// ============================================================================
// RANDY RIG — hand-drawn triceratops. Faces right.
// `body` is the torso center. Feet are positioned relative to the origin.
// headPitch > 0 lowers the head (horns forward, frill up like a shield).
// ============================================================================
import { add, rotate, solveLimb } from '../../graphics/ink.js';

const C = {
    skin: '#62a34c', skinShade: '#467d36', far: '#4f8a3d', farShade: '#3a6a2c',
    belly: '#d9e5a3', bellyShade: '#b9c97f', spot: '#3f7231',
    frill: '#ec9440', frillShade: '#c66d20', frillRim: '#f7c56e', frillSpot: '#c66d20',
    horn: '#f7f0da', hornShade: '#d7caa5', beak: '#7a5a3a', beakShade: '#5c4129',
    mouth: '#5a1a14', white: '#fffdf5', nail: '#efe6c8'
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function eye(ctx, ink, [x, y], kind) {
    if (kind === 'shut') return ink.line(ctx, [[x - 5, y], [x, y + 2.5], [x + 5, y]], { width: 2.6 });
    if (kind === 'dizzy') {
        ink.line(ctx, [[x - 4, y - 4], [x + 4, y + 4]], { width: 2.6 });
        ink.line(ctx, [[x + 4, y - 4], [x - 4, y + 4]], { width: 2.6 });
        return;
    }
    ink.fill(ctx, ink.ellipse(x, y, 5.5, 6, 0, 8), C.white, { lineWidth: 2.2 });
    ink.dot(ctx, x + 2, y + 1, 2.8);
    ink.dot(ctx, x + 1, y - 1, 0.9, C.white);
    const browTilt = kind === 'angry' ? 5 : 1;
    ink.line(ctx, [[x - 8, y - 9], [x + 7, y - 9 + browTilt]], { width: 3.6 });
}

/** A tapered horn from base (width w) to tip. */
function horn(ctx, ink, base, tip, w, color, shade) {
    const d = [tip[0] - base[0], tip[1] - base[1]];
    const len = Math.hypot(d[0], d[1]) || 1;
    const n = [-d[1] / len * w, d[0] / len * w];
    const mid = [base[0] + d[0] * 0.55, base[1] + d[1] * 0.55];
    ink.fill(ctx, ink.closedCurve([add(base, n), add(mid, [n[0] * 0.55, n[1] * 0.55]), tip, add(mid, [-n[0] * 0.5, -n[1] * 0.5]), [base[0] - n[0], base[1] - n[1]]], 0.5), color, { shade, shadeOffset: [1, 2], lineWidth: 2.6 });
}

function leg(ctx, ink, hip, foot, color, shade) {
    const [knee, end] = solveLimb(hip, foot, 26, 24, -1);
    ink.limb(ctx, [hip, knee, end], 22, color);
    ink.fill(ctx, ink.ellipse(end[0] + 2, end[1] - 6, 15, 7.5, 0, 10), color, { shade, shadeOffset: [2, 2] });
    for (const dx of [-6, 2, 10]) ink.fill(ctx, ink.ellipse(end[0] + dx, end[1] - 2, 3, 2.4, 0, 6), C.nail, { lineWidth: 1.6 });
}

export const randyRig = {
    canvas: { width: 360, height: 260, originX: 180, originY: 245 },
    portrait: { x: 70, y: -86, scale: 0.95 },
    previewScale: 0.78, // menus draw Randy smaller so the big lizard fits the cards
    stepFrames: 20,
    ink: { lineWidth: 3.6 },

    basePose: {
        root: [0, 0], rootRotate: 0,
        body: [-8, -64], lean: 0, head: [0, 0], headPitch: 0, jaw: 0, eyes: 'open', tail: 0,
        fb: [-34, 0], nb: [-44, 0], ff: [40, 0], nf: [30, 0]
    },

    cycles: {
        idle: (t) => {
            const b = Math.sin(t * 0.06);
            return { body: [-8, -64 + b * 1.6], head: [0, b * 2], headPitch: b * 0.03, tail: Math.sin(t * 0.05) * 0.12 };
        },
        // Heavy trot: diagonal leg pairs move together.
        walking: (t) => {
            const a = (t / 40) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
            const liftA = Math.max(0, c) * 10, liftB = Math.max(0, -c) * 10;
            return {
                body: [-8, -64 - Math.abs(c) * 3], head: [0, Math.abs(s) * 3], headPitch: s * 0.05, tail: -s * 0.15,
                nb: [-44 + s * 12, -liftA], ff: [40 + s * 12, -liftA],
                fb: [-34 - s * 12, -liftB], nf: [30 - s * 12, -liftB]
            };
        },
        hitstun: (t) => ({
            body: [-14, -62], lean: -0.12, head: [-10, -6], headPitch: -0.35 + Math.sin(t * 0.9) * 0.06,
            eyes: 'dizzy', jaw: 0.6, tail: 0.3
        }),
        // Rearing roar.
        victory: (t) => {
            const r = Math.sin(t * 0.1);
            return {
                rootRotate: -0.16 + r * 0.04, body: [-12, -66], head: [4, -12], headPitch: -0.5 + r * 0.1, jaw: 0.9, eyes: 'shut',
                ff: [46, -22 - r * 6], nf: [38, -18 + r * 6], tail: 0.25
            };
        }
    },

    poses: {
        crouching: { body: [-8, -50], lean: 0.08, head: [6, 12], headPitch: 0.35, fb: [-40, 0], nb: [-50, 0], ff: [46, 0], nf: [36, 0] },
        jumping: { body: [-8, -70], head: [2, -6], headPitch: -0.1, fb: [-44, -18], nb: [-52, -14], ff: [46, -18], nf: [36, -14], tail: 0.3 },
        falling: { body: [-8, -68], head: [0, -4], headPitch: -0.15, fb: [-38, 0], nb: [-48, 4], ff: [44, 0], nf: [34, 4], tail: -0.2 },
        blocking: { body: [-12, -60], lean: 0.05, head: [6, 8], headPitch: 0.75, eyes: 'angry', fb: [-38, 0], nb: [-48, 0], ff: [40, 0], nf: [30, 0] },
        getup: { body: [-8, -52], head: [4, 10], headPitch: 0.3, eyes: 'shut', fb: [-40, 0], nb: [-50, 0], ff: [46, 0], nf: [36, 0] },
        knockdown: {
            root: [0, -114], rootRotate: 3.0, body: [-8, -64], head: [4, 6], headPitch: 0.2, eyes: 'dizzy', jaw: 0.7, tail: -0.4,
            fb: [-34, -6], nb: [-46, 6], ff: [42, -6], nf: [30, 6]
        },
        defeat: {
            root: [0, -114], rootRotate: 3.0, body: [-8, -64], head: [4, 8], headPitch: 0.3, eyes: 'dizzy', jaw: 0.4, tail: -0.5,
            fb: [-30, 4], nb: [-46, 10], ff: [40, 4], nf: [28, 10]
        },

        attack_windup: { body: [-14, -60], lean: -0.08, head: [-12, 10], headPitch: 0.5, eyes: 'angry', fb: [-40, 0], nb: [-50, 0], ff: [36, 0], nf: [26, 0], tail: 0.25 },
        attack_strike: { body: [4, -62], lean: 0.04, head: [18, -2], headPitch: -0.25, jaw: 0.35, eyes: 'angry', fb: [-30, 0], nb: [-40, 0], ff: [52, 0], nf: [42, 0], tail: -0.2 },
        crouch_windup: { body: [-12, -50], lean: 0.05, head: [-6, 14], headPitch: 0.4, eyes: 'angry', fb: [-42, 0], nb: [-52, 0], ff: [44, 0], nf: [34, 0] },
        crouch_attack: { body: [0, -48], lean: 0.08, head: [24, 18], headPitch: 0.45, jaw: 0.3, eyes: 'angry', fb: [-36, 0], nb: [-46, 0], ff: [54, 0], nf: [44, 0] },
        air_windup: { body: [-8, -72], lean: -0.1, head: [-4, -8], headPitch: -0.2, eyes: 'angry', fb: [-44, -18], nb: [-52, -14], ff: [44, -20], nf: [34, -16] },
        air_attack: { body: [-8, -66], lean: 0.15, head: [8, 6], headPitch: 0.3, jaw: 0.4, eyes: 'angry', fb: [-30, 4], nb: [-42, 6], ff: [50, 4], nf: [40, 6], tail: 0.4 },
        attack_rear: { rootRotate: -0.28, body: [-12, -70], head: [0, -10], headPitch: -0.35, jaw: 0.6, eyes: 'angry', ff: [46, -30], nf: [38, -24], tail: 0.35 },
        attack_charge: { body: [0, -56], lean: 0.1, head: [22, 14], headPitch: 0.65, eyes: 'angry', fb: [-46, 0], nb: [-54, -8], ff: [56, -6], nf: [46, 0], tail: 0.3 },
        attack_toss: { body: [-4, -66], lean: -0.1, head: [12, -20], headPitch: -0.85, jaw: 0.4, eyes: 'angry', ff: [44, -10], nf: [36, 0], tail: -0.2 },
        // Tail swung hard behind (back air)
        tail_swat: { rootRotate: 0.1, body: [-10, -66], lean: 0.12, head: [-4, 4], headPitch: 0.2, eyes: 'angry', jaw: 0.3, tail: -0.6, fb: [-44, -12], nb: [-54, -6], ff: [40, -10], nf: [30, -6] }
    },

    draw(ctx, p, ink) {
        ctx.translate(p.root[0], p.root[1]);
        ctx.rotate(p.rootRotate);
        const swing = clamp(-p.motion[0] * 0.03 + p.motion[1] * 0.03, -0.5, 0.5);
        const { body, lean } = p;
        const B = (x, y) => add(body, rotate([x, y], lean));
        const pitch = p.headPitch + lean;
        const S = 1.3; // head scale: triceratops heads are huge
        const headC = add(B(68, -20), p.head);
        const H = (x, y) => add(headC, rotate([x * S, y * S], pitch));

        // Tail
        const tb = B(-52, -4), ta = p.tail + swing;
        ink.limb(ctx, [tb, add(tb, rotate([-20, 4], ta)), add(tb, rotate([-34, 10], ta))], 20, C.skin);
        ink.limb(ctx, [add(tb, rotate([-30, 9], ta)), add(tb, rotate([-50, 16], ta))], 9, C.skin);

        // Far legs
        leg(ctx, ink, add(B(-30, 18), [8, -4]), p.fb, C.far, C.farShade);
        leg(ctx, ink, add(B(30, 18), [8, -4]), p.ff, C.far, C.farShade);

        // Torso
        ink.fill(ctx, ink.ellipse(body[0], body[1], 56, 34, lean, 14), C.skin, { shade: C.skinShade, shadeOffset: [5, 6] });
        ink.fill(ctx, ink.ellipse(...B(4, 18), 40, 12, lean, 12), C.belly, { shade: C.bellyShade, shadeOffset: [2, 3], lineWidth: 2.2 });
        for (const [x, y, r] of [[-26, -18, 5], [-8, -24, 6], [12, -20, 5], [-16, -6, 4], [4, -8, 4.5], [26, -10, 4]]) {
            ink.fill(ctx, ink.ellipse(...B(x, y), r, r * 0.7, lean, 7), C.spot, { outline: false });
        }

        // Near legs
        leg(ctx, ink, B(-38, 20), p.nb, C.skin, C.skinShade);
        leg(ctx, ink, B(28, 20), p.nf, C.skin, C.skinShade);

        // Neck
        ink.limb(ctx, [B(40, -6), add(headC, rotate([-14, 8], pitch))], 38, C.skin);

        // Frill: a scalloped fan behind the skull
        const fc = H(-10, -6);
        const frillPts = [];
        const steps = 11;
        for (let i = 0; i <= steps; i++) {
            const a = -2.75 + (i / steps) * 2.55 + pitch;
            const r = (i % 2 === 0 ? 42 : 36) * S;
            frillPts.push(add(fc, [Math.cos(a) * r, Math.sin(a) * r]));
        }
        frillPts.push(H(6, 10), H(-18, 10));
        ink.fill(ctx, ink.closedCurve(frillPts), C.frill, { shade: C.frillShade, shadeOffset: [4, 5] });
        for (let i = 1; i < steps; i += 2) {
            const a = -2.75 + (i / steps) * 2.55 + pitch;
            ink.fill(ctx, ink.ellipse(...add(fc, [Math.cos(a) * 28 * S, Math.sin(a) * 28 * S]), 4 * S, 3 * S, a, 6), C.frillSpot, { outline: false });
        }
        ink.line(ctx, frillPts.slice(1, steps).map(([x, y]) => [x + (fc[0] - x) * 0.12, y + (fc[1] - y) * 0.12]), { width: 2.4, color: C.frillRim });

        // Far brow horn (shaded), skull, beak, jaw
        horn(ctx, ink, H(2, -12), H(44, -40), 5 * S, C.hornShade, C.hornShade);
        if (p.jaw > 0.05) ink.fill(ctx, ink.ellipse(...H(18, 14 + p.jaw * 4), 15 * S, (3 + p.jaw * 6) * S, pitch, 10), C.mouth, { lineWidth: 2.4 });
        ink.fill(ctx, ink.ellipse(...H(16, 16 + p.jaw * 8), 15 * S, 6 * S, pitch + p.jaw * 0.25, 10), C.skin, { shade: C.skinShade, shadeOffset: [2, 3] });
        ink.fill(ctx, ink.ellipse(headC[0], headC[1], 27 * S, 19 * S, pitch, 12), C.skin, { shade: C.skinShade, shadeOffset: [3, 4] });
        ink.fill(ctx, ink.closedCurve([H(22, -6), H(36, -2), H(42, 8), H(36, 14), H(24, 12)]), C.beak, { shade: C.beakShade, shadeOffset: [2, 2] });
        horn(ctx, ink, H(28, -8), H(36, -22), 4.5 * S, C.horn, C.hornShade); // nose horn
        eye(ctx, ink, H(4, -3), p.eyes);
        ink.dot(ctx, ...H(32, 2), 1.4);
        horn(ctx, ink, H(-2, -12), H(42, -34), 6 * S, C.horn, C.hornShade); // near brow horn
    }
};

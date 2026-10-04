// ============================================================================
// QUACKERS RIG — hand-drawn round duck. Faces right.
// Wing tips are positioned relative to their shoulder; feet relative to the origin.
// ============================================================================
import { add, rotate, solveLimb } from '../../graphics/ink.js';

const C = {
    body: '#f7cf2e', bodyShade: '#d9a91a', far: '#e0b21f', farShade: '#b88d12',
    belly: '#fff0b8', bellyShade: '#f3d77c', bill: '#f08a24', billShade: '#c96510',
    billLow: '#d9701a', mouth: '#6b2a12', leg: '#f08a24', legShade: '#c96510', white: '#fffdf5'
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function eye(ctx, ink, [x, y], kind) {
    if (kind === 'shut') return ink.line(ctx, [[x - 5, y], [x, y + 2.5], [x + 5, y]], { width: 2.4 });
    if (kind === 'happy') return ink.line(ctx, [[x - 5, y + 2], [x, y - 3], [x + 5, y + 2]], { width: 2.6 });
    if (kind === 'dizzy') {
        ink.line(ctx, [[x - 4, y - 4], [x + 4, y + 4]], { width: 2.4 });
        ink.line(ctx, [[x + 4, y - 4], [x - 4, y + 4]], { width: 2.4 });
        return;
    }
    ink.fill(ctx, ink.ellipse(x, y, 6, 7, 0, 8), C.white, { lineWidth: 2.2 });
    ink.dot(ctx, x + 2, y + 1, 3.2);
    ink.dot(ctx, x + 1, y - 1, 1, C.white);
    if (kind === 'angry') ink.line(ctx, [[x - 7, y - 11], [x + 7, y - 6]], { width: 3.4 });
}

/** A wing: a feathered teardrop from the shoulder to the tip. */
function wing(ctx, ink, shoulder, tip, color, shade) {
    const d = [tip[0] - shoulder[0], tip[1] - shoulder[1]];
    const len = Math.hypot(d[0], d[1]) || 1;
    const n = [-d[1] / len, d[0] / len];
    const at = (t, w) => [shoulder[0] + d[0] * t + n[0] * w, shoulder[1] + d[1] * t + n[1] * w];
    ink.fill(ctx, ink.closedCurve([at(-0.1, 7), at(0.45, 11), at(0.85, 7), at(1.05, 0), at(0.85, -4), at(0.45, -7), at(-0.1, -6)]), color, { shade, shadeOffset: [2, 3] });
    ink.line(ctx, [at(0.62, 6), at(0.92, 2)], { width: 1.8 });
    ink.line(ctx, [at(0.52, 2), at(0.85, -1)], { width: 1.8 });
}

function legAndFoot(ctx, ink, hip, foot, color, shade) {
    const [knee, end] = solveLimb(hip, foot, 15, 14, -1);
    ink.limb(ctx, [hip, knee, end], 5, color);
    // Webbed foot: a fan pointing forward
    ink.fill(ctx, ink.closedCurve([[end[0] - 4, end[1] - 3], [end[0] + 6, end[1] - 4], [end[0] + 15, end[1] - 1], [end[0] + 12, end[1] + 1], [end[0] - 3, end[1] + 1]], 0.6), color, { shade, shadeOffset: [1, 2], lineWidth: 2.6 });
}

export const quackersRig = {
    canvas: { width: 240, height: 200, originX: 120, originY: 190 },
    portrait: { x: 14, y: -76, scale: 1.45 },
    stepFrames: 11,

    basePose: {
        root: [0, 0], rootRotate: 0,
        hip: [0, -30], lean: 0, head: [0, 0], headTilt: 0, bill: 0, eyes: 'open',
        wingBack: [-16, 14], wingFront: [-12, 18],
        footBack: [-8, 0], footFront: [8, 0], tuft: 0
    },

    cycles: {
        idle: (t) => {
            const b = Math.sin(t * 0.1);
            return { hip: [0, -30 + b * 1.5], head: [0, b], wingFront: [-12, 18 + b * 2], wingBack: [-16, 14 + b * 2], tuft: Math.sin(t * 0.07) * 0.3 };
        },
        walking: (t) => {
            const a = (t / 22) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
            return {
                rootRotate: s * 0.07, hip: [0, -30 - Math.abs(c) * 2], lean: 0.05,
                footBack: [-2 + s * 10, -Math.max(0, c) * 7], footFront: [2 - s * 10, -Math.max(0, -c) * 7],
                wingFront: [-16, 10 + s * 4], wingBack: [-20, 6 - s * 4]
            };
        },
        // Wings beat while rising.
        jumping: (t) => {
            const flap = Math.sin(t * 0.7);
            return {
                hip: [0, -32], lean: -0.05, footBack: [-10, -10], footFront: [4, -12], bill: 0.2, tuft: -0.8,
                wingFront: [-6, -16 + flap * 16], wingBack: [-12, -12 + flap * 14]
            };
        },
        hitstun: (t) => ({
            hip: [-5, -30], lean: -0.35, head: [-6, 0], headTilt: -0.4 + Math.sin(t * 0.9) * 0.08,
            eyes: 'dizzy', bill: 0.6, wingFront: [-20, -20], wingBack: [10, -24], tuft: -1
        }),
        victory: (t) => {
            const hop = Math.abs(Math.sin(t * 0.14));
            return {
                hip: [0, -32 - hop * 8], footBack: [-8, -hop * 8], footFront: [8, -hop * 8],
                wingFront: [-2, -30 + Math.sin(t * 0.5) * 8], wingBack: [-8, -28 - Math.sin(t * 0.5) * 8],
                bill: 0.6, eyes: 'happy', tuft: Math.sin(t * 0.3) * 0.6
            };
        },
        // Feather Fury: a blur of wing slaps.
        flurry: (t) => ({
            lean: 0.15, eyes: 'angry', bill: 0.3, tuft: -0.5,
            wingFront: [22 + Math.sin(t * 1.3) * 12, -8 + Math.cos(t * 1.3) * 12],
            wingBack: [18 + Math.cos(t * 1.3) * 12, -6 + Math.sin(t * 1.3) * 12]
        })
    },

    poses: {
        crouching: { hip: [0, -18], lean: 0.25, head: [4, 10], wingFront: [-14, 10], wingBack: [-16, 8], footBack: [-12, 0], footFront: [12, 0] },
        falling: { hip: [0, -31], footBack: [-6, 0], footFront: [10, -2], wingFront: [-4, -26], wingBack: [-10, -20], bill: 0.4, tuft: -0.6 },
        blocking: { hip: [-2, -29], lean: -0.1, head: [-4, 6], wingFront: [14, -26], wingBack: [-14, 10], eyes: 'angry', footBack: [-12, 0], footFront: [8, 0] },
        getup: { hip: [0, -20], lean: 0.2, head: [3, 8], eyes: 'shut', footBack: [-12, 0], footFront: [12, 0] },
        knockdown: {
            root: [36, -20], rootRotate: -1.45, eyes: 'dizzy', bill: 0.5, tuft: 1,
            footFront: [30, -40], footBack: [24, -28], wingFront: [16, -20], wingBack: [10, -24]
        },
        defeat: {
            root: [36, -20], rootRotate: -1.45, eyes: 'dizzy', bill: 0.3, tuft: 1.2,
            footFront: [28, -36], footBack: [22, -26], wingFront: [12, 8], wingBack: [8, 4]
        },

        attack_windup: { lean: -0.15, head: [-6, 0], wingFront: [-24, -6], wingBack: [-18, 10], eyes: 'angry', tuft: 0.5, footFront: [12, 0], footBack: [-10, 0] },
        attack_strike: { lean: 0.2, head: [3, 2], bill: 0.3, wingFront: [34, -4], wingBack: [-20, 8], eyes: 'angry', tuft: -0.4, footFront: [14, 0], footBack: [-8, 0] },
        attack_quack: { lean: 0.1, head: [10, -4], headTilt: -0.3, bill: 1, wingFront: [-26, -14], wingBack: [-22, -18], eyes: 'angry', tuft: -1.1 },
        crouch_windup: { hip: [0, -18], lean: 0.15, head: [-4, 8], wingFront: [-14, 10], wingBack: [-16, 8], footBack: [-12, 0], footFront: [12, 0], eyes: 'angry' },
        crouch_attack: { hip: [-2, -18], lean: 0.6, head: [16, 18], headTilt: 0.5, bill: 0.4, wingFront: [-10, 6], wingBack: [-14, 4], eyes: 'angry', footBack: [-14, 0], footFront: [10, 0] },
        air_windup: { hip: [0, -32], lean: -0.15, footBack: [-10, -16], footFront: [-4, -18], wingFront: [-6, -26], wingBack: [-12, -22], eyes: 'angry' },
        air_attack: { hip: [0, -32], lean: -0.2, footBack: [10, -10], footFront: [26, -14], wingFront: [-6, -26], wingBack: [-12, -22], eyes: 'angry', bill: 0.4, tuft: -0.8 },
        dive: { hip: [0, -32], lean: 0.9, head: [14, 12], headTilt: 0.6, footBack: [-14, -24], footFront: [-8, -28], wingFront: [-28, -4], wingBack: [-26, -8], eyes: 'angry', bill: 0.2, tuft: -1.2 },

        // Smash-style moves
        beak_up: { lean: -0.25, head: [4, -10], headTilt: -0.8, bill: 0.8, wingFront: [-20, -10], wingBack: [-16, -6], eyes: 'angry', tuft: -1, footFront: [10, 0], footBack: [-8, 0] },
        belly_flop: { root: [0, -6], rootRotate: 0.9, lean: 0.3, head: [10, 6], bill: 0.4, wingFront: [20, -20], wingBack: [14, -24], footBack: [-16, -10], footFront: [-12, -14], eyes: 'angry', tuft: -1 },
        tail_waggle: { hip: [-4, -32], lean: -0.3, head: [-6, 2], headTilt: -0.2, wingFront: [-24, -8], wingBack: [-20, -12], footBack: [-18, -14], footFront: [-10, -16], eyes: 'angry', bill: 0.3, tuft: 0.8 },
        // Wings spread wide while gliding
        glide: { hip: [0, -31], lean: 0.2, head: [4, 2], wingFront: [-2, -34], wingBack: [-16, -30], footBack: [-12, -2], footFront: [-6, -4], bill: 0.1, tuft: -0.9 }
    },

    draw(ctx, p, ink) {
        ctx.translate(p.root[0], p.root[1]);
        ctx.rotate(p.rootRotate);
        const swing = clamp(-p.motion[0] * 0.07 + p.motion[1] * 0.06, -1, 1);
        const { hip, lean } = p;
        const bodyC = add(hip, rotate([0, -18], lean));
        const shoulderBack = add(hip, rotate([-4, -28], lean));
        const shoulderFront = add(hip, rotate([4, -26], lean));
        const neck = add(hip, rotate([6, -40], lean));
        const headC = add(add(neck, [0, -12]), p.head);
        const tilt = p.headTilt + lean * 0.4;
        const H = (x, y) => add(headC, rotate([x, y], tilt));

        // Far wing and leg
        wing(ctx, ink, shoulderBack, add(shoulderBack, p.wingBack), C.far, C.farShade);
        legAndFoot(ctx, ink, add(hip, [-6, 0]), p.footBack, C.legShade, C.legShade);

        // Tail feathers
        const tail = add(bodyC, rotate([-24, -6], lean));
        ink.fill(ctx, ink.closedCurve([add(tail, [6, -6]), add(tail, [-10, -14 - swing * 4]), add(tail, [-8, -6]), add(tail, [-12, 0]), add(tail, [6, 6])]), C.bodyShade);

        // Body
        ink.fill(ctx, ink.ellipse(bodyC[0], bodyC[1], 26, 24, lean, 12), C.body, { shade: C.bodyShade, shadeOffset: [4, 5] });
        ink.fill(ctx, ink.ellipse(...add(bodyC, rotate([8, 6], lean)), 14, 15, lean, 10), C.belly, { shade: C.bellyShade, shadeOffset: [2, 3], lineWidth: 2.2 });

        // Near leg
        legAndFoot(ctx, ink, add(hip, [6, 0]), p.footFront, C.leg, C.legShade);

        // Head
        ink.fill(ctx, ink.ellipse(headC[0], headC[1], 17, 16, tilt, 12), C.body, { shade: C.bodyShade, shadeOffset: [3, 3] });
        const open = p.bill;
        if (open > 0.05) ink.fill(ctx, ink.ellipse(...H(20, 5 + open * 3), 9, 2 + open * 5, tilt, 8), C.mouth, { lineWidth: 2.2 });
        ink.fill(ctx, ink.ellipse(...H(21, 6 + open * 7), 11, 3.5, tilt + open * 0.3, 9), C.billLow, { lineWidth: 2.4 });
        ink.fill(ctx, ink.ellipse(...H(22, 2 - open * 2), 13, 5, tilt - open * 0.3, 10), C.bill, { shade: C.billShade, shadeOffset: [1, 2] });
        ink.dot(ctx, ...H(27, 0 - open * 2), 1.2);
        eye(ctx, ink, H(5, -4), p.eyes);
        // Head tuft (curly feathers that lag behind movement)
        const tuftBase = H(-3, -15);
        const ta = p.tuft + swing;
        ink.line(ctx, [tuftBase, add(tuftBase, rotate([-2, -8], ta)), add(tuftBase, rotate([4, -12], ta))], { width: 3 });
        ink.line(ctx, [tuftBase, add(tuftBase, rotate([-6, -6], ta)), add(tuftBase, rotate([-6, -11], ta))], { width: 2.6 });

        // Near wing
        wing(ctx, ink, shoulderFront, add(shoulderFront, p.wingFront), C.body, C.bodyShade);
    }
};

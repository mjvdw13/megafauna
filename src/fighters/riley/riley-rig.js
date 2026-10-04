// ============================================================================
// RILEY RIG — hand-drawn cartoon dog, boxer stance. Faces right.
// Coordinates: origin at the feet on the ground, y negative is up.
// Hands are positioned relative to their shoulder; feet relative to the origin.
// ============================================================================
import { add, rotate, solveLimb } from '../../graphics/ink.js';

const C = {
    fur: '#de6a42', furShade: '#b44a2c', farFur: '#b9502f', farShade: '#8f3a22',
    belly: '#f8dcb3', bellyShade: '#e6b98a', ear: '#8e3624', earShade: '#6e2819',
    nose: '#2a1d17', mouth: '#5a1a14', tongue: '#f08a96', white: '#fffaf0'
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
    ink.fill(ctx, ink.ellipse(x, y, 5.5, 6.8, 0, 8), C.white, { lineWidth: 2.2 });
    ink.dot(ctx, x + 2, y + 1, 2.9);
    ink.dot(ctx, x + 1, y - 1, 0.9, C.white);
    if (kind === 'angry') ink.line(ctx, [[x - 7, y - 10], [x + 7, y - 5]], { width: 3.4 });
}

/** Floppy ear: a teardrop hanging from `base` in direction `angle`. */
function ear(ctx, ink, base, angle, color, shade) {
    const pts = [[0, -5], [9, -7.5], [19, -5], [25, 0], [19, 6], [9, 7.5], [0, 5]].map((p) => add(base, rotate(p, angle)));
    ink.fill(ctx, ink.closedCurve(pts), color, { shade, shadeOffset: [2, 3] });
}

function leg(ctx, ink, hip, foot, color, shade) {
    const [knee, end] = solveLimb(hip, foot, 27, 26, -1);
    ink.limb(ctx, [hip, knee, end], 13, color);
    ink.fill(ctx, ink.ellipse(end[0] + 5, end[1] - 5, 11.5, 6, 0, 9), color, { shade, shadeOffset: [2, 2] });
}

function arm(ctx, ink, shoulder, hand, color, shade) {
    const [elbow, end] = solveLimb(shoulder, hand, 18, 18, 1);
    ink.limb(ctx, [shoulder, elbow, end], 10, color);
    ink.fill(ctx, ink.ellipse(end[0], end[1], 8.5, 8, 0, 9), color, { shade, shadeOffset: [2, 2] });
    ink.line(ctx, [[end[0] + 3, end[1] - 5], [end[0] + 6, end[1] - 1]], { width: 1.8 });
}

export const rileyRig = {
    canvas: { width: 280, height: 220, originX: 140, originY: 205 },
    portrait: { x: 20, y: -108, scale: 1.25 },
    stepFrames: 13,

    basePose: {
        root: [0, 0], rootRotate: 0,
        hip: [0, -50], lean: 0.12, head: [3, 0], headTilt: 0,
        footBack: [-14, 0], footFront: [14, 0],
        handBack: [16, 10], handFront: [22, 4],
        mouth: 0, eyes: 'open', ears: 0, tail: 0.3
    },

    cycles: {
        idle: (t) => {
            const b = Math.sin(t * 0.08);
            return { hip: [0, -50 + b * 1.2], head: [3, b * 0.8], handFront: [22, 4 + b * 1.6], handBack: [16, 10 + b], tail: 0.3 + Math.sin(t * 0.18) * 0.35 };
        },
        walking: (t) => {
            const a = (t / 26) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
            return {
                hip: [0, -50 - Math.abs(c) * 2.5], lean: 0.16, head: [3, Math.abs(c)],
                footBack: [-4 + s * 14, -Math.max(0, c) * 9], footFront: [4 - s * 14, -Math.max(0, -c) * 9],
                handFront: [20 + s * 4, 6], handBack: [14 - s * 4, 10], tail: 0.4 + Math.sin(t * 0.3) * 0.4
            };
        },
        hitstun: (t) => ({
            hip: [-6, -49], lean: -0.3, head: [-5, 2], headTilt: -0.35 + Math.sin(t * 0.9) * 0.08,
            eyes: 'dizzy', mouth: 0.6, handFront: [-4, -8], handBack: [-12, 4], ears: -0.7, tail: 1,
            footFront: [16, 0], footBack: [-14, 0]
        }),
        victory: (t) => {
            const hop = Math.abs(Math.sin(t * 0.12));
            return {
                hip: [0, -52 - hop * 6], lean: -0.05, handFront: [6, -38 + hop * 4], handBack: [14, 10],
                footBack: [-12, -hop * 6], footFront: [12, -hop * 6],
                eyes: 'happy', mouth: 0.8, tail: Math.sin(t * 0.5) * 0.7, ears: -0.3 + hop * 0.5
            };
        },
        // Spinning tail swipe: arms flung out, body twisting.
        spin: (t) => ({
            lean: Math.sin(t * 0.8) * 0.1, handFront: [32, -4], handBack: [-30, -2], tail: 1.4,
            eyes: 'angry', mouth: 0.3, ears: -0.6
        })
    },

    poses: {
        crouching: { hip: [0, -30], lean: 0.38, head: [5, 4], handFront: [20, 0], handBack: [16, 6], footBack: [-17, 0], footFront: [15, 0], ears: 0.25 },
        jumping: { hip: [0, -54], lean: 0, footBack: [-16, -16], footFront: [8, -20], handFront: [16, -10], handBack: [10, -14], ears: -0.9, mouth: 0.25, tail: 0.9 },
        falling: { hip: [0, -52], lean: 0.05, footBack: [-12, 0], footFront: [12, -4], handFront: [10, -24], handBack: [2, -22], ears: -0.5, mouth: 0.4 },
        blocking: { hip: [-3, -48], lean: -0.08, head: [-3, 4], headTilt: 0.15, handFront: [12, -14], handBack: [16, -8], eyes: 'angry', ears: 0.4, footFront: [12, 0], footBack: [-17, 0] },
        getup: { hip: [0, -34], lean: 0.3, head: [4, 4], handFront: [18, 10], handBack: [14, 14], footBack: [-15, 0], footFront: [15, 0], eyes: 'shut' },
        knockdown: {
            root: [44, -22], rootRotate: -1.5, hip: [0, -50], lean: 0, head: [0, 2], headTilt: 0.2,
            footFront: [38, -58], footBack: [32, -40], handFront: [24, -6], handBack: [20, 4],
            eyes: 'dizzy', mouth: 0.7, ears: 1.2, tail: 1
        },
        defeat: {
            root: [44, -22], rootRotate: -1.5, hip: [0, -50], lean: 0, head: [0, 2], headTilt: 0.25,
            footFront: [30, -50], footBack: [26, -36], handFront: [16, 4], handBack: [14, 10],
            eyes: 'dizzy', mouth: 0.5, ears: 1.3, tail: 1.2
        },

        // Attacks: windup (anticipation) → strike (extension)
        attack_windup: { hip: [-4, -49], lean: -0.06, head: [-3, 1], handFront: [-6, 8], handBack: [18, 0], eyes: 'angry', ears: 0.35, footBack: [-18, 0], footFront: [16, 0], tail: 0.8 },
        attack_strike: { hip: [6, -48], lean: 0.32, head: [8, 3], headTilt: 0.1, handFront: [38, -6], handBack: [8, 14], eyes: 'angry', mouth: 0.45, ears: 0.7, footBack: [-16, 0], footFront: [24, 0], tail: 0.1 },
        headbutt: { hip: [8, -46], lean: 0.55, head: [12, 8], headTilt: 0.35, handFront: [6, 16], handBack: [2, 18], eyes: 'angry', mouth: 0.2, ears: -0.6, footFront: [22, 0], footBack: [-20, 0], tail: 0 },
        bark: { lean: 0.22, head: [9, -3], headTilt: -0.3, mouth: 1, eyes: 'angry', ears: -0.8, handFront: [10, 14], handBack: [6, 16], footFront: [18, 0], footBack: [-16, 0] },
        crouch_windup: { hip: [0, -30], lean: 0.3, head: [2, 4], handFront: [18, 4], handBack: [14, 8], footBack: [-17, 0], footFront: [4, -6], eyes: 'angry', ears: 0.3 },
        crouch_attack: { hip: [-6, -30], lean: 0.15, head: [2, 2], handFront: [14, 6], handBack: [10, 10], footBack: [-16, 0], footFront: [44, -3], eyes: 'angry', mouth: 0.3, ears: 0.5 },
        air_windup: { hip: [0, -54], lean: -0.1, handFront: [-4, 2], handBack: [0, -4], footBack: [-14, -16], footFront: [6, -18], eyes: 'angry', ears: -0.6 },
        air_attack: { hip: [0, -54], lean: 0.35, handFront: [34, 16], handBack: [28, 22], footBack: [-18, -14], footFront: [4, -18], eyes: 'angry', mouth: 0.5, ears: -0.5, tail: 1 },

        // Smash-style moves
        bite: { hip: [6, -48], lean: 0.38, head: [12, 2], headTilt: 0.15, mouth: 1, eyes: 'angry', ears: -0.7, handFront: [16, 12], handBack: [8, 16], footFront: [22, 0], footBack: [-16, 0], tail: 0 },
        ear_flick: { hip: [0, -52], lean: -0.15, head: [2, -8], headTilt: -0.7, ears: -1.4, mouth: 0.3, eyes: 'angry', handFront: [14, -6], handBack: [10, 0], footFront: [10, 0], footBack: [-14, 0], tail: 1 },
        slide: { hip: [8, -34], lean: 0.9, head: [14, 8], headTilt: 0.3, handFront: [34, 10], handBack: [28, 16], footFront: [18, 0], footBack: [-30, -4], ears: -1, mouth: 0.4, eyes: 'angry', tail: 1.2 },
        tail_whip: { hip: [-4, -52], lean: -0.25, head: [-6, 0], headTilt: -0.2, tail: 1.6, handFront: [-6, -6], handBack: [-16, 0], footBack: [-22, -14], footFront: [4, -16], eyes: 'angry', mouth: 0.3, ears: 0.6 },
        stomp: { hip: [0, -58], lean: 0.05, footFront: [10, 12], footBack: [-6, 10], handFront: [8, -28], handBack: [0, -26], eyes: 'angry', mouth: 0.5, ears: -1, tail: 0.9 }
    },

    draw(ctx, p, ink) {
        ctx.translate(p.root[0], p.root[1]);
        ctx.rotate(p.rootRotate);
        const swing = clamp(-p.motion[0] * 0.06 + p.motion[1] * 0.05, -0.9, 0.9);
        const { hip, lean } = p;
        const neck = add(hip, rotate([0, -44], lean));
        const mid = [(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2];
        const shoulderBack = add(neck, rotate([-5, 9], lean));
        const shoulderFront = add(neck, rotate([5, 11], lean));
        const headC = add(add(neck, rotate([2, -16], lean * 0.5)), p.head);
        const tilt = p.headTilt + lean * 0.3;
        const H = (x, y) => add(headC, rotate([x, y], tilt));

        // Tail
        const tailBase = add(hip, rotate([-16, -8], lean));
        const ta = p.tail + swing * 0.6;
        ink.limb(ctx, [tailBase, add(tailBase, rotate([-10, -8], ta)), add(tailBase, rotate([-13, -22], ta))], 9, C.fur);

        // Far limbs and ear (darker, behind the body)
        leg(ctx, ink, add(hip, [-7, 2]), p.footBack, C.farFur, C.farShade);
        arm(ctx, ink, shoulderBack, add(shoulderBack, p.handBack), C.farFur, C.farShade);
        ear(ctx, ink, H(-9, -14), tilt + 2.3 + p.ears + swing, C.earShade, C.earShade);

        // Torso and belly
        ink.fill(ctx, ink.ellipse(mid[0], mid[1], 21, 30, lean, 12), C.fur, { shade: C.furShade, shadeOffset: [4, 5] });
        ink.fill(ctx, ink.ellipse(...add(mid, rotate([7, 5], lean)), 12, 20, lean, 10), C.belly, { shade: C.bellyShade, shadeOffset: [2, 3], lineWidth: 2.2 });

        // Near leg
        leg(ctx, ink, add(hip, [7, 2]), p.footFront, C.fur, C.furShade);

        // Head
        ink.fill(ctx, ink.ellipse(headC[0], headC[1], 20, 18, tilt, 12), C.fur, { shade: C.furShade, shadeOffset: [3, 4] });
        ink.fill(ctx, ink.ellipse(...H(17, 6), 13, 9, tilt, 10), C.belly, { shade: C.bellyShade, shadeOffset: [2, 3] });
        if (p.mouth > 0.05) {
            ink.fill(ctx, ink.ellipse(...H(18, 14), 9, 2 + 7 * p.mouth, tilt, 10), C.mouth, { lineWidth: 2.4 });
            ink.fill(ctx, ink.ellipse(...H(18, 15 + 4 * p.mouth), 5, 1 + 3 * p.mouth, tilt, 8), C.tongue, { outline: false });
        } else {
            ink.line(ctx, [H(12, 13), H(18, 15.5), H(24, 13)], { width: 2.2 });
        }
        ink.fill(ctx, ink.ellipse(...H(29, 1), 5.2, 4.2, tilt, 8), C.nose);
        ink.dot(ctx, ...H(28, -0.5), 1.3, C.white);
        eye(ctx, ink, H(6, -5), p.eyes);
        ear(ctx, ink, H(-3, -16), tilt + 2.0 + p.ears + swing, C.ear, C.earShade);

        // Near arm (the lead hand, in front of everything)
        arm(ctx, ink, shoulderFront, add(shoulderFront, p.handFront), C.fur, C.furShade);
    }
};

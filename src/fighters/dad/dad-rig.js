// ============================================================================
// DAD RIG — a big hand-drawn gorilla in a dress shirt (sleeves rolled up),
// striped tie, khakis, loafers and thick glasses. Faces right.
// Coordinates: origin at the feet on the ground, y negative is up.
// Hands are positioned relative to their shoulder; feet relative to the origin.
// `tie` swings the tie (0 = hanging down, negative = forward, ~2.6 = flying up);
// `tieReach` stretches it for the Tie Whip.
// ============================================================================
import { add, rotate, solveLimb } from '../../graphics/ink.js';

const C = {
    fur: '#4a4650', furShade: '#34313a', farFur: '#3a3740', farShade: '#29262e',
    skin: '#8d7b70', skinShade: '#6e5e55', hand: '#5c4f4b', handShade: '#463b38',
    shirt: '#d6e8f7', shirtShade: '#a9c4dc', farShirt: '#b4cbe0', collar: '#ffffff',
    tie: '#c0392b', tieShade: '#8e2a1f', tieStripe: '#f1c40f',
    pants: '#b09a6c', pantsShade: '#8a7650', farPants: '#937f56',
    shoe: '#6b3f22', shoeShade: '#4a2b16', belt: '#4a3222', buckle: '#e3b341',
    lens: 'rgba(205,232,255,0.5)', frame: '#1e1b1f', mouth: '#4a1c1c', tongue: '#d9707c', teeth: '#fffaf0', white: '#fffaf0'
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function eye(ctx, ink, [x, y], kind) {
    if (kind === 'shut') return ink.line(ctx, [[x - 4, y], [x, y + 2], [x + 4, y]], { width: 2.4 });
    if (kind === 'happy') return ink.line(ctx, [[x - 4, y + 2], [x, y - 2], [x + 4, y + 2]], { width: 2.4 });
    if (kind === 'dizzy') {
        ink.line(ctx, [[x - 3.5, y - 3.5], [x + 3.5, y + 3.5]], { width: 2.2 });
        ink.line(ctx, [[x + 3.5, y - 3.5], [x - 3.5, y + 3.5]], { width: 2.2 });
        return;
    }
    ink.fill(ctx, ink.ellipse(x, y, 4.2, 4.6, 0, 8), C.white, { lineWidth: 1.8 });
    ink.dot(ctx, x + 1.4, y + 0.6, 2.3);
}

/** Khaki leg ending in a brown loafer. */
function leg(ctx, ink, hip, foot, color) {
    const [knee, end] = solveLimb(hip, foot, 30, 28, -1);
    ink.limb(ctx, [hip, knee, end], 24, color);
    ink.fill(ctx, ink.ellipse(end[0] + 8, end[1] - 6, 18, 8, 0, 10), C.shoe, { shade: C.shoeShade, shadeOffset: [2, 2] });
    ink.line(ctx, [[end[0] + 2, end[1] - 10], [end[0] + 14, end[1] - 11]], { width: 1.6, color: C.shoeShade });
}

/** Long gorilla arm: rolled-up shirt sleeve, hairy forearm, big knuckly fist. */
function arm(ctx, ink, shoulder, hand, sleeve, fur) {
    const [elbow, end] = solveLimb(shoulder, hand, 38, 38, 1);
    ink.limb(ctx, [shoulder, elbow], 24, sleeve);
    ink.limb(ctx, [elbow, end], 20, fur);
    // Rolled cuff at the elbow
    const a = Math.atan2(end[1] - elbow[1], end[0] - elbow[0]);
    ink.fill(ctx, ink.ellipse(elbow[0], elbow[1], 8, 14, a, 8), sleeve, { lineWidth: 2.4 });
    // Fist
    ink.fill(ctx, ink.ellipse(end[0], end[1], 15, 13, a, 10), C.hand, { shade: C.handShade, shadeOffset: [2, 3] });
    for (const k of [-6, 0, 6]) {
        const [kx, ky] = add(end, rotate([8, k], a));
        ink.line(ctx, [[kx - 2, ky], [kx + 2, ky]], { width: 1.6 });
    }
}

export const dadRig = {
    canvas: { width: 360, height: 300, originX: 180, originY: 280 },
    portrait: { x: 30, y: -132, scale: 0.95 },
    previewScale: 0.8, // menus draw Dad smaller so he fits the cards
    stepFrames: 15,
    ink: { lineWidth: 3.4 },

    basePose: {
        root: [0, 0], rootRotate: 0,
        hip: [0, -54], lean: 0.1, head: [0, 0], headTilt: 0,
        footBack: [-18, 0], footFront: [16, 0],
        handBack: [4, 64], handFront: [10, 64],
        mouth: 0, eyes: 'open', tie: 0, tieReach: 0
    },

    cycles: {
        idle: (t) => {
            const b = Math.sin(t * 0.07);
            return { hip: [0, -54 + b * 1.2], head: [0, b], handFront: [10, 64 + b * 2], handBack: [4, 64 + b * 1.5], tie: Math.sin(t * 0.05) * 0.08 };
        },
        walking: (t) => {
            const a = (t / 30) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
            return {
                hip: [0, -54 - Math.abs(c) * 3], lean: 0.16, head: [0, Math.abs(c) * 1.5],
                footBack: [-6 + s * 16, -Math.max(0, c) * 10], footFront: [6 - s * 16, -Math.max(0, -c) * 10],
                handFront: [12 - s * 14, 62], handBack: [4 + s * 14, 62], tie: s * 0.15
            };
        },
        hitstun: (t) => ({
            hip: [-8, -52], lean: -0.3, head: [-6, 2], headTilt: -0.35 + Math.sin(t * 0.9) * 0.08,
            eyes: 'dizzy', mouth: 0.6, handFront: [-10, -10], handBack: [-20, 0], footFront: [18, 0], footBack: [-16, 0], tie: 0.6
        }),
        // Chest pound: OOH OOH!
        victory: (t) => {
            const p = Math.sin(t * 0.35);
            return {
                lean: -0.1, head: [0, -2], headTilt: -0.3, mouth: 0.8, eyes: 'happy',
                handFront: [8 + Math.max(0, p) * 10, 16], handBack: [10 + Math.max(0, -p) * 10, 18], tie: p * 0.2
            };
        }
    },

    poses: {
        crouching: { hip: [0, -38], lean: 0.35, head: [6, 6], handFront: [30, 50], handBack: [22, 52], footBack: [-22, 0], footFront: [20, 0] },
        jumping: { hip: [0, -58], lean: 0, footBack: [-18, -18], footFront: [10, -22], handFront: [20, -50], handBack: [10, -54], mouth: 0.3, tie: 0.8 },
        falling: { hip: [0, -56], lean: 0.05, footBack: [-14, 0], footFront: [14, -4], handFront: [46, -6], handBack: [30, -14], mouth: 0.4, tie: 1.7 },
        blocking: { hip: [-4, -52], lean: -0.1, head: [-4, 4], handFront: [10, -20], handBack: [16, -14], eyes: 'angry', footFront: [14, 0], footBack: [-20, 0] },
        getup: { hip: [0, -36], lean: 0.3, head: [4, 4], handFront: [24, 40], handBack: [18, 44], eyes: 'shut', footBack: [-18, 0], footFront: [18, 0] },
        knockdown: {
            root: [60, -26], rootRotate: -1.5, head: [0, 2], headTilt: 0.2,
            footFront: [40, -60], footBack: [34, -44], handFront: [30, -6], handBack: [24, 6], eyes: 'dizzy', mouth: 0.7, tie: 1.2
        },
        defeat: {
            root: [60, -26], rootRotate: -1.5, head: [0, 2], headTilt: 0.25,
            footFront: [34, -52], footBack: [30, -40], handFront: [20, 4], handBack: [16, 10], eyes: 'dizzy', mouth: 0.5, tie: 1.4
        },

        // Attacks: windup (anticipation) → strike (extension)
        attack_windup: { hip: [-6, -53], lean: -0.08, head: [-4, 1], handFront: [-14, 20], handBack: [20, 10], eyes: 'angry', footBack: [-22, 0], footFront: [18, 0], tie: 0.3 },
        attack_strike: { hip: [8, -52], lean: 0.3, head: [8, 3], handFront: [72, -6], handBack: [6, 30], eyes: 'angry', mouth: 0.4, footBack: [-20, 0], footFront: [28, 0], tie: -0.3 },
        crouch_windup: { hip: [0, -38], lean: 0.3, handFront: [10, 30], handBack: [16, 36], footBack: [-22, 0], footFront: [10, -4], eyes: 'angry' },
        crouch_attack: { hip: [-4, -36], lean: 0.25, handFront: [64, 56], handBack: [14, 40], footBack: [-22, 0], footFront: [24, 0], eyes: 'angry', mouth: 0.3 },
        air_windup: { hip: [0, -58], lean: -0.1, handFront: [-10, -10], handBack: [-4, -20], footBack: [-16, -16], footFront: [8, -20], eyes: 'angry' },
        air_attack: { hip: [0, -58], lean: 0.35, handFront: [66, 20], handBack: [54, 28], footBack: [-20, -14], footFront: [6, -18], eyes: 'angry', mouth: 0.5, tie: 1 },

        // Dad's own moves
        breath_windup: { hip: [-4, -56], lean: -0.2, head: [-6, -6], headTilt: -0.4, mouth: 0.3, eyes: 'shut', handFront: [4, 6], handBack: [10, 8], tie: 0.4 },
        breath: { hip: [4, -52], lean: 0.32, head: [12, -2], headTilt: -0.15, mouth: 1, eyes: 'happy', handFront: [10, 30], handBack: [6, 34], tie: -0.2 },
        chest_pound: { lean: -0.12, head: [0, -2], headTilt: -0.35, mouth: 0.9, eyes: 'angry', handFront: [8, 16], handBack: [14, 14] },
        slam: { hip: [0, -42], lean: 0.45, head: [10, 8], handFront: [44, 92], handBack: [-34, 92], eyes: 'angry', mouth: 0.6 },
        arms_up: { hip: [0, -58], lean: -0.12, head: [0, -4], headTilt: -0.4, handFront: [10, -70], handBack: [-2, -72], mouth: 0.6, eyes: 'angry', tie: 0.5 },
        tie_whip: { hip: [4, -53], lean: 0.2, handFront: [34, 8], handBack: [10, 30], tie: -1.5, tieReach: 1, eyes: 'angry', mouth: 0.3 },
        kick: { hip: [-4, -56], lean: -0.3, footBack: [-58, -30], footFront: [10, -16], handFront: [20, -20], handBack: [6, -24], eyes: 'angry', mouth: 0.4 },
        cannonball: { hip: [0, -62], lean: 0.1, footFront: [10, -24], footBack: [-10, -26], handFront: [10, -6], handBack: [0, -4], eyes: 'shut', mouth: 0.2, tie: 1.7 },
        grab: { lean: 0.15, handFront: [42, 0], handBack: [38, 6], mouth: 0.3, eyes: 'happy' }
    },

    draw(ctx, p, ink) {
        ctx.translate(p.root[0], p.root[1]);
        ctx.rotate(p.rootRotate);
        const swing = clamp(-p.motion[0] * 0.05 + p.motion[1] * 0.04, -0.8, 0.8);
        const { hip, lean } = p;
        const neck = add(hip, rotate([6, -58], lean));
        const mid = [(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2 + 4];
        const T = (x, y) => add(mid, rotate([x, y], lean));
        // Shoulders sit back on the barrel chest so the shirt front and tie show.
        const shoulderBack = add(neck, rotate([-14, 14], lean));
        const shoulderFront = add(neck, rotate([0, 18], lean));
        const headC = add(add(neck, rotate([12, -22], lean * 0.5)), p.head);
        const tilt = p.headTilt + lean * 0.3;
        const H = (x, y) => add(headC, rotate([x, y], tilt));

        // Far limbs (darker, behind the body)
        leg(ctx, ink, add(hip, [-10, 2]), p.footBack, C.farPants);
        arm(ctx, ink, shoulderBack, add(shoulderBack, p.handBack), C.farShirt, C.farFur);
        leg(ctx, ink, add(hip, [10, 2]), p.footFront, C.pants);

        // Torso: a barrel chest in a dress shirt, tucked into khakis
        ink.fill(ctx, ink.ellipse(...T(0, 26), 40, 16, lean, 12), C.pants, { shade: C.pantsShade, shadeOffset: [3, 3] });
        ink.fill(ctx, ink.ellipse(mid[0], mid[1], 44, 40, lean, 14), C.shirt, { shade: C.shirtShade, shadeOffset: [5, 6] });
        ink.line(ctx, [T(-26, 6), T(-18, 20)], { width: 1.6, color: C.shirtShade }); // a wrinkle or two
        ink.line(ctx, [T(20, -14), T(26, 0)], { width: 1.6, color: C.shirtShade });
        for (const y of [-12, 2, 16]) ink.dot(ctx, ...T(34, y), 1.8, C.shirtShade); // buttons beside the tie
        ink.line(ctx, [T(-40, 30), T(-10, 36), T(30, 32), T(42, 26)], { width: 6, color: C.belt });
        ink.fill(ctx, ink.polygon([T(26, 28), T(36, 26), T(37, 35), T(27, 37)], 0.4), C.buckle, { lineWidth: 2 });

        // Head: big dark cranium with a crest, pale face, heavy brow
        ink.fill(ctx, ink.closedCurve([H(-26, 12), H(-32, -6), H(-22, -26), H(-6, -38), H(10, -30), H(24, -16), H(28, 4), H(16, 20), H(-12, 22)]), C.fur, { shade: C.furShade, shadeOffset: [3, 4] });
        ink.fill(ctx, ink.ellipse(...H(-14, -2), 6, 8, tilt, 8), C.skin, { lineWidth: 2.2 }); // ear
        ink.fill(ctx, ink.closedCurve([H(-2, -14), H(20, -18), H(32, -8), H(36, 8), H(32, 22), H(16, 26), H(0, 20), H(-4, 4)]), C.skin, { shade: C.skinShade, shadeOffset: [2, 3] });
        // Muzzle and mouth
        if (p.mouth > 0.05) {
            ink.fill(ctx, ink.ellipse(...H(22, 20), 12, 2 + 10 * p.mouth, tilt, 10), C.mouth, { lineWidth: 2.4 });
            ink.fill(ctx, ink.ellipse(...H(22, 22 + 4 * p.mouth), 7, 1 + 4 * p.mouth, tilt, 8), C.tongue, { outline: false });
            ink.fill(ctx, ink.polygon([H(13, 17 - p.mouth), H(31, 17 - p.mouth), H(30, 20), H(14, 20)], 0.3), C.teeth, { lineWidth: 1.4 });
        } else {
            ink.line(ctx, [H(12, 19), H(22, 21), H(31, 17)], { width: 2.2 });
        }
        ink.fill(ctx, ink.ellipse(...H(28, 6), 10, 8, tilt, 10), C.skin, { shade: C.skinShade, shadeOffset: [2, 2], lineWidth: 2.4 });
        ink.fill(ctx, ink.ellipse(...H(32, 6), 3.2, 2.4, tilt + 0.4, 6), C.mouth, { outline: false }); // nostril
        ink.fill(ctx, ink.ellipse(...H(25, 7), 2.6, 2, tilt + 0.4, 6), C.mouth, { outline: false });
        // Eyes, then the brow ridge over them
        eye(ctx, ink, H(16, -6), p.eyes);
        eye(ctx, ink, H(4, -6), p.eyes === 'open' || p.eyes === 'angry' ? 'open' : p.eyes);
        const browDip = p.eyes === 'angry' ? 4 : 0;
        ink.line(ctx, [H(-4, -14), H(10, -16 + browDip * 0.3), H(24, -14 + browDip)], { width: 6, color: C.furShade });
        // Glasses: thick round frames, tinted lenses, a glint
        ink.fill(ctx, ink.ellipse(...H(3, -5), 7, 9, tilt, 10), C.lens, { lineWidth: 3 });
        ink.fill(ctx, ink.ellipse(...H(17, -5), 9, 9, tilt, 10), C.lens, { lineWidth: 3 });
        ink.line(ctx, [H(9, -6), H(9, -7), H(9, -6)], { width: 3 });
        ink.line(ctx, [H(-4, -6), H(-14, -4)], { width: 3 });
        ink.line(ctx, [H(13, -10), H(16, -12)], { width: 2.2, color: C.white });

        // Collar and tie
        const collarL = add(neck, rotate([10, 6], lean)), collarR = add(neck, rotate([30, 8], lean));
        ink.fill(ctx, ink.polygon([collarL, add(collarL, rotate([10, 2], lean)), add(collarL, rotate([6, 14], lean))], 0.4), C.collar, { lineWidth: 2.2 });
        ink.fill(ctx, ink.polygon([collarR, add(collarR, rotate([-10, 2], lean)), add(collarR, rotate([-2, 14], lean))], 0.4), C.collar, { lineWidth: 2.2 });
        const knot = add(neck, rotate([20, 12], lean));
        const tieAngle = lean + p.tie + swing * 0.5;
        const L = 46 + p.tieReach * 110;
        const R = (x, y) => add(knot, rotate([x, y], tieAngle));
        ink.fill(ctx, ink.polygon([R(-4, 4), R(4, 4), R(8, L - 10), R(0, L), R(-8, L - 10)], 0.6), C.tie, { shade: C.tieShade, shadeOffset: [2, 2], lineWidth: 2.6 });
        for (let y = 14; y < L - 12; y += 12) ink.line(ctx, [R(-5, y + 3), R(5, y - 3)], { width: 2.4, color: C.tieStripe });
        ink.fill(ctx, ink.polygon([add(knot, rotate([-6, -3], lean)), add(knot, rotate([6, -3], lean)), add(knot, rotate([4, 6], lean)), add(knot, rotate([-4, 6], lean))], 0.4), C.tie, { lineWidth: 2.4 });

        // Near arm, in front of everything
        arm(ctx, ink, shoulderFront, add(shoulderFront, p.handFront), C.shirt, C.fur);
    }
};

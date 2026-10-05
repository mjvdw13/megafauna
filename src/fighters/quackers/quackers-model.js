// ============================================================================
// QUACKERS MODEL — a cream-white Pekin duck. Faces +x, feet at y = 0.
// The wings are a separate mesh so they can spread without stretching the body.
//
// Pose parameters (radians unless noted):
//   x, y, pitch, roll, yaw    body offset (units) and tilt
//   neck, head                + raises     jaw   bill opening
//   tailWag                   tail waggle amount
//   spread                    wings: 0 folded → 1 fully spread
//   raise                     wing angle (+ up)     flap   flapping amount
//   lH lK lF, rH rK rF        legs: hip, shank, foot (+ swings forward)
//   snap                      1 = keep the feet on the floor while grounded
// ============================================================================
import { fbm, smooth } from '../../render3d/noise.js';
import { cap, ell } from '../../render3d/shapes.js';

const bones = [
    ['body', null, [0, 0.38, 0]], ['tailB', 'body', [-0.16, 0.42, 0]], ['neck', 'body', [0.13, 0.46, 0]],
    ['head', 'neck', [0.2, 0.66, 0]], ['jaw', 'head', [0.27, 0.652, 0]]
];
const body = [
    ell([0, 0.38, 0], [0.2, 0.135, 0.13], 'body', 0.05, 'plume'),
    ell([0.08, 0.355, 0], [0.12, 0.125, 0.115], 'body', 0.05, 'plume'),
    cap([-0.14, 0.41, 0], [-0.27, 0.47, 0], 0.06, 0.012, 'tailB', 0.04, 'plume'),
    cap([0.11, 0.43, 0], [0.19, 0.64, 0], 0.055, 0.042, 'neck', 0.04, 'plume'),
    ell([0.2, 0.69, 0], [0.075, 0.064, 0.058], 'head', 0.03, 'plume'),
    ell([0.245, 0.695, 0], [0.05, 0.048, 0.044], 'head', 0.03, 'plume'),
    ell([0.325, 0.664, 0], [0.065, 0.015, 0.03], 'head', 0.012, 'bill'),
    ell([0.315, 0.648, 0], [0.055, 0.011, 0.026], 'jaw', 0.01, 'bill')
];
const wings = [];
for (const [S, z] of [['L', 1], ['R', -1]]) {
    const lz = z * 0.07;
    bones.push(
        ['hip' + S, 'body', [0, 0.3, lz]], ['shank' + S, 'hip' + S, [0.02, 0.235, lz]], ['foot' + S, 'shank' + S, [0.03, 0.035, lz]],
        ['wShoulder' + S, 'body', [0.08, 0.46, z * 0.135]], ['wElbow' + S, 'wShoulder' + S, [-0.03, 0.47, z * 0.12]], ['wHand' + S, 'wElbow' + S, [-0.13, 0.48, z * 0.09]]
    );
    body.push(
        cap([0.01, 0.31, lz], [0.02, 0.235, lz], 0.035, 0.02, 'hip' + S, 0.03, 'plume'),
        cap([0.02, 0.235, lz], [0.03, 0.035, lz], 0.014, 0.012, 'shank' + S, 0.01, 'leg'),
        ell([0.075, 0.012, lz], [0.06, 0.012, 0.045], 'foot' + S, 0.012, 'leg')
    );
    wings.push(
        ell([0.02, 0.46, z * 0.135], [0.085, 0.058, 0.018], 'wShoulder' + S, 0.02, 'plume'),
        ell([-0.08, 0.47, z * 0.115], [0.09, 0.055, 0.016], 'wElbow' + S, 0.02, 'plume'),
        ell([-0.18, 0.485, z * 0.075], [0.1, 0.038, 0.012], 'wHand' + S, 0.015, 'tip')
    );
}

const legs = (h, k) => ({ lH: h, lK: k, rH: h, rK: k });
const TUCK = legs(-0.9, 0.4);
const CROUCH = { ...legs(0.5, -0.9), neck: -0.25, head: 0.1, y: -0.05 };
const LYING = { roll: 1.35, y: -0.24, snap: 0, spread: 0.6, raise: -0.3, neck: -0.7, ...legs(-0.5, 0.3) };

export const quackersModel = {
    scale: 1.25,
    stepFrames: 11,
    bones,
    parts: [
        { prims: body, min: [-0.32, -0.03, -0.17], max: [0.42, 0.8, 0.17], step: 0.008 },
        { prims: wings, min: [-0.4, 0.37, -0.2], max: [0.16, 0.56, 0.2], step: 0.007 }
    ],
    colors: { plume: '#ece2b8', tip: '#ddd0a0', bill: ['#e58a2c', 0.15, 0.45], leg: ['#de7c28', 0.2, 0.55] },
    material: { roughness: 0.8, sheen: 1, sheenRoughness: 0.4, sheenColor: '#fffbe8', detail: { mode: 'fur', freq: 110, strength: 0.2, tint: 0.05, freq2: 10 } },
    ao: 0.014,
    shade(c, x, y, z, nx, ny) {
        c.multiplyScalar(1 - smooth(ny, 0.1, 0.95) * 0.08);
        c.multiplyScalar(0.96 + fbm(x * 12, y * 12, z * 12) * 0.08);
    },
    accessories(kit) {
        for (const z of [-1, 1]) kit.eye('head', [0.24, 0.71, z * 0.043], 0.012, '#120c08');
    },
    feet: [{ bone: 'footL', offset: [0.045, -0.035, 0] }, { bone: 'footR', offset: [0.045, -0.035, 0] }],
    portrait: { target: [0.23, 0.66, 0], distance: 0.5 },

    basePose: { x: 0, y: 0, pitch: 0, roll: 0, yaw: 0, neck: 0, head: 0, jaw: 0, tailWag: 0, spread: 0, raise: 0, flap: 0, ...legs(0, 0), lF: 0, rF: 0, snap: 1 },

    cycles: {
        idle: (t) => ({ neck: Math.sin(t * 0.03) * 0.05, head: Math.sin(t * 0.015) * 0.1, tailWag: Math.sin(t * 0.013) > 0.85 ? 1 : 0 }),
        // Waddle: the body rocks side to side over each step.
        walking: (t) => {
            const ph = (t / 8) * Math.PI * 2, s = Math.sin(ph);
            return {
                roll: s * 0.12, neck: -0.1 + Math.abs(s) * 0.05,
                lH: s * 0.6, lK: Math.max(0, Math.cos(ph)) * 0.4, rH: -s * 0.6, rK: Math.max(0, -Math.cos(ph)) * 0.4
            };
        },
        jumping: () => ({ ...TUCK, spread: 1, flap: 1, raise: 0.2, pitch: 0.1 }),
        flurry: (t) => ({ neck: -0.4 + Math.sin(t * 1.2) * 0.3, head: 0.2, jaw: Math.max(0, Math.sin(t * 1.2)) * 0.5, spread: 0.7, flap: 0.6, raise: 0.2 }),
        hitstun: (t) => ({ spread: 0.8, flap: 0.5, neck: 0.4, head: 0.3 + Math.sin(t * 0.9) * 0.05, jaw: 0.4, pitch: 0.2 }),
        dizzy: (t) => ({ roll: Math.sin(t * 0.12) * 0.15, neck: -0.2 + Math.sin(t * 0.08) * 0.15, head: Math.sin(t * 0.17) * 0.35, jaw: 0.3, spread: 0.3, raise: -0.2 }),
        victory: (t) => ({ spread: 1, flap: 0.7, raise: 0.3, neck: 0.25, jaw: Math.max(0, Math.sin(t * 0.15)) * 0.6 })
    },

    poses: {
        crouching: CROUCH,
        landing: { ...CROUCH, neck: -0.1 },
        spotdodge: { ...CROUCH, neck: -0.5, spread: 0.3, raise: 0.6 },
        roll: { pitch: -0.5, neck: -0.7, ...TUCK, spread: 0.2 },
        falling: { ...legs(-0.5, 0.25), spread: 0.7, flap: 0.25, raise: 0.1, pitch: -0.05 },
        airdodge: { ...TUCK, spread: 0.3, raise: 0.6, neck: -0.3 },
        helpless: { ...legs(0.2, 0), spread: 0.9, flap: 0.4, raise: -0.1, neck: 0.3, jaw: 0.3 },
        glide: { ...TUCK, spread: 1, raise: 0.12, pitch: -0.12, neck: -0.2 },
        blocking: { ...CROUCH, spread: 0.45, raise: 0.6, neck: -0.35 },
        getup: { ...CROUCH, neck: 0.1 },
        ledge: { pitch: 0.8, neck: 0.5, head: -0.3, jaw: 0.3, spread: 0.8, raise: 0.4, flap: 0.3, ...legs(0.3, 0) },
        ledge_climb: { pitch: 0.3, neck: 0.2, spread: 0.6, flap: 0.5, ...legs(0.4, -0.4) },
        knockdown: LYING,
        defeat: { ...LYING, neck: -0.9 },
        grab: { x: 0.06, neck: -0.3, head: 0.3, jaw: 0.2, spread: 0.3 },
        grabbed: { spread: 0.8, flap: 0.6, neck: 0.4, head: 0.2, jaw: 0.5, ...legs(0.2, 0) },

        attack_windup: { x: -0.03, pitch: 0.05, neck: 0.4, head: -0.2 },
        attack_strike: { x: 0.08, pitch: -0.1, neck: -0.55, head: 0.35, jaw: 0.3 },
        attack_quack: { neck: 0.3, head: 0.4, jaw: 0.8, spread: 0.4, raise: 0.5 },
        crouch_windup: { ...CROUCH, neck: 0.1 },
        crouch_attack: { ...CROUCH, yaw: 0.4, rH: 0.9, rK: -0.2, spread: 0.3 },
        air_windup: { ...TUCK, spread: 0.7, raise: 0.9, neck: 0.3 },
        air_attack: { spread: 1, raise: -0.4, lH: 0.9, lK: -0.3, rH: 0.7, rK: -0.2, pitch: -0.15, neck: -0.2 },
        dive: { pitch: -0.6, neck: -0.4, head: 0.3, spread: 0.5, raise: 0.5, ...TUCK },
        beak_up: { pitch: 0.15, neck: 0.6, head: 0.9, jaw: 0.4 },
        belly_flop: { y: -0.2, snap: 0, pitch: -0.3, spread: 0.9, raise: 0.2, ...legs(-1.1, 0.3), neck: 0.1, head: 0.3 },
        tail_waggle: { yaw: -0.5, pitch: 0.1, tailWag: 2, spread: 0.4 }
    },

    apply({ bones: B }, p, info) {
        B.body.position.x += p.x;
        B.body.position.y += p.y;
        B.body.rotation.set(p.roll, p.yaw, p.pitch);
        B.neck.rotation.z = p.neck;
        B.head.rotation.z = p.head;
        B.jaw.rotation.z = -p.jaw;
        B.tailB.rotation.y = Math.sin(info.time * 0.5) * 0.25 * p.tailWag;
        const flap = p.raise + Math.sin(info.time * 0.45) * 0.75 * p.flap;
        for (const [S, side] of [['L', 1], ['R', -1]]) {
            // Spread swings the folded wing out sideways (about y), then the flap lifts it (about x).
            B['wShoulder' + S].rotation.set(-side * flap * p.spread, side * 1.45 * p.spread, 0);
            B['wHand' + S].rotation.y = -side * 0.25 * p.spread;
            const hip = p[`${S.toLowerCase()}H`], shank = p[`${S.toLowerCase()}K`];
            B['hip' + S].rotation.z = hip;
            B['shank' + S].rotation.z = shank;
            B['foot' + S].rotation.z = -(hip + shank) + p[`${S.toLowerCase()}F`];
        }
    }
};

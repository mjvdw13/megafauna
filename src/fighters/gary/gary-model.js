// ============================================================================
// GARY MODEL — a city rock pigeon: blue-grey, a green and purple sheen on the
// neck, two dark bars on each wing, orange eyes, pink feet. Faces +x, feet at y = 0.
// The wings are a separate mesh so they can spread without stretching the body.
//
// Pose parameters (radians unless noted):
//   x, y, pitch, roll, yaw    body offset (units) and tilt
//   neck, head                + raises (and pulls back)     jaw   lower beak opening
//   tail                      + fans the tail up             tailWag  side-to-side waggle
//   spread                    wings: 0 folded → 1 fully spread
//   raise                     wing angle (+ up)     flap   flapping amount
//   lH lK lF, rH rK rF        legs: hip, shank, foot (+ swings forward)
//   snap                      1 = keep the feet on the floor while grounded
// ============================================================================
import { fbm, smooth } from '../../render3d/noise.js';
import { cap, ell } from '../../render3d/shapes.js';

const bones = [
    ['body', null, [0, 0.29, 0]], ['tailB', 'body', [-0.14, 0.32, 0]], ['neck', 'body', [0.1, 0.38, 0]],
    ['head', 'neck', [0.15, 0.52, 0]], ['jaw', 'head', [0.2, 0.518, 0]]
];
const body = [
    ell([-0.01, 0.28, 0], [0.17, 0.125, 0.12], 'body', 0.05, 'plume'),
    ell([0.085, 0.315, 0], [0.105, 0.12, 0.108], 'body', 0.05, 'chest'),       // plump breast
    ell([-0.23, 0.32, 0], [0.095, 0.016, 0.052], 'tailB', 0.03, 'tail'),       // flat fan of tail feathers
    ell([-0.315, 0.322, 0], [0.03, 0.015, 0.05], 'tailB', 0.01, 'band'),       // dark band at the tip
    cap([0.08, 0.35, 0], [0.145, 0.49, 0], 0.07, 0.048, 'neck', 0.04, 'neck'),
    ell([0.155, 0.53, 0], [0.058, 0.054, 0.05], 'head', 0.03, 'head'),
    ell([0.196, 0.528, 0], [0.016, 0.012, 0.016], 'head', 0.008, 'cere'),     // the white bump above the beak
    ell([0.228, 0.52, 0], [0.034, 0.01, 0.012], 'head', 0.008, 'beak'),
    ell([0.222, 0.511, 0], [0.028, 0.007, 0.01], 'jaw', 0.006, 'beak')
];
const wings = [];
for (const [S, z] of [['L', 1], ['R', -1]]) {
    const lz = z * 0.06;
    bones.push(
        ['hip' + S, 'body', [0.01, 0.2, lz]], ['shank' + S, 'hip' + S, [0.02, 0.105, lz]], ['foot' + S, 'shank' + S, [0.025, 0.03, lz]],
        ['wShoulder' + S, 'body', [0.07, 0.38, z * 0.122]], ['wElbow' + S, 'wShoulder' + S, [-0.03, 0.385, z * 0.112]], ['wHand' + S, 'wElbow' + S, [-0.13, 0.38, z * 0.085]]
    );
    body.push(
        cap([0.01, 0.2, lz], [0.02, 0.115, lz], 0.042, 0.022, 'hip' + S, 0.03, 'plume'),          // feathered thigh
        cap([0.02, 0.105, lz], [0.025, 0.03, lz], 0.013, 0.011, 'shank' + S, 0.01, 'leg'),
        // Three toes forward, one back
        cap([0.025, 0.012, lz], [0.085, 0.007, lz], 0.009, 0.006, 'foot' + S, 0.008, 'leg'),
        cap([0.025, 0.012, lz], [0.07, 0.007, lz + 0.032], 0.008, 0.006, 'foot' + S, 0.008, 'leg'),
        cap([0.025, 0.012, lz], [0.07, 0.007, lz - 0.032], 0.008, 0.006, 'foot' + S, 0.008, 'leg'),
        cap([0.025, 0.012, lz], [-0.02, 0.007, lz], 0.008, 0.006, 'foot' + S, 0.008, 'leg')
    );
    wings.push(
        ell([0.01, 0.375, z * 0.122], [0.09, 0.062, 0.02], 'wShoulder' + S, 0.02, 'wing'),
        ell([-0.08, 0.375, z * 0.11], [0.095, 0.056, 0.018], 'wElbow' + S, 0.02, 'wing'),
        // The two black wing bars, sitting just proud of the folded wing
        ell([-0.12, 0.362, z * 0.126], [0.065, 0.012, 0.013], 'wElbow' + S, 0.004, 'bar'),
        ell([-0.13, 0.336, z * 0.121], [0.06, 0.012, 0.013], 'wElbow' + S, 0.004, 'bar'),
        ell([-0.2, 0.37, z * 0.075], [0.11, 0.034, 0.012], 'wHand' + S, 0.015, 'tip')
    );
}

const legs = (h, k) => ({ lH: h, lK: k, rH: h, rK: k });
const TUCK = legs(-0.9, 0.5);
const CROUCH = { ...legs(0.6, -1.0), neck: -0.3, head: 0.15, y: -0.05, tail: 0.15 };
const LYING = { roll: 1.35, y: -0.22, snap: 0, spread: 0.6, raise: -0.3, neck: -0.6, ...legs(-0.4, 0.3) };
const BREATH = { x: 0.03, pitch: -0.12, neck: -0.45, head: 0.3, jaw: 0.75, spread: 0.45, raise: 0.35, tail: 0.3 };

export const garyModel = {
    scale: 1.5,
    stepFrames: 9,
    blend: 0.015, // crisper color edges, so the wing bars stay sharp
    bones,
    parts: [
        { prims: body, min: [-0.37, -0.03, -0.16], max: [0.29, 0.61, 0.16], step: 0.008 },
        { prims: wings, min: [-0.34, 0.29, -0.17], max: [0.13, 0.46, 0.17], step: 0.007 }
    ],
    colors: {
        plume: '#7c8794', chest: '#878595', head: '#6a7482', neck: '#5e7a78', wing: '#97a1ad', bar: '#1c1e22',
        tip: '#4a515c', tail: '#727b88', band: '#22252a',
        beak: ['#2e2a2a', 0.1, 0.4], cere: ['#ebe6dd', 0.1, 0.6], leg: ['#d4606d', 0.2, 0.5],
        // Not on any shape: the two colors of the neck's sheen, used by shade()
        sheenGreen: '#3f9a6e', sheenPurple: '#7d4f9a'
    },
    material: { roughness: 0.75, sheen: 1, sheenRoughness: 0.35, sheenColor: '#d8e4f0', detail: { mode: 'fur', freq: 120, strength: 0.22, tint: 0.05, freq2: 10 } },
    ao: 0.014,
    shade(c, x, y, z, nx, ny, nz, cols) {
        c.multiplyScalar(1 - smooth(ny, 0.1, 0.95) * 0.1);
        // Iridescent neck: green or purple depending on which way the feathers face.
        const neck = 1 - smooth(Math.hypot((x - 0.12) * 1.4, y - 0.44), 0.04, 0.09);
        if (neck > 0) {
            const t = 0.5 + 0.5 * Math.sin(nz * 3.5 + ny * 2.5 + x * 25);
            c.lerp(cols.sheenGreen.c, neck * 0.7 * (1 - t));
            c.lerp(cols.sheenPurple.c, neck * 0.6 * t);
        }
        c.multiplyScalar(0.95 + fbm(x * 12, y * 12, z * 12) * 0.1);
    },
    accessories(kit) {
        for (const z of [-1, 1]) {
            kit.eye('head', [0.183, 0.543, z * 0.039], 0.013, '#e8742a');   // orange iris
            kit.eye('head', [0.189, 0.545, z * 0.048], 0.006, '#0b0b0b');   // pupil
        }
    },
    feet: [{ bone: 'footL', offset: [0.04, -0.03, 0] }, { bone: 'footR', offset: [0.04, -0.03, 0] }],
    portrait: { target: [0.16, 0.51, 0], distance: 0.48 },

    basePose: { x: 0, y: 0, pitch: 0, roll: 0, yaw: 0, neck: 0, head: 0, jaw: 0, tail: 0, tailWag: 0, spread: 0, raise: 0, flap: 0, ...legs(0, 0), lF: 0, rF: 0, snap: 1 },

    cycles: {
        idle: (t) => ({ neck: Math.sin(t * 0.04) * 0.05, head: Math.sin(t * 0.02) * 0.12, tail: Math.sin(t * 0.03) * 0.05, tailWag: Math.sin(t * 0.011) > 0.9 ? 1 : 0 }),
        // The pigeon strut: the head jerks forward and back twice per stride.
        walking: (t) => {
            const ph = (t / 9) * Math.PI * 2, s = Math.sin(ph), bob = Math.sin(ph * 2);
            return {
                roll: s * 0.05, neck: -0.12 + bob * 0.22, head: -bob * 0.15,
                lH: s * 0.55, lK: Math.max(0, Math.cos(ph)) * 0.5, rH: -s * 0.55, rK: Math.max(0, -Math.cos(ph)) * 0.5
            };
        },
        running: (t) => {
            const ph = (t / 7) * Math.PI * 2, s = Math.sin(ph);
            return {
                pitch: -0.15, neck: -0.3 + Math.sin(ph * 2) * 0.1, spread: 0.55, flap: 0.5, raise: 0.25, tail: 0.15,
                lH: s * 0.8, lK: Math.max(0, Math.cos(ph)) * 0.7, rH: -s * 0.8, rK: Math.max(0, -Math.cos(ph)) * 0.7
            };
        },
        jumping: () => ({ ...TUCK, spread: 1, flap: 1, raise: 0.2, pitch: 0.1, tail: 0.3 }),
        hitstun: (t) => ({ spread: 0.8, flap: 0.5, neck: 0.4, head: 0.3 + Math.sin(t * 0.9) * 0.05, jaw: 0.4, pitch: 0.2, tail: -0.2 }),
        dizzy: (t) => ({ roll: Math.sin(t * 0.12) * 0.15, neck: -0.2 + Math.sin(t * 0.08) * 0.15, head: Math.sin(t * 0.17) * 0.35, jaw: 0.3, spread: 0.3, raise: -0.2 }),
        // Chest puffed out, cooing, wings half open.
        victory: (t) => ({ pitch: 0.15, neck: 0.25 + Math.sin(t * 0.2) * 0.12, head: -0.15, jaw: Math.max(0, Math.sin(t * 0.2)) * 0.4, spread: 0.35, raise: 0.45, flap: 0.15, tail: 0.4, tailWag: 1 }),
        phoenix: (t) => ({ ...TUCK, pitch: 0.2, neck: 0.5, head: 0.3, jaw: 0.5, spread: 1, raise: 0.7, flap: 0.6 + Math.sin(t * 0.3) * 0.1, tail: 0.5 })
    },

    poses: {
        crouching: CROUCH,
        landing: { ...CROUCH, neck: -0.1 },
        spotdodge: { ...CROUCH, neck: -0.5, spread: 0.3, raise: 0.6 },
        roll: { pitch: -0.5, neck: -0.7, ...TUCK, spread: 0.2 },
        falling: { ...legs(-0.5, 0.3), spread: 0.7, flap: 0.25, raise: 0.1, pitch: -0.05, tail: 0.2 },
        airdodge: { ...TUCK, spread: 0.3, raise: 0.6, neck: -0.3 },
        helpless: { ...legs(0.2, 0), spread: 0.9, flap: 0.4, raise: -0.1, neck: 0.3, jaw: 0.3 },
        blocking: { ...CROUCH, spread: 0.45, raise: 0.6, neck: -0.35 },
        getup: { ...CROUCH, neck: 0.1 },
        ledge: { pitch: 0.8, neck: 0.5, head: -0.3, jaw: 0.3, spread: 0.8, raise: 0.4, flap: 0.3, ...legs(0.3, 0) },
        ledge_climb: { pitch: 0.3, neck: 0.2, spread: 0.6, flap: 0.5, ...legs(0.4, -0.4) },
        knockdown: LYING,
        defeat: { ...LYING, neck: -0.9, jaw: 0.3 },
        grab: { x: 0.05, neck: -0.25, head: 0.25, spread: 0.7, raise: -0.3 },
        grabbed: { spread: 0.8, flap: 0.6, neck: 0.4, head: 0.2, jaw: 0.5, ...legs(0.2, 0) },

        attack_windup: { x: -0.03, pitch: 0.05, neck: 0.4, head: -0.2 },
        attack_strike: { x: 0.07, pitch: -0.1, neck: -0.55, head: 0.35, jaw: 0.25 },
        crouch_windup: { ...CROUCH, rH: 0.2, rK: -0.4 },
        crouch_attack: { ...CROUCH, rH: 1.0, rK: -0.1, rF: 0.3 },
        air_windup: { ...TUCK, spread: 0.7, raise: 0.9, neck: 0.3 },
        air_attack: { spread: 1, raise: -0.4, lH: 0.9, lK: -0.3, rH: 0.7, rK: -0.2, pitch: -0.15, neck: -0.2 },

        // Fire: chest pumped and head back, then neck thrust out with the beak wide.
        breath_windup: { x: -0.03, pitch: 0.18, neck: 0.55, head: -0.3, jaw: 0.15, spread: 0.3, raise: 0.5, tail: 0.2 },
        breath: BREATH,
        beak_up: { pitch: 0.15, neck: 0.6, head: 0.9, jaw: 0.4 },
        wing_clap: { x: 0.04, pitch: -0.1, neck: -0.2, spread: 1, raise: -0.15, tail: 0.2 },
        rush: { pitch: -0.3, neck: -0.5, head: 0.3, spread: 0.8, raise: 0.3, flap: 0.6, ...legs(-0.4, 0.5), tail: 0.3 },
        puff: { pitch: 0.2, y: 0.02, neck: 0.3, head: -0.2, spread: 0.9, raise: -0.35, tail: 0.6 },
        talons: { pitch: 0.35, neck: 0.2, spread: 0.9, raise: 0.5, ...legs(1.3, -0.2), tail: 0.4 },
        tail_fan: { yaw: -0.4, pitch: 0.2, neck: 0.2, tail: 0.8, tailWag: 2, spread: 0.4 },
        // Goes stiff as a park statue and drops.
        statue: { pitch: 0, neck: 0.35, head: -0.15, ...legs(0, 0), lF: 0.4, rF: 0.4, spread: 0, tail: -0.2 },
        stomp_windup: { pitch: 0.15, neck: 0.2, rH: 0.9, rK: -1.1, spread: 0.4, raise: 0.5, tail: 0.3 },
        stomp: { ...CROUCH, neck: -0.2, rH: 0.5, rK: -0.2, spread: 0.6, raise: -0.2 }
    },

    apply({ bones: B }, p, info) {
        B.body.position.x += p.x;
        B.body.position.y += p.y;
        B.body.rotation.set(p.roll, p.yaw, p.pitch);
        B.neck.rotation.z = p.neck;
        B.head.rotation.z = p.head;
        B.jaw.rotation.z = -p.jaw;
        B.tailB.rotation.set(0, Math.sin(info.time * 0.5) * 0.25 * p.tailWag, -p.tail);
        const flap = p.raise + Math.sin(info.time * 0.45) * 0.75 * p.flap;
        for (const [S, side] of [['L', 1], ['R', -1]]) {
            // Spread swings the folded wing out sideways (about y), then the flap lifts it (about x).
            B['wShoulder' + S].rotation.set(-side * flap * p.spread, side * 1.45 * p.spread, 0);
            B['wHand' + S].rotation.y = -side * 0.25 * p.spread;
            const l = S.toLowerCase(), hip = p[`${l}H`], shank = p[`${l}K`];
            B['hip' + S].rotation.z = hip;
            B['shank' + S].rotation.z = shank;
            B['foot' + S].rotation.z = -(hip + shank) + p[`${l}F`];
        }
    }
};

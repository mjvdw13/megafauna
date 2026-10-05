// ============================================================================
// DAD MODEL — a silverback gorilla in a short-sleeved shirt, khakis, loafers,
// wire glasses, and a tie that hangs plumb and swings on its own.
// Faces +x, knuckles and feet at y = 0.
//
// Pose parameters (radians unless noted):
//   x, y, pitch, roll, yaw    body offset (units) and tilt (pitch + = rears up)
//   neck, head, jaw           head control (the neck also levels the head against pitch)
//   puff                      chest swell (breath attack)   beat   chest-beating amount
//   aLs aLe aLx, aRs aRe aRx  arms: shoulder (+ forward/up), elbow (+ bends), out to the side
//   hLh hLk, hRh hRk          legs: hip (+ forward), knee (- bends)
//   tieSwing                  where the tie is flung to (radians from hanging straight down)
//   snap                      1 = keep knuckles and feet on the floor while grounded
// ============================================================================
import { clamp, fbm, smooth } from '../../render3d/noise.js';
import { cap, ell } from '../../render3d/shapes.js';

const bones = [
    ['body', null, [0, 0.7, 0]], ['pelvis', 'body', [-0.18, 0.62, 0]], ['chest', 'body', [0.12, 0.9, 0]],
    ['neck', 'chest', [0.24, 1.02, 0]], ['head', 'neck', [0.34, 1.1, 0]], ['jaw', 'head', [0.44, 1.0, 0]]
];
const prims = [
    cap([-0.15, 0.66, 0], [0.14, 0.92, 0], 0.3, 0.31, 'body', 0.1, 'shirt'),
    ell([0.17, 0.9, 0], [0.22, 0.24, 0.32], 'chest', 0.1, 'shirt'),
    ell([-0.03, 0.6, 0], [0.25, 0.2, 0.26], 'body', 0.1, 'shirt'),
    ell([0.15, 0.98, 0], [0.16, 0.08, 0.27], 'chest', 0.08, 'shirt'),
    ell([-0.2, 0.56, 0], [0.22, 0.17, 0.25], 'pelvis', 0.08, 'pants'),
    ell([-0.106, 0.699, 0], [0.315, 0.028, 0.315], 'body', 0.02, 'belt', -0.84),
    cap([0.2, 1.0, 0], [0.33, 1.08, 0], 0.15, 0.13, 'neck', 0.06, 'fur'),
    ell([0.25, 1.03, 0], [0.14, 0.035, 0.16], 'neck', 0.02, 'collar', -1.03),
    ell([0.37, 1.12, 0], [0.15, 0.15, 0.135], 'head', 0.05, 'fur'),
    ell([0.32, 1.25, 0], [0.11, 0.065, 0.05], 'head', 0.04, 'crown'),
    ell([0.465, 1.055, 0], [0.1, 0.1, 0.11], 'head', 0.04, 'skin'),
    cap([0.49, 1.15, -0.085], [0.49, 1.15, 0.085], 0.034, 0.034, 'head', 0.03, 'skin'),
    ell([0.555, 1.085, 0], [0.028, 0.04, 0.055], 'head', 0.02, 'skin'),
    ell([0.465, 0.985, 0], [0.09, 0.055, 0.1], 'jaw', 0.03, 'skin')
];
for (const [S, z] of [['L', 1], ['R', -1]]) {
    const az = z * 0.3, lz = z * 0.17;
    bones.push(
        ['shoulder' + S, 'chest', [0.2, 0.98, az]], ['elbow' + S, 'shoulder' + S, [0.3, 0.6, az]], ['wrist' + S, 'elbow' + S, [0.34, 0.2, az]],
        ['hip' + S, 'pelvis', [-0.2, 0.55, lz]], ['knee' + S, 'hip' + S, [-0.08, 0.3, lz]], ['ankle' + S, 'knee' + S, [-0.16, 0.09, lz]]
    );
    prims.push(
        ell([0.34, 1.12, z * 0.14], [0.022, 0.032, 0.016], 'head', 0.015, 'skin'),
        cap([0.2, 0.98, az], [0.3, 0.6, az], 0.13, 0.1, 'shoulder' + S, 0.08, 'shirt'),
        ell([0.295, 0.63, az], [0.11, 0.04, 0.11], 'shoulder' + S, 0.02, 'shirt', 0.26),
        cap([0.3, 0.6, az], [0.34, 0.2, az], 0.11, 0.085, 'elbow' + S, 0.05, 'fur'),
        ell([0.36, 0.085, az], [0.085, 0.085, 0.075], 'wrist' + S, 0.04, 'hand'),
        cap([-0.2, 0.55, lz], [-0.08, 0.3, lz], 0.14, 0.1, 'hip' + S, 0.06, 'pants'),
        cap([-0.08, 0.3, lz], [-0.16, 0.09, lz], 0.095, 0.075, 'knee' + S, 0.04, 'pants'),
        ell([-0.08, 0.04, lz], [0.13, 0.042, 0.075], 'ankle' + S, 0.03, 'shoe')
    );
}

const arms = (s, e, x = 0) => ({ aLs: s, aLe: e, aLx: x, aRs: s, aRe: e, aRx: x });
const legs = (h, k) => ({ hLh: h, hLk: k, hRh: h, hRk: k });
const CROUCH = { pitch: -0.15, ...legs(0.4, -0.7), ...arms(0, 0.3) };
const LYING = { roll: 1.35, y: -0.42, snap: 0, aLs: 0.6, aRs: 0.9, aLe: 0.3, neck: -0.2, jaw: 0.3 };
const CHEST_BEAT = { pitch: 0.75, ...arms(1.9, 1.9), jaw: 0.45, beat: 1, ...legs(0.2, -0.2) };

export const dadModel = {
    scale: 1.2,
    stepFrames: 15,
    bones,
    parts: [{ prims, min: [-0.5, -0.04, -0.5], max: [0.64, 1.38, 0.5], step: 0.016 }],
    blend: 0.03,
    ao: 0.035,
    colors: {
        fur: '#2a292d', crown: ['#5f5d63', 1, 0.85], skin: ['#3b3634', 0.35, 0.55], hand: ['#2c2725', 0.4, 0.6],
        shirt: ['#b4cde3', 0.3, 0.9], collar: ['#f2f4f6', 0.3, 0.85], pants: ['#a7946b', 0.35, 0.9], belt: ['#3b2a1e', 0.2, 0.45], shoe: ['#4a2e1b', 0.1, 0.32]
    },
    material: { roughness: 0.85, sheen: 0.4, sheenRoughness: 0.6, sheenColor: '#8a8a96', detail: { mode: 'fur', freq: 80, strength: 0.35, tint: 0.06, freq2: 7 } },
    shade(c, x, y, z, nx, ny) {
        c.multiplyScalar(1 - smooth(ny, 0.1, 0.95) * 0.1);
        c.multiplyScalar(0.94 + fbm(x * 9, y * 9, z * 9) * 0.12);
    },
    accessories(kit) {
        for (const z of [-1, 1]) kit.eye('head', [0.515, 1.115, z * 0.05], 0.015, '#24150c');
        // Glasses
        const frame = { color: '#1b1a1d', roughness: 0.3, metalness: 0.4 };
        for (const z of [-1, 1]) {
            kit.torus('head', [0.55, 1.115, z * 0.053], [0, Math.PI / 2, 0], { radius: 0.03, tube: 0.0045, ...frame });
            kit.disc('head', [0.55, 1.115, z * 0.053], [0, Math.PI / 2, 0], { radius: 0.029, color: '#dfeefa', roughness: 0.05, opacity: 0.22, clearcoat: 1 });
            kit.box('head', [0.46, 1.12, z * 0.11], [0, z * 0.3, 0], { size: [0.17, 0.006, 0.006], ...frame });
        }
        kit.cylinder('head', [0.55, 1.123, 0], [Math.PI / 2, 0, 0], { radiusTop: 0.004, height: 0.036, ...frame });
        // Tie: two hinged pieces hanging from the knot
        const silk = { color: '#ffffff', roughness: 0.55, sheen: 0.5, sheenColor: '#ffd6c8', stripes: { colors: ['#9e2f27', '#d4a23a'] } };
        const upper = kit.group('tieUpper', 'chest', [0.4, 0.92, 0]);
        kit.flat(upper, [0.4, 0.92, 0], [[-0.018, 0], [0.018, 0], [0.032, -0.2], [-0.032, -0.2]], silk);
        kit.roundedBox(upper, [0.405, 0.93, 0], [0, 0, 0], { size: [0.03, 0.04, 0.045], radius: 0.01, ...silk });
        const lower = kit.group('tieLower', upper, [0.4, 0.72, 0]);
        kit.flat(lower, [0.4, 0.72, 0], [[-0.032, 0], [0.032, 0], [0.04, -0.21], [0, -0.26], [-0.04, -0.21]], silk);
    },
    feet: [
        { bone: 'ankleL', offset: [0.08, -0.09, 0] }, { bone: 'ankleR', offset: [0.08, -0.09, 0] },
        { bone: 'wristL', offset: [0.02, -0.2, 0] }, { bone: 'wristR', offset: [0.02, -0.2, 0] }
    ],
    portrait: { target: [0.47, 1.1, 0], distance: 0.85 },

    basePose: { x: 0, y: 0, pitch: 0, roll: 0, yaw: 0, neck: 0, head: 0, jaw: 0, puff: 0, beat: 0, tieSwing: 0, snap: 1, ...arms(0, 0), ...legs(0, 0) },

    cycles: {
        idle: (t) => ({ head: Math.sin(t * 0.01) * 0.06 }),
        // Knuckle-walk: each arm swings with the opposite leg.
        walking: (t) => {
            const ph = (t / 22) * Math.PI * 2, out = {};
            for (const [S, off] of [['L', 0], ['R', Math.PI]]) {
                const s = Math.sin(ph + off), lift = Math.max(0, Math.cos(ph + off));
                const sl = Math.sin(ph + off + Math.PI), ll = Math.max(0, Math.cos(ph + off + Math.PI));
                Object.assign(out, { [`a${S}s`]: s * 0.42, [`a${S}e`]: lift * 0.3, [`h${S}h`]: sl * 0.35, [`h${S}k`]: -ll * 0.5 });
            }
            return out;
        },
        hitstun: (t) => ({ pitch: 0.25, x: -0.05, head: 0.3 + Math.sin(t * 0.9) * 0.04, jaw: 0.4, aLs: 0.4, aRs: 0.5 }),
        dizzy: (t) => ({ roll: Math.sin(t * 0.07) * 0.08, pitch: 0.2, head: Math.sin(t * 0.12) * 0.3, jaw: 0.3, ...arms(0.2, 0.2) }),
        victory: () => CHEST_BEAT
    },

    poses: {
        crouching: CROUCH,
        landing: { ...CROUCH, ...legs(0.3, -0.5) },
        spotdodge: { ...CROUCH, neck: -0.3, ...arms(0.8, 1.2, -0.2) },
        roll: { pitch: -0.4, neck: -0.5, ...arms(1.0, 1.6), ...legs(1.1, -1.5) },
        jumping: { pitch: 0.35, aLs: 1.2, aRs: 1.0, aLe: 0.5, aRe: 0.5, ...legs(0.7, -1.1) },
        falling: { pitch: 0.15, aLs: 2.2, aRs: 2.0, aLe: 0.4, aRe: 0.4, ...legs(0.3, -0.4) },
        airdodge: { pitch: 0.2, ...arms(1.2, 1.4, -0.2), ...legs(0.8, -1.2) },
        helpless: { pitch: 0.1, ...arms(2.4, 0.3, 0.3), ...legs(0.2, -0.2), jaw: 0.3 },
        blocking: { pitch: 0.3, aLs: 1.6, aLe: 1.4, aLx: -0.3, aRs: 1.5, aRe: 1.5, aRx: -0.3, neck: -0.3, head: -0.2 },
        getup: { ...CROUCH, pitch: 0 },
        ledge: { pitch: 1.0, ...arms(3.0, 0.2), ...legs(0.2, -0.3) },
        ledge_climb: { pitch: 0.5, ...arms(1.8, 0.8), ...legs(0.6, -0.9) },
        knockdown: LYING,
        defeat: { ...LYING, neck: -0.4 },
        grabbed: { pitch: 0.35, head: 0.2, jaw: 0.4, ...arms(0.5, 0.3, 0.3), ...legs(0.2, -0.2) },

        attack_windup: { pitch: 0.3, aLs: 1.4, aLe: 1.2, aLx: 0.6, neck: -0.2 },
        attack_strike: { pitch: 0.15, x: 0.1, aLs: 1.4, aLe: 0.1, aLx: -0.2, neck: -0.1, jaw: 0.2 },
        arms_up: { pitch: 0.6, ...arms(3.0, 0.2, 0.1), neck: -0.3, head: 0.3, jaw: 0.3 },
        slam: { pitch: -0.25, x: 0.1, ...arms(1.2, 0), neck: 0.1, jaw: 0.4 },
        chest_pound: CHEST_BEAT,
        breath_windup: { pitch: 0.4, neck: 0.3, head: 0.3, puff: 0.12, jaw: 0.1 },
        breath: { pitch: 0.25, neck: -0.1, head: -0.2, jaw: 0.9 },
        tie_whip: { pitch: 0.35, yaw: -0.4, aLs: 1.5, aLe: 0.6, tieSwing: 1.6 },
        kick: { pitch: -0.35, hLh: -1.2, hLk: 0.2, ...arms(0.3, 0) },
        cannonball: { pitch: 0.2, ...arms(1.0, 1.6), ...legs(1.2, -1.6), neck: -0.3 },
        grab: { pitch: 0.45, aLs: 1.4, aLe: 0.8, aLx: -0.4, aRs: 1.4, aRe: 0.8, aRx: -0.4 },
        crouch_windup: { ...CROUCH, aLs: -0.3 },
        crouch_attack: { ...CROUCH, aLs: 1.0, aLe: 0, aLx: 0.2 },
        air_windup: { pitch: 0.2, aLs: 1.8, aLe: 1.2, ...legs(0.5, -0.8) },
        air_attack: { pitch: 0.1, x: 0.1, aLs: 1.5, aLe: 0, ...legs(0.3, -0.4) }
    },

    apply({ bones: B, extras, state }, p, info) {
        B.body.position.x += p.x;
        B.body.position.y += p.y;
        B.body.rotation.set(p.roll, p.yaw, p.pitch);
        B.chest.scale.setScalar(1 + Math.sin(info.time * 0.027) * 0.012 + p.puff);
        B.neck.rotation.z = p.neck - p.pitch * 0.6; // keep his eyes on the opponent
        B.head.rotation.z = p.head;
        B.jaw.rotation.z = -p.jaw;
        const beat = Math.sin(info.time * 0.27) * 0.3 * p.beat;
        for (const [S, side] of [['L', 1], ['R', -1]]) {
            const s = p[`a${S}s`] + beat * side, e = p[`a${S}e`];
            B['shoulder' + S].rotation.set(-side * p[`a${S}x`], 0, s);
            B['elbow' + S].rotation.z = e;
            B['wrist' + S].rotation.z = -(s + e) * 0.5;
            const hip = p[`h${S}h`], knee = p[`h${S}k`];
            B['hip' + S].rotation.z = hip;
            B['knee' + S].rotation.z = knee;
            B['ankle' + S].rotation.z = -(hip + knee);
        }
        // The tie: a damped pendulum driven by Dad's acceleration, hanging plumb whatever his pitch.
        // A pose's tieSwing (the Tie Whip) yanks it much harder, so it snaps out within a few frames.
        // It can't swing far back: his belly is in the way.
        const tie = state.tie || (state.tie = { a: 0, v: 0, b: 0, bv: 0, vx: 0 });
        const dt = Math.min(info.dt, 1 / 30);
        const accel = ((info.motion[0] - tie.vx) / Math.max(info.dt, 1e-3)) * 0.0006;
        tie.vx = info.motion[0];
        const yank = Math.min(1, Math.abs(p.tieSwing));
        tie.v += (-(tie.a - p.tieSwing) * (30 + 370 * yank) - tie.v * (3.5 + 16 * yank) - accel * 60) * dt;
        const swung = tie.a + tie.v * dt;
        tie.a = clamp(swung, -0.4, 1.8);
        if (tie.a !== swung) tie.v = 0;
        tie.bv += (-(tie.b - tie.a) * 40 - tie.bv * 4) * dt;
        tie.b += tie.bv * dt;
        extras.tieUpper.rotation.z = tie.a - p.pitch;
        extras.tieLower.rotation.z = tie.b - tie.a;
    }
};

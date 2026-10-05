// ============================================================================
// RILEY MODEL — a red short-coated hunting dog on four legs. Faces +x.
// Coordinates are world units (1 = 100 px) in the rest pose, feet at y = 0.
//
// Pose parameters (radians unless noted):
//   x, y           body offset (units)        pitch / roll / yaw   whole-body tilt
//   neck, head     + raises the head          jaw   how far the mouth opens
//   ears           + flaps the ears up        tail  + raises the tail
//   wag            tail wag amount            tailYaw  tail swung to one side
//   pant           panting (idle, victory)
//   fLs fLe fLw    left front leg: shoulder, elbow, wrist (+ swings forward)
//   fRs fRe fRw    right front leg
//   hLh hLk hLa    left hind leg: hip, knee, hock (+ swings forward)
//   hRh hRk hRa    right hind leg
//   snap           1 = keep the paws on the floor while grounded, 0 = lying down
// ============================================================================
import { clamp, fbm, smooth } from '../../render3d/noise.js';
import { cap, ell } from '../../render3d/shapes.js';

const bones = [
    ['body', null, [0, 0.62, 0]], ['pelvis', 'body', [-0.3, 0.62, 0]], ['spine', 'body', [0.05, 0.63, 0]],
    ['chest', 'spine', [0.26, 0.64, 0]], ['neck', 'chest', [0.36, 0.7, 0]], ['head', 'neck', [0.48, 0.88, 0]],
    ['jaw', 'head', [0.55, 0.85, 0]], ['earL', 'head', [0.47, 0.93, 0.075]], ['earR', 'head', [0.47, 0.93, -0.075]],
    ['tail1', 'pelvis', [-0.4, 0.65, 0]], ['tail2', 'tail1', [-0.53, 0.6, 0]], ['tail3', 'tail2', [-0.63, 0.51, 0]]
];
const prims = [
    ell([0.17, 0.6, 0], [0.21, 0.165, 0.125], 'chest', 0.06, 'coat'),
    cap([0.3, 0.6, 0], [0.29, 0.47, 0], 0.085, 0.07, 'chest', 0.06, 'belly'),
    cap([0.24, 0.68, 0], [0.34, 0.66, 0], 0.09, 0.08, 'chest', 0.05, 'coat'),
    cap([0.05, 0.62, 0], [-0.22, 0.64, 0], 0.115, 0.1, 'spine', 0.07, 'coat'),
    ell([-0.3, 0.63, 0], [0.14, 0.12, 0.11], 'pelvis', 0.06, 'coat'),
    cap([0.3, 0.66, 0], [0.46, 0.85, 0], 0.085, 0.065, 'neck', 0.05, 'coat'),
    ell([0.5, 0.9, 0], [0.095, 0.08, 0.075], 'head', 0.03, 'coat'),
    ell([0.53, 0.86, 0], [0.06, 0.05, 0.065], 'head', 0.03, 'coat'),
    cap([0.56, 0.885, 0], [0.7, 0.86, 0], 0.048, 0.033, 'head', 0.03, 'coat'),
    cap([0.54, 0.845, 0], [0.68, 0.835, 0], 0.035, 0.022, 'jaw', 0.02, 'belly'),
    cap([-0.38, 0.655, 0], [-0.53, 0.6, 0], 0.032, 0.027, 'tail1', 0.03, 'coat'),
    cap([-0.53, 0.6, 0], [-0.63, 0.51, 0], 0.027, 0.02, 'tail2', 0.02, 'coat'),
    cap([-0.63, 0.51, 0], [-0.69, 0.4, 0], 0.02, 0.01, 'tail3', 0.015, 'coat')
];
for (const [S, z] of [['L', 1], ['R', -1]]) {
    const fz = z * 0.095, hz = z * 0.09;
    bones.push(
        ['fShoulder' + S, 'chest', [0.31, 0.56, fz]], ['fElbow' + S, 'fShoulder' + S, [0.25, 0.35, fz]], ['fWrist' + S, 'fElbow' + S, [0.27, 0.11, fz]],
        ['hHip' + S, 'pelvis', [-0.31, 0.58, hz]], ['hKnee' + S, 'hHip' + S, [-0.2, 0.37, hz]], ['hHock' + S, 'hKnee' + S, [-0.34, 0.16, hz]]
    );
    prims.push(
        ell([0.48, 0.86, z * 0.083], [0.045, 0.075, 0.016], 'ear' + S, 0.015, 'dark'),
        cap([0.31, 0.56, fz], [0.25, 0.35, fz], 0.062, 0.042, 'fShoulder' + S, 0.04, 'coat'),
        cap([0.25, 0.35, fz], [0.27, 0.11, fz], 0.038, 0.027, 'fElbow' + S, 0.025, 'coat'),
        cap([0.27, 0.11, fz], [0.3, 0.04, fz], 0.026, 0.024, 'fWrist' + S, 0.02, 'coat'),
        ell([0.31, 0.028, fz], [0.045, 0.028, 0.034], 'fWrist' + S, 0.02, 'paw'),
        cap([-0.3, 0.6, hz], [-0.2, 0.37, hz], 0.085, 0.048, 'hHip' + S, 0.05, 'coat'),
        cap([-0.2, 0.37, hz], [-0.34, 0.16, hz], 0.042, 0.028, 'hKnee' + S, 0.025, 'coat'),
        cap([-0.34, 0.16, hz], [-0.32, 0.04, hz], 0.026, 0.023, 'hHock' + S, 0.02, 'coat'),
        ell([-0.3, 0.028, hz], [0.045, 0.028, 0.034], 'hHock' + S, 0.02, 'paw')
    );
}

/** Both front legs or both hind legs at once. */
const front = (s, e, w) => ({ fLs: s, fLe: e, fLw: w, fRs: s, fRe: e, fRw: w });
const hind = (h, k, a) => ({ hLh: h, hLk: k, hLa: a, hRh: h, hRk: k, hRa: a });
const CROUCH = { ...front(-0.35, 0.7, -0.35), ...hind(0.45, -0.65, 0.3), neck: -0.1, head: 0.05, ears: 0.3, tail: 0.1 };
const LYING = { roll: 1.45, y: -0.45, snap: 0, neck: -0.2, fLs: 0.4, fLe: 0.1, fRs: 0.2, hLh: 0.3, hRh: 0.2, tail: -0.3, jaw: 0.3, ears: 1 };

/** Trot: diagonal pairs of legs swing together. */
function trot(t, period) {
    const ph = (t / period) * Math.PI * 2, out = {};
    for (const [S, offF, offH] of [['L', 0, Math.PI], ['R', Math.PI, 0]]) {
        const sf = Math.sin(ph + offF), lf = Math.max(0, Math.cos(ph + offF));
        const sh = Math.sin(ph + offH), lh = Math.max(0, Math.cos(ph + offH));
        Object.assign(out, { [`f${S}s`]: sf * 0.5, [`f${S}e`]: lf * 0.5, [`f${S}w`]: -lf * 1.1, [`h${S}h`]: sh * 0.45, [`h${S}k`]: lh * 0.35, [`h${S}a`]: -lh * 0.6 });
    }
    return { ...out, y: Math.abs(Math.sin(ph)) * 0.02, pitch: -0.03, neck: -0.12, tail: 0.4, wag: 0.3, ears: 0.2 };
}

export const rileyModel = {
    scale: 1.15,
    stepFrames: 13,
    bones,
    parts: [{ prims, min: [-0.78, -0.03, -0.2], max: [0.8, 1.08, 0.2], step: 0.013 }],
    colors: { coat: '#a8582a', dark: '#8a4520', belly: '#c58149', paw: ['#94502a', 0.6, 0.7] },
    material: { roughness: 0.82, sheen: 0.8, sheenRoughness: 0.5, sheenColor: '#e2a46f', detail: { mode: 'fur', freq: 70, strength: 0.35, tint: 0.07, freq2: 9 } },
    ao: 0.02,
    shade(c, x, y, z, nx, ny, nz, cols) {
        c.multiplyScalar(1 - smooth(ny, 0.1, 0.95) * 0.2);           // darker along the back
        c.lerp(cols.belly.c, smooth(-ny, 0.25, 0.95) * 0.45);          // paler underneath
        c.multiplyScalar(0.94 + fbm(x * 7 + 3, y * 7, z * 7) * 0.12);
    },
    accessories(kit) {
        for (const z of [-1, 1]) kit.eye('head', [0.567, 0.912, z * 0.052], 0.016, '#2a1608');
        kit.ellipsoid('head', [0.729, 0.872, 0], [0.022, 0.02, 0.026], { color: '#3b2219', roughness: 0.3, clearcoat: 0.6 });
    },
    /** Bone-local points at the bottom of each paw, for keeping them on the floor. */
    feet: [
        { bone: 'fWristL', offset: [0.04, -0.11, 0] }, { bone: 'fWristR', offset: [0.04, -0.11, 0] },
        { bone: 'hHockL', offset: [0.04, -0.16, 0] }, { bone: 'hHockR', offset: [0.04, -0.16, 0] }
    ],
    portrait: { target: [0.56, 0.86, 0], distance: 0.72 },

    basePose: {
        x: 0, y: 0, pitch: 0, roll: 0, yaw: 0, neck: 0, head: 0, jaw: 0, ears: 0, tail: 0.3, wag: 0.5, tailYaw: 0, pant: 0, snap: 1,
        ...front(0, 0, 0), ...hind(0, 0, 0)
    },

    cycles: {
        idle: (t) => ({ neck: Math.sin(t * 0.05) * 0.02, head: Math.sin(t * 0.012) * 0.08, pant: 1 }),
        walking: (t) => trot(t, 14),
        // Running plays at 1.7x: a bounding gallop, front legs together then hind legs together.
        running: (t) => {
            const ph = (t / 16) * Math.PI * 2, f = Math.sin(ph), h = Math.sin(ph + Math.PI);
            return {
                ...front(f * 0.75, Math.max(0, Math.cos(ph)) * 0.6, -Math.max(0, Math.cos(ph)) * 1.2), fRs: Math.sin(ph - 0.3) * 0.75,
                ...hind(h * 0.6, Math.max(0, Math.cos(ph + Math.PI)) * 0.4, -Math.max(0, Math.cos(ph + Math.PI)) * 0.7), hRh: Math.sin(ph + Math.PI - 0.3) * 0.6,
                pitch: f * 0.08, neck: -0.2 + f * 0.06, tail: 0.5, wag: 0.1, ears: -0.6, jaw: 0.25
            };
        },
        hitstun: (t) => ({ pitch: 0.2 + Math.sin(t * 0.9) * 0.03, neck: 0.3, head: 0.2, jaw: 0.35, ears: 1, tail: -0.4, wag: 0, fLs: -0.3, fRs: -0.2, hLh: 0.2 }),
        dizzy: (t) => ({ roll: Math.sin(t * 0.1) * 0.15, neck: -0.25 + Math.sin(t * 0.07) * 0.1, head: Math.sin(t * 0.15) * 0.3, jaw: 0.3, ears: 1, tail: -0.3, wag: 0 }),
        // Sit, wag hard and bark.
        victory: (t) => ({
            pitch: 0.55, x: -0.08, ...front(-0.55, 0, 0), ...hind(0.6, -1.4, 1.3),
            neck: 0.15 + Math.sin(t * 0.2) * 0.04, head: -0.25, jaw: 0.2 + Math.max(0, Math.sin(t * 0.2)) * 0.45, wag: 1.6, tail: -0.1
        }),
        // Spinning moves: legs flung out, tail straight back. The spin itself comes from the move.
        spin: (t) => ({ ...front(0.9, 0.1, 0), ...hind(-0.8, 0.1, 0.2), tail: 1, wag: 0, neck: -0.2 + Math.sin(t * 0.8) * 0.05, ears: -0.8, jaw: 0.3 })
    },

    poses: {
        crouching: CROUCH,
        landing: { ...CROUCH, ...front(-0.2, 0.4, -0.2), ...hind(0.3, -0.4, 0.2) },
        spotdodge: { ...CROUCH, neck: -0.35, ears: -0.6 },
        roll: { pitch: -0.4, neck: -0.6, ...front(0.6, 1.2, -1.2), ...hind(1.0, -1.2, 0.6), tail: -0.5, wag: 0, ears: -0.8 },
        jumping: { pitch: 0.28, neck: -0.1, fLs: 0.9, fLe: 0.5, fLw: -1.4, fRs: 0.8, fRe: 0.5, fRw: -1.3, hLh: -0.7, hLk: -0.2, hLa: 0.7, hRh: -0.65, hRk: -0.2, hRa: 0.65, tail: 0.2, wag: 0, ears: -0.6 },
        falling: { pitch: -0.15, neck: 0.1, fLs: 0.5, fLw: -0.2, fRs: 0.45, hLh: 0.3, hRh: 0.25, tail: 0.5, wag: 0, ears: 0.8 },
        airdodge: { pitch: 0.1, ...front(0.5, 0.9, -1), ...hind(0.6, -0.8, 0.5), tail: -0.2, wag: 0, ears: -0.7 },
        helpless: { pitch: -0.25, ...front(0.2, 0, 0), ...hind(0.2, 0, 0), ears: 1, tail: 0.9, wag: 0, jaw: 0.3 },
        blocking: { ...front(-0.3, 0.6, -0.3), ...hind(0.35, -0.5, 0.25), pitch: -0.1, neck: -0.2, head: 0.15, ears: -0.5, tail: -0.2, wag: 0 },
        getup: { pitch: 0.1, neck: 0.1, fLs: 0.2, fRs: -0.1, ...hind(0.4, -0.6, 0.3), ears: 0.2 },
        ledge: { pitch: 0.9, neck: 0.3, fLs: 2.2, fLe: 0.2, fRs: 2.1, fRe: 0.2, hLh: 0.3, hRh: 0.2, tail: -0.5, wag: 0, ears: 0.6 },
        ledge_climb: { pitch: 0.4, neck: 0.1, ...front(1.0, 0.6, -0.6), ...hind(0.5, -0.8, 0.4) },
        knockdown: LYING,
        defeat: { ...LYING, neck: -0.4, jaw: 0.1 },
        grab: { x: 0.1, neck: -0.2, head: 0.2, jaw: 0.25, fLs: 0.5, fRs: 0.4, tail: 0.5, wag: 0.4 },
        grabbed: { pitch: 0.3, neck: 0.3, head: 0.2, jaw: 0.4, ...front(0.2, 0, 0), ...hind(0.3, 0, 0), ears: 1, tail: -0.4, wag: 0 },

        // Attacks: windup (anticipation) → strike. The jab is a raised-paw swipe.
        attack_windup: { x: -0.04, pitch: 0.05, neck: 0.1, fLs: -0.3, fLe: 0.5, fLw: -0.6, hLh: 0.2, hLk: -0.25, hLa: 0.1, ears: 0.3, tail: 0.5, wag: 0 },
        attack_strike: { x: 0.1, pitch: 0.15, neck: -0.05, fLs: 1.3, fLe: 0.2, fLw: -0.2, fRs: -0.1, hLh: -0.25, hRh: -0.2, ears: -0.2, jaw: 0.2, tail: 0.2, wag: 0 },
        headbutt: { x: 0.14, pitch: -0.15, neck: -0.45, head: -0.25, fLs: 0.4, fRs: 0.35, hLh: -0.5, hLk: 0.1, hLa: 0.4, hRh: -0.45, ears: -0.8, tail: 0, wag: 0 },
        bark: { pitch: 0.12, neck: 0.35, head: 0.25, jaw: 0.8, ears: -0.5, fLs: 0.1, fRs: 0.1, tail: 0.8, wag: 0.2 },
        bite: { x: 0.12, pitch: -0.04, neck: -0.3, head: 0.2, jaw: 0.7, fLs: 0.3, fRs: 0.25, hLh: -0.3, hRh: -0.25, ears: -0.6, tail: 0.3, wag: 0 },
        ear_flick: { pitch: 0.25, neck: 0.55, head: 0.45, jaw: 0.3, ears: 1.2, fLs: 0.2, fRs: 0.15, hLh: 0.1, wag: 0 },
        crouch_windup: { ...CROUCH, x: -0.04, tail: 0.6, hLh: 0.55, wag: 0 },
        crouch_attack: { ...CROUCH, yaw: 0.5, tail: 0.1, tailYaw: 1.2, wag: 0, hLh: -0.4, hLk: 0.3 },
        air_windup: { pitch: 0.1, neck: 0.1, ...front(0.2, 0.6, -1), ...hind(0.5, -0.6, 0.4), tail: 0.3, wag: 0 },
        air_attack: { pitch: -0.05, neck: -0.2, head: 0.1, jaw: 0.5, fLs: 1.4, fLe: 0.1, fLw: -0.1, fRs: 1.3, fRe: 0.1, hLh: -0.8, hLk: -0.1, hLa: 0.6, hRh: -0.75, tail: 0.2, wag: 0, ears: -0.7 },
        slide: { y: -0.3, snap: 0, pitch: -0.08, fLs: 1.3, fLe: 0.2, fRs: 1.2, hLh: -1.2, hLk: 0.2, hLa: 0.5, hRh: -1.15, neck: -0.1, head: 0.2, jaw: 0.4, ears: -1, tail: 0.1, wag: 0 },
        tail_whip: { yaw: 0.9, pitch: -0.1, neck: 0.1, tail: 0.2, tailYaw: -1.4, wag: 0, hLh: -0.6, hLk: 0.3, hLa: 0.3 },
        stomp: { pitch: -0.2, ...front(0.1, 0, 0), ...hind(0.1, 0, 0), neck: -0.2, ears: 1.2, tail: 0.9, wag: 0 }
    },

    apply({ bones: B }, p, info) {
        B.body.position.x += p.x;
        B.body.position.y += p.y;
        B.body.rotation.set(p.roll, p.yaw, p.pitch);
        B.chest.scale.setScalar(1 + Math.sin(info.time * 0.05) * 0.012);
        B.neck.rotation.z = p.neck;
        B.head.rotation.z = p.head;
        B.jaw.rotation.z = -(p.jaw + p.pant * (0.1 + Math.sin(info.time * 0.15) * 0.05));
        B.tail1.rotation.z = -p.tail;
        const wag = p.tailYaw + Math.sin(info.time * 0.15) * p.wag;
        B.tail1.rotation.y = wag * 0.5;
        B.tail2.rotation.y = wag * 0.6;
        B.tail3.rotation.y = wag * 0.6;
        const lift = p.ears + clamp(info.motion[1] * 0.05, -0.4, 0.6); // ears lag behind vertical motion
        B.earL.rotation.x = -lift * 0.5;
        B.earR.rotation.x = lift * 0.5;
        B.earL.rotation.z = B.earR.rotation.z = -lift * 0.3;
        for (const S of ['L', 'R']) {
            B['fShoulder' + S].rotation.z = p[`f${S}s`];
            B['fElbow' + S].rotation.z = p[`f${S}e`];
            B['fWrist' + S].rotation.z = p[`f${S}w`];
            B['hHip' + S].rotation.z = p[`h${S}h`];
            B['hKnee' + S].rotation.z = p[`h${S}k`];
            B['hHock' + S].rotation.z = p[`h${S}a`];
        }
    }
};

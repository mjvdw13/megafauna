// ============================================================================
// RANDY MODEL — a triceratops with realistic proportions. Faces +x, feet at y = 0.
//
// Pose parameters (radians unless noted):
//   x, y, pitch, roll, yaw    body offset (units) and tilt (pitch + = nose up)
//   neck, head                + raises (head down = horns forward, frill up like a shield)
//   jaw                       beak opening       bellow   head shake while roaring
//   tail, tailYaw             tail raised / swung to one side; sway = idle swish amount
//   fLs fLe fLw, fRs fRe fRw  front legs: shoulder, elbow, wrist (+ swings forward)
//   hLh hLk hLa, hRh hRk hRa  hind legs: hip, knee, ankle
//   snap                      1 = keep the feet on the floor while grounded
// ============================================================================
import { fbm, smooth } from '../../render3d/noise.js';
import { cap, ell } from '../../render3d/shapes.js';

const bones = [
    ['body', null, [0, 0.78, 0]], ['pelvis', 'body', [-0.4, 0.82, 0]], ['chest', 'body', [0.32, 0.74, 0]],
    ['neck', 'chest', [0.62, 0.72, 0]], ['head', 'neck', [0.8, 0.72, 0]], ['jaw', 'head', [0.95, 0.58, 0]],
    ['tail1', 'pelvis', [-0.68, 0.8, 0]], ['tail2', 'tail1', [-1.02, 0.72, 0]], ['tail3', 'tail2', [-1.32, 0.6, 0]]
];
const frillC = [0.54, 1.04, 0], frillRz = 0.65;
const prims = [
    ell([-0.05, 0.8, 0], [0.6, 0.37, 0.36], 'body', 0.1, 'skin'),
    ell([0, 0.62, 0], [0.5, 0.24, 0.31], 'body', 0.1, 'belly'),
    ell([0.36, 0.7, 0], [0.3, 0.3, 0.3], 'chest', 0.1, 'skin'),
    ell([-0.42, 0.82, 0], [0.32, 0.3, 0.29], 'pelvis', 0.1, 'skin'),
    cap([0.5, 0.74, 0], [0.74, 0.72, 0], 0.24, 0.2, 'neck', 0.08, 'skin'),
    cap([0.76, 0.75, 0], [1.08, 0.62, 0], 0.17, 0.11, 'head', 0.06, 'skin'),
    cap([1.02, 0.62, 0], [1.24, 0.53, 0], 0.095, 0.055, 'head', 0.04, 'skin'),
    cap([1.2, 0.54, 0], [1.32, 0.45, 0], 0.05, 0.012, 'head', 0.02, 'beak'),
    cap([0.88, 0.56, 0], [1.22, 0.46, 0], 0.085, 0.035, 'jaw', 0.03, 'belly'),
    ell(frillC, [0.035, 0.32, 0.42], 'head', 0.05, 'frill', frillRz),
    cap([-0.62, 0.84, 0], [-1.02, 0.72, 0], 0.2, 0.13, 'tail1', 0.08, 'skin'),
    cap([-1.02, 0.72, 0], [-1.32, 0.6, 0], 0.13, 0.075, 'tail2', 0.05, 'skin'),
    cap([-1.32, 0.6, 0], [-1.58, 0.5, 0], 0.075, 0.02, 'tail3', 0.03, 'skin')
];
for (let i = 0; i <= 10; i++) { // bony knobs around the frill's rim
    const th = ((-100 + i * 20) * Math.PI) / 180, yl = 0.32 * Math.cos(th), zl = 0.42 * Math.sin(th);
    prims.push(ell([frillC[0] - yl * Math.sin(frillRz), frillC[1] + yl * Math.cos(frillRz), zl], [0.035, 0.035, 0.035], 'head', 0.02, 'rim'));
}
for (const [S, z] of [['L', 1], ['R', -1]]) {
    const fz = z * 0.27, hz = z * 0.25;
    bones.push(
        ['fShoulder' + S, 'chest', [0.42, 0.58, fz]], ['fElbow' + S, 'fShoulder' + S, [0.37, 0.33, fz]], ['fWrist' + S, 'fElbow' + S, [0.42, 0.11, fz]],
        ['hHip' + S, 'pelvis', [-0.4, 0.7, hz]], ['hKnee' + S, 'hHip' + S, [-0.26, 0.42, hz]], ['hAnkle' + S, 'hKnee' + S, [-0.38, 0.15, hz]]
    );
    prims.push(
        ell([0.9, 0.58, z * 0.16], [0.06, 0.05, 0.04], 'head', 0.03, 'skin'),
        cap([0.42, 0.62, fz], [0.37, 0.33, fz], 0.13, 0.09, 'fShoulder' + S, 0.08, 'skin'),
        cap([0.37, 0.33, fz], [0.42, 0.1, fz], 0.085, 0.07, 'fElbow' + S, 0.04, 'skin'),
        ell([0.45, 0.05, fz], [0.1, 0.055, 0.095], 'fWrist' + S, 0.03, 'foot'),
        cap([-0.4, 0.76, hz], [-0.26, 0.42, hz], 0.2, 0.11, 'hHip' + S, 0.1, 'skin'),
        cap([-0.26, 0.42, hz], [-0.38, 0.15, hz], 0.1, 0.075, 'hKnee' + S, 0.04, 'skin'),
        ell([-0.33, 0.05, hz], [0.12, 0.055, 0.1], 'hAnkle' + S, 0.03, 'foot')
    );
}

const front = (s, e, w) => ({ fLs: s, fLe: e, fLw: w, fRs: s, fRe: e, fRw: w });
const hind = (h, k, a) => ({ hLh: h, hLk: k, hLa: a, hRh: h, hRk: k, hRa: a });
const CROUCH = { ...front(-0.3, 0.6, -0.3), ...hind(0.3, -0.5, 0.2), neck: -0.1 };
const LYING = { roll: 1.3, y: -0.4, snap: 0, ...front(0.3, 0, 0), ...hind(0.2, 0, 0), neck: -0.1, jaw: 0.3 };

function walk(t, period) {
    const ph = (t / period) * Math.PI * 2, out = {};
    for (const [S, offF, offH] of [['L', 0, Math.PI], ['R', Math.PI, 0]]) {
        const sf = Math.sin(ph + offF), lf = Math.max(0, Math.cos(ph + offF));
        const sh = Math.sin(ph + offH), lh = Math.max(0, Math.cos(ph + offH));
        Object.assign(out, { [`f${S}s`]: sf * 0.35, [`f${S}e`]: lf * 0.3, [`f${S}w`]: -lf * 0.6, [`h${S}h`]: sh * 0.35, [`h${S}k`]: lh * 0.3, [`h${S}a`]: -lh * 0.5 });
    }
    return { ...out, neck: -0.05 + Math.sin(ph * 2) * 0.03, sway: 0.18 };
}

export const randyModel = {
    scale: 0.9,
    stepFrames: 20,
    bones,
    parts: [{ prims, min: [-1.68, -0.04, -0.5], max: [1.42, 1.44, 0.5], step: 0.022 }],
    blend: 0.04,
    ao: 0.045,
    colors: { skin: '#6f6b4a', belly: '#a59a76', beak: ['#2f2a24', 0.2, 0.45], frill: '#7a5b3e', rim: '#4f3b2a', foot: ['#4e4b35', 0.6, 0.8] },
    material: { roughness: 0.72, sheen: 0.15, sheenColor: '#c8c3a0', detail: { mode: 'scales', freq: 28, strength: 0.55, tint: 0.12, freq2: 5 } },
    shade(c, x, y, z, nx, ny, nz, cols) {
        const back = smooth(ny, 0.0, 0.9);
        c.multiplyScalar(1 - back * 0.3);
        c.multiplyScalar(1 - back * 0.25 * smooth(fbm(x * 4 + 1, y * 2, z * 4), 0.45, 0.65)); // mottled saddle
        c.lerp(cols.belly.c, smooth(-ny, 0.3, 0.95) * 0.4);
        c.multiplyScalar(0.92 + fbm(x * 9, y * 9 + 5, z * 9) * 0.16);
    },
    accessories(kit) {
        for (const z of [-1, 1]) {
            kit.horn('head', [0.95, 0.77, z * 0.085], [z * 0.25, 0, -1.05], { length: 0.55, radius: 0.05, curve: 0.25 });
            kit.eye('head', [0.97, 0.69, z * 0.122], 0.026, '#1d140c');
            for (const dz of [-0.06, 0, 0.06]) {
                const nail = { radius: 0.022, height: 0.06, color: '#cfc4a8', roughness: 0.5 };
                kit.cone('fWrist' + (z > 0 ? 'L' : 'R'), [0.54, 0.03, z * 0.27 + dz], [0, 0, -Math.PI / 2], nail);
                kit.cone('hAnkle' + (z > 0 ? 'L' : 'R'), [-0.22, 0.03, z * 0.25 + dz], [0, 0, -Math.PI / 2], nail);
            }
        }
        kit.horn('head', [1.19, 0.6, 0], [0, 0, -0.5], { length: 0.17, radius: 0.04, curve: 0.1 });
    },
    feet: [
        { bone: 'fWristL', offset: [0.03, -0.11, 0] }, { bone: 'fWristR', offset: [0.03, -0.11, 0] },
        { bone: 'hAnkleL', offset: [0.05, -0.15, 0] }, { bone: 'hAnkleR', offset: [0.05, -0.15, 0] }
    ],
    portrait: { target: [1.0, 0.75, 0], distance: 1.2 },

    basePose: {
        x: 0, y: 0, pitch: 0, roll: 0, yaw: 0, neck: 0, head: 0, jaw: 0, bellow: 0, tail: 0, tailYaw: 0, sway: 0.08, snap: 1,
        ...front(0, 0, 0), ...hind(0, 0, 0)
    },

    cycles: {
        idle: (t) => ({ neck: Math.sin(t * 0.022) * 0.03, head: Math.sin(t * 0.03 + 1) * 0.03 }),
        walking: (t) => walk(t, 31),
        hitstun: (t) => ({ pitch: 0.15, neck: 0.3, head: 0.2 + Math.sin(t * 0.9) * 0.04, jaw: 0.35, x: -0.04 }),
        dizzy: (t) => ({ roll: Math.sin(t * 0.08) * 0.1, neck: -0.2 + Math.sin(t * 0.06) * 0.1, head: Math.sin(t * 0.13) * 0.25, jaw: 0.25 }),
        victory: (t) => ({ neck: 0.35, head: 0.3, jaw: 0.45 + Math.sin(t * 0.3) * 0.05, bellow: 1, sway: 0.4 })
    },

    poses: {
        crouching: CROUCH,
        landing: { ...CROUCH, ...front(-0.2, 0.4, -0.2) },
        spotdodge: { ...CROUCH, neck: -0.4, head: -0.3 },
        roll: { pitch: -0.3, neck: -0.5, head: -0.4, ...front(0.5, 0.8, -0.8), ...hind(0.7, -0.9, 0.5) },
        jumping: { pitch: 0.12, ...front(0.5, 0.3, -0.8), ...hind(-0.4, 0, 0.4), tail: 0.15 },
        falling: { pitch: -0.08, ...front(0.3, 0, 0), ...hind(0.2, 0, 0), tail: 0.1 },
        airdodge: { pitch: 0.05, ...front(0.5, 0.6, -0.7), ...hind(0.5, -0.6, 0.4), neck: -0.2 },
        helpless: { pitch: -0.15, ...front(0.2, 0, 0), ...hind(0.2, 0, 0), jaw: 0.3, tail: 0.3 },
        blocking: { ...front(-0.2, 0.4, -0.2), ...hind(0.15, -0.25, 0.1), pitch: -0.08, neck: -0.4, head: -0.5 },
        getup: { ...CROUCH, neck: 0.1 },
        ledge: { pitch: 0.9, neck: 0.3, head: -0.2, ...front(2.0, 0.2, 0), ...hind(0.3, 0, 0), tail: -0.3 },
        ledge_climb: { pitch: 0.35, ...front(1.0, 0.5, -0.5), ...hind(0.4, -0.6, 0.3) },
        knockdown: LYING,
        defeat: { ...LYING, neck: -0.35, jaw: 0.15 },
        grab: { x: 0.1, neck: -0.3, head: -0.4, fLs: 0.2, fRs: 0.15 },
        grabbed: { pitch: 0.2, neck: 0.3, head: 0.2, jaw: 0.4, ...front(0.3, 0, 0) },

        attack_windup: { x: -0.1, pitch: 0.05, neck: 0.25, head: 0.1, fLs: -0.1, hLh: 0.15 },
        attack_strike: { x: 0.2, pitch: -0.1, neck: -0.25, head: -0.3, fLs: 0.25, fRs: 0.1, hLh: -0.25, hRh: -0.2 },
        attack_rear: { pitch: 0.45, ...front(0.6, 0.5, -0.6), neck: 0.2, head: 0.2, jaw: 0.4, tail: -0.2 },
        attack_charge: { x: 0.25, pitch: -0.12, neck: -0.35, head: -0.4, fLs: 0.35, fRs: 0.2, hLh: -0.4, hRh: -0.3 },
        attack_toss: { pitch: 0.12, neck: 0.5, head: 0.5, jaw: 0.3, fLs: 0.1 },
        tail_swat: { yaw: 0.6, pitch: -0.05, tailYaw: -1.2, tail: 0.1, hLh: -0.2, sway: 0 },
        crouch_windup: { ...CROUCH, neck: -0.45, head: -0.5 },
        crouch_attack: { ...CROUCH, x: 0.15, neck: -0.6, head: -0.2, jaw: 0.3 },
        air_windup: { ...front(0.4, 0.4, -0.6), ...hind(0.3, -0.4, 0.3), neck: 0.15, head: 0.1 },
        air_attack: { pitch: -0.15, neck: -0.3, head: -0.4, ...front(0.6, 0, 0), ...hind(-0.4, 0, 0.2) }
    },

    apply({ bones: B }, p, info) {
        B.body.position.x += p.x;
        B.body.position.y += p.y;
        B.body.rotation.set(p.roll, p.yaw, p.pitch);
        B.chest.scale.setScalar(1 + Math.sin(info.time * 0.03) * 0.008);
        B.neck.rotation.z = p.neck;
        B.head.rotation.z = p.head + Math.sin(info.time * 0.37) * 0.015 * p.bellow;
        B.jaw.rotation.z = -p.jaw;
        B.tail1.rotation.z = -p.tail;
        const t = info.time * 0.023;
        B.tail1.rotation.y = p.tailYaw * 0.5 + Math.sin(t) * p.sway;
        B.tail2.rotation.y = p.tailYaw * 0.3 + Math.sin(t - 0.6) * p.sway * 1.2;
        B.tail3.rotation.y = p.tailYaw * 0.2 + Math.sin(t - 1.2) * p.sway * 1.4;
        for (const S of ['L', 'R']) {
            B['fShoulder' + S].rotation.z = p[`f${S}s`];
            B['fElbow' + S].rotation.z = p[`f${S}e`];
            B['fWrist' + S].rotation.z = p[`f${S}w`];
            B['hHip' + S].rotation.z = p[`h${S}h`];
            B['hKnee' + S].rotation.z = p[`h${S}k`];
            B['hAnkle' + S].rotation.z = p[`h${S}a`];
        }
    }
};

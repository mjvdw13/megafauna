// ============================================================================
// WORLD KIT
// The toolbox a stage's world(kit) builds its 3-D scene with. Coordinates are
// world units (1 = 100 px): x = 0 is the middle of the screen, y = 0 is the top
// of the main platform, z points at the camera (fighters fight at z = 0).
//
//   Atmosphere   sky, light, fog, stars, moon, aurora
//   Land         terrain, forest, tree, rocks, ferns, bushes, reeds
//   The arena    ground (main platform), platforms, pit (built automatically)
//   Props        fence, house, lilyPads, floes, bones, volcano, sauropods
//   Particles    snow, embers, fireflies, mist, bubbles, leaves
//
// Distant scenery is lit once (light baked into vertex colors, drawn unlit);
// the arena and props near the fighters get real lighting and shadows.
// ============================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { addRest, DETAIL, getNoiseTexture, materialTime, paintVertices, withDetail } from './materials.js';
import { fbm, hash3, lerp, ridged, rng, smooth } from './noise.js';
import { bakeSky, sunDirection } from './sky.js';

const C = (hex) => new THREE.Color(hex);
const DEPTH = 3.2; // main platform front-to-back (world units)

// ---------------------------------------------------------------------------- shared helpers

function bakeLight(geometry, dir, intensity, ambient) {
    const n = geometry.attributes.normal, c = geometry.attributes.color, k = intensity / Math.PI;
    for (let i = 0; i < c.count; i++) {
        const l = ambient + k * Math.max(0, n.getX(i) * dir.x + n.getY(i) * dir.y + n.getZ(i) * dir.z);
        c.setXYZ(i, c.getX(i) * l, c.getY(i) * l, c.getZ(i) * l);
    }
    return geometry;
}

function jitterGeometry(geo, amount, seed, keepAbove = Infinity) {
    const p = geo.attributes.position, r = rng(seed), memo = new Map();
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y >= keepAbove) continue;
        const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
        if (!memo.has(key)) memo.set(key, [(r() - 0.5) * amount, (r() - 0.5) * amount, (r() - 0.5) * amount]);
        const d = memo.get(key);
        p.setXYZ(i, x + d[0], y + d[1], z + d[2]);
    }
    geo.computeVertexNormals();
    return geo;
}

const tint = (geo, hex) => paintVertices(geo, () => C(hex));

/** Merge shapes into one geometry (mixing indexed and non-indexed pieces is fine). */
const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

let softTexture = null;
function getSoftTexture() {
    if (!softTexture && typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        softTexture = new THREE.CanvasTexture(c);
        softTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return softTexture;
}

/** A detailed (bump-mapped) lit material. */
function surface(color, { roughness = 0.9, metalness = 0, mode = DETAIL.ROCK, freq = 18, strength = 0.6, tint: t = 0.15, freq2 = 3, vertexColors = false, ...rest } = {}) {
    return withDetail(new THREE.MeshStandardMaterial({ color, roughness, metalness, vertexColors, ...rest }), { mode, freq, strength, tint: t, freq2 });
}

function mesh(parent, geometry, material, pos = [0, 0, 0], { rot = [0, 0, 0], scale = [1, 1, 1], cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.scale.set(...scale);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
}

// ---------------------------------------------------------------------------- vegetation shapes (unit size)

const TREE_SHAPES = {
    /** A spruce: tiers of drooping, ragged branch skirts, darker toward the trunk. */
    conifer({ snow = false, dark = '#22381f', light = '#3a5a32' } = {}) {
        const parts = [tint(new THREE.CylinderGeometry(0.02, 0.035, 0.35, 6).translate(0, 0.17, 0), '#4a3626')];
        const tiers = 7;
        for (let i = 0; i < tiers; i++) {
            const k = i / (tiers - 1), r = 0.3 * (1 - k * 0.85) + 0.03, h = 0.26 - k * 0.08;
            const cone = new THREE.ConeGeometry(r, h, 11, 3, true);
            const cp = cone.attributes.position;
            for (let v = 0; v < cp.count; v++) {
                const x = cp.getX(v), y = cp.getY(v), z = cp.getZ(v), edge = Math.hypot(x, z) / r;
                const rag = 0.8 + hash3(v, i, 3) * 0.4;
                cp.setXYZ(v, x * rag, y - edge * edge * h * 0.35, z * rag); // branch tips droop
            }
            cone.computeVertexNormals();
            cone.translate(0, 0.22 + k * 0.78 + h / 2, 0);
            const lo = C(dark), hi = C(light), white = C('#eef3f7');
            parts.push(paintVertices(cone, (x, y, z, ny) => {
                const out = Math.min(1, Math.hypot(x, z) / r);
                const col = lo.clone().lerp(hi, out * 0.8 + hash3(Math.round(x * 50), i, 7) * 0.2);
                // Snow settles in patches on the upper side of the outer branches.
                const snowy = snow ? smooth(ny, 0.45, 0.8) * smooth(out, 0.5, 0.9) * (hash3(Math.round(x * 40), Math.round(z * 40), i) > 0.35 ? 1 : 0) : 0;
                return col.lerp(white, snowy);
            }));
        }
        return merge(parts);
    },
    /** A leafy tree: trunk and limbs under a canopy of lumpy, noise-shaped foliage clusters. */
    broadleaf({ dark = '#2f5223', light = '#6f9a44', detail = 2, blobs = 10 } = {}) {
        const bark = '#5a4130';
        const parts = [tint(new THREE.CylinderGeometry(0.03, 0.06, 0.6, 7).translate(0, 0.3, 0), bark)];
        const r = rng(17);
        for (let i = 0; i < 3; i++) {
            const limb = new THREE.CylinderGeometry(0.012, 0.025, 0.35, 5).translate(0, 0.17, 0);
            limb.rotateZ(0.6 + r() * 0.3);
            limb.rotateY((i / 3) * Math.PI * 2);
            parts.push(tint(limb.translate(0, 0.45, 0), bark));
        }
        for (let i = 0; i < blobs; i++) {
            const a = r() * Math.PI * 2, d = 0.08 + r() * 0.22;
            parts.push(foliage(0.17 + r() * 0.1, i * 7 + 3, dark, light, detail).translate(Math.cos(a) * d, 0.62 + r() * 0.32, Math.sin(a) * d));
        }
        return merge(parts);
    },
    acacia() {
        const parts = [tint(new THREE.CylinderGeometry(0.025, 0.045, 0.7, 6).translate(0, 0.35, 0), '#5d4532')];
        const r = rng(23);
        for (let i = 0; i < 6; i++) {
            const blob = new THREE.IcosahedronGeometry(0.22, 1);
            blob.scale(1.3, 0.35, 1.3);
            blob.translate((r() - 0.5) * 0.5, 0.72 + r() * 0.08, (r() - 0.5) * 0.5);
            parts.push(tint(jitterGeometry(blob, 0.04, i + 9), i % 2 ? '#6d7a3a' : '#5b6b31'));
        }
        return merge(parts);
    },
    araucaria() {
        const parts = [tint(new THREE.CylinderGeometry(0.025, 0.05, 1.1, 6).translate(0, 0.55, 0), '#4f3a2a')];
        for (let i = 0; i < 4; i++) {
            const tuft = new THREE.IcosahedronGeometry(0.2 - i * 0.03, 1);
            tuft.scale(1.5, 0.45, 1.5);
            tuft.translate(0, 0.85 + i * 0.12, 0);
            parts.push(tint(jitterGeometry(tuft, 0.05, i + 31), i % 2 ? '#2f4b2a' : '#3a5a2f'));
        }
        return merge(parts);
    },
    treefern() {
        const parts = [tint(new THREE.CylinderGeometry(0.03, 0.045, 0.7, 6).translate(0, 0.35, 0), '#3d2f22')];
        for (let i = 0; i < 9; i++) {
            const frond = fernFrond(0.55, 0.09);
            frond.rotateX(-0.9 + (i % 2) * 0.15);
            frond.rotateY((i / 9) * Math.PI * 2);
            frond.translate(0, 0.7, 0);
            parts.push(frond);
        }
        return merge(parts);
    }
};

/** A foliage cluster: a sphere pushed in and out by noise, darker underneath and inside. */
function foliage(radius, seed, dark = '#2f5223', light = '#6f9a44', detail = 2) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        v.multiplyScalar(radius * (0.75 + fbm(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2, 3) * 0.55));
        p.setXYZ(i, v.x, v.y * 0.85, v.z);
    }
    g.computeVertexNormals();
    const lo = C(dark), hi = C(light);
    return paintVertices(g, (x, y, z, ny) => lo.clone().lerp(hi, smooth(ny, -0.4, 0.9) * 0.85 + fbm(x * 9 + seed, y * 9, z * 9, 2) * 0.15));
}

/** One arching fern frond pointing up/out along +y before rotation, with a green gradient. */
function fernFrond(length, width) {
    const g = new THREE.PlaneGeometry(width, length, 2, 8);
    g.translate(0, length / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / length;
        p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)));
        p.setZ(i, -t * t * length * 0.6);
    }
    g.computeVertexNormals();
    const base = C('#2d4a1f'), tip = C('#6b8f3a');
    return paintVertices(g, (x, y) => base.clone().lerp(tip, y / length));
}

function fernClump() {
    const parts = [];
    for (let i = 0; i < 8; i++) {
        const frond = fernFrond(0.6 + (i % 3) * 0.12, 0.12);
        frond.rotateX(-0.5 - (i % 2) * 0.25);
        frond.rotateY((i / 8) * Math.PI * 2 + i * 0.3);
        parts.push(frond);
    }
    return merge(parts);
}

/** Thousands of tapered blades scattered over rectangles. */
/** Grass in front of the fighting lane (z > 0) is kept short so it never hides feet. */
function grassField(areas, { count, height = 0.16, base = '#3a4a22', tip = '#8a9a52', laneScale = 0.3, seed = 5 }) {
    const blade = new THREE.PlaneGeometry(0.024, height, 1, 2);
    blade.translate(0, height / 2, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const t = bp.getY(i) / height; bp.setX(i, bp.getX(i) * (1 - t * 0.85)); bp.setZ(i, t * t * 0.04); }
    blade.computeVertexNormals();
    const b = C(base), t = C(tip);
    paintVertices(blade, (x, y) => b.clone().lerp(t, y / height));
    const total = areas.reduce((s, a) => s + Math.round(count * a.share), 0);
    const field = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), total);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), r = rng(seed);
    let n = 0;
    for (const a of areas) {
        for (let i = 0; i < Math.round(count * a.share); i++) {
            const z = lerp(a.z[0], a.z[1], r()), s = (0.6 + r() * 0.7) * lerp(1, laneScale, smooth(z, -0.6, 0.2));
            q.setFromEuler(e.set((r() - 0.5) * 0.5, r() * 6.28, (r() - 0.5) * 0.5));
            m4.compose(new THREE.Vector3(lerp(a.x[0], a.x[1], r()), a.y, z), q, new THREE.Vector3(s, s * (0.7 + r() * 0.7), s));
            field.setMatrixAt(n, m4);
            field.setColorAt(n, col.setRGB(0.8 + r() * 0.3, 0.85 + r() * 0.25, 0.75 + r() * 0.25));
            n++;
        }
    }
    field.receiveShadow = true;
    return field;
}

// ---------------------------------------------------------------------------- the kit

export function createWorldKit(world, view) {
    const { scene, stage } = world;
    const { main, platforms } = stage.layout;
    const x0 = world.toWorldX(main.left), x1 = world.toWorldX(main.right);
    const pitY = world.toWorldY(stage.pitSurfaceY);
    const state = { sunDir: sunDirection(40, 20).setZ(0.65).normalize(), sunIntensity: 3.6, ambient: 0.14, terrainHeight: null, built: new Set() };
    const animate = (fn) => world.updaters.push(fn);
    const r = rng(stage.id.length * 97 + 13);
    const R = (a, b) => a + r() * (b - a);

    const kit = {
        /** Screen pixels → world units, for placing things against the stage layout. */
        x: (px) => world.toWorldX(px),
        y: (py) => world.toWorldY(py),
        main: { left: x0, right: x1, width: x1 - x0 },
        pitY,
        random: R,

        // ------------------------------------------------------------ atmosphere

        /** Daylight: { elevation, azimuth, turbidity, rayleigh, mie } (degrees). Night: { gradient: [[h, color], ...] }. */
        sky(spec, { envIntensity = 0.8 } = {}) {
            const { background, environment } = bakeSky(view.renderer, spec);
            scene.background = background;
            scene.environment = environment;
            scene.environmentIntensity = envIntensity;
        },

        /** The key light (with shadows) and a soft fill. dir points toward the light. */
        light({ dir = [0.45, 0.62, 0.65], color = '#fff1dc', intensity = 3.6, fill = ['#bcd4ff', '#5a5040', 0.4] } = {}) {
            state.sunDir = new THREE.Vector3(...dir).normalize();
            state.sunIntensity = intensity;
            state.ambient = 0.1 + fill[2] * 0.15;
            const sun = new THREE.DirectionalLight(color, intensity);
            sun.position.copy(state.sunDir).multiplyScalar(20);
            sun.castShadow = true;
            sun.shadow.mapSize.set(2048, 2048);
            Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -4, near: 1, far: 60 });
            sun.shadow.camera.updateProjectionMatrix();
            sun.shadow.bias = -0.0003;
            sun.shadow.normalBias = 0.02;
            scene.add(sun, sun.target);
            if (fill[2] > 0) scene.add(new THREE.HemisphereLight(fill[0], fill[1], fill[2]));
            world.sun = sun;
        },

        fog(color, density = 0.0055) { scene.fog = new THREE.FogExp2(color, density); },

        stars({ count = 900, color = '#ffffff' } = {}) {
            const pos = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const a = R(0, Math.PI * 2), el = Math.asin(R(0.08, 1)), d = 600;
                pos.set([Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d, -Math.abs(Math.sin(a) * Math.cos(el) * d) - 50], i * 3);
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
        },

        moon({ at = [-120, 160, -500], radius = 18, color = '#f4f1e6' } = {}) {
            const m = mesh(scene, new THREE.SphereGeometry(radius, 32, 16), new THREE.MeshBasicMaterial({ color, fog: false }), at, { cast: false, receive: false });
            const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSoftTexture(), color: '#9fb8d8', transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
            halo.position.set(...at);
            halo.scale.setScalar(radius * 7);
            scene.add(halo);
            return m;
        },

        /** Northern lights: glowing curtains that ripple slowly. */
        aurora({ colors = ['#3dffa8', '#3fd0ff'], y = 80, z = -320 } = {}) {
            const curtains = [];
            colors.forEach((hex, i) => {
                const g = new THREE.PlaneGeometry(700, 90, 120, 1);
                const c = new Float32Array(g.attributes.position.count * 4), col = C(hex);
                for (let v = 0; v < g.attributes.position.count; v++) {
                    const top = g.attributes.position.getY(v) > 0;
                    c.set([col.r, col.g, col.b, top ? 0 : 0.55], v * 4);
                }
                g.setAttribute('color', new THREE.BufferAttribute(c, 4));
                const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
                m.position.set(i * 60 - 30, y + i * 25, z - i * 40);
                m.userData.base = Float32Array.from(g.attributes.position.array);
                scene.add(m);
                curtains.push(m);
            });
            animate((t) => {
                curtains.forEach((m, i) => {
                    const p = m.geometry.attributes.position, b = m.userData.base;
                    for (let v = 0; v < p.count; v++) {
                        const x = b[v * 3];
                        p.setZ(v, Math.sin(x * 0.012 + t * 0.25 + i) * 40 + Math.sin(x * 0.031 - t * 0.4) * 12);
                    }
                    p.needsUpdate = true;
                });
            });
        },

        // ------------------------------------------------------------ land

        /**
         * Distant land. y: base height. rough: hill amplitude. mountains: { height, start, end } (distance where they rise).
         * colors: { low, high, rock, snow }. snowLine: height where snow starts. water: { y, color }.
         */
        terrain({ y = -0.6, rough = 3, mountains = { height: 40, start: 30, end: 120 }, colors = {}, snowLine = 30, near = -6, water = null, seed = 0 } = {}) {
            const pal = { low: '#55663a', high: '#7d7b4e', rock: '#6f6a61', snow: '#e9edf0', ...colors };
            const height = (x, z) => {
                const behind = -z;
                const hills = (fbm(x * 0.02 + seed, 0.5, z * 0.02, 4) - 0.5) * rough * smooth(behind, -near, -near + 25);
                return y + hills + ridged(x * 0.009, z * 0.009, 5, seed) * mountains.height * smooth(behind, mountains.start, mountains.end);
            };
            state.terrainHeight = height;
            const g = new THREE.PlaneGeometry(600, 320, 180, 100);
            g.rotateX(-Math.PI / 2);
            g.translate(0, 0, near - 160);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
            g.computeVertexNormals();
            const low = C(pal.low), high = C(pal.high), rock = C(pal.rock), snow = C(pal.snow);
            paintVertices(g, (px, py, pz, ny) => {
                const n = fbm(px * 0.08, 1.3, pz * 0.08, 3);
                const col = low.clone().lerp(high, smooth(n, 0.35, 0.75) * 0.8);
                col.lerp(rock, smooth(1 - ny, 0.18, 0.4));
                col.lerp(snow, smooth(py, snowLine + n * 14, snowLine + 8 + n * 14) * smooth(ny, 0.55, 0.8));
                return col;
            });
            mesh(scene, bakeLight(g, state.sunDir, state.sunIntensity, state.ambient), new THREE.MeshBasicMaterial({ vertexColors: true }), [0, 0, 0], { cast: false, receive: false });
            if (water) {
                const w = mesh(scene, new THREE.PlaneGeometry(600, 320), new THREE.MeshBasicMaterial({ color: water.color }), [0, water.y, near - 160], { rot: [-Math.PI / 2, 0, 0], cast: false, receive: false });
                w.renderOrder = 1;
            }
            return height;
        },

        /** Many trees of one kind, lit once. kind: conifer | snowConifer | broadleaf | acacia | araucaria | treefern. */
        forest({ kind = 'conifer', count = 400, x = [-170, 170], z = [-22, -150], scale = [6, 11], maxSlope = 1.4, maxY = 18, minY = -Infinity, seed = 1 } = {}) {
            // Distant trees are simpler (fewer, coarser foliage clusters); they're small on screen.
            const shape = kind === 'snowConifer' ? TREE_SHAPES.conifer({ snow: true, dark: '#26382a', light: '#2d4231' }) : TREE_SHAPES[kind]({ detail: 1, blobs: 6 });
            const trees = new THREE.InstancedMesh(bakeLight(shape, state.sunDir, state.sunIntensity, state.ambient + 0.05), new THREE.MeshBasicMaterial({ vertexColors: true }), count);
            const h = state.terrainHeight || (() => 0);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), rr = rng(seed * 31 + 7);
            let placed = 0;
            for (let tries = 0; tries < count * 8 && placed < count; tries++) {
                const px = lerp(x[0], x[1], rr()), pz = lerp(z[0], z[1], rr()), py = h(px, pz);
                const slope = Math.abs(h(px + 1, pz) - h(px - 1, pz)) + Math.abs(h(px, pz + 1) - h(px, pz - 1));
                if (slope > maxSlope || py > maxY || py < minY) continue;
                const s = lerp(scale[0], scale[1], rr());
                q.setFromAxisAngle(up, rr() * 6.28);
                m4.compose(new THREE.Vector3(px, py - 0.1, pz), q, new THREE.Vector3(s, s * (0.9 + rr() * 0.35), s));
                trees.setMatrixAt(placed, m4);
                trees.setColorAt(placed, col.setScalar(0.8 + rr() * 0.3));
                placed++;
            }
            trees.count = placed;
            scene.add(trees);
        },

        /** One tree near the fighters (real lighting and shadows). */
        tree(kind, pos, scale = 1) {
            const shape = kind === 'snowConifer' ? TREE_SHAPES.conifer({ snow: true }) : TREE_SHAPES[kind](kind === 'broadleaf' ? { detail: 3 } : undefined);
            const leafy = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { mode: DETAIL.SCALES, freq: 9, strength: 0.9, tint: 0.12, freq2: 2 });
            return mesh(scene, addRest(shape), leafy, pos, { rot: [0, R(0, 6), 0], scale: [scale, scale, scale] });
        },

        /** Lumpy boulders. list: [[x, y, z, size], ...] */
        rocks(list, color = '#7b7266') {
            const mat = surface('#ffffff', { vertexColors: true, roughness: 0.95, freq: 9, strength: 1.1, tint: 0.18, freq2: 2 });
            for (const [px, py, pz, s] of list) {
                const g = new THREE.IcosahedronGeometry(1, 3), seed = Math.round(px * 13 + pz * 7);
                const p = g.attributes.position;
                for (let i = 0; i < p.count; i++) {
                    const v = new THREE.Vector3().fromBufferAttribute(p, i);
                    v.multiplyScalar(0.8 + fbm(v.x * 1.5 + seed, v.y * 1.5, v.z * 1.5, 4) * 0.45);
                    p.setXYZ(i, v.x, v.y * 0.7, v.z);
                }
                g.computeVertexNormals();
                const base = C(color);
                paintVertices(g, (x, y) => base.clone().multiplyScalar(0.8 + (y + 1) * 0.15));
                mesh(scene, addRest(g), mat, [px, py + s * 0.25, pz], { rot: [0, seed, 0], scale: [s, s, s] });
            }
        },

        ferns({ count = 40, x = [-7, 7], z = [-6, -2], y = 0, scale = [0.6, 1.2] } = {}) {
            const ferns = new THREE.InstancedMesh(fernClump(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), count);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
            for (let i = 0; i < count; i++) {
                const s = R(...scale);
                q.setFromAxisAngle(up, R(0, 6.28));
                m4.compose(new THREE.Vector3(R(...x), typeof y === 'function' ? y() : y, R(...z)), q, new THREE.Vector3(s, s, s));
                ferns.setMatrixAt(i, m4);
            }
            ferns.receiveShadow = true;
            ferns.castShadow = true;
            scene.add(ferns);
        },

        bushes({ count = 12, x = [-9, 9], z = [-5, -3], y = 0, color = '#4d7a33' } = {}) {
            const mat = withDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { mode: DETAIL.SCALES, freq: 14, strength: 0.9, tint: 0.12, freq2: 3 });
            const light = C(color).offsetHSL(0.02, 0, 0.12).getHexString(), dark = C(color).offsetHSL(0, 0, -0.14).getHexString();
            for (let i = 0; i < count; i++) {
                const s = R(0.35, 0.7);
                mesh(scene, addRest(foliage(1, i + 50, `#${dark}`, `#${light}`, 3)), mat, [R(...x), y + s * 0.3, R(...z)], { scale: [s * 1.3, s * 0.8, s] });
            }
        },

        reeds({ count = 260, x = [-9, -4.6], z = [-3, 1.5], y = -0.4 } = {}) {
            const blade = new THREE.ConeGeometry(0.012, 0.9, 4);
            blade.translate(0, 0.45, 0);
            paintVertices(blade, (bx, by) => C('#3f5a2a').lerp(C('#a39a5c'), by / 0.9));
            const reeds = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
            for (let i = 0; i < count; i++) {
                const s = R(0.6, 1.3);
                q.setFromEuler(e.set(R(-0.15, 0.15), R(0, 6), R(-0.15, 0.15)));
                m4.compose(new THREE.Vector3(R(...x), y, R(...z)), q, new THREE.Vector3(s, s, s));
                reeds.setMatrixAt(i, m4);
            }
            reeds.castShadow = true;
            scene.add(reeds);
            const tops = [];
            for (let i = 0; i < 16; i++) tops.push([R(...x), y + R(0.5, 0.9), R(...z)]);
            const cat = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.02, 0.09, 3, 6), new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.9 }), tops.length);
            tops.forEach((t, i) => cat.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...t)));
            scene.add(cat);
        },

        // ------------------------------------------------------------ the arena

        /**
         * The main platform. top: grass | lawn | snow | basalt | earth | moss | planks.
         * body: island (floats over a chasm) | cliff (drops into the pit) | dock (planks on pilings) | shelf (ice).
         * palette: rock colors for cliffs, light to dark.
         */
        ground({ top = 'grass', body = 'cliff', palette = ['#9c7a58', '#7d5f45', '#b08b64', '#6c5240'] } = {}) {
            state.built.add('ground');
            const w = x1 - x0, cx = (x0 + x1) / 2;
            const g = new THREE.Group();
            g.position.set(cx, 0, 0);
            scene.add(g);
            if (body === 'island') buildIsland(g, w, DEPTH, 3.6, 11, palette);
            else if (body === 'dock') buildDock(g, w, DEPTH, pitY);
            else buildCliff(g, w, DEPTH, body === 'shelf' ? 'ice' : palette);
            if (body !== 'dock') buildTop(g, top, w, DEPTH);
            return g;
        },

        /** The thin floating platforms from the stage layout. kind: turf | wood | log | ice | bone | stone. */
        platforms(kind = stage.def.platformStyle?.kind || 'stone') {
            state.built.add('platforms');
            for (const p of platforms) {
                const pl = world.toWorldX(p.left), pr = world.toWorldX(p.right), py = world.toWorldY(p.y);
                const g = new THREE.Group();
                // Set back from the fighting lane, so nobody standing underneath is hidden by it.
                g.position.set((pl + pr) / 2, py, -0.7);
                scene.add(g);
                buildPlatform(g, kind, pr - pl, (pl + pr) * 7);
            }
        },

        /** The pit's surface on both sides of the main platform (built automatically from the stage's pit style). */
        pit(style = stage.pit.style) {
            state.built.add('pit');
            buildPit(style);
        },

        // ------------------------------------------------------------ props

        fence({ z = -4.2, x = [-16, 16], y = 0, height = 1.6, color = '#9a7552' } = {}) {
            const n = Math.ceil((x[1] - x[0]) / 0.16);
            const plank = new THREE.BoxGeometry(0.14, height, 0.03);
            plank.translate(0, height / 2, 0);
            const pickets = new THREE.InstancedMesh(addRest(plank), surface(color, { freq: 30, strength: 0.5, tint: 0.2 }), n);
            const col = new THREE.Color();
            for (let i = 0; i < n; i++) {
                pickets.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x[0] + i * 0.16, y + R(-0.03, 0.03), z));
                pickets.setColorAt(i, col.setScalar(R(0.85, 1.1)));
            }
            pickets.castShadow = pickets.receiveShadow = true;
            scene.add(pickets);
            for (const ry of [y + 0.3, y + height - 0.3]) mesh(scene, addRest(new THREE.BoxGeometry(x[1] - x[0], 0.09, 0.05)), surface(color, { freq: 30, strength: 0.5 }), [(x[0] + x[1]) / 2, ry, z - 0.04]);
        },

        house({ pos = [-9, 0, -14], size = [8, 4.2, 6], wall = '#d8cdb8', roof = '#6b3a2e', trim = '#f2ede2' } = {}) {
            const [w, h, d] = size;
            const g = new THREE.Group();
            g.position.set(...pos);
            scene.add(g);
            mesh(g, addRest(new THREE.BoxGeometry(w, h, d)), surface(wall, { freq: 12, strength: 0.25, tint: 0.08 }), [0, h / 2, 0]);
            // Gable roof: a triangle profile across the depth, extruded along the width, with eaves.
            const profile = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.35, 0), new THREE.Vector2(0, d * 0.42), new THREE.Vector2(d / 2 + 0.35, 0)]);
            const roofGeo = new THREE.ExtrudeGeometry(profile, { depth: w + 0.6, bevelEnabled: false });
            roofGeo.translate(0, 0, -(w + 0.6) / 2);
            roofGeo.rotateY(Math.PI / 2);
            roofGeo.computeVertexNormals();
            mesh(g, addRest(roofGeo), surface(roof, { freq: 14, strength: 0.7, tint: 0.15 }), [0, h, 0]);
            const glass = new THREE.MeshPhysicalMaterial({ color: '#2a3a48', roughness: 0.05, metalness: 0.2, clearcoat: 1 });
            const frame = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.6 });
            for (let i = 0; i < 3; i++) {
                const wx = -w / 2 + w * (0.2 + i * 0.3);
                mesh(g, new THREE.BoxGeometry(1.2, 1.3, 0.06), frame, [wx, h * 0.55, d / 2 + 0.01]);
                mesh(g, new THREE.BoxGeometry(1.0, 1.1, 0.07), glass, [wx, h * 0.55, d / 2 + 0.02]);
            }
            return g;
        },

        lilyPads({ count = 30, x = [-9, -4.6], z = [-3, 2] } = {}) {
            const pad = new THREE.CircleGeometry(0.16, 14, 0.3, Math.PI * 2 - 0.3);
            pad.rotateX(-Math.PI / 2);
            const pads = new THREE.InstancedMesh(pad, new THREE.MeshStandardMaterial({ color: '#4f7a33', roughness: 0.5, side: THREE.DoubleSide }), count);
            const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
            for (let i = 0; i < count; i++) {
                const side = r() < 0.5 ? -1 : 1, s = R(0.6, 1.5);
                const px = side < 0 ? R(x[0], x[1]) : R(-x[1], -x[0]);
                q.setFromAxisAngle(up, R(0, 6.28));
                m4.compose(new THREE.Vector3(px, pitY + 0.01, R(...z)), q, new THREE.Vector3(s, 1, s));
                pads.setMatrixAt(i, m4);
            }
            pads.receiveShadow = true;
            scene.add(pads);
        },

        /** Drifting ice floes on the water. */
        floes({ count = 18 } = {}) {
            const mat = surface('#eef6fa', { roughness: 0.35, freq: 10, strength: 0.4 });
            const list = [];
            for (let i = 0; i < count; i++) {
                const side = i % 2 ? -1 : 1, s = R(0.3, 1.1);
                const g = addRest(jitterGeometry(new THREE.CylinderGeometry(1, 1, 0.2, 7, 1), 0.3, i + 70, 0.09));
                const px = side < 0 ? R(-14, x0 - 0.8) : R(x1 + 0.8, 14);
                list.push(mesh(scene, g, mat, [px, pitY + 0.02, R(-12, 1.5)], { scale: [s, 1, s * R(0.6, 1)], rot: [0, R(0, 6), 0] }));
            }
            animate((t) => list.forEach((m, i) => { m.position.y = pitY + 0.02 + Math.sin(t * 0.8 + i) * 0.02; m.rotation.y += 0.0004 * (i % 2 ? 1 : -1); }));
        },

        /** Mammoth bones poking out of the tar: curved ribs and a tusk. */
        bones({ spots = [[-6.5, -2], [6.8, -3.5]] } = {}) {
            const mat = surface('#e8dcc0', { roughness: 0.7, freq: 16, strength: 0.5, tint: 0.15 });
            for (const [bx, bz] of spots) {
                for (let i = 0; i < 4; i++) {
                    const rib = new THREE.TorusGeometry(0.9, 0.05, 6, 16, Math.PI * 0.8);
                    mesh(scene, addRest(rib), mat, [bx + i * 0.35, pitY - 0.2, bz], { rot: [0, 0.3, Math.PI * 0.1] });
                }
                const tusk = new THREE.TorusGeometry(1.1, 0.08, 8, 20, Math.PI * 0.6);
                mesh(scene, addRest(tusk), surface('#efe6cf', { roughness: 0.5, freq: 12, strength: 0.3 }), [bx - 1, pitY - 0.1, bz + 1.2], { rot: [0.2, -0.5, 0] });
            }
        },

        /** A smoking volcano in the distance with a glowing crater and lava streaks. */
        volcano({ at = [10, -1, -90], height = 34, radius = 42 } = {}) {
            const cone = new THREE.CylinderGeometry(radius * 0.12, radius, height, 48, 12, true);
            const p = cone.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), n = fbm(vx * 0.1, vy * 0.1, vz * 0.1, 4);
                p.setXYZ(i, vx * (0.9 + n * 0.25), vy, vz * (0.9 + n * 0.25));
            }
            cone.computeVertexNormals();
            paintVertices(cone, (vx, vy, vz) => {
                const streak = smooth(Math.sin(Math.atan2(vz, vx) * 9 + vy * 0.15), 0.93, 1) * smooth(vy, -height * 0.1, height * 0.45);
                return C('#2a2324').lerp(C('#ff5a1a'), streak * 0.9);
            });
            const v = mesh(scene, cone, new THREE.MeshBasicMaterial({ vertexColors: true }), [at[0], at[1] + height / 2, at[2]], { cast: false, receive: false });
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSoftTexture(), color: '#ff7a2a', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
            glow.position.set(at[0], at[1] + height + 1, at[2]);
            glow.scale.set(radius * 0.6, radius * 0.25, 1);
            scene.add(glow);
            kit.smoke({ at: [at[0], at[1] + height + 2, at[2]], count: 14, size: radius * 0.5 });
            return v;
        },

        /** Billowing smoke column (soft sprites rising and spreading). */
        smoke({ at, count = 12, size = 10, color = '#3a3030' }) {
            const puffs = [];
            for (let i = 0; i < count; i++) {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSoftTexture(), color, transparent: true, opacity: 0.5, depthWrite: false }));
                s.userData.phase = i / count;
                scene.add(s);
                puffs.push(s);
            }
            animate((t) => puffs.forEach((s) => {
                const k = (s.userData.phase + t * 0.02) % 1;
                s.position.set(at[0] + k * size * 0.8, at[1] + k * size * 1.6, at[2]);
                s.scale.setScalar(size * (0.4 + k));
                s.material.opacity = 0.45 * (1 - k);
            }));
        },

        /** Long-necked dinosaurs grazing far off in the mist. */
        sauropods(list = [[-30, -45, 1], [42, -70, 1.3]]) {
            const mat = new THREE.MeshLambertMaterial({ color: '#4c5548' });
            for (const [sx, sz, s] of list) {
                const g = new THREE.Group();
                g.position.set(sx, (state.terrainHeight ? state.terrainHeight(sx, sz) : 0), sz);
                g.scale.setScalar(s * 3);
                g.rotation.y = R(-0.6, 0.6);
                scene.add(g);
                mesh(g, new THREE.SphereGeometry(1, 16, 10), mat, [0, 2.2, 0], { scale: [1.8, 1, 0.9], cast: false });
                mesh(g, new THREE.CapsuleGeometry(0.22, 3.2, 4, 8), mat, [1.9, 3.8, 0], { rot: [0, 0, -0.75], cast: false });
                mesh(g, new THREE.SphereGeometry(0.3, 10, 8), mat, [3.1, 5.0, 0], { scale: [1.4, 0.8, 0.8], cast: false });
                mesh(g, new THREE.CapsuleGeometry(0.2, 3.5, 4, 8), mat, [-2.8, 1.6, 0], { rot: [0, 0, 1.25], cast: false });
                for (const [lx, lz] of [[0.9, 0.5], [0.9, -0.5], [-0.9, 0.5], [-0.9, -0.5]]) mesh(g, new THREE.CylinderGeometry(0.22, 0.25, 2, 8), mat, [lx, 1, lz], { cast: false });
            }
        },

        // ------------------------------------------------------------ particles

        snow({ count = 160 } = {}) {
            return particles({ count, color: '#ffffff', size: 0.05, area: [-8, 8, -1, 7, -4, 3], fall: [0.3, 0.6], drift: 0.25, opacity: 0.9 });
        },
        embers({ count = 70 } = {}) {
            return particles({ count, color: '#ff7a2a', size: 0.06, area: [-8, 8, -2, 7, -3, 2], fall: [-0.5, -1.2], drift: 0.4, additive: true, flicker: true });
        },
        fireflies({ count = 26, area = [-7, 7, 0.2, 3, -3, 1.5], color = '#eaff7b' } = {}) {
            return particles({ count, color, size: 0.07, area, fall: [0, 0], drift: 0.25, additive: true, flicker: true, wander: true });
        },
        leaves({ count = 18, color = '#c8742a' } = {}) {
            return particles({ count, color, size: 0.07, area: [-8, 8, -1, 7, -4, 2], fall: [0.25, 0.45], drift: 0.6, opacity: 0.95 });
        },
        /** Low drifting mist banks. */
        mist({ count = 10, color = '#dfe8e4', y = 0, opacity = 0.18, z = [-6, 1] } = {}) {
            const puffs = [];
            for (let i = 0; i < count; i++) {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getSoftTexture(), color, transparent: true, opacity, depthWrite: false }));
                s.position.set(R(-12, 12), y + R(-0.3, 0.4), R(...z));
                s.scale.set(R(5, 9), R(1, 1.8), 1);
                s.userData.speed = R(0.05, 0.15);
                scene.add(s);
                puffs.push(s);
            }
            animate((t, dt) => puffs.forEach((s) => { s.position.x += s.userData.speed * dt; if (s.position.x > 14) s.position.x = -14; }));
        },
        /** Bubbles that swell and pop on the pit surface (tar, swamp). */
        bubbles({ count = 14, color = '#1a1412' } = {}) {
            const geo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.2 });
            const list = [];
            for (let i = 0; i < count; i++) {
                const side = i % 2 ? -1 : 1;
                const b = mesh(scene, geo, mat, [side < 0 ? R(-10, x0 - 0.5) : R(x1 + 0.5, 10), pitY, R(-6, 1.5)], { cast: false });
                b.userData = { phase: R(0, 1), speed: R(0.2, 0.45), size: R(0.05, 0.16) };
                list.push(b);
            }
            animate((t) => list.forEach((b) => {
                const k = (b.userData.phase + t * b.userData.speed) % 1;
                b.scale.setScalar(Math.max(0.001, b.userData.size * Math.sin(k * Math.PI)));
            }));
        }
    };

    // ------------------------------------------------------------ builders

    function particles({ count, color, size, area, fall, drift, opacity = 1, additive = false, flicker = false, wander = false }) {
        const [ax0, ax1, ay0, ay1, az0, az1] = area;
        const pos = new Float32Array(count * 3), speed = new Float32Array(count), phase = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos.set([R(ax0, ax1), R(ay0, ay1), R(az0, az1)], i * 3);
            speed[i] = R(fall[0], fall[1]);
            phase[i] = R(0, 6.28);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color, size, map: getSoftTexture(), transparent: true, opacity, depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        const pts = new THREE.Points(g, mat);
        pts.frustumCulled = false;
        scene.add(pts);
        animate((t, dt) => {
            const p = g.attributes.position;
            for (let i = 0; i < count; i++) {
                let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
                py -= speed[i] * dt;
                px += Math.sin(t * 0.7 + phase[i]) * drift * dt;
                if (wander) { py += Math.sin(t * 1.3 + phase[i] * 2) * 0.3 * dt; pz += Math.cos(t * 0.9 + phase[i]) * 0.2 * dt; }
                if (py < ay0) py = ay1;
                if (py > ay1) py = ay0;
                if (px < ax0) px = ax1;
                if (px > ax1) px = ax0;
                p.setXYZ(i, px, py, pz);
            }
            p.needsUpdate = true;
            if (flicker) mat.opacity = opacity * (0.75 + Math.sin(t * 6) * 0.1);
        });
        return pts;
    }

    function topSlab(parent, w, d, color, opts) {
        return mesh(parent, addRest(new RoundedBoxGeometry(w, 0.16, d, 3, 0.06)), surface(color, opts), [0, -0.08, 0]);
    }

    function buildTop(g, top, w, d) {
        const areas = () => [{ x: [-w / 2 + 0.05, w / 2 - 0.05], z: [-d / 2 + 0.05, d / 2 - 0.05], y: 0, share: 1 }];
        if (top === 'grass') {
            topSlab(g, w, d, '#4f6233', { freq: 18, strength: 0.4 });
            g.add(grassField(areas(), { count: 4200 }));
        } else if (top === 'lawn') {
            topSlab(g, w, d, '#4a7a2c', { freq: 22, strength: 0.3 });
            g.add(grassField(areas(), { count: 4500, height: 0.09, base: '#3d6a24', tip: '#7fb04a', laneScale: 0.8 }));
        } else if (top === 'snow') {
            topSlab(g, w, d, '#eef3f6', { roughness: 0.75, freq: 8, strength: 0.35, tint: 0.04 });
            const lumps = surface('#f4f8fa', { roughness: 0.8, freq: 8, strength: 0.3, tint: 0.03 });
            for (let i = 0; i < 9; i++) mesh(g, addRest(new THREE.SphereGeometry(1, 16, 10)), lumps, [R(-w / 2, w / 2), -0.05, R(-d / 2, -d / 2 + 0.6)], { scale: [R(0.4, 0.9), R(0.12, 0.25), R(0.3, 0.6)] });
        } else if (top === 'basalt') {
            topSlab(g, w, d, '#3a3433', { freq: 12, strength: 1.0, tint: 0.2 });
        } else if (top === 'earth') {
            topSlab(g, w, d, '#8a6b48', { freq: 14, strength: 0.7, tint: 0.2 });
            g.add(grassField(areas(), { count: 900, height: 0.14, base: '#8a7a45', tip: '#d8c27a', laneScale: 0.5 }));
        } else if (top === 'moss') {
            topSlab(g, w, d, '#3d4f2a', { freq: 20, strength: 0.5, tint: 0.2 });
            g.add(grassField(areas(), { count: 2600, height: 0.12, base: '#2b3d1c', tip: '#6a8a3a' }));
        }
    }

    function stratumColor(palette, y, x, seed) {
        const cols = palette.map(C);
        const band = Math.floor(-y * 7 + fbm(x * 0.8, y * 0.5, seed, 2) * 3);
        return cols[((band % cols.length) + cols.length) % cols.length].clone().multiplyScalar(0.85 + hash3(band, seed, 1) * 0.3);
    }

    function buildIsland(g, w, d, depth, seed, palette) {
        const geo = new THREE.CylinderGeometry(1, 0.06, 1, 48, 18);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), t = 0.5 - vy;
            const orig = lerp(1, 0.06, t), ang = Math.atan2(vz, vx);
            const n = fbm(Math.cos(ang) * 1.6 + seed, t * 2.4, Math.sin(ang) * 1.6, 5);
            const ledge = 1 + 0.06 * Math.sin(t * 26 + n * 9) * smooth(t, 0.05, 0.2);
            const rr = Math.pow(Math.max(0, 1 - t), 0.6) * (1 + (n - 0.5) * 0.6 * smooth(t, 0, 0.12)) * ledge;
            const sc = orig > 1e-6 ? rr / orig : 0;
            p.setXYZ(i, vx * sc * w * 0.5, -t * depth, vz * sc * d * 0.5);
        }
        geo.computeVertexNormals();
        paintVertices(geo, (vx, vy) => stratumColor(palette, vy, vx, seed));
        mesh(g, addRest(geo), surface('#ffffff', { vertexColors: true, roughness: 0.95, freq: 9, strength: 1.2, tint: 0.18, freq2: 2 }), [0, -0.3, 0], { receive: false });
        mesh(g, addRest(new RoundedBoxGeometry(w - 0.02, 0.26, d - 0.04, 3, 0.08)), surface('#5a4330', { freq: 24, strength: 0.8 }), [0, -0.21, 0], { cast: false });
    }

    function buildCliff(g, w, d, palette) {
        const ice = palette === 'ice';
        const H = 3.4;
        const geo = new THREE.BoxGeometry(w, H, d, Math.ceil(w * 5), 16, 12);
        geo.translate(0, -H / 2 - 0.12, 0);
        const p = geo.attributes.position, seed = Math.round(w * 10);
        for (let i = 0; i < p.count; i++) {
            const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
            if (vy > -0.13) continue; // keep the top flat for the surface slab
            const n = fbm(vx * 0.9 + seed, vy * 1.2, vz * 0.9, 4) - 0.5;
            const ledge = Math.sin(vy * 9 + n * 6) * 0.04;
            const out = (n * 0.25 + ledge) * smooth(-vy, 0.1, 0.4);
            const ox = Math.abs(vx) > w / 2 - 0.01 ? Math.sign(vx) * out : 0, oz = Math.abs(vz) > d / 2 - 0.01 ? Math.sign(vz) * out : 0;
            p.setXYZ(i, vx + ox, vy, vz + oz);
        }
        geo.computeVertexNormals();
        if (ice) paintVertices(geo, (vx, vy) => C('#cfe8f2').lerp(C('#7fb6cf'), smooth(-vy, 0.2, 2.5)));
        else paintVertices(geo, (vx, vy) => stratumColor(palette, vy, vx, seed));
        const mat = ice
            ? withDetail(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, clearcoat: 0.6 }), { mode: DETAIL.ROCK, freq: 6, strength: 0.6, tint: 0.08, freq2: 2 })
            : surface('#ffffff', { vertexColors: true, roughness: 0.95, freq: 9, strength: 1.2, tint: 0.18, freq2: 2 });
        mesh(g, addRest(geo), mat, [0, 0, 0]);
    }

    function buildDock(g, w, d, waterY) {
        const wood = surface('#8a6648', { roughness: 0.8, freq: 26, strength: 0.6, tint: 0.25, freq2: 6 });
        const n = Math.ceil(w / 0.2);
        const board = addRest(new THREE.BoxGeometry(0.185, 0.07, d));
        const boards = new THREE.InstancedMesh(board, wood, n);
        const col = new THREE.Color();
        for (let i = 0; i < n; i++) {
            boards.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-w / 2 + 0.1 + i * 0.2, -0.035 + R(-0.006, 0.006), R(-0.02, 0.02)));
            boards.setColorAt(i, col.setScalar(R(0.75, 1.15)));
        }
        boards.castShadow = boards.receiveShadow = true;
        g.add(boards);
        for (const z of [-d / 2 + 0.3, 0, d / 2 - 0.3]) mesh(g, addRest(new THREE.BoxGeometry(w, 0.16, 0.14)), wood, [0, -0.15, z]);
        const piling = addRest(new THREE.CylinderGeometry(0.1, 0.11, 2.6, 10));
        for (let px = -w / 2 + 0.2; px <= w / 2; px += 1.4) {
            for (const z of [-d / 2 + 0.25, d / 2 - 0.25]) mesh(g, piling, wood, [px, waterY - 1.0, z]);
        }
    }

    function buildPlatform(g, kind, w, seed) {
        if (kind === 'turf') {
            buildIsland(g, w, 1.1, 0.35, seed, ['#9c7a58', '#7d5f45', '#b08b64', '#6c5240']);
            topSlab(g, w, 1.1, '#4f6233', { freq: 18, strength: 0.4 });
            g.add(grassField([{ x: [-w / 2 + 0.05, w / 2 - 0.05], z: [-0.5, 0.5], y: 0, share: 1 }], { count: 400, height: 0.1, seed, laneScale: 0.6 }));
        } else if (kind === 'wood') {
            const wood = surface('#a07a52', { roughness: 0.75, freq: 26, strength: 0.6, tint: 0.25, freq2: 6 });
            for (let i = 0; i < 6; i++) mesh(g, addRest(new THREE.BoxGeometry(w, 0.06, 0.17)), wood, [0, -0.03, -0.45 + i * 0.18]);
            for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) mesh(g, addRest(new THREE.BoxGeometry(0.12, 0.1, 1.1)), wood, [x, -0.11, 0]);
        } else if (kind === 'log') {
            const bark = surface('#5d4630', { roughness: 0.95, freq: 14, strength: 1.0, tint: 0.2, mode: DETAIL.FUR });
            const ring = new THREE.MeshStandardMaterial({ color: '#b08a5c', roughness: 0.8 });
            for (const z of [-0.14, 0.14]) {
                const log = addRest(new THREE.CylinderGeometry(0.13, 0.13, w, 14));
                mesh(g, log, bark, [0, -0.12, z], { rot: [0, 0, Math.PI / 2] });
                for (const x of [-w / 2, w / 2]) mesh(g, new THREE.CircleGeometry(0.125, 14), ring, [x + Math.sign(x) * 0.001, -0.12, z], { rot: [0, Math.sign(x) * Math.PI / 2, 0] });
            }
        } else if (kind === 'ice') {
            const ice = withDetail(new THREE.MeshPhysicalMaterial({ color: '#d4eef8', roughness: 0.12, clearcoat: 1, transmission: 0 }), { mode: DETAIL.ROCK, freq: 5, strength: 0.6, tint: 0.06, freq2: 2 });
            mesh(g, addRest(jitterGeometry(new RoundedBoxGeometry(w, 0.24, 1.2, 3, 0.08), 0.04, seed, 0.11)), ice, [0, -0.12, 0]);
            mesh(g, addRest(new RoundedBoxGeometry(w * 0.96, 0.05, 1.1, 2, 0.02)), surface('#f4f8fa', { roughness: 0.8, freq: 8, strength: 0.3 }), [0, -0.01, 0]);
        } else if (kind === 'bone') {
            const pts = [];
            for (let i = 0; i <= 20; i++) {
                const t = i / 20, knob = Math.max(Math.exp(-((t - 0.04) ** 2) / 0.002), Math.exp(-((t - 0.96) ** 2) / 0.002));
                pts.push(new THREE.Vector2(0.09 + knob * 0.1 + Math.sin(t * Math.PI) * 0.015, t * w - w / 2));
            }
            pts.unshift(new THREE.Vector2(0.001, -w / 2));
            pts.push(new THREE.Vector2(0.001, w / 2));
            const bone = addRest(new THREE.LatheGeometry(pts, 16));
            mesh(g, bone, surface('#e9dfc6', { roughness: 0.6, freq: 16, strength: 0.4, tint: 0.15 }), [0, -0.13, 0], { rot: [0, 0, Math.PI / 2], scale: [1, 1, 1.6] });
        } else {
            mesh(g, addRest(jitterGeometry(new RoundedBoxGeometry(w, 0.26, 1.2, 3, 0.07), 0.06, seed, 0.12)), surface('#4a4142', { roughness: 0.92, freq: 10, strength: 1.1, tint: 0.2 }), [0, -0.13, 0]);
        }
    }

    /** A liquid surface at pit level, spanning z (front of the screen back to the shore). */
    function liquid(color, { roughness = 0.08, opacity = 1, flow = 0.04, strength = 0.18, z = [-16, 6], reflect = 1, specular = 1 } = {}) {
        const m = withDetail(new THREE.MeshPhysicalMaterial({ color, roughness, transparent: opacity < 1, opacity, envMapIntensity: reflect, specularIntensity: specular }), { mode: DETAIL.ROCK, freq: 1.4, strength, tint: 0.05, freq2: 0.5, flow });
        const g = addRest(new THREE.PlaneGeometry(40, z[1] - z[0]).rotateX(-Math.PI / 2).translate(0, 0, (z[0] + z[1]) / 2));
        const surfaceMesh = mesh(scene, g, m, [0, pitY, 0], { cast: false });
        surfaceMesh.renderOrder = 1;
        return surfaceMesh;
    }

    function lavaMaterial() {
        const m = new THREE.MeshStandardMaterial({ color: '#1a0e0a', roughness: 0.85, emissive: '#ffffff' });
        m.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, { uNoise: { value: getNoiseTexture() }, uTime: materialTime });
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec2 vLava;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLava = position.xz;');
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform sampler2D uNoise;\nuniform float uTime;\nvarying vec2 vLava;')
                .replace('#include <emissivemap_fragment>', `
                    float n1 = texture2D(uNoise, vLava * 0.22 + vec2(uTime * 0.006, uTime * 0.003)).r;
                    float n2 = texture2D(uNoise, vLava * 0.6 - vec2(uTime * 0.01, 0.0)).r;
                    float v = n1 * 0.6 + n2 * 0.4;
                    // Mostly dark cooling crust, with molten orange showing through the cracks.
                    float heat = smoothstep(0.56, 0.68, v);
                    float glow = smoothstep(0.45, 0.62, v) * 0.35;
                    totalEmissiveRadiance = vec3(2.2, 0.5, 0.05) * heat + vec3(0.45, 0.06, 0.0) * glow;
                    diffuseColor.rgb *= 1.0 - heat;`);
        };
        m.customProgramCacheKey = () => 'lava';
        return m;
    }

    function buildPit(style) {
        if (style === 'chasm') return;
        if (style === 'water') liquid('#2a5566', { roughness: 0.1 });
        else if (style === 'swamp') liquid('#2f3a1b', { roughness: 0.5, strength: 0.08, flow: 0.01, reflect: 0.55, specular: 0.5 });
        else if (style === 'icewater') liquid('#13303f', { roughness: 0.08, strength: 0.12 });
        else if (style === 'tar') { liquid('#040303', { roughness: 0.18, strength: 0.04, flow: 0.003, reflect: 0.2, specular: 0.25 }); kit.bubbles(); }
        else if (style === 'pool') buildPool();
        else if (style === 'lava') {
            const g = new THREE.PlaneGeometry(40, 22, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -5);
            mesh(scene, g, lavaMaterial(), [0, pitY, 0], { cast: false });
            for (const x of [x0 - 2.5, x1 + 2.5]) {
                const glow = new THREE.PointLight('#ff6a1a', 6, 9, 1.6);
                glow.position.set(x, pitY + 0.8, 1);
                scene.add(glow);
                animate((t) => { glow.intensity = 5 + Math.sin(t * 3.1 + x) * 1.2 + Math.sin(t * 7.3) * 0.5; });
            }
        }
    }

    function buildPool() {
        const tiles = (() => {
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = c.height = 64;
            const g = c.getContext('2d');
            g.fillStyle = '#7fd3e6';
            g.fillRect(0, 0, 64, 64);
            g.strokeStyle = '#5bb8cf';
            g.lineWidth = 3;
            for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(20, 20);
            return t;
        })();
        mesh(scene, new THREE.PlaneGeometry(40, 5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.4 }), [0, pitY - 1.4, -0.3], { cast: false });
        liquid('#3aaecb', { roughness: 0.03, opacity: 0.72, strength: 0.35, z: [-2.4, 1.85] });
        // Paving in front of the pools, out to the bottom of the screen
        mesh(scene, addRest(new THREE.PlaneGeometry(40, 8).rotateX(-Math.PI / 2)), surface('#cfc6b6', { roughness: 0.85, freq: 6, strength: 0.5, tint: 0.1 }), [0, pitY + 0.18, 6.05], { cast: false });
        const coping = surface('#ece6da', { roughness: 0.7, freq: 10, strength: 0.4, tint: 0.05 });
        for (const [cx, cw] of [[(-14 + x0) / 2, x0 + 14], [(x1 + 14) / 2, 14 - x1]]) {
            mesh(scene, addRest(new THREE.BoxGeometry(cw, 0.12, 0.45)), coping, [cx, pitY + 0.12, 1.85]);
            mesh(scene, addRest(new THREE.BoxGeometry(cw, 0.12, 0.45)), coping, [cx, pitY + 0.12, -2.4]);
        }
    }

    /** Anything the stage didn't build itself. */
    kit.finish = () => {
        if (!state.built.has('pit')) kit.pit();
        if (!state.built.has('platforms')) kit.platforms();
    };
    return kit;
}

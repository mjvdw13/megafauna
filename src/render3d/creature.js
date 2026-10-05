// ============================================================================
// CREATURE MODELS
// Builds a character's 3D model from its model file (fighters/<id>/<id>-model.js):
// the signed-distance body becomes one smooth mesh per part (surface nets),
// skinned to a bone skeleton, with ambient occlusion baked into the vertex
// colors. Accessories (eyes, horns, glasses...) are rigid meshes on bones.
//
// buildModel() is slow (a few hundred ms), so each character is built once and
// every fighter gets a cheap clone from createInstance().
// ============================================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import * as SkeletonUtils from 'three/addons/SkeletonUtils.js';
import { addRest, cloneMaterial, DETAIL, withDetail } from './materials.js';
import { clamp } from './noise.js';
import { makeSDF, surfaceNets } from './shapes.js';

const DETAIL_MODES = { rock: DETAIL.ROCK, fur: DETAIL.FUR, scales: DETAIL.SCALES };
const EYE = new THREE.SphereGeometry(1, 20, 14);

function materialFrom(spec = {}) {
    const { color = '#ffffff', roughness = 0.6, metalness = 0, clearcoat = 0, opacity = 1, sheen = 0, sheenColor = '#ffffff', stripes = null, emissive = null } = spec;
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat, sheen, sheenColor: new THREE.Color(sheenColor) });
    if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
    if (emissive) m.emissive.set(emissive);
    if (stripes) m.map = stripeTexture(stripes);
    return m;
}

function stripeTexture({ colors = ['#9e2f27', '#d4a23a'], width = 7, repeat = 14 }) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = colors[0];
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = colors[1];
    g.lineWidth = width;
    for (let i = -64; i < 128; i += 32) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    return t;
}

function hornGeometry(length, radius, curve, base, tip) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(radius * Math.pow(1 - t, 0.8) + 0.0008, t * length)); }
    const g = new THREE.LatheGeometry(pts, 16);
    const p = g.attributes.position, b = new THREE.Color(base), e = new THREE.Color(tip), c = [];
    for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / length;
        p.setX(i, p.getX(i) + curve * t * t * length);
        const col = b.clone().lerp(e, Math.pow(t, 1.4));
        c.push(col.r, col.g, col.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals();
    return addRest(g);
}

/**
 * The toolkit a model's accessories(kit) uses. `at` is a bone name or a group made by
 * kit.group(); positions are in the model's rest pose (world units, feet at y = 0).
 */
function accessoryKit(bones, world) {
    const anchor = (at) => (typeof at === 'string' ? { node: bones[at], pos: world[at] } : at);
    const place = (at, obj, pos = [0, 0, 0], rot = [0, 0, 0], shadow = true) => {
        const a = anchor(at);
        obj.position.set(pos[0] - a.pos[0], pos[1] - a.pos[1], pos[2] - a.pos[2]);
        obj.rotation.set(...rot);
        obj.castShadow = shadow;
        obj.receiveShadow = true;
        a.node.add(obj);
        return obj;
    };
    const mesh = (geometry, spec) => new THREE.Mesh(geometry, materialFrom(spec));
    return {
        /** A named pivot other accessories can hang from; the model's apply() can move it via rig.extras[name]. */
        group(name, at, pos) {
            const g = place(at, new THREE.Group(), pos);
            g.name = name;
            return { node: g, pos };
        },
        eye(at, pos, radius, color) {
            const e = new THREE.Mesh(EYE, materialFrom({ color, roughness: 0.08, clearcoat: 1 }));
            e.scale.setScalar(radius);
            return place(at, e, pos, [0, 0, 0], false);
        },
        ellipsoid(at, pos, scale, spec) {
            const e = mesh(EYE, spec);
            e.scale.set(...scale);
            return place(at, e, pos);
        },
        horn(at, pos, rot, { length, radius, curve = 0, base = '#8f846c', tip = '#2e2a24', roughness = 0.45 }) {
            const m = withDetail(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness, clearcoat: 0.3 }), { mode: DETAIL.ROCK, freq: 40, strength: 0.25, tint: 0.05, freq2: 6 });
            return place(at, new THREE.Mesh(hornGeometry(length, radius, curve, base, tip), m), pos, rot);
        },
        cone(at, pos, rot, { radius, height, ...spec }) { return place(at, mesh(new THREE.ConeGeometry(radius, height, 10), spec), pos, rot, false); },
        cylinder(at, pos, rot, { radiusTop, radiusBottom = radiusTop, height, ...spec }) { return place(at, mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 10), spec), pos, rot); },
        torus(at, pos, rot, { radius, tube, ...spec }) { return place(at, mesh(new THREE.TorusGeometry(radius, tube, 8, 28), spec), pos, rot); },
        disc(at, pos, rot, { radius, ...spec }) { return place(at, mesh(new THREE.CircleGeometry(radius, 24), spec), pos, rot, false); },
        box(at, pos, rot, { size, ...spec }) { return place(at, mesh(new THREE.BoxGeometry(...size), spec), pos, rot); },
        roundedBox(at, pos, rot, { size, radius, ...spec }) { return place(at, mesh(new RoundedBoxGeometry(...size, 2, radius), spec), pos, rot); },
        /** A flat piece cut from a 2-D outline (x across, y up), `depth` thick, facing +x. */
        flat(at, pos, outline, { depth = 0.006, ...spec }) {
            const shape = new THREE.Shape();
            shape.moveTo(...outline[0]);
            for (const p of outline.slice(1)) shape.lineTo(...p);
            shape.closePath();
            const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
            g.rotateY(Math.PI / 2);
            return place(at, mesh(g, spec), pos);
        }
    };
}

/** Build a character's template model from its model file. */
export function buildModel(def) {
    const world = {}, bones = {}, list = [];
    for (const [name, parent, p] of def.bones) {
        const b = new THREE.Bone();
        b.name = name;
        world[name] = p;
        const pp = parent ? world[parent] : [0, 0, 0];
        b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
        if (parent) bones[parent].add(b);
        bones[name] = b;
        list.push(b);
    }
    const boneIndex = Object.fromEntries(list.map((b, i) => [b.name, i]));
    const rough = def.material?.roughness ?? 0.8;
    const cols = {};
    for (const [k, v] of Object.entries(def.colors)) {
        const [hex, s = 1, r = rough] = Array.isArray(v) ? v : [v];
        cols[k] = { c: new THREE.Color(hex), s, r };
    }
    const { detail = {}, ...matOpts } = def.material || {};
    const material = withDetail(
        new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: rough, sheen: matOpts.sheen ?? 0, sheenRoughness: matOpts.sheenRoughness ?? 0.5, sheenColor: new THREE.Color(matOpts.sheenColor ?? '#ffffff') }),
        { mode: DETAIL_MODES[detail.mode || 'fur'], freq: detail.freq ?? 60, strength: detail.strength ?? 0.3, tint: detail.tint ?? 0.06, freq2: detail.freq2 ?? 8, surf: true }
    );
    const blend = def.blend ?? 0.025, ao = def.ao ?? 0.02;

    const root = new THREE.Group();
    const scaleNode = new THREE.Group();
    scaleNode.scale.setScalar(def.scale ?? 1);
    root.add(scaleNode);
    const skeleton = new THREE.Skeleton(list);
    const meshes = [];
    let triangles = 0;
    const c = new THREE.Color();
    const box = new THREE.Box3();
    for (const { prims, min, max, step } of def.parts) {
        const sdf = makeSDF(prims);
        const { P, N, I } = surfaceNets(sdf, min, max, step);
        const count = P.length / 3;
        for (let i = 0; i < P.length; i += 3) box.expandByPoint(new THREE.Vector3(P[i], P[i + 1], P[i + 2]));
        const skinI = new Uint16Array(count * 4), skinW = new Float32Array(count * 4), col = new Float32Array(count * 3), surf = new Float32Array(count * 2);
        const wb = new Float32Array(list.length), order = list.map((_, i) => i), ds = new Float32Array(prims.length);
        for (let v = 0; v < count; v++) {
            const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
            let dmin = Infinity;
            for (let i = 0; i < prims.length; i++) { ds[i] = prims[i].d(x, y, z); if (ds[i] < dmin) dmin = ds[i]; }
            wb.fill(0);
            let r = 0, g = 0, b = 0, ss = 0, sr = 0, ws = 0;
            for (let i = 0; i < prims.length; i++) {
                const w = Math.exp(-(ds[i] - dmin) / blend);
                if (w < 1e-4) continue;
                wb[boneIndex[prims[i].bone]] += w;
                const pc = cols[prims[i].col];
                r += pc.c.r * w; g += pc.c.g * w; b += pc.c.b * w; ss += pc.s * w; sr += pc.r * w; ws += w;
            }
            order.sort((a2, b2) => wb[b2] - wb[a2]);
            const tot = wb[order[0]] + wb[order[1]] + wb[order[2]] + wb[order[3]];
            for (let s = 0; s < 4; s++) { skinI[v * 4 + s] = order[s]; skinW[v * 4 + s] = wb[order[s]] / tot; }
            c.setRGB(r / ws, g / ws, b / ws);
            def.shade?.(c, x, y, z, nx, ny, nz, cols);
            let occ = 0, wt = 1; // ambient occlusion sampled from the distance field
            for (let i = 1; i <= 5; i++) { const hh = ao * i; occ += (hh - sdf(x + nx * hh, y + ny * hh, z + nz * hh)) * wt; wt *= 0.6; }
            c.multiplyScalar(clamp(1 - occ / (ao * 2.4), 0.3, 1));
            col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
            surf[v * 2] = ss / ws; surf[v * 2 + 1] = sr / ws;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
        geo.setAttribute('rest', new THREE.BufferAttribute(P.slice(), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('surf', new THREE.BufferAttribute(surf, 2));
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinI, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4));
        geo.setIndex(new THREE.BufferAttribute(I, 1));
        const mesh = new THREE.SkinnedMesh(geo, material);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        scaleNode.add(mesh);
        meshes.push(mesh);
        triangles += I.length / 3;
    }
    meshes[0].add(list[0]);
    root.updateMatrixWorld(true);
    skeleton.calculateInverses();
    for (const m of meshes) m.bind(skeleton, meshes[0].matrixWorld);
    def.accessories?.(accessoryKit(bones, world));
    const s = def.scale ?? 1;
    // Size in the rest pose, scaled: used to frame the model in menus.
    const bounds = { min: box.min.clone().multiplyScalar(s), max: box.max.clone().multiplyScalar(s) };
    return { def, root, world, triangles, bounds };
}

/**
 * A posable copy of a template for one fighter or one menu slot. Materials are
 * cloned so each copy can flash, glow or fade on its own.
 */
export function createInstance(template) {
    const root = SkeletonUtils.clone(template.root);
    const scaleNode = root.children[0];
    const bones = {}, extras = {}, materials = new Map(), meshes = [];
    root.traverse((o) => {
        if (o.isBone) bones[o.name] = o;
        else if (o.name) extras[o.name] = o;
        if (o.isMesh) {
            if (!materials.has(o.material)) materials.set(o.material, cloneMaterial(o.material));
            o.material = materials.get(o.material);
            meshes.push(o);
        }
    });
    return new CreatureInstance(template, root, scaleNode, bones, extras, [...materials.values()], meshes);
}

const tmp = new THREE.Vector3();

export class CreatureInstance {
    constructor(template, root, scaleNode, bones, extras, materials, meshes) {
        Object.assign(this, { template, def: template.def, root, scaleNode, bones, extras, materials, meshes });
        this.state = {};       // per-instance memory for apply() (tie swing, etc.)
        this.rest = Object.fromEntries(Object.entries(bones).map(([k, b]) => [k, b.position.clone()]));
        this.tint = null;
    }

    /**
     * Pose the skeleton. info: { time (frames), dt (seconds), motion [vx, vy] in px/frame, grounded }.
     * When grounded, the body is shifted so the lowest foot touches the floor.
     */
    pose(pose, info) {
        const { bones, rest } = this;
        for (const [k, b] of Object.entries(bones)) { b.position.copy(rest[k]); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1); }
        this.def.apply({ bones, extras: this.extras, state: this.state }, pose, info);
        this.scaleNode.position.y = 0;
        if (info.grounded && this.def.feet) {
            this.root.updateMatrixWorld(true);
            const inv = this.root.matrixWorld.clone().invert();
            let low = Infinity;
            for (const { bone, offset } of this.def.feet) {
                tmp.set(...offset).applyMatrix4(bones[bone].matrixWorld).applyMatrix4(inv);
                low = Math.min(low, tmp.y);
            }
            if (Number.isFinite(low)) this.scaleNode.position.y = clamp(-low, -0.35, 0.35) * (pose.snap ?? 1);
        }
    }

    /** Emissive overlay (hit flash, charge glow) or null to clear. */
    setTint(color, amount) {
        const key = color ? `${color}:${amount.toFixed(2)}` : null;
        if (key === this.tint) return;
        this.tint = key;
        for (const m of this.materials) {
            if (color) { m.emissive.set(color); m.emissiveIntensity = amount; } else { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; }
        }
    }

    /** Fade the whole model (dodges). Materials that are see-through already (lenses) stay relative. */
    setOpacity(alpha) {
        if (this.alpha === alpha) return;
        this.alpha = alpha;
        for (const m of this.materials) {
            if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
            const transparent = alpha < 0.999 || m.userData.baseTransparent;
            if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
            m.opacity = m.userData.baseOpacity * alpha;
        }
    }
}

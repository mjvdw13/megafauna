// ============================================================================
// MATERIALS
// Surface detail without texture files: a small tiling noise texture (R: rock
// grain, G: pebbled scales, B: fine fur streaks) is generated once and sampled
// three ways (triplanar) from each vertex's rest position, so the detail
// sticks to skin as a skinned model bends. Plus a vertex attribute `surf`
// lets one creature mesh mix fur, skin and cloth (detail strength, roughness).
// ============================================================================
import * as THREE from 'three';
import { hash3, lerp, smooth } from './noise.js';

export const DETAIL = Object.freeze({ ROCK: 0, FUR: 1, SCALES: 2 });

function makeNoiseTexture(size = 256) {
    const data = new Uint8Array(size * size * 4);
    const wrap = (a, p) => ((a % p) + p) % p;
    const periodic = (fx, fy, p) => {
        const xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const H = (a, b) => hash3(wrap(a, p), wrap(b, p), p);
        return lerp(lerp(H(xi, yi), H(xi + 1, yi), u), lerp(H(xi, yi + 1), H(xi + 1, yi + 1), u), v);
    };
    const cells = 8, pts = [];
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([hash3(i, j, 91), hash3(i, j, 92)]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        let fb = 0, a = 0.5, n = 0;
        for (let o = 0; o < 4; o++) { const p = 8 << o; fb += a * periodic(u * p, v * p, p); n += a; a *= 0.5; }
        const cx = u * cells, cy = v * cells, ix = Math.floor(cx), iy = Math.floor(cy);
        let d = 9;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const gx = ix + dx, gy = iy + dy, q = pts[wrap(gy, cells) * cells + wrap(gx, cells)];
            d = Math.min(d, (gx + q[0] - cx) ** 2 + (gy + q[1] - cy) ** 2);
        }
        const k = (y * size + x) * 4;
        data[k] = (fb / n) * 255;
        data[k + 1] = (1 - smooth(Math.sqrt(d), 0, 0.75)) * 255;
        data[k + 2] = (periodic(u * 32, v * 32, 32) * 0.65 + periodic(u * 64, v * 64, 64) * 0.35) * 255;
        data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
}

let noiseTexture = null;
export function getNoiseTexture() {
    if (!noiseTexture) noiseTexture = makeNoiseTexture();
    return noiseTexture;
}

/** Shared clock for animated materials (water ripples, lava). Set once per frame. */
export const materialTime = { value: 0 };

const DETAIL_GLSL = `
uniform sampler2D uNoise;
uniform float uFreq, uStrength, uTint, uFreq2, uTime, uFlow;
varying vec3 vRest;
varying vec3 vRestN;
#ifdef USE_SURF
varying vec2 vSurf;
#endif
vec4 triN(vec3 p, vec3 w) { return texture2D(uNoise, p.yz) * w.x + texture2D(uNoise, p.zx) * w.y + texture2D(uNoise, p.xy) * w.z; }
float detailHeight(vec3 p, vec3 w) {
#if DETAIL_MODE == 1
  return triN(vec3(p.x * 0.3, p.y, p.z) * (uFreq / 32.0), w).b;
#elif DETAIL_MODE == 2
  return triN(p * (uFreq / 8.0), w).g;
#else
  float r = triN(p * (uFreq / 8.0), w).r; return 1.0 - abs(r * 2.0 - 1.0);
#endif
}`;

/**
 * Add procedural surface detail to a standard/physical material.
 * mode: DETAIL.ROCK | FUR | SCALES. freq: features per world unit. strength: bump slope.
 * tint: large-scale color variation (freq2 per unit). flow: scroll speed (water).
 * surf: the geometry carries a `surf` attribute (detail strength, roughness) per vertex.
 * Every geometry using it needs `rest` (a copy of position) and normals.
 */
export function withDetail(material, { mode = DETAIL.ROCK, freq = 20, strength = 0.5, tint = 0.1, freq2 = 4, flow = 0, surf = false } = {}) {
    const params = { mode, freq, strength, tint, freq2, flow, surf };
    material.userData.detail = params;
    material.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, {
            uNoise: { value: getNoiseTexture() }, uFreq: { value: freq }, uStrength: { value: strength },
            uTint: { value: tint }, uFreq2: { value: freq2 }, uTime: materialTime, uFlow: { value: flow }
        });
        const defs = `#define DETAIL_MODE ${mode}\n${surf ? '#define USE_SURF\n' : ''}`;
        sh.vertexShader = defs + sh.vertexShader
            .replace('#include <common>', `#include <common>
                attribute vec3 rest;
                varying vec3 vRest;
                varying vec3 vRestN;
                #ifdef USE_SURF
                attribute vec2 surf;
                varying vec2 vSurf;
                #endif`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vRest = rest;
                vRestN = normal;
                #ifdef USE_SURF
                vSurf = surf;
                #endif`);
        sh.fragmentShader = defs + sh.fragmentShader
            .replace('#include <common>', '#include <common>\n' + DETAIL_GLSL)
            .replace('#include <color_fragment>', `#include <color_fragment>
                vec3 triW = pow(abs(normalize(vRestN)), vec3(4.0)); triW /= dot(triW, vec3(1.0));
                vec3 detailP = vRest + vec3(uTime * uFlow, 0.0, uTime * uFlow * 0.6);
                float detailK = uStrength;
                #ifdef USE_SURF
                detailK *= vSurf.x;
                #endif
                diffuseColor.rgb *= 1.0 + uTint * (triN(detailP * (uFreq2 / 8.0), triW).r * 2.0 - 1.0);`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                #ifdef USE_SURF
                roughnessFactor = vSurf.y;
                #endif`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                {
                  float dh = detailHeight(detailP, triW);
                  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
                  float hx = dFdx(dh), hy = dFdy(dh);
                  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
                  float det = dot(dpx, r1);
                  vec3 gr = sign(det) * (hx * r1 + hy * r2);
                  normal = normalize(abs(det) * normal - gr * detailK / uFreq);
                }`);
    };
    material.customProgramCacheKey = () => `detail-${mode}-${surf}`;
    return material;
}

/** Clone a material, keeping its procedural detail (Material.clone drops onBeforeCompile). */
export function cloneMaterial(material) {
    const copy = material.clone();
    if (material.userData.detail) withDetail(copy, material.userData.detail);
    return copy;
}

/** Copy `position` into a `rest` attribute so detail shaders have a stable surface to sample. */
export function addRest(geometry) {
    geometry.setAttribute('rest', geometry.attributes.position.clone());
    return geometry;
}

/** Set per-vertex colors from a function (x, y, z, normalY) → THREE.Color. */
export function paintVertices(geometry, colorAt) {
    const p = geometry.attributes.position, n = geometry.attributes.normal, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const col = colorAt(p.getX(i), p.getY(i), p.getZ(i), n ? n.getY(i) : 1);
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geometry;
}

// ============================================================================
// NOISE
// Seeded value noise for procedural models and worlds. Pure math, no three.js,
// so model and world files can use it too.
// ============================================================================

export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export function smooth(x, lo, hi) {
    const t = clamp((x - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
}

/** Repeatable random numbers in [0, 1). */
export function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Hash of an integer lattice point to [0, 1). */
export function hash3(x, y, z) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    return lerp(
        lerp(lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
        lerp(lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}

/** Fractal noise in roughly [0, 1]. */
export function fbm(x, y, z, octaves = 4) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < octaves; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
}

/** Ridged fractal noise (sharp crests), for mountain ranges. */
export function ridged(x, z, octaves = 5, seed = 0) {
    let m = 0, a = 1, f = 1;
    for (let i = 0; i < octaves; i++) {
        const r = 1 - Math.abs(vnoise(x * f + 13.1 + seed, 7.7, z * f + 3.3) * 2 - 1);
        m += r * r * a;
        a *= 0.5;
        f *= 2.05;
    }
    return m;
}

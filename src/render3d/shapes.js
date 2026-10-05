// ============================================================================
// SHAPES
// Signed-distance primitives that character models are sculpted from, and the
// surface-nets mesher that turns them into triangles. Pure math (no three.js),
// so model files can import the primitives and tests can load them in Node.
//
//   cap(a, b, ra, rb, bone, k, col)       a tapered capsule from point a to b
//   ell(center, radii, bone, k, col, rz)  an ellipsoid, optionally tilted by rz about z
//
// bone: the skeleton bone that moves this piece. k: how softly it blends into
// its neighbours (world units). col: a key into the model's color table.
// ============================================================================

export function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
}

export function cap(a, b, ra, rb, bone, k, col) {
    const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2;
    return {
        bone, k, col,
        bc: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
        br: Math.sqrt(l2) / 2 + Math.max(ra, rb),
        d(x, y, z) {
            const px = x - a[0], py = y - a[1], pz = z - a[2];
            let h = (px * ba[0] + py * ba[1] + pz * ba[2]) / l2;
            h = h < 0 ? 0 : h > 1 ? 1 : h;
            const dx = px - ba[0] * h, dy = py - ba[1] * h, dz = pz - ba[2] * h;
            return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
        }
    };
}

export function ell(c, r, bone, k, col, rz = 0) {
    const cs = Math.cos(rz), sn = Math.sin(rz), rmin = Math.min(...r);
    return {
        bone, k, col, bc: c, br: Math.max(...r),
        d(x, y, z) {
            let px = x - c[0], py = y - c[1];
            const pz = z - c[2];
            if (rz) { const qx = px * cs + py * sn, qy = -px * sn + py * cs; px = qx; py = qy; }
            const ax = px / r[0], ay = py / r[1], az = pz / r[2];
            const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
            const bx = ax / r[0], by = ay / r[1], bz = az / r[2];
            const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
            return k1 < 1e-9 ? -rmin : (k0 * (k0 - 1)) / k1;
        }
    };
}

/** One distance function for a list of primitives, blended smoothly. */
export function makeSDF(prims) {
    return (x, y, z) => {
        let d = 1e9;
        for (const p of prims) {
            const dx = x - p.bc[0], dy = y - p.bc[1], dz = z - p.bc[2];
            if (Math.sqrt(dx * dx + dy * dy + dz * dz) - p.br > d + p.k) continue;
            const di = p.d(x, y, z);
            d = d === 1e9 ? di : smin(d, di, p.k);
        }
        return d;
    };
}

/**
 * Naive surface nets: one vertex per surface-crossing cell, one quad per crossing edge.
 * Blocks of the grid far from the surface are filled from a single sample (much faster).
 * Returns positions, outward normals (from the field's gradient) and triangle indices.
 */
export function surfaceNets(f, min, max, h) {
    const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
    const field = new Float32Array(nx * ny * nz), BS = 6;
    for (let bk = 0; bk < nz; bk += BS) for (let bj = 0; bj < ny; bj += BS) for (let bi = 0; bi < nx; bi += BS) {
        const ie = Math.min(bi + BS, nx), je = Math.min(bj + BS, ny), ke = Math.min(bk + BS, nz);
        const dc = f(min[0] + ((bi + ie - 1) / 2) * h, min[1] + ((bj + je - 1) / 2) * h, min[2] + ((bk + ke - 1) / 2) * h);
        const half = Math.sqrt((ie - 1 - bi) ** 2 + (je - 1 - bj) ** 2 + (ke - 1 - bk) ** 2) * h * 0.5;
        const far = Math.abs(dc) > (half + 2 * h) * 1.4;
        for (let k = bk; k < ke; k++) for (let j = bj; j < je; j++) {
            let q = bi + nx * (j + ny * k);
            for (let i = bi; i < ie; i++, q++) field[q] = far ? dc : f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
        }
    }
    const at = (i, j, k) => field[i + nx * (j + ny * k)];
    const cx = nx - 1, cy = ny - 1, cz = nz - 1;
    const cellIndex = new Int32Array(cx * cy * cz).fill(-1);
    const O = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const v = new Float32Array(8), pos = [];
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) { v[c] = at(i + O[c][0], j + O[c][1], k + O[c][2]); if (v[c] < 0) inside++; }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of E) {
            if ((v[a] < 0) === (v[b] < 0)) continue;
            const t = v[a] / (v[a] - v[b]);
            sx += O[a][0] + (O[b][0] - O[a][0]) * t;
            sy += O[a][1] + (O[b][1] - O[a][1]) * t;
            sz += O[a][2] + (O[b][2] - O[a][2]) * t;
            cnt++;
        }
        cellIndex[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / cnt) * h, min[1] + (j + sy / cnt) * h, min[2] + (k + sz / cnt) * h);
    }
    const cell = (i, j, k) => cellIndex[i + cx * (j + cy * k)];
    const idx = [];
    const quad = (a, b, c, d) => { if (a >= 0 && b >= 0 && c >= 0 && d >= 0) idx.push(a, b, c, a, c, d); };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const s = at(i, j, k) < 0;
        if (i < cx && j > 0 && j < cy && k > 0 && k < cz && s !== (at(i + 1, j, k) < 0)) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k));
        if (j < cy && i > 0 && i < cx && k > 0 && k < cz && s !== (at(i, j + 1, k) < 0)) quad(cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k));
        if (k < cz && i > 0 && i < cx && j > 0 && j < cy && s !== (at(i, j, k + 1) < 0)) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k));
    }
    const P = new Float32Array(pos), N = new Float32Array(pos.length), e = h * 0.5;
    for (let q = 0; q < P.length; q += 3) {
        const x = P[q], y = P[q + 1], z = P[q + 2];
        const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
        const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        N[q] = gx / l; N[q + 1] = gy / l; N[q + 2] = gz / l;
    }
    const I = new Uint32Array(idx);
    for (let t = 0; t < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
        const wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
        const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
        if (fx * (N[a] + N[b] + N[c]) + fy * (N[a + 1] + N[b + 1] + N[c + 1]) + fz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) {
            const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp;
        }
    }
    return { P, N, I };
}

// ============================================================================
// SKETCH KIT
// Hand-painted drawing primitives for stage backgrounds. Everything is in
// screen pixels (1280 x 720). Shapes get a wobbly ink outline and a textured
// "wash" fill so backgrounds look painted rather than computer-flat.
// ============================================================================
import { Ink } from '../graphics/ink.js';

export const W = 1280;
export const H = 720;
/** Top of the floor plane fighters stand on (feet are at groundY, usually 550). */
export const FLOOR_TOP = 452;

/** Create the painter used by a stage's paint(). `rng` keeps details identical every run. */
export function createSketch(ctx, rng) {
    const ink = new Ink({ seed: Math.floor(rng() * 1000), wobble: 1.6, lineWidth: 3 });
    ink.begin(0);
    const rand = (a, b) => a + rng() * (b - a);

    const kit = {
        ctx, ink, rng, rand,

        /** Vertical gradient sky with soft painted streaks. */
        sky(stops, bottom = FLOOR_TOP) {
            const g = ctx.createLinearGradient(0, 0, 0, bottom);
            stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, bottom + 4);
            ctx.save();
            ctx.globalAlpha = 0.08;
            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = rng() < 0.5 ? '#ffffff' : '#000000';
                ctx.beginPath();
                ctx.ellipse(rand(0, W), rand(0, bottom), rand(80, 260), rand(4, 12), rand(-0.05, 0.05), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        },

        /** Fill a path with a color plus brushy texture, then optionally ink it. */
        wash(path, color, { texture = 0.12, outline = true, lineWidth = 3, strokes = 60 } = {}) {
            ctx.fillStyle = color;
            ctx.fill(path);
            if (texture > 0) {
                ctx.save();
                ctx.clip(path);
                for (let i = 0; i < strokes; i++) {
                    ctx.globalAlpha = texture * rand(0.4, 1);
                    ctx.strokeStyle = rng() < 0.55 ? '#000000' : '#ffffff';
                    ctx.lineWidth = rand(2, 7);
                    ctx.lineCap = 'round';
                    const x = rand(0, W), y = rand(0, H), len = rand(20, 90), a = rand(-0.3, 0.3);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.quadraticCurveTo(x + len / 2, y + rand(-6, 6), x + Math.cos(a) * len, y + Math.sin(a) * len);
                    ctx.stroke();
                }
                ctx.restore();
            }
            if (outline) ink.outlinePath(ctx, path, lineWidth);
        },

        /** Rolling ridge from baseY down to `bottom`. */
        hills({ baseY, amplitude = 30, frequency = 0.006, phase = 0, color, bottom = H, outline = true, lineWidth = 3, bumps = 0, texture = 0.1 }) {
            const pts = [];
            for (let x = -40; x <= W + 40; x += 40) {
                const y = baseY - amplitude * (Math.sin(x * frequency + phase) * 0.5 + 0.5) - (bumps ? Math.abs(Math.sin(x * 0.05 + phase)) * bumps : 0);
                pts.push([x, y]);
            }
            const path = ink.openCurve(pts, 2);
            path.lineTo(W + 60, bottom + 20);
            path.lineTo(-60, bottom + 20);
            path.closePath();
            kit.wash(path, color, { outline, lineWidth, texture });
        },

        /** Triangular mountain with a wobbly outline and optional snow cap. */
        mountain(peakX, peakY, width, baseY, color, { cap = null, shade = null } = {}) {
            const left = [peakX - width / 2, baseY], right = [peakX + width / 2, baseY];
            const pts = [left, [peakX - width * 0.22, peakY + (baseY - peakY) * 0.45], [peakX - 8, peakY + 6], [peakX, peakY], [peakX + 10, peakY + 8], [peakX + width * 0.25, peakY + (baseY - peakY) * 0.5], right];
            const path = ink.openCurve(pts, 3);
            path.closePath();
            kit.wash(path, color, { texture: 0.12 });
            if (shade) {
                const s = ink.openCurve([[peakX, peakY], [peakX + 10, peakY + 8], [peakX + width * 0.25, peakY + (baseY - peakY) * 0.5], right, [peakX + width * 0.08, baseY]], 2);
                s.closePath();
                ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = shade; ctx.fill(s); ctx.restore();
            }
            if (cap) {
                const k = 0.28, cy = peakY + (baseY - peakY) * k;
                const capPath = ink.closedCurve([[peakX, peakY - 1], [peakX + width * k * 0.45, cy], [peakX + width * 0.06, cy - 8], [peakX - width * 0.05, cy + 4], [peakX - width * k * 0.45, cy]], 1.5);
                kit.wash(capPath, cap, { texture: 0.05, lineWidth: 2.4 });
            }
        },

        /** Puffy cloud / bush: outline all circles first, then fill, so only the outer edge is inked. */
        puffs(circles, color, { shade = null, lineWidth = 3, outline = true } = {}) {
            const paths = circles.map(([x, y, r]) => ink.ellipse(x, y, r, r * 0.92, 0, 10));
            if (outline) for (const p of paths) ink.outlinePath(ctx, p, lineWidth * 2);
            for (const p of paths) { ctx.fillStyle = color; ctx.fill(p); }
            if (shade) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = shade;
                circles.forEach(([x, y, r]) => { ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.45, r * 0.75, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); });
                ctx.restore();
            }
        },

        cloud(x, y, size, color = '#ffffff', shade = '#d9e4ef') {
            const s = size;
            kit.puffs([[x, y, s * 0.6], [x + s * 0.55, y - s * 0.25, s * 0.7], [x + s * 1.15, y, s * 0.55], [x + s * 0.5, y + s * 0.15, s * 0.6]], color, { shade, lineWidth: 2.2 });
        },

        /** Round canopy tree. */
        tree(x, groundY, { size = 60, trunk = '#6d4c33', leaves = '#4caf50', shade = '#357a38', trunkHeight = 70 } = {}) {
            const t = ink.closedCurve([[x - 9, groundY], [x - 6, groundY - trunkHeight], [x + 6, groundY - trunkHeight], [x + 10, groundY]], 1);
            kit.wash(t, trunk, { texture: 0.15, strokes: 15 });
            const cy = groundY - trunkHeight - size * 0.4;
            kit.puffs([[x, cy, size * 0.6], [x - size * 0.5, cy + size * 0.2, size * 0.45], [x + size * 0.5, cy + size * 0.15, size * 0.5], [x - size * 0.2, cy - size * 0.4, size * 0.45], [x + size * 0.25, cy - size * 0.35, size * 0.42]], leaves, { shade });
        },

        /** Pine tree: stacked wobbly triangles. */
        pine(x, groundY, height, color, shade = null, snow = null) {
            ink.limb(ctx, [[x, groundY], [x, groundY - height * 0.3]], 6, '#5d4037');
            for (let i = 0; i < 3; i++) {
                const top = groundY - height + i * height * 0.22, w = height * (0.28 + i * 0.1), bottom = top + height * 0.42;
                const path = ink.closedCurve([[x, top], [x + w * 0.5, bottom - 6], [x + w * 0.55, bottom], [x - w * 0.55, bottom], [x - w * 0.5, bottom - 6]], 1.5);
                kit.wash(path, color, { texture: 0.08, strokes: 10, lineWidth: 2.4 });
                if (snow) { ctx.fillStyle = snow; ctx.beginPath(); ctx.ellipse(x, top + 8, w * 0.2, 4, 0, 0, Math.PI * 2); ctx.fill(); }
            }
            if (shade) { ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = shade; ctx.fillRect(x, groundY - height, height * 0.3, height * 0.75); ctx.restore(); }
        },

        /** Palm tree with a curved trunk and drooping fronds. */
        palm(x, groundY, height, color = '#2a1430', trunk = color) {
            const lean = height * 0.18;
            const top = [x + lean, groundY - height];
            ink.limb(ctx, [[x, groundY], [x + lean * 0.3, groundY - height * 0.5], top], 9, trunk);
            for (const [dx, dy, droop] of [[70, 0, 30], [-70, 6, 30], [50, -22, 10], [-48, -24, 12], [16, -30, -4], [80, 16, 50], [-78, 20, 50]]) {
                const tip = [top[0] + dx, top[1] + dy + droop];
                const mid = [top[0] + dx * 0.5, top[1] + dy - 10];
                const path = ink.closedCurve([top, [mid[0], mid[1] - 7], tip, [mid[0], mid[1] + 6]], 1.2);
                kit.wash(path, color, { texture: 0, lineWidth: 2 });
            }
        },

        /** Prehistoric fern: arcing fronds with leaflets. */
        fern(x, groundY, size, color, dark) {
            for (const [angle, len] of [[-2.6, 1], [-2.2, 0.9], [-1.85, 1.1], [-1.55, 1.2], [-1.25, 1.1], [-0.9, 0.9], [-0.5, 1]]) {
                const L = size * len;
                const pts = [];
                for (let i = 0; i <= 6; i++) {
                    const t = i / 6;
                    const a = angle + (angle < -1.57 ? -1 : 1) * t * t * 0.9;
                    pts.push([x + Math.cos(a) * L * t, groundY + Math.sin(a) * L * t]);
                }
                ink.line(ctx, pts, { width: 3, color: dark });
                for (let i = 1; i < pts.length - 1; i++) {
                    const [px, py] = pts[i];
                    const leaf = (Math.cos(angle) > 0 ? 1 : -1);
                    kit.wash(ink.ellipse(px + leaf * 4, py - 5, 7 - i * 0.6, 3, angle - 0.6, 6), color, { texture: 0, lineWidth: 1.6 });
                    kit.wash(ink.ellipse(px - leaf * 3, py + 4, 7 - i * 0.6, 3, angle + 0.6, 6), color, { texture: 0, lineWidth: 1.6 });
                }
            }
        },

        /** Clumps of grass blades. */
        grass(y, { count = 80, color = '#3f7a2a', height = [8, 18], x0 = 0, x1 = W } = {}) {
            for (let i = 0; i < count; i++) {
                const x = rand(x0, x1), h = rand(...height);
                ink.line(ctx, [[x, y], [x + rand(-4, 4), y - h * 0.6], [x + rand(-6, 6), y - h]], { width: 2, color });
            }
        },

        /** Ink hatching inside a path (shadows, texture). */
        hatch(path, { spacing = 10, angle = -0.8, color = '#2a1d17', alpha = 0.18, width = 1.5 } = {}) {
            ctx.save();
            ctx.clip(path);
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            const dx = Math.cos(angle) * 1600, dy = Math.sin(angle) * 1600;
            for (let o = -1600; o < 2900; o += spacing) {
                ctx.beginPath();
                ctx.moveTo(o + rand(-2, 2), 0);
                ctx.lineTo(o + dx, dy + rand(-2, 2));
                ctx.stroke();
            }
            ctx.restore();
        },

        /** The floor band fighters stand on. */
        floor(color, { edge = null, top = FLOOR_TOP, lines = '#000000', lineAlpha = 0.12 } = {}) {
            const path = ink.openCurve([[-20, top + 4], [W * 0.3, top], [W * 0.7, top + 3], [W + 20, top]], 2);
            path.lineTo(W + 20, H + 10);
            path.lineTo(-20, H + 10);
            path.closePath();
            kit.wash(path, color, { texture: 0.12, strokes: 120 });
            if (edge) { ctx.fillStyle = edge; ctx.fillRect(0, top, W, 10); ink.line(ctx, [[0, top + 10], [W, top + 10]], { width: 2, color: '#2a1d17' }); }
            // Perspective scratches
            ctx.save();
            ctx.globalAlpha = lineAlpha;
            for (let i = 0; i < 30; i++) {
                const y = rand(top + 20, H), x = rand(0, W);
                ink.line(ctx, [[x, y], [x + rand(30, 110), y + rand(-2, 2)]], { width: 2, color: lines });
            }
            ctx.restore();
        },

        /** Round-ish stone. */
        rock(x, y, r, color = '#8d8d8d') {
            kit.wash(ink.ellipse(x, y, r, r * 0.65, rand(-0.2, 0.2), 9), color, { texture: 0.15, strokes: 8, lineWidth: 2.4 });
        }
    };
    return kit;
}

/**
 * What lies beyond the main platform's edges. `floatable` liquids hold up fighters
 * with the `floats` ability; `splash` colors the particles when someone falls in.
 */
export const PIT_STYLES = Object.freeze({
    water: { colors: ['#6db6d8', '#2f6d8c'], floatable: true, splash: ['#e8f7ff', '#8fd0ee', '#4f9cc0'], sound: 'splash', detail: 'ripples' },
    pool: { colors: ['#7fdcf0', '#2b8fb3'], floatable: true, splash: ['#ffffff', '#a8ecfb', '#4fc0dd'], sound: 'splash', detail: 'tiles' },
    swamp: { colors: ['#6f8a42', '#2c3a1a'], floatable: true, splash: ['#a7c26a', '#5f7a3a', '#3e4f24'], sound: 'splash', detail: 'scum' },
    icewater: { colors: ['#4d93b0', '#123449'], floatable: false, splash: ['#ffffff', '#cdeefa', '#6fb6d3'], sound: 'splash', detail: 'floes' },
    tar: { colors: ['#3a2f2a', '#0b0807'], floatable: false, splash: ['#4a3b33', '#1a1311', '#000000'], sound: 'gloop', detail: 'gloss' },
    lava: { colors: ['#ffb238', '#b3240c'], floatable: false, splash: ['#fff2a8', '#ff8a1f', '#d9300f'], sound: 'sizzle', detail: 'crust' },
    chasm: { colors: ['#5a4639', '#0c0806'], floatable: false, splash: [], sound: 'fall', detail: 'strata' }
});

/** Darken (amount < 0) or lighten (amount > 0) an [r, g, b] color. */
function shadeRgb([r, g, b], amount) {
    const f = (v) => Math.round(Math.max(0, Math.min(255, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** The floor's own color just inside an edge, so cliff faces match whatever the stage painted. */
function sampleFloor(ctx, x, y) {
    try {
        const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return [d[0], d[1], d[2]];
    } catch {
        return [120, 90, 60];
    }
}

/** Paint the pit on both sides of the main platform, and the cliff faces of the platform itself. */
export function paintPit(kit, layout, pit) {
    const { ctx, ink, rand } = kit;
    const { main } = layout;
    const top = FLOOR_TOP - 2;
    const regions = [[-20, main.left], [main.right, W + 20]];
    const cliffColor = sampleFloor(ctx, main.left + 40, (main.y + H) / 2);

    for (const [x0, x1] of regions) {
        if (x1 - x0 < 4) continue;
        const region = ink.polygon([[x0, top], [x1, top], [x1, H + 10], [x0, H + 10]], 0.8);
        const g = ctx.createLinearGradient(0, top, 0, H);
        g.addColorStop(0, pit.colors[0]);
        g.addColorStop(1, pit.colors[1]);
        ctx.save();
        ctx.clip(region);
        ctx.fillStyle = g;
        ctx.fillRect(x0, top, x1 - x0, H - top + 10);
        paintPitDetail(kit, pit.detail, x0, x1, top);
        ctx.restore();
        // Shoreline / rim along the far edge of the pit
        ink.line(ctx, [[x0, top + 1], [x1, top + rand(-1, 1)]], { width: 2.4 });
    }

    // Cliff faces: the platform is a plateau, so show its sides dropping away.
    for (const side of [-1, 1]) {
        const edge = side < 0 ? main.left : main.right;
        const depth = 22 * side;
        const face = ink.polygon([[edge, top], [edge + depth, top + 14], [edge + depth * 0.8, H + 10], [edge, H + 10]], 1.2);
        kit.wash(face, shadeRgb(cliffColor, -0.38), { texture: 0.18, strokes: 30, lineWidth: 2.6 });
        // Strata lines on the cliff
        for (let y = top + 40; y < H; y += rand(34, 52)) ink.line(ctx, [[edge, y], [edge + depth * 0.9, y + rand(2, 8)]], { width: 1.6, color: shadeRgb(cliffColor, -0.6) });
        // The ledge lip fighters hang from
        const lip = ink.polygon([[edge - 6 * side, main.y - 4], [edge + 12 * side, main.y - 2], [edge + 14 * side, main.y + 8], [edge - 6 * side, main.y + 10]], 0.8);
        kit.wash(lip, shadeRgb(cliffColor, -0.15), { texture: 0.1, strokes: 4, lineWidth: 2.2 });
    }
}

function paintPitDetail(kit, detail, x0, x1, top) {
    const { ctx, ink, rand, rng } = kit;
    const count = Math.max(2, Math.round((x1 - x0) / 40));
    ctx.save();
    if (detail === 'ripples' || detail === 'scum') {
        for (let i = 0; i < count * 3; i++) {
            const x = rand(x0, x1), y = rand(top + 14, H), w = rand(14, 40);
            ctx.globalAlpha = 0.35;
            ink.line(ctx, [[x, y], [x + w / 2, y - 3], [x + w, y]], { width: 2, color: detail === 'scum' ? '#a7c26a' : '#e8f7ff' });
        }
        if (detail === 'scum') {
            ctx.globalAlpha = 0.8;
            for (let i = 0; i < count; i++) kit.wash(ink.ellipse(rand(x0, x1), rand(top + 20, H - 20), rand(10, 18), rand(4, 6), 0, 8), '#5f8f3a', { texture: 0, lineWidth: 1.6 });
        }
    } else if (detail === 'tiles') {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let y = top + 30; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
        for (let x = x0 + 15; x < x1; x += 34) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, H); ctx.stroke(); }
    } else if (detail === 'floes') {
        ctx.globalAlpha = 1;
        for (let i = 0; i < count; i++) {
            const x = rand(x0 + 10, x1 - 10), y = rand(top + 30, H - 20), r = rand(10, 22);
            kit.wash(ink.polygon([[x - r, y], [x - r * 0.4, y - r * 0.4], [x + r, y - r * 0.2], [x + r * 0.6, y + r * 0.3]], 1), '#e8f6fc', { texture: 0, lineWidth: 1.8 });
        }
    } else if (detail === 'gloss') {
        for (let i = 0; i < count * 2; i++) {
            ctx.globalAlpha = 0.25;
            kit.wash(ink.ellipse(rand(x0, x1), rand(top + 20, H), rand(8, 26), rand(2, 5), rand(-0.2, 0.2), 8), '#8a7a70', { texture: 0, outline: false });
        }
    } else if (detail === 'crust') {
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < count * 2; i++) {
            const x = rand(x0, x1), y = rand(top + 20, H);
            ink.line(ctx, [[x, y], [x + rand(-30, 30), y + rand(-6, 6)], [x + rand(-40, 40), y + rand(-10, 10)]], { width: rand(2, 4), color: rng() < 0.5 ? '#5a1a0a' : '#fff2a8' });
        }
    } else if (detail === 'strata') {
        ctx.globalAlpha = 0.35;
        for (let y = top + 20; y < H; y += rand(18, 36)) ink.line(ctx, [[x0, y], [x1, y + rand(-4, 4)]], { width: 2, color: '#1d1410' });
    }
    ctx.restore();
}

/** Platform looks per stage: { top, front, kind } where kind is 'stone' | 'wood' | 'ice' | 'bone' | 'log' | 'turf'. */
const DEFAULT_PLATFORM_STYLE = { top: '#b9a58a', front: '#7d6a52', kind: 'stone' };

/** Paint the thin floating platforms you can jump through. */
export function paintPlatforms(kit, layout, style = DEFAULT_PLATFORM_STYLE) {
    const { ctx, ink, rand } = kit;
    const s = { ...DEFAULT_PLATFORM_STYLE, ...style };
    for (const p of layout.platforms) {
        const { left, right, y } = p;
        const thick = 16;
        // Soft shadow on the background below
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.ellipse((left + right) / 2, y + thick + 26, (right - left) * 0.42, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const front = ink.polygon([[left, y], [right, y], [right - 6, y + thick], [left + 6, y + thick]], 1);
        kit.wash(front, s.front, { texture: 0.15, strokes: 12, lineWidth: 2.6 });
        const topFace = ink.polygon([[left + 4, y - 7], [right - 4, y - 7], [right, y], [left, y]], 0.8);
        kit.wash(topFace, s.top, { texture: 0.1, strokes: 8, lineWidth: 2.4 });
        if (s.kind === 'wood' || s.kind === 'log') {
            for (let x = left + 26; x < right - 10; x += 30) ink.line(ctx, [[x, y + 1], [x, y + thick - 1]], { width: 1.6, color: '#3b2a1e' });
            if (s.kind === 'log') for (const x of [left + 2, right - 2]) kit.wash(ink.ellipse(x, y + thick / 2 - 2, 6, thick / 2 + 2, 0, 8), '#c9a77a', { texture: 0, lineWidth: 2 });
        } else if (s.kind === 'ice') {
            ctx.save(); ctx.globalAlpha = 0.7;
            ink.line(ctx, [[left + 14, y - 4], [left + 50, y - 4]], { width: 2, color: '#ffffff' });
            ctx.restore();
            for (let x = left + 20; x < right - 10; x += rand(28, 44)) ink.line(ctx, [[x, y + thick], [x + 3, y + thick + rand(6, 14)]], { width: 2.4, color: '#bfe3f2' });
        } else if (s.kind === 'bone') {
            for (const x of [left + 4, right - 4]) kit.puffs([[x, y + 2, 9], [x, y + thick - 2, 9]], s.top, { lineWidth: 2 });
        } else if (s.kind === 'turf') {
            kit.grass(y - 6, { count: Math.round((right - left) / 10), color: '#3f7a2a', height: [5, 11], x0: left + 4, x1: right - 4 });
        } else {
            for (let x = left + 20; x < right - 10; x += rand(30, 50)) ink.line(ctx, [[x, y + 2], [x + rand(-4, 4), y + thick - 2]], { width: 1.4, color: '#2a1d17' });
        }
    }
}

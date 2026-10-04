// ============================================================================
// TAR PITS — sunset over the La Brea tar pits. The sticky ground cuts knockback.
// ============================================================================
import { INK_COLOR } from '../graphics/ink.js';
import { FLOOR_TOP } from './sketch-kit.js';

const TAR_TOP = 372, TAR_BOTTOM = FLOOR_TOP;

/** Bubbles that swell on the tar surface and pop. */
function tarBubbles() {
    const spawn = () => ({ x: 40 + Math.random() * 1200, y: TAR_TOP + 16 + Math.random() * (TAR_BOTTOM - TAR_TOP - 30), age: 0, life: 60 + Math.random() * 80, max: 7 + Math.random() * 10 });
    const bubbles = Array.from({ length: 7 }, () => ({ ...spawn(), age: Math.random() * 60 }));
    return {
        update() {
            bubbles.forEach((b, i) => { if (++b.age > b.life) bubbles[i] = spawn(); });
        },
        render(ctx) {
            ctx.lineWidth = 2;
            for (const b of bubbles) {
                const t = b.age / b.life;
                if (t < 0.85) {
                    const r = b.max * Math.min(1, t * 1.4);
                    ctx.fillStyle = '#2a2024';
                    ctx.strokeStyle = INK_COLOR;
                    ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * 0.75, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = 'rgba(242,138,75,0.8)';
                    ctx.beginPath(); ctx.arc(b.x - r * 0.35, b.y - r * 0.45, Math.max(1, r * 0.18), 0, Math.PI * 2); ctx.fill();
                } else {
                    const k = (t - 0.85) / 0.15;
                    ctx.strokeStyle = `rgba(42,29,23,${1 - k})`;
                    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.max * (1 + k), b.max * 0.4 * (1 + k), 0, 0, Math.PI * 2); ctx.stroke();
                }
            }
        }
    };
}

/** Woolly mammoth silhouette, optionally sunk up to its belly. */
function mammoth(k, x, y, scale = 1, sunk = false) {
    const { ctx, ink } = k;
    const body = '#3d2a2a', shade = '#2b1d1d', tusk = '#efe2c4';
    const s = (dx, dy) => [x + dx * scale, y + dy * scale];
    if (!sunk) for (const lx of [-34, -14, 18, 34]) ink.limb(ctx, [s(lx, 20), s(lx, 52)], 16 * scale, body);
    k.puffs([[...s(0, 0), 44 * scale], [...s(-30, 8), 34 * scale], [...s(34, -10), 32 * scale]], body, { shade, lineWidth: 2.4 });
    k.puffs([[...s(56, -18), 22 * scale], [...s(50, -36), 16 * scale]], body, { lineWidth: 2.4 });
    ink.limb(ctx, [s(70, -10), s(80, 14), s(74, 36), s(82, 44)], 10 * scale, body);
    ink.limb(ctx, [s(64, 0), s(86, 4), s(98, -14)], 6 * scale, tusk);
    ink.dot(ctx, ...s(60, -22), 2.5 * scale);
}

export default {
    id: 'tar-pits',
    name: 'La Brea Tar Pits',
    description: 'Sunset over the sticky pits. Many megafauna went in. Few came out.',
    traits: ['Sticky tar: knockback slides are short'],
    accent: '#f28a4b',
    music: 'stampede',
    layout: { main: { left: 180, right: 1100 }, platforms: [[380, 580, 420], [700, 900, 420]] },
    pit: 'tar',
    platformStyle: { top: '#efe3c8', front: '#bfae8a', kind: 'bone' },
    physics: { friction: 0.72 },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#2e1d52', '#6b2a6e', '#c23f68', '#ef7a4e', '#f9b56a', '#fcd99a'], TAR_TOP);
        k.wash(ink.ellipse(940, 360, 70, 70, 0, 14), '#ffd27a', { texture: 0.03, outline: false });
        for (const [x, y, w] of [[120, 110, 260], [600, 170, 340], [980, 90, 220]]) {
            ctx.save(); ctx.globalAlpha = 0.6;
            k.wash(ink.closedCurve([[x, y], [x + w * 0.4, y - 12], [x + w, y - 4], [x + w * 0.7, y + 10], [x + w * 0.2, y + 12]], 3), '#d1567b', { texture: 0, outline: false });
            ctx.restore();
        }
        k.hills({ baseY: 362, amplitude: 22, frequency: 0.004, color: '#3b1f3f', bottom: TAR_TOP + 6, lineWidth: 2.4, texture: 0.05 });
        k.palm(90, 372, 230, '#2a1430');
        k.palm(1120, 372, 260, '#2a1430');
        k.palm(1210, 372, 170, '#2a1430');

        // Tar pool with sunset reflections
        const tar = ink.closedCurve([[-20, TAR_TOP], [1300, TAR_TOP], [1300, TAR_BOTTOM + 10], [-20, TAR_BOTTOM + 10]], 1);
        k.wash(tar, '#17110f', { texture: 0.06, strokes: 40 });
        ctx.save();
        ctx.globalAlpha = 0.55;
        for (const [x, y, w] of [[880, 384, 130], [900, 398, 90], [915, 412, 56], [300, 420, 60], [640, 392, 40]]) {
            ink.line(ctx, [[x, y], [x + w, y + 1]], { width: 3, color: '#c25a55' });
        }
        ctx.restore();
        mammoth(k, 470, 384, 0.9);
        mammoth(k, 1010, 420, 0.6, true);

        // Cracked earth floor with bones
        k.floor('#5a3e2c', { lines: '#2e2018', lineAlpha: 0.35 });
        for (let i = 0; i < 18; i++) {
            let x = k.rand(0, 1280), y = k.rand(FLOOR_TOP + 20, 700);
            const pts = [[x, y]];
            for (let s = 0; s < 4; s++) { x += k.rand(14, 30); y += k.rand(-8, 8); pts.push([x, y]); }
            ink.line(ctx, pts, { width: 2, color: '#2e2018' });
        }
        const bone = '#efe2c4';
        for (const [x, y, a] of [[70, 540, 0.2], [270, 660, -0.3], [600, 690, 0.1], [860, 520, 0.4], [1200, 600, -0.2]]) {
            ctx.save(); ctx.translate(x, y); ctx.rotate(a);
            k.wash(ink.closedCurve([[-20, -3], [20, -3], [20, 3], [-20, 3]], 0.5), bone, { texture: 0, lineWidth: 2 });
            k.puffs([[-22, -4, 5], [-22, 4, 5], [22, -4, 5], [22, 4, 5]], bone, { lineWidth: 1.4 });
            ctx.restore();
        }
        k.puffs([[1040, 676, 18]], bone, { lineWidth: 2 });
        ink.dot(ctx, 1033, 674, 4); ink.dot(ctx, 1047, 674, 4);
    },

    createLayers: () => [tarBubbles()]
};

// ============================================================================
// CRETACEOUS JUNGLE — Randy's home: misty ferns at dusk, giants in the distance.
// ============================================================================
import { SCREEN } from '../config.js';
import { fireflies } from './ambient.js';
import { FLOOR_TOP } from './sketch-kit.js';

/** Slow drifting mist banks. */
function mist() {
    const banks = [{ x: 0, y: 360, w: 520, speed: 0.12 }, { x: 700, y: 395, w: 600, speed: 0.08 }, { x: 300, y: 425, w: 420, speed: 0.16 }];
    return {
        update() { for (const b of banks) { b.x += b.speed; if (b.x > SCREEN.width) b.x = -b.w; } },
        render(ctx) {
            ctx.fillStyle = 'rgba(230,245,235,0.12)';
            for (const b of banks) {
                ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y, b.w / 2, 20, 0, 0, Math.PI * 2); ctx.fill();
            }
        }
    };
}

/** Long-necked sauropod silhouette. */
function sauropod(k, x, y, scale, color) {
    const { ctx, ink } = k;
    const s = (dx, dy) => [x + dx * scale, y + dy * scale];
    for (const lx of [-40, -20, 24, 40]) ink.limb(ctx, [s(lx, 10), s(lx, 60)], 14 * scale, color, { outline: false });
    ink.limb(ctx, [s(-50, 0), s(-110, 30), s(-150, 40)], 18 * scale, color, { outline: false });
    ink.limb(ctx, [s(40, -10), s(70, -60), s(90, -120), s(110, -130)], 20 * scale, color, { outline: false });
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(...s(0, 0), 64 * scale, 32 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(...s(116, -132), 14 * scale, 8 * scale, 0, 0, Math.PI * 2); ctx.fill();
}

export default {
    id: 'fern-jungle',
    name: 'Cretaceous Jungle',
    description: "Randy's home turf. Misty ferns, distant giants, and fireflies at dusk.",
    traits: ['Quackers can paddle in the swamp'],
    accent: '#6fae8a',
    music: 'jungle',
    layout: { main: { left: 210, right: 1070 }, platforms: [[360, 560, 425], [720, 920, 390]] },
    pit: 'swamp',
    platformStyle: { top: '#8a6a45', front: '#5d4630', kind: 'log' },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#1f4e5f', '#2f7a76', '#6faa86', '#d8d79a', '#f4dca0'], 400);
        k.wash(ink.ellipse(280, 300, 50, 50, 0, 12), '#fbecb5', { texture: 0.03, outline: false });
        // Distant volcano with smoke
        k.mountain(1040, 200, 380, 400, '#3d6b62', { shade: '#2f5a52' });
        ctx.save(); ctx.globalAlpha = 0.5;
        for (let i = 0; i < 6; i++) k.puffs([[1040 + i * 18, 190 - i * 26, 14 + i * 5]], '#58706a', { outline: false });
        ctx.restore();
        sauropod(k, 600, 300, 1, '#3f7068');
        sauropod(k, 820, 330, 0.65, '#4a7c71');
        k.hills({ baseY: 372, amplitude: 30, frequency: 0.01, color: '#2f5c4c', bumps: 14, lineWidth: 2.4 });
        // Tree ferns
        for (const [x, h] of [[90, 200], [420, 170], [960, 190], [1210, 220]]) {
            ink.limb(ctx, [[x, 420], [x + 6, 420 - h * 0.5], [x, 420 - h]], 12, '#5a4632');
            k.fern(x, 420 - h, 80, '#3b8a57', '#1e5a38');
        }
        ctx.fillStyle = 'rgba(230,245,235,0.2)';
        ctx.fillRect(0, 380, 1280, 50);
        // Ferns along the back of the floor
        for (let x = 20; x < 1280; x += k.rand(90, 140)) k.fern(x, FLOOR_TOP + 6, k.rand(40, 60), '#4c9a5f', '#24603b');

        // Mossy floor with roots and three-toed footprints
        k.floor('#544130', { edge: '#5c7f3a', lines: '#2f2418', lineAlpha: 0.3 });
        for (let i = 0; i < 6; i++) {
            let x = k.rand(0, 1280), y = k.rand(FLOOR_TOP + 30, 690);
            const pts = [[x, y]];
            for (let s = 0; s < 6; s++) { x += k.rand(18, 30); y += k.rand(-6, 6); pts.push([x, y]); }
            ink.line(ctx, pts, { width: 6, color: '#3a2c1f' });
        }
        for (const [x, y] of [[160, 600], [360, 650], [920, 590], [1120, 660]]) {
            k.wash(ink.ellipse(x, y, 12, 8, 0, 8), '#3a2c1f', { texture: 0, outline: false });
            for (const a of [-2.2, -1.57, -0.9]) ctx.fill(ink.ellipse(x + Math.cos(a) * 20, y + Math.sin(a) * 14, 5, 9, a + 1.57, 6));
        }
    },

    createLayers: () => [mist(), fireflies({ count: 24, front: true, area: { top: 220, bottom: 540 } })]
};

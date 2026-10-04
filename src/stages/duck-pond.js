// ============================================================================
// DUCK POND — Quackers' home dock at sunrise.
// ============================================================================
import { SCREEN } from '../config.js';
import { fireflies } from './ambient.js';
import { FLOOR_TOP } from './sketch-kit.js';

const WATER_TOP = 300;

/** Glints of light sliding across the water surface. */
function waterShimmer() {
    const glints = Array.from({ length: 24 }, () => ({
        x: Math.random() * SCREEN.width, y: WATER_TOP + 14 + Math.random() * 120,
        w: 18 + Math.random() * 30, speed: 0.15 + Math.random() * 0.35, phase: Math.random() * 6
    }));
    return {
        update() {
            for (const g of glints) { g.x += g.speed; if (g.x > SCREEN.width) g.x = -g.w; }
        },
        render(ctx, t) {
            ctx.lineCap = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#eefaff';
            for (const g of glints) {
                ctx.globalAlpha = 0.3 + 0.35 * Math.sin(t * 0.05 + g.phase);
                ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.quadraticCurveTo(g.x + g.w / 2, g.y - 3, g.x + g.w, g.y); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    };
}

export default {
    id: 'duck-pond',
    name: 'Duck Pond',
    description: "Quackers' dock at sunrise. Mind the splinters.",
    traits: ['Quackers floats on the pond'],
    accent: '#4f9cc0',
    music: 'jungle',
    layout: { main: { left: 230, right: 1050 }, platforms: [[290, 470, 430], [810, 990, 430]] },
    pit: 'water',
    platformStyle: { top: '#c49a6c', front: '#7a5235', kind: 'wood' },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#90cbe6', '#bfdfe9', '#f2e3cf', '#f8cfa6'], WATER_TOP);
        k.wash(ink.ellipse(260, 230, 46, 46, 0, 12), '#ffe8a3', { texture: 0.03 });
        k.hills({ baseY: 262, amplitude: 30, frequency: 0.004, color: '#9cbf8e', bottom: WATER_TOP + 10 });
        // Treeline
        for (let x = -20; x < 1300; x += 70) k.puffs([[x, 270, k.rand(26, 40)], [x + 34, 262, k.rand(24, 36)]], '#5d8c55', { shade: '#466f40', lineWidth: 2.2 });

        // Pond with painted bands
        const water = ink.closedCurve([[-20, WATER_TOP], [1300, WATER_TOP], [1300, FLOOR_TOP + 10], [-20, FLOOR_TOP + 10]], 1);
        k.wash(water, '#4f9cc0', { texture: 0.12, strokes: 80 });
        ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#2f6d8c';
        ctx.fillRect(0, WATER_TOP, 1280, 22); ctx.restore(); // treeline reflection
        // Lily pads and flowers
        for (const [x, y, r] of [[160, 360, 22], [230, 400, 16], [600, 340, 18], [820, 384, 26], [1080, 352, 18], [1170, 410, 20]]) {
            const pad = new Path2D();
            pad.moveTo(x, y);
            pad.ellipse(x, y, r, r * 0.4, 0, 0.35, Math.PI * 2 - 0.1);
            pad.closePath();
            k.wash(pad, '#4a9b4f', { texture: 0.05, strokes: 4, lineWidth: 2.2 });
            if (k.rng() < 0.6) k.puffs([[x - r * 0.3, y - 6, 6], [x - r * 0.3 + 6, y - 8, 5]], '#f7b7d2', { lineWidth: 1.5 });
        }
        // Duck house on a post
        ink.limb(ctx, [[480, 400], [480, 330]], 8, '#6e4b2a');
        k.wash(ink.polygon([[440, 330], [520, 330], [520, 290], [440, 290]], 1), '#d68c45', { texture: 0.1, strokes: 8 });
        k.wash(ink.polygon([[430, 294], [480, 262], [530, 294]], 1), '#8e4b20', { texture: 0.1, strokes: 6 });
        k.wash(ink.ellipse(480, 310, 9, 9, 0, 8), '#3b2414', { texture: 0, lineWidth: 2 });
        // Reeds
        for (const baseX of [40, 340, 940, 1240]) {
            for (let i = 0; i < 6; i++) {
                const x = baseX + i * 8, h = k.rand(60, 110);
                ink.line(ctx, [[x, FLOOR_TOP + 6], [x + k.rand(-4, 4), FLOOR_TOP - h]], { width: 2.4, color: '#4f7a2f' });
                if (i % 2 === 0) k.wash(ink.ellipse(x, FLOOR_TOP - h + 8, 4, 12, 0, 8), '#6e4b2a', { texture: 0, lineWidth: 1.8 });
            }
        }

        // Wooden dock
        k.floor('#ad8463', { lines: '#5a3f2c', lineAlpha: 0 });
        for (let y = FLOOR_TOP + 24, i = 0; y < 720; y += 26, i++) {
            ink.line(ctx, [[0, y], [1280, y + k.rand(-2, 2)]], { width: 2.4, color: '#5a3f2c' });
            for (let x = (i * 97) % 220; x < 1280; x += 220) ink.line(ctx, [[x, y - 26], [x, y]], { width: 2, color: '#5a3f2c' });
            for (let n = 0; n < 4; n++) { const nx = k.rand(0, 1280); ink.line(ctx, [[nx, y - 14], [nx + k.rand(20, 50), y - 13]], { width: 1.2, color: '#8f6a4e' }); }
        }
    },

    createLayers: () => [
        waterShimmer(),
        fireflies({ count: 6, color: '#7fd3ff', area: { top: 300, bottom: 420 } })
    ]
};

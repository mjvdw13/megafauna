// ============================================================================
// VOLCANO RIM — rising heat makes every jump float.
// ============================================================================
import { risingEmbers } from './ambient.js';
import { FLOOR_TOP } from './sketch-kit.js';

const LAVA_TOP = 386;

/** Pulsing glow over the lava lake and crater. */
function lavaGlow() {
    return {
        render(ctx, t) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 0.04);
            const lake = ctx.createLinearGradient(0, LAVA_TOP - 80, 0, FLOOR_TOP);
            lake.addColorStop(0, 'rgba(255,120,30,0)');
            lake.addColorStop(1, `rgba(255,140,40,${0.12 + 0.14 * pulse})`);
            ctx.fillStyle = lake;
            ctx.fillRect(0, LAVA_TOP - 80, 1280, FLOOR_TOP - LAVA_TOP + 80);
            const crater = ctx.createRadialGradient(800, 96, 4, 800, 96, 150);
            crater.addColorStop(0, `rgba(255,170,60,${0.35 + 0.25 * pulse})`);
            crater.addColorStop(1, 'rgba(255,90,20,0)');
            ctx.fillStyle = crater;
            ctx.fillRect(640, 0, 320, 260);
            // Lava surface ripples
            ctx.strokeStyle = `rgba(255,224,130,${0.5 + 0.3 * pulse})`;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            for (let i = 0; i < 9; i++) {
                const x = ((i * 173 + t * (0.3 + i * 0.05)) % 1340) - 40;
                const y = LAVA_TOP + 18 + (i % 4) * 12;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y - 4, x + 28, y); ctx.stroke();
            }
        }
    };
}

export default {
    id: 'volcano',
    name: 'Volcano Rim',
    description: 'Scorching updrafts make every leap linger.',
    traits: ['Hot updrafts: higher, floatier jumps'],
    accent: '#ff6b1a',
    music: 'stampede',
    layout: { main: { left: 220, right: 1060 }, platforms: [[300, 470, 445], [810, 980, 445], [555, 725, 330]] },
    pit: 'lava',
    platformStyle: { top: '#55494a', front: '#2e2627', kind: 'stone' },
    physics: { gravity: 0.66 },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#1a0a0a', '#3a120f', '#6a1d12', '#a3361a'], LAVA_TOP);
        // Ash clouds
        for (const [x, y, s] of [[60, 70, 80], [300, 40, 60], [980, 60, 90], [1180, 120, 60]]) {
            k.puffs([[x, y, s * 0.5], [x + s * 0.5, y - s * 0.2, s * 0.55], [x + s, y, s * 0.45]], '#2e1c1c', { shade: '#1e1212', lineWidth: 2 });
        }
        k.mountain(200, 210, 440, LAVA_TOP + 10, '#2a1b1b', { shade: '#170e0e' });
        // Main volcano with crater and lava streams
        k.mountain(800, 96, 860, LAVA_TOP + 10, '#352222', { shade: '#1e1313' });
        k.wash(ink.ellipse(800, 100, 44, 10, 0, 10), '#ff7b25', { texture: 0, lineWidth: 2.6 });
        for (const [sx, dir] of [[780, -1], [818, 1], [800, 0.4]]) {
            const pts = [];
            let x = sx;
            for (let y = 104; y < LAVA_TOP; y += 24) { pts.push([x, y]); x += dir * k.rand(6, 18) + k.rand(-6, 6); }
            ink.line(ctx, pts, { width: 9, color: '#2a1d17' });
            ink.line(ctx, pts, { width: 5, color: '#ff8a2a' });
            ink.line(ctx, pts, { width: 2, color: '#ffd56b' });
        }
        // Lava lake
        const lava = ink.closedCurve([[-20, LAVA_TOP], [1300, LAVA_TOP], [1300, FLOOR_TOP + 10], [-20, FLOOR_TOP + 10]], 1.5);
        k.wash(lava, '#ff5a1f', { texture: 0.15, strokes: 60 });
        for (let i = 0; i < 9; i++) k.wash(ink.ellipse(k.rand(0, 1280), k.rand(LAVA_TOP + 14, FLOOR_TOP - 10), k.rand(20, 40), k.rand(4, 7), 0, 8), '#3b1a12', { texture: 0, lineWidth: 2 });

        // Basalt floor with glowing cracks
        k.floor('#332d2e', { lines: '#1a1616', lineAlpha: 0.4 });
        for (let y = FLOOR_TOP + 30, row = 0; y < 720; y += 44, row++) {
            for (let x = (row % 2) * 60; x < 1280; x += 120) {
                ctx.save(); ctx.globalAlpha = 0.5;
                ink.line(ctx, [[x, y], [x + 116, y + k.rand(-2, 2)]], { width: 2, color: '#1a1616' });
                ink.line(ctx, [[x, y - 44], [x, y]], { width: 2, color: '#1a1616' });
                ctx.restore();
            }
        }
        for (let i = 0; i < 12; i++) {
            let x = k.rand(0, 1280), y = k.rand(FLOOR_TOP + 20, 700);
            const pts = [[x, y]];
            for (let s = 0; s < 4; s++) { x += k.rand(12, 24); y += k.rand(-8, 8); pts.push([x, y]); }
            ink.line(ctx, pts, { width: 4, color: '#c0392b' });
            ink.line(ctx, pts, { width: 1.6, color: '#ffb347' });
        }
    },

    createLayers: () => [lavaGlow(), risingEmbers({ count: 50 })]
};

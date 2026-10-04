// ============================================================================
// SUNNY MEADOW — the original stage, now hand-painted
// ============================================================================
import { driftingClouds } from './ambient.js';
import { FLOOR_TOP } from './sketch-kit.js';

export default {
    id: 'meadow',
    name: 'Sunny Meadow',
    description: 'Where it all began. Wide open, nothing to hide behind.',
    traits: [],
    accent: '#7BA828',
    music: 'romp',
    layout: { main: { left: 200, right: 1080 }, platforms: [[330, 530, 425], [750, 950, 425], [540, 740, 315]] },
    pit: 'chasm',
    platformStyle: { top: '#8bc34a', front: '#9c6b43', kind: 'turf' },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#6fbde8', '#9dd3f0', '#cfeaf6', '#f4f4e0']);
        // Sun with hand-drawn rays
        k.wash(ink.ellipse(1080, 110, 44, 44, 0, 12), '#ffd95a', { texture: 0.05 });
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            ink.line(ctx, [[1080 + Math.cos(a) * 56, 110 + Math.sin(a) * 56], [1080 + Math.cos(a) * 76, 110 + Math.sin(a) * 76]], { width: 3, color: '#e7a92b' });
        }
        k.mountain(220, 230, 440, 390, '#a3b9cf', { cap: '#ffffff', shade: '#7d95ad' });
        k.mountain(640, 180, 560, 390, '#90aac2', { cap: '#ffffff', shade: '#6f89a3' });
        k.mountain(1040, 250, 400, 390, '#adc1d4', { cap: '#ffffff', shade: '#8aa1b8' });
        k.hills({ baseY: 400, amplitude: 40, frequency: 0.005, color: '#93c95c' });
        k.tree(150, 410, { size: 52, trunkHeight: 50 });
        k.tree(1170, 418, { size: 42, trunkHeight: 40, leaves: '#5dae4c', shade: '#3e8a36' });
        k.hills({ baseY: 446, amplitude: 22, frequency: 0.008, phase: 2, color: '#7bb64a' });
        // Wildflowers
        for (let i = 0; i < 40; i++) {
            const x = k.rand(0, 1280), y = k.rand(410, 448);
            ctx.fillStyle = ['#e74c3c', '#f1c40f', '#9b59b6', '#ffffff'][i % 4];
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        }
        k.floor('#b98352', { edge: '#7bb64a' });
        k.grass(FLOOR_TOP + 2, { count: 90, color: '#4f8f2f' });
        for (const [x, y, r] of [[120, 620, 14], [600, 680, 10], [1040, 600, 16]]) k.rock(x, y, r, '#a49b8f');
    },

    createLayers: () => [
        driftingClouds([
            { x: 120, y: 60, size: 70, speed: 0.12 },
            { x: 560, y: 30, size: 90, speed: 0.08 },
            { x: 900, y: 120, size: 55, speed: 0.16 }
        ])
    ]
};

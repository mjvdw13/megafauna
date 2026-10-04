// ============================================================================
// FROZEN TUNDRA — an Ice Age night under the aurora. The ice is slippery.
// ============================================================================
import { SCREEN } from '../config.js';
import { snowfall } from './ambient.js';
import { FLOOR_TOP } from './sketch-kit.js';

/** Waving aurora curtains across the night sky. */
function aurora() {
    const bands = [
        { base: 70, amp: 18, freq: 0.006, speed: 0.012, color: '120,255,180', height: 70 },
        { base: 120, amp: 14, freq: 0.009, speed: -0.009, color: '90,200,255', height: 50 },
        { base: 95, amp: 22, freq: 0.004, speed: 0.007, color: '190,120,255', height: 40 }
    ];
    return {
        render(ctx, t) {
            for (const b of bands) {
                for (let x = 0; x < SCREEN.width; x += 8) {
                    const y = b.base + Math.sin(x * b.freq + t * b.speed) * b.amp + Math.sin(x * b.freq * 3.1 + t * b.speed * 2) * 6;
                    const flicker = 0.10 + 0.07 * Math.sin(x * 0.05 + t * 0.03);
                    const grad = ctx.createLinearGradient(0, y, 0, y + b.height);
                    grad.addColorStop(0, `rgba(${b.color},0)`);
                    grad.addColorStop(0.3, `rgba(${b.color},${flicker})`);
                    grad.addColorStop(1, `rgba(${b.color},0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, y, 8, b.height);
                }
            }
        }
    };
}

export default {
    id: 'frozen-tundra',
    name: 'Frozen Tundra',
    description: 'An Ice Age night under the aurora. Keep your footing.',
    traits: ['Slippery ice: you slide after moving and when hit'],
    accent: '#7fdbff',
    music: 'stampede',
    layout: { main: { left: 240, right: 1040 }, platforms: [[560, 720, 405]] },
    pit: 'icewater',
    platformStyle: { top: '#e8f6fc', front: '#9fd0e6', kind: 'ice' },
    physics: { friction: 0.95 },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#060c22', '#0e1c42', '#1c3360', '#2f4f7a']);
        for (let i = 0; i < 140; i++) {
            const x = k.rand(0, 1280), y = k.rand(0, 320), r = k.rng() < 0.15 ? 2 : 1;
            ctx.fillStyle = k.rng() < 0.8 ? '#ffffff' : '#fcf3cf';
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            if (r > 1) ink.line(ctx, [[x - 5, y], [x + 5, y]], { width: 1, color: '#ffffff' });
        }
        k.wash(ink.ellipse(1070, 90, 38, 38, 0, 12), '#f4f6f7', { texture: 0.05, lineWidth: 2.4 });
        k.puffs([[1058, 80, 6], [1082, 102, 4]], '#d5dbdb', { outline: false });

        k.mountain(230, 170, 480, 420, '#3d5a80', { cap: '#eef5fb', shade: '#2a4161' });
        k.mountain(680, 120, 600, 420, '#34507a', { cap: '#eef5fb', shade: '#22385a' });
        k.mountain(1100, 190, 440, 420, '#46658f', { cap: '#eef5fb', shade: '#2f4b70' });
        for (const [x, h] of [[60, 120], [130, 90], [1180, 110], [1240, 140], [980, 80]]) k.pine(x, 420, h, '#1f4a43', null, '#eef5fb');
        // Glacier wall
        k.hills({ baseY: 410, amplitude: 50, frequency: 0.012, color: '#9fd0e3', bumps: 14 });
        k.hills({ baseY: 444, amplitude: 18, frequency: 0.02, phase: 2, color: '#bfe2ee' });

        // Ice floor
        k.floor('#d4ecf6', { lines: '#8fbfd4', lineAlpha: 0.5 });
        for (let i = 0; i < 14; i++) {
            let x = k.rand(0, 1280), y = k.rand(FLOOR_TOP + 20, 700);
            const pts = [[x, y]];
            for (let s = 0; s < 4; s++) { x += k.rand(12, 26); y += k.rand(-10, 10); pts.push([x, y]); }
            ink.line(ctx, pts, { width: 1.6, color: '#7fb1c8' });
        }
        ctx.save(); ctx.globalAlpha = 0.6;
        for (let i = 0; i < 10; i++) {
            const x = k.rand(0, 1280), y = k.rand(FLOOR_TOP + 30, 700);
            ink.line(ctx, [[x, y], [x + 30, y - 18]], { width: 3, color: '#ffffff' });
            ink.line(ctx, [[x + 10, y + 4], [x + 24, y - 4]], { width: 2, color: '#ffffff' });
        }
        ctx.restore();
        k.puffs([[0, 470, 70], [60, 490, 50]], '#f0f7fb', { lineWidth: 2.4 });
        k.puffs([[1280, 466, 80], [1210, 492, 46]], '#f0f7fb', { lineWidth: 2.4 });
    },

    createLayers: () => [aurora(), snowfall({ count: 80 })]
};

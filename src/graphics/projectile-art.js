// ============================================================================
// PROJECTILE ART
// How each projectile kind looks in flight, and what it leaves behind when it
// ends (hits something, smashes into the ground, or fades out).
// ============================================================================
import { burst, RingPulse } from './effects.js';
import { INK_COLOR } from './ink.js';

const DRAW = {
    /** Riley's bark: stacked sound arcs that widen as they travel. */
    bark(ctx, p, time) {
        const fade = Math.max(0, 1 - p.age / p.life);
        ctx.translate(p.centerX, p.centerY);
        ctx.scale(p.dir, 1);
        for (let i = 0; i < 3; i++) {
            const r = p.height * (0.3 + i * 0.22) + Math.sin(time * 0.6 + i) * 2;
            ctx.globalAlpha = fade * (1 - i * 0.22);
            ctx.lineCap = 'round';
            ctx.strokeStyle = INK_COLOR;
            ctx.lineWidth = 8;
            ctx.beginPath(); ctx.arc(-p.width * 0.3 + i * 10, 0, r, -0.9, 0.9); ctx.stroke();
            ctx.strokeStyle = p.owner.accentColor;
            ctx.lineWidth = 4.5;
            ctx.stroke();
        }
    },

    /** Quackers' egg: spins as it arcs. */
    egg(ctx, p) {
        ctx.translate(p.centerX, p.centerY);
        ctx.rotate(p.spin);
        ctx.fillStyle = '#fffaf0';
        ctx.strokeStyle = INK_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, p.width / 2, p.height / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d9c9a8';
        for (const [x, y] of [[-3, -6], [4, 2], [-2, 7]]) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-3, -4, 4, Math.PI, Math.PI * 1.5); ctx.stroke();
    },

    /** Dad's Bad Breath: a lumpy green cloud with stink lines and a couple of flies. */
    breath(ctx, p, time) {
        const fade = Math.min(1, (p.life - p.age) / 15);
        const cx = p.centerX, cy = p.centerY, w = p.width / 2, h = p.height / 2;
        ctx.globalAlpha = 0.75 * fade;
        const puffs = [[-0.45, 0.1, 0.55], [0, -0.25, 0.65], [0.4, 0.05, 0.55], [0.05, 0.3, 0.5]];
        // Ink outline under the puffs, then the green fill, so only the outer edge is inked
        for (const [fill, pad] of [[INK_COLOR, 2.5], ['#9ccc4a', 0]]) {
            ctx.fillStyle = fill;
            for (const [dx, dy, r] of puffs) {
                const wob = Math.sin(time * 0.15 + dx * 5) * 2;
                ctx.beginPath(); ctx.arc(cx + dx * w, cy + dy * h + wob, r * h + pad, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.fillStyle = '#c5e07a';
        ctx.beginPath(); ctx.arc(cx - w * 0.15, cy - h * 0.35, h * 0.25, 0, Math.PI * 2); ctx.fill();
        // Wavy stink lines rising off it
        ctx.strokeStyle = '#5f7f2a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (const dx of [-0.4, 0, 0.4]) {
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) {
                const y = cy - h * 0.9 - i * 3.5, x = cx + dx * w + Math.sin(i * 0.9 + time * 0.3) * 4;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        // Flies buzzing round it
        ctx.globalAlpha = fade;
        for (let i = 0; i < 2; i++) {
            const a = time * (0.25 + i * 0.1) + i * 3;
            const fx = cx + Math.cos(a) * w * 1.1, fy = cy - h * 0.2 + Math.sin(a * 1.7) * h * 0.8;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.ellipse(fx - 2, fy - 3, 2.5, 1.5, -0.5, 0, Math.PI * 2); ctx.ellipse(fx + 2, fy - 3, 2.5, 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = INK_COLOR;
            ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, Math.PI * 2); ctx.fill();
        }
    },

    /** Randy's boulder: a lumpy rock that rolls along the ground. */
    boulder(ctx, p) {
        ctx.translate(p.centerX, p.centerY);
        ctx.rotate(p.spin);
        const r = p.width / 2;
        ctx.fillStyle = '#8a7f74';
        ctx.strokeStyle = INK_COLOR;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2, k = i % 3 === 0 ? 0.88 : 1;
            const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(r * 0.25, r * 0.25, r * 0.55, r * 0.4, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.1, r * 0.15); ctx.lineTo(r * 0.2, -r * 0.3); ctx.stroke();
    }
};

export function drawProjectile(ctx, projectile, time) {
    const draw = DRAW[projectile.kind];
    if (!draw) return;
    ctx.save();
    draw(ctx, projectile, time);
    ctx.restore();
}

/** Bits that fly off when a projectile ends. */
export function projectileEndEffect(p, effects, audio) {
    const x = p.centerX, y = p.centerY;
    if (p.kind === 'egg') {
        effects.add(burst(x, y, { count: 10, colors: ['#fffaf0', '#f7c948', '#ffb300'], speed: [2, 7], size: [5, 10], gravity: 0.3, angle: -Math.PI / 2, spread: 2.6 }));
        audio?.play('splat', { x });
    } else if (p.kind === 'boulder') {
        effects.add(burst(x, y, { count: 9, colors: ['#8a7f74', '#6d645b', '#b0a596'], speed: [3, 8], size: [5, 9], gravity: 0.45, angle: -Math.PI / 2, spread: 2.2 }));
        if (p.endReason !== 'offscreen') audio?.play('land', { x, heavy: true });
    } else if (p.kind === 'breath' && p.endReason === 'hit') {
        effects.add(burst(x, y, { count: 10, colors: ['#9ccc4a', '#c5e07a', '#5f7f2a'], speed: [1, 4], size: [8, 14], gravity: -0.05, drag: 0.92, life: [20, 34] }));
    } else if (p.kind === 'bark' && p.endReason === 'hit') {
        effects.add(new RingPulse(x, y, { color: p.owner.accentColor, from: 10, to: 60, life: 10, width: 4 }));
    }
}

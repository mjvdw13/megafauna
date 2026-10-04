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
    } else if (p.kind === 'bark' && p.endReason === 'hit') {
        effects.add(new RingPulse(x, y, { color: p.owner.accentColor, from: 10, to: 60, life: 10, width: 4 }));
    }
}

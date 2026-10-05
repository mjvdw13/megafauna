// ============================================================================
// PROJECTILE EFFECTS
// What a projectile leaves behind when it ends (hits something, smashes into
// the ground, or fades out). Projectiles in flight are 3-D (render3d/projectile-view.js).
// ============================================================================
import { burst, RingPulse } from './effects.js';
import { fireBurst } from './fire.js';

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
    } else if (p.kind === 'fireball') {
        effects.add(fireBurst(x, y, { count: p.endReason === 'expired' ? 6 : 14, speed: [1, 5], size: [12, 24] }));
        if (p.endReason !== 'expired') audio?.play('crackle', { x });
    } else if (p.kind === 'embers') {
        // Stepped in: a burst of flame shoots up. Burnt out or replaced: a wisp of smoke.
        if (p.endReason === 'hit') effects.add(fireBurst(x, y, { count: 16, speed: [2, 7], size: [14, 28], spread: 1.4, offset: p.width * 0.3 }));
        else effects.add(burst(x, y, { count: 6, colors: ['rgba(90,85,80,0.5)', 'rgba(140,135,130,0.4)'], speed: [0.5, 1.5], size: [12, 20], angle: -Math.PI / 2, spread: 1, gravity: -0.05, drag: 0.95, shrink: 1.02, life: [24, 36] }));
    }
}

// ============================================================================
// EFFECTS
// Short-lived visual effects drawn in screen space over the 3-D picture:
// impact flashes, glowing particles, dust, comic callouts. Each effect has
// update() → alive? and render(ctx). The bigger hit effects (impact stars,
// focus lines, shockwaves) are in impacts.js; the camera is in camera.js.
// ============================================================================
import { clamp, easeOutBack, easeOutQuad, randRange } from '../core/math.js';
import { createCanvas } from './canvas.js';
import { INK_COLOR } from './ink.js';

/**
 * A soft round sprite in `color` (bright core fading out at the rim), drawn once per color and
 * reused: much cheaper than a fresh radial gradient for every particle every frame.
 */
const softSprites = new Map();
const SOFT_SIZE = 64;
export function softSprite(color) {
    let sprite = softSprites.get(color);
    if (!sprite) {
        sprite = createCanvas(SOFT_SIZE, SOFT_SIZE);
        const g = sprite.getContext('2d');
        const r = SOFT_SIZE / 2;
        const grad = g.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, color);
        grad.addColorStop(0.55, color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, SOFT_SIZE, SOFT_SIZE);
        softSprites.set(color, sprite);
    }
    return sprite;
}

export class EffectsManager {
    constructor() { this.effects = []; }
    add(effect) { this.effects.push(effect); return effect; }
    clear() { this.effects = []; }
    update() { this.effects = this.effects.filter((e) => e.update()); }
    render(ctx) {
        for (const effect of this.effects) {
            ctx.save();
            effect.render(ctx);
            ctx.restore();
        }
    }
}

export class Effect {
    constructor(life) { this.life = life; this.age = 0; }
    /** 0 → 1 over the effect's lifetime. */
    get t() { return clamp(this.age / this.life, 0, 1); }
    update() { this.age++; return this.age < this.life; }
    render() {}
}

// ---------------------------------------------------------------------------- particles

/**
 * Generic particle burst. Particle fields: x, y, vx, vy, size, color, life,
 * gravity, drag, shrink, shape ('square' | 'circle' | 'line' | 'feather'), spin,
 * additive (glows: adds light instead of covering what's behind).
 */
export class ParticleBurst extends Effect {
    constructor(particles) {
        super(Math.max(...particles.map((p) => p.life)));
        this.particles = particles.map((p) => ({ gravity: 0.2, drag: 0.94, shrink: 0.95, shape: 'blob', outline: null, rotation: 0, spin: 0, maxLife: p.life, ...p }));
    }

    update() {
        for (const p of this.particles) {
            p.x += p.vx; p.y += p.vy;
            p.vy += p.gravity; p.vx *= p.drag; p.vy *= p.drag;
            p.size *= p.shrink; p.rotation += p.spin;
            p.life--;
        }
        return super.update();
    }

    render(ctx) {
        for (const p of this.particles) {
            if (p.life <= 0 || p.size < 0.4) continue;
            ctx.globalAlpha = clamp(p.life / Math.min(10, p.maxLife), 0, 1) * (p.alpha ?? 1);
            ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
            ctx.fillStyle = p.color;
            ctx.strokeStyle = p.color;
            if (p.shape === 'circle' || p.shape === 'blob') {
                // Soft-edged: bright core fading out, so particles read as light and dust, not ink.
                ctx.drawImage(softSprite(p.color), p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            } else if (p.shape === 'line') {
                ctx.lineCap = 'round';
                ctx.lineWidth = Math.max(1, p.size / 3);
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5); ctx.stroke();
            } else if (p.shape === 'feather') {
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
                ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size / 3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke();
                ctx.restore();
            } else {
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
        }
    }
}

export function burst(x, y, { count = 8, colors = ['#fff'], speed = [3, 8], size = [4, 9], life = [14, 24], spread = Math.PI * 2, angle = 0, ...rest } = {}) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const a = angle + (spread === Math.PI * 2 ? (Math.PI * 2 * i) / count + Math.random() * 0.5 : (Math.random() - 0.5) * spread);
        const s = randRange(...speed);
        particles.push({
            x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            size: randRange(...size), life: Math.round(randRange(...life)),
            color: colors[Math.floor(Math.random() * colors.length)], ...rest
        });
    }
    return new ParticleBurst(particles);
}

// ---------------------------------------------------------------------------- impacts

/** Blue guard flash: a curved shield facing the attacker. */
export class BlockSpark extends Effect {
    constructor(x, y, direction) {
        super(14);
        Object.assign(this, { x, y, direction });
    }

    render(ctx) {
        const t = this.t;
        ctx.translate(this.x, this.y);
        ctx.scale(-this.direction, 1); // shield bulges toward the attacker
        ctx.globalAlpha = 1 - t;
        const r = 34 + 12 * easeOutQuad(t);
        ctx.lineWidth = 6 * (1 - t) + 2;
        ctx.strokeStyle = '#85c1e9';
        ctx.fillStyle = 'rgba(93,173,226,0.25)';
        ctx.beginPath(); ctx.arc(-10, 0, r, -Math.PI / 2.4, Math.PI / 2.4); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.stroke();
        // Hex facets
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#d6eaf8';
        for (let i = -2; i <= 2; i++) {
            const a = i * 0.32;
            ctx.beginPath();
            ctx.moveTo(-10 + Math.cos(a) * (r - 10), Math.sin(a) * (r - 10));
            ctx.lineTo(-10 + Math.cos(a) * r, Math.sin(a) * r);
            ctx.stroke();
        }
    }
}

/** Ring that animates from radius `from` to `to` (contracting when to < from). Can follow a fighter. */
export class RingPulse extends Effect {
    constructor(x, y, { color = '#fff', from = 20, to = 80, life = 12, width = 5, follow = null } = {}) {
        super(life);
        Object.assign(this, { x, y, color, from, to, width, follow });
    }

    render(ctx) {
        const t = easeOutQuad(this.t);
        const x = this.follow ? this.follow.centerX : this.x;
        const y = this.follow ? this.follow.y + this.follow.height / 2 : this.y;
        const r = this.from + (this.to - this.from) * t;
        ctx.globalAlpha = 1 - this.t;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width * (1 - this.t) + 1;
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
    }
}

/** Soft dust clouds at ground level. */
export function dustPuff(x, groundY, { count = 6, spread = 30, size = [10, 18], color = 'rgba(200,180,150,0.45)', direction = 0 } = {}) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const side = direction || (i % 2 === 0 ? 1 : -1);
        particles.push({
            x: x + randRange(-spread / 2, spread / 2), y: groundY - randRange(0, 6),
            vx: side * randRange(0.8, 3), vy: -randRange(0.3, 1.5),
            size: randRange(...size) * 1.6, life: Math.round(randRange(20, 34)),
            color, shape: 'circle', gravity: 0, drag: 0.92, shrink: 1.025
        });
    }
    return new ParticleBurst(particles);
}

/** Comic-book text pop ("WOOF!", "QUACK!"). */
export class Callout extends Effect {
    constructor(x, y, text, { color = '#fff', outline = '#000', size = 34 } = {}) {
        super(32);
        Object.assign(this, { x, y, text, color, outline, size });
    }

    render(ctx) {
        const pop = easeOutBack(Math.min(1, this.age / 7));
        ctx.globalAlpha = this.t > 0.7 ? (1 - this.t) / 0.3 : 1;
        ctx.translate(this.x, this.y - this.age * 0.8);
        ctx.rotate(-0.12);
        ctx.scale(pop, pop);
        ctx.font = `${this.size * 1.3}px Bangers, "Arial Black", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 7;
        ctx.strokeStyle = this.outline === '#000' ? INK_COLOR : this.outline;
        ctx.strokeText(this.text, 0, 0);
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, 0, 0);
    }
}

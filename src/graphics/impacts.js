// ============================================================================
// IMPACTS
// The big hit effects, drawn in playfield coordinates over the 3-D picture:
//   ImpactStar  a hot white-cored star of spikes at the point of contact
//   FocusLines  speed lines rushing in on a heavy hit (manga "focus lines")
//   ShockRing   an expanding ring, flattened for shockwaves along the ground
// plus particle recipes for sparks, debris, launch smoke and skid dust.
// The fight scene picks how many of these a hit gets from how hard it was.
// ============================================================================
import { easeOutQuad, randRange } from '../core/math.js';
import { burst, Effect, ParticleBurst, softSprite } from './effects.js';

/** Star outline: alternating long and short spikes with some randomness. */
function starPoints(rays, rng = Math.random) {
    const points = [];
    for (let i = 0; i < rays * 2; i++) {
        const long = i % 2 === 0;
        points.push({ a: (i / (rays * 2)) * Math.PI * 2 + randRange(-0.08, 0.08, rng), r: long ? randRange(0.75, 1.15, rng) : randRange(0.28, 0.4, rng) });
    }
    return points;
}

function tracePoints(ctx, points, scale) {
    ctx.beginPath();
    points.forEach(({ a, r }, i) => {
        const x = Math.cos(a) * r * scale, y = Math.sin(a) * r * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
}

/** The flash at the point of contact. Stretched along the hit's direction (`angle`). */
export class ImpactStar extends Effect {
    constructor(x, y, { size = 60, color = '#ffc23d', angle = 0, life = 10, rays = 9 } = {}) {
        super(life);
        Object.assign(this, { x, y, size, color, angle });
        this.outer = starPoints(rays);
        this.inner = starPoints(rays);
        this.spin = randRange(-0.6, 0.6);
    }

    render(ctx) {
        const t = this.t;
        // Pops out past full size in two frames, then keeps swelling slightly as it fades.
        const pop = this.age < 2 ? 0.55 + 0.35 * (this.age + 1) : 1.25 + 0.3 * t;
        const size = this.size * pop;
        const fade = t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalCompositeOperation = 'lighter';
        // A tight glow that dies quickly, so the fighters stay readable through the hit.
        ctx.globalAlpha = fade * fade * 0.55;
        const glow = size * 1.5;
        ctx.drawImage(softSprite(this.color), -glow / 2, -glow / 2, glow, glow);
        ctx.scale(1.35, 1); // stretched along the hit
        ctx.rotate(this.spin * t);
        ctx.globalAlpha = fade * 0.85;
        ctx.fillStyle = this.color;
        tracePoints(ctx, this.outer, size);
        ctx.fill();
        // White-hot core: solid on the first frames so it reads even over a bright sky.
        ctx.globalCompositeOperation = this.age < 2 ? 'source-over' : 'lighter';
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#fffaf0';
        tracePoints(ctx, this.inner, size * 0.55);
        ctx.fill();
    }
}

/** Manga speed lines converging on a point. Redrawn with new lines every other frame so they flicker. */
export class FocusLines extends Effect {
    constructor(x, y, { count = 30, inner = 140, outer = 1100, life = 12, color = '#ffffff', width = [3, 12], alpha = 0.75 } = {}) {
        super(life);
        Object.assign(this, { x, y, count, inner, outer, color, width, alpha });
        this.reseed();
    }

    reseed() {
        this.lines = Array.from({ length: this.count }, () => ({
            a: Math.random() * Math.PI * 2, w: randRange(...this.width), r: this.inner * randRange(0.8, 1.6)
        }));
    }

    update() {
        if (this.age % 2 === 1) this.reseed();
        return super.update();
    }

    render(ctx) {
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.alpha * (1 - easeOutQuad(this.t));
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (const { a, w, r } of this.lines) {
            const c = Math.cos(a), s = Math.sin(a);
            // A long thin wedge from off-screen to a point near the impact.
            ctx.moveTo(c * this.outer - s * w, s * this.outer + c * w);
            ctx.lineTo(c * this.outer + s * w, s * this.outer - c * w);
            ctx.lineTo(c * r, s * r);
        }
        ctx.fill();
    }
}

/** Expanding ring. `squash` < 1 flattens it into a ground shockwave. */
export class ShockRing extends Effect {
    constructor(x, y, { radius = 110, squash = 1, color = '#ffffff', life = 14, width = 10, additive = true } = {}) {
        super(life);
        Object.assign(this, { x, y, radius, squash, color, width, additive });
    }

    render(ctx) {
        const t = this.t;
        const r = this.radius * (0.15 + 0.85 * easeOutQuad(t));
        if (this.additive) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.width * (1 - t) + 1;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, r, r * this.squash, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// ---------------------------------------------------------------------------- particle recipes

/** Hot sparks spraying out along the hit. `angle` is the knockback direction. */
export function impactSparks(x, y, { angle = 0, count = 10, speed = [6, 14], colors = ['#fff6d8', '#ffd36b', '#ff9a3c'], spread = 1.6, size = [3, 7] } = {}) {
    return burst(x, y, { count, colors, speed, size, angle, spread, shape: 'line', gravity: 0.35, drag: 0.9, shrink: 0.94, life: [10, 20], additive: true });
}

/** Chunks of dirt and grit kicked up by a hit against the ground. */
export function debris(x, groundY, { count = 10, colors = ['#6d5a45', '#8c7457', '#4a3d30'], dir = 0 } = {}) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const side = dir || (Math.random() < 0.5 ? -1 : 1);
        particles.push({
            x: x + randRange(-20, 20), y: groundY - 2, vx: side * randRange(1, 6), vy: -randRange(4, 10),
            size: randRange(3, 7), life: Math.round(randRange(22, 36)), color: colors[i % colors.length],
            shape: 'square', gravity: 0.55, drag: 0.98, shrink: 0.99, spin: randRange(-0.3, 0.3)
        });
    }
    return new ParticleBurst(particles);
}

/** One puff of the smoke trail a hard-launched fighter leaves behind. */
export function launchSmoke(x, y, { size = 26, color = 'rgba(235,232,225,0.55)', vx = 0, vy = 0 } = {}) {
    return new ParticleBurst([{
        x: x + randRange(-6, 6), y: y + randRange(-6, 6), vx: vx * 0.1, vy: vy * 0.1 - 0.3,
        size: size * randRange(0.8, 1.2), life: Math.round(randRange(24, 34)), color,
        shape: 'circle', gravity: 0, drag: 0.94, shrink: 1.035
    }]);
}

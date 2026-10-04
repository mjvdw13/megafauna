// ============================================================================
// AMBIENT LAYERS
// Reusable animated layers for stages. A layer is:
//   { front?: boolean, update(time), render(ctx, time) }
// Back layers draw behind fighters, front layers in front of them.
// ============================================================================
import { SCREEN } from '../config.js';
import { randRange, seededRandom } from '../core/math.js';
import { createCanvas } from '../graphics/canvas.js';
import { INK_COLOR } from '../graphics/ink.js';
import { createSketch } from './sketch-kit.js';

/**
 * Generic particle field that keeps `count` particles alive.
 * spawn(initial) → particle (initial=true scatters across the screen at start)
 * step(p, time) → false to respawn; draw(ctx, p, time)
 */
export function particleField({ count, spawn, step, draw, front = false }) {
    const particles = Array.from({ length: count }, () => spawn(true));
    return {
        front,
        update(time) {
            for (let i = 0; i < particles.length; i++) {
                if (step(particles[i], time) === false) particles[i] = spawn(false);
            }
        },
        render(ctx, time) {
            for (const particle of particles) draw(ctx, particle, time);
        }
    };
}

export function snowfall({ count = 90, front = true } = {}) {
    return particleField({
        count, front,
        spawn: (initial) => ({
            x: Math.random() * SCREEN.width, y: initial ? Math.random() * SCREEN.height : -10,
            vy: randRange(0.6, 1.8), r: Math.random() < 0.3 ? 3.5 : 2, phase: Math.random() * 6
        }),
        step: (s, t) => {
            s.y += s.vy;
            s.x += Math.sin(t * 0.02 + s.phase) * 0.6;
            return s.y < SCREEN.height + 10;
        },
        draw: (ctx, s) => {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
            if (s.r > 3) { ctx.strokeStyle = 'rgba(90,120,150,0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
        }
    });
}

export function risingEmbers({ count = 45, front = true, colors = ['#ff6b35', '#f7c548', '#ff3b1f'] } = {}) {
    return particleField({
        count, front,
        spawn: (initial) => ({
            x: Math.random() * SCREEN.width, y: initial ? Math.random() * SCREEN.height : SCREEN.height + 10,
            vy: -randRange(0.6, 2.2), r: Math.random() < 0.25 ? 3 : 1.8, phase: Math.random() * 6,
            color: colors[Math.floor(Math.random() * colors.length)], life: randRange(200, 600)
        }),
        step: (e, t) => {
            e.y += e.vy;
            e.x += Math.sin(t * 0.03 + e.phase) * 0.8;
            e.life--;
            return e.y > -10 && e.life > 0;
        },
        draw: (ctx, e, t) => {
            const glow = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.1 + e.phase));
            ctx.globalAlpha = 0.25 * glow;
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.6 + 0.4 * glow;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    });
}

export function fireflies({ count = 22, front = false, area = { top: 200, bottom: 520 }, color = '#eaff7b' } = {}) {
    return particleField({
        count, front,
        spawn: () => ({
            x: Math.random() * SCREEN.width, y: randRange(area.top, area.bottom),
            phase: Math.random() * Math.PI * 2, speed: randRange(0.01, 0.025), drift: randRange(-0.4, 0.4)
        }),
        step: (f, t) => {
            f.x += f.drift + Math.sin(t * f.speed + f.phase) * 0.5;
            f.y += Math.cos(t * f.speed * 1.3 + f.phase) * 0.4;
            if (f.x < -10) f.x = SCREEN.width + 10;
            if (f.x > SCREEN.width + 10) f.x = -10;
            return true;
        },
        draw: (ctx, f, t) => {
            const glow = 0.5 + 0.5 * Math.sin(t * 0.08 + f.phase);
            const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 12);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.5 * glow;
            ctx.fillStyle = g;
            ctx.fillRect(f.x - 12, f.y - 12, 24, 24);
            ctx.globalAlpha = 0.5 + 0.5 * glow;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        }
    });
}

export function fallingLeaves({ count = 10, front = true, colors = ['#e67e22', '#d35400', '#f1c40f'], area = { left: 0, right: SCREEN.width } } = {}) {
    return particleField({
        count, front,
        spawn: (initial) => ({
            x: randRange(area.left, area.right), y: initial ? Math.random() * SCREEN.height : -10,
            vy: randRange(0.5, 1.2), phase: Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)]
        }),
        step: (l, t) => {
            l.y += l.vy;
            l.x += Math.sin(t * 0.04 + l.phase) * 1.2;
            return l.y < SCREEN.height + 10;
        },
        draw: (ctx, l, t) => {
            const turn = Math.sin(t * 0.08 + l.phase);
            ctx.save();
            ctx.translate(l.x, l.y);
            ctx.rotate(t * 0.03 + l.phase);
            ctx.scale(1, Math.max(0.2, Math.abs(turn)));
            ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = l.color; ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = INK_COLOR; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
            ctx.restore();
        }
    });
}

/** Inked clouds that drift across the sky and wrap around. Each is pre-rendered once. */
export function driftingClouds(clouds, { color = '#ffffff', shade = '#d9e4ef' } = {}) {
    const state = clouds.map((c) => ({ ...c, canvas: null }));
    // Painted lazily so the layer can be created without a DOM (tests).
    const paint = (c, i) => {
        c.canvas = createCanvas(Math.ceil(c.size * 2.2), Math.ceil(c.size * 1.6));
        createSketch(c.canvas.getContext('2d'), seededRandom(i + 11)).cloud(c.size * 0.55, c.size * 0.85, c.size, color, shade);
    };
    return {
        front: false,
        update() {
            for (const c of state) {
                c.x += c.speed;
                if (c.x > SCREEN.width + 20) c.x = -c.size * 2.2 - 20;
            }
        },
        render(ctx) {
            state.forEach((c, i) => {
                if (!c.canvas) paint(c, i);
                ctx.drawImage(c.canvas, Math.round(c.x), c.y);
            });
        }
    };
}

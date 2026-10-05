// ============================================================================
// FIRE
// Flame particles for Gary's fire moves and for burning fighters. Each flame
// is a soft blob drawn with additive blending, so overlapping flames glow
// brighter; it cools from white-yellow through orange to deep red as it ages,
// rises, and swells. A FireEmitter can keep spawning flames for a while and
// follow a fighter (a flamethrower, the phoenix aura).
// ============================================================================
import { clamp, randRange } from '../core/math.js';
import { Effect } from './effects.js';

/** Color ramp over a flame's life: [t, r, g, b, alpha]. */
const RAMP = [[0, 255, 252, 225, 1], [0.15, 255, 214, 110, 1], [0.45, 255, 128, 34, 0.9], [0.75, 214, 56, 18, 0.6], [1, 120, 24, 10, 0]];

function rampColor(t) {
    let i = 1;
    while (i < RAMP.length - 1 && RAMP[i][0] < t) i++;
    const [t0, r0, g0, b0, a0] = RAMP[i - 1], [t1, r1, g1, b1, a1] = RAMP[i];
    const k = clamp((t - t0) / (t1 - t0), 0, 1);
    return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k, a0 + (a1 - a0) * k];
}

/** One flame: position and velocity in screen px, size in px, life in frames. */
export function flame(x, y, { vx = 0, vy = 0, size = 16, life = 18, rise = -0.25, drag = 0.93, grow = 1.04 } = {}) {
    return { x, y, vx, vy, size, life, maxLife: life, rise, drag, grow };
}

/**
 * A group of flames. `emit(add, frame)` adds more: on each of the first `emitFrames`
 * frames, or, with `during: { owner, attack }`, on each frame that attack advances
 * through its active phase (so hitstop pauses the stream instead of using it up).
 * The effect ends once emission stops and every flame has burnt out.
 */
export class FireEmitter extends Effect {
    constructor({ flames = [], emit = null, emitFrames = 0, during = null } = {}) {
        super(Math.max(1, emitFrames));
        this.flames = flames;
        this.emit = emit;
        this.emitFrames = emitFrames;
        this.during = during;
        this.lastFrame = -1;
    }

    /** Should this update add flames, and is more emission still to come? */
    emitting() {
        if (!this.during) return { now: this.age < this.emitFrames, more: this.age < this.emitFrames };
        const { owner, attack } = this.during;
        if (owner.currentAttack !== attack || !attack.isHitboxActive(owner.attackFrame)) return { now: false, more: owner.currentAttack === attack && owner.attackFrame < attack.startup };
        const now = owner.attackFrame !== this.lastFrame;
        this.lastFrame = owner.attackFrame;
        return { now, more: true };
    }

    update() {
        const { now, more } = this.emitting();
        if (this.emit && now) this.emit((f) => this.flames.push(f), this.age);
        for (const f of this.flames) {
            f.x += f.vx; f.y += f.vy;
            f.vy += f.rise; f.vx *= f.drag; f.vy *= f.drag;
            f.size *= f.grow;
            f.life--;
        }
        this.flames = this.flames.filter((f) => f.life > 0);
        this.age++;
        return more || this.flames.length > 0;
    }

    render(ctx) {
        ctx.globalCompositeOperation = 'lighter';
        for (const f of this.flames) {
            const [r, g, b, a] = rampColor(1 - f.life / f.maxLife);
            if (a <= 0.01) continue;
            const rad = f.size / 2;
            const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
            grad.addColorStop(0, `rgba(${r | 0},${g | 0},${b | 0},${a})`);
            grad.addColorStop(0.45, `rgba(${r | 0},${(g * 0.8) | 0},${(b * 0.6) | 0},${a * 0.55})`);
            grad.addColorStop(1, `rgba(${r | 0},${(g * 0.5) | 0},0,0)`);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, Math.PI * 2); ctx.fill();
        }
    }
}

/** A one-off puff of flames flying out from a point. */
export function fireBurst(x, y, { count = 10, angle = -Math.PI / 2, spread = Math.PI * 2, speed = [1, 4], size = [10, 22], life = [12, 24], rise = -0.2, offset = 0 } = {}) {
    const flames = [];
    for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread, s = randRange(...speed);
        flames.push(flame(x + randRange(-offset, offset), y + randRange(-offset, offset), {
            vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: randRange(...size), life: Math.round(randRange(...life)), rise
        }));
    }
    return new FireEmitter({ flames });
}

/** A few flames licking up off a burning fighter. */
export function burningFlames(fighter) {
    const x = fighter.centerX + randRange(-0.3, 0.3) * fighter.width;
    const y = fighter.y + fighter.height * randRange(0.25, 0.85);
    return fireBurst(x, y, { count: 2, angle: -Math.PI / 2, spread: 0.8, speed: [0.5, 1.6], size: [10, 18], life: [12, 20], rise: -0.12 });
}

// ---------------------------------------------------------------------------- attack effects

/** Where a move's flames start: the front of its hitbox (or its projectile's muzzle), at mid height. */
function mouthOf(owner, attack) {
    const dir = owner.facingRight ? 1 : -1;
    if (attack.projectile) {
        const [ox, oy] = attack.projectile.offset ?? [owner.width * 0.6, owner.height * 0.4];
        return { x: owner.centerX + dir * ox, y: owner.y + oy, dir };
    }
    const hb = attack.hitbox;
    return { x: owner.centerX + dir * (hb.x - owner.width / 2), y: owner.y + hb.y + hb.height / 2, dir };
}

/** A small burst of flame from the beak. */
export function firePuff(owner, attack) {
    const { x, y, dir } = mouthOf(owner, attack);
    return fireBurst(x, y, { count: 12, angle: dir > 0 ? 0 : Math.PI, spread: 1.1, speed: [2, 6], size: [12, 24], life: [10, 18], rise: -0.15 });
}

/** A blast that fills the hitbox with fire for the active frames. */
export function fireBlast(owner, attack) {
    const hb = attack.hitbox;
    return new FireEmitter({
        during: { owner, attack },
        emit: (add) => {
            const { x, y, dir } = mouthOf(owner, attack);
            for (let i = 0; i < 7; i++) {
                const a = (dir > 0 ? 0 : Math.PI) + randRange(-0.45, 0.45), s = randRange(5, 10);
                add(flame(x, y + randRange(-8, 8), { vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: randRange(18, 30), life: Math.round(hb.width / 8 + randRange(2, 8)), rise: -0.12, grow: 1.06 }));
            }
        }
    });
}

/** A stream of fire from the beak, following the owner, as long as the move is active. */
export function flameJet(owner, attack) {
    const hb = attack.hitbox;
    return new FireEmitter({
        during: { owner, attack },
        emit: (add) => {
            const { x, y, dir } = mouthOf(owner, attack);
            for (let i = 0; i < 4; i++) {
                const s = randRange(10, 14);
                add(flame(x + dir * randRange(0, 8), y + randRange(-3, 3), {
                    vx: dir * s, vy: randRange(-1.2, 1.2), size: randRange(10, 16), life: Math.round(hb.width / (s * 0.82)), rise: -0.06, drag: 0.97, grow: 1.11
                }));
            }
        }
    });
}

/** Flames racing outward along the ground on both sides. */
export function fireRing(owner, attack, groundY) {
    const reach = attack.hitbox.width / 2;
    return new FireEmitter({
        during: { owner, attack },
        emit: (add) => {
            const spreadOut = (owner.attackFrame - attack.startup + 1) / attack.active;
            for (const side of [-1, 1]) {
                for (let i = 0; i < 3; i++) {
                    const x = owner.centerX + side * reach * spreadOut * randRange(0.5, 1);
                    add(flame(x, groundY - randRange(0, 6), { vx: side * randRange(0.5, 2), vy: -randRange(1, 3), size: randRange(16, 28), life: Math.round(randRange(14, 24)), rise: -0.18 }));
                }
            }
        }
    });
}

/** A fiery aura around the owner while the move is active, trailing flames below. */
export function phoenixAura(owner, attack) {
    return new FireEmitter({
        during: { owner, attack },
        emit: (add) => {
            const cx = owner.centerX, cy = owner.y + owner.height * 0.5;
            for (let i = 0; i < 5; i++) {
                const a = Math.random() * Math.PI * 2, r = randRange(0.35, 0.6) * owner.height;
                add(flame(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r, { vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.8 + 2, size: randRange(16, 28), life: Math.round(randRange(10, 18)), rise: 0.05 }));
            }
            add(flame(cx + randRange(-12, 12), owner.y + owner.height, { vy: 3, size: randRange(20, 30), life: 16, rise: 0.1, grow: 1.02 }));
        }
    });
}

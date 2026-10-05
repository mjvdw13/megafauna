// ============================================================================
// ATTACK VFX
// Named effects played when an attack's hitbox becomes active. An attack picks
// one with its `vfx` field. To add a new look, add an entry to ATTACK_VFX.
// ============================================================================
import { easeOutQuad } from '../core/math.js';
import { Callout, dustPuff, Effect, burst, RingPulse } from './effects.js';

/** An effect positioned at the attack's hitbox, following its owner and mirrored by facing. */
class AttachedEffect extends Effect {
    constructor(owner, attack, life) {
        super(life);
        this.owner = owner;
        this.dir = owner.facingRight ? 1 : -1;
        const hb = attack.hitbox;
        this.offX = hb.x + hb.width / 2 - owner.width / 2;
        this.offY = hb.y + hb.height / 2;
        this.hb = hb;
        this.color = owner.accentColor;
    }
    get x() { return this.owner.centerX + this.offX * this.dir; }
    get y() { return this.owner.y + this.offY; }
    render(ctx) {
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1);
        this.draw(ctx, this.t);
    }
    draw() {}
}

/**
 * Crescent "smear" arc, the classic fighting-game swing trail. The arc sweeps
 * in over the first few frames, then widens and fades.
 */
class SlashArc extends AttachedEffect {
    constructor(owner, attack, { radius = 32, thickness = 12, span = 1.0, life = 10, rotation = 0, flatten = 1, reverse = false, lines = 0 } = {}) {
        super(owner, attack, life);
        Object.assign(this, { radius, thickness, span, rotation, flatten, reverse, lines });
    }

    draw(ctx, t) {
        const sweep = easeOutQuad(Math.min(1, (this.age + 1) / 4));
        const r = this.radius * (1 + 0.18 * t);
        const th = this.thickness * (1 - 0.5 * t);
        const cx = this.hb.width / 2 - r; // outer edge reaches the front of the hitbox
        let a0 = -this.span, a1 = -this.span + 2 * this.span * sweep;
        if (this.reverse) { a1 = this.span; a0 = this.span - 2 * this.span * sweep; }

        ctx.rotate(this.rotation);
        ctx.scale(1, this.flatten);
        ctx.globalAlpha = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;

        // Body of the smear
        ctx.beginPath();
        ctx.arc(cx, 0, r, a0, a1);
        ctx.arc(cx - th, 0, r, a1, a0, true);
        ctx.closePath();
        // A faint motion blur of light rather than an inked shape, so it sits well over the 3-D fighters.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
        // Colored leading edge
        ctx.lineWidth = Math.max(1.5, th * 0.35);
        ctx.strokeStyle = this.color;
        ctx.beginPath(); ctx.arc(cx, 0, r, a0, a1); ctx.stroke();

        // Speed lines trailing the swing
        ctx.lineWidth = 2;
        for (let i = 0; i < this.lines; i++) {
            const a = a0 + ((i + 1) / (this.lines + 1)) * (a1 - a0);
            const len = 16 + 10 * (1 - t);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * (r + 6), Math.sin(a) * (r + 6));
            ctx.lineTo(cx + Math.cos(a) * (r + 6) - len, Math.sin(a) * (r + 6));
            ctx.stroke();
        }
    }
}

/** Concentric sound arcs travelling forward (barks, quacks). */
class SoundWave extends AttachedEffect {
    constructor(owner, attack, { rings = 3, maxRadius = 90, life = 22 } = {}) {
        super(owner, attack, life);
        Object.assign(this, { rings, maxRadius });
        this.offX -= this.hb.width / 2; // start at the back of the hitbox (the mouth)
    }

    draw(ctx) {
        for (let i = 0; i < this.rings; i++) {
            const local = (this.age - i * 3) / (this.life - this.rings * 3);
            if (local <= 0 || local >= 1) continue;
            const r = 12 + this.maxRadius * easeOutQuad(local);
            ctx.globalAlpha = 1 - local;
            ctx.lineWidth = 7 * (1 - local) + 1.5;
            ctx.strokeStyle = i % 2 ? this.color : '#fff';
            ctx.beginPath(); ctx.arc(0, 0, r, -0.75, 0.75); ctx.stroke();
        }
    }
}

/** Spinning wind rings around the owner (Tail Tornado). */
class Whirlwind extends AttachedEffect {
    constructor(owner, attack) {
        super(owner, attack, attack.active + 8);
        this.offX = 0;
    }

    draw(ctx, t) {
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 0.9;
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
            const rx = 58 + i * 10, ry = 12 + i * 3, y = -24 + i * 22;
            const start = this.age * 0.6 + i * 2;
            ctx.strokeStyle = i === 1 ? this.color : 'rgba(255,255,255,0.85)';
            ctx.beginPath(); ctx.ellipse(0, y, rx, ry, 0, start, start + Math.PI * 1.3); ctx.stroke();
        }
    }
}

/** Ground shockwave that travels both ways from the owner (stomps, body slams). */
class Shockwave extends Effect {
    constructor(owner, groundY, { reach = 160, life = 20 } = {}) {
        super(life);
        Object.assign(this, { x: owner.centerX, groundY, reach, color: owner.accentColor });
    }

    render(ctx) {
        const t = easeOutQuad(this.t);
        ctx.globalAlpha = 1 - this.t;
        for (const [color, scale, width] of [['#fff', 1, 6], [this.color, 0.75, 4]]) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width * (1 - this.t) + 1;
            ctx.beginPath();
            ctx.ellipse(this.x, this.groundY, 20 + this.reach * t * scale, 8 + 16 * t * scale, 0, Math.PI, Math.PI * 2);
            ctx.stroke();
        }
    }
}

/** Emits dust behind the owner's feet while a charge is active. */
class DustTrail extends Effect {
    constructor(owner, attack, effects, groundY) {
        super(attack.active + 2);
        Object.assign(this, { owner, effects, groundY });
    }

    update() {
        if (this.age % 2 === 0 && this.owner.isGrounded) {
            const back = this.owner.facingRight ? this.owner.x + 10 : this.owner.x + this.owner.width - 10;
            this.effects.add(dustPuff(back, this.groundY, { count: 3, direction: this.owner.facingRight ? -1 : 1, size: [12, 20] }));
        }
        return super.update();
    }
}

// ---------------------------------------------------------------------------- registry

/** Each entry: (owner, attack, env) where env = { effects, camera, groundY }. */
export const ATTACK_VFX = {
    none: () => {},
    'slash-small': (owner, attack, { effects }) => {
        effects.add(new SlashArc(owner, attack, { radius: 30, thickness: 11, span: 0.95, life: 9, rotation: -0.1 }));
    },
    'slash-large': (owner, attack, { effects }) => {
        effects.add(new SlashArc(owner, attack, { radius: 50, thickness: 20, span: 1.25, life: 13, rotation: 0.15, lines: 3 }));
    },
    'slash-air': (owner, attack, { effects }) => {
        effects.add(new SlashArc(owner, attack, { radius: 44, thickness: 16, span: 1.1, life: 12, rotation: 0.9, lines: 2 }));
    },
    uppercut: (owner, attack, { effects, camera }) => {
        effects.add(new SlashArc(owner, attack, { radius: 56, thickness: 20, span: 1.2, life: 14, rotation: -1.25, reverse: true, lines: 3 }));
        camera.shake(4);
    },
    sweep: (owner, attack, { effects, groundY }) => {
        effects.add(new SlashArc(owner, attack, { radius: 46, thickness: 14, span: 1.3, life: 11, flatten: 0.35 }));
        const front = owner.centerX + (owner.facingRight ? 1 : -1) * owner.width * 0.6;
        effects.add(dustPuff(front, groundY, { count: 4, direction: owner.facingRight ? 1 : -1 }));
    },
    soundwave: (owner, attack, { effects }) => {
        const big = attack.strength === 'special' && attack.damage >= 12;
        effects.add(new SoundWave(owner, attack, big ? { rings: 4, maxRadius: 120, life: 26 } : {}));
    },
    whirlwind: (owner, attack, { effects }) => {
        effects.add(new Whirlwind(owner, attack));
    },
    feathers: (owner, attack, { effects }) => {
        const dir = owner.facingRight ? 1 : -1;
        effects.add(burst(owner.centerX + dir * 30, owner.y + 40, {
            count: 14, colors: ['#fff', '#fce4a8', '#f1c40f'], speed: [4, 9], size: [6, 10], life: [20, 32],
            angle: dir > 0 ? 0 : Math.PI, spread: 1.2, shape: 'feather', gravity: 0.08, drag: 0.92, shrink: 0.99, spin: 0.25
        }));
    },
    quake: (owner, attack, { effects, camera, groundY }) => {
        // The ring's reach matches the hitbox so players can read the real range.
        effects.add(new Shockwave(owner, groundY, { reach: Math.max(60, attack.hitbox.width / 2 - 20) }));
        effects.add(dustPuff(owner.centerX, groundY, { count: 10, spread: owner.width, size: [14, 24] }));
        effects.add(burst(owner.centerX, groundY - 4, {
            count: 10, colors: ['#7f5539', '#9c6644', '#b08968'], speed: [4, 9], size: [4, 8], life: [20, 30],
            angle: -Math.PI / 2, spread: 2.2, gravity: 0.5, drag: 0.98, shrink: 0.99
        }));
        camera.shake(12);
    },
    charge: (owner, attack, { effects, groundY }) => {
        effects.add(new DustTrail(owner, attack, effects, groundY));
        effects.add(new SlashArc(owner, attack, { radius: 40, thickness: 12, span: 0.9, life: attack.active, lines: 4 }));
    }
};

/** Telegraph flash when a special move begins. */
export function spawnAttackStartVfx(owner, attack, { effects }) {
    if (attack.strength !== 'special') return;
    effects.add(new RingPulse(0, 0, { color: owner.accentColor, from: 90, to: 25, life: Math.min(14, attack.startup + 2), follow: owner, width: 4 }));
}

export function spawnAttackVfx(owner, attack, env) {
    (ATTACK_VFX[attack.vfx] || ATTACK_VFX['slash-small'])(owner, attack, env);
    if (attack.callout) {
        const dir = owner.facingRight ? 1 : -1;
        env.effects.add(new Callout(owner.centerX + dir * (owner.width * 0.7), owner.y - 10, attack.callout, { color: owner.accentColor }));
    }
}

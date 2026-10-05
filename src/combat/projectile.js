// ============================================================================
// PROJECTILE
// Things fighters throw or fire: Riley's bark wave, Quackers' egg, Randy's
// boulder. A move spawns one by giving `projectile: { kind, ... }`; the move's
// own damage/knockback/hitstun are what the projectile hits with.
//
// Spec fields: kind, width, height, speed, vy, gravity, life, offset [x, y]
// (from the fighter's center / top), rolls (stays on platforms and keeps going),
// pierce (keeps going after a hit), grow (px of size added per frame),
// max (how many of this kind one fighter can have out; a new one ends the oldest).
// ============================================================================
import { SCREEN } from '../config.js';

const OFFSCREEN = 160;

export class Projectile {
    constructor(owner, attack) {
        const spec = attack.projectile;
        this.owner = owner;
        this.attack = attack;
        this.kind = spec.kind;
        this.dir = owner.facingRight ? 1 : -1;
        this.width = spec.width ?? 30;
        this.height = spec.height ?? 30;
        const [ox, oy] = spec.offset ?? [owner.width * 0.6, owner.height * 0.4];
        this.x = owner.centerX + this.dir * ox - this.width / 2;
        this.y = owner.y + oy - this.height / 2;
        this.vx = this.dir * (spec.speed ?? 8);
        this.vy = spec.vy ?? 0;
        this.gravity = spec.gravity ?? 0;
        this.life = spec.life ?? 60;
        this.rolls = !!spec.rolls;
        this.pierce = !!spec.pierce;
        this.grow = spec.grow ?? 0;
        this.age = 0;
        this.dead = false;
        this.endReason = null;
        this.hitTargets = new Set();
        this.grounded = false;
        this.spin = 0;
    }

    get centerX() { return this.x + this.width / 2; }
    get centerY() { return this.y + this.height / 2; }
    box() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }

    /** @param physics  for the platforms rolling projectiles travel along */
    update(physics) {
        if (this.dead) return;
        this.age++;
        if (this.grow) {
            this.x -= this.grow / 2; this.y -= this.grow / 2;
            this.width += this.grow; this.height += this.grow;
        }
        if (!this.grounded) this.vy += this.gravity;
        const feetBefore = this.y + this.height;
        this.x += this.vx;
        this.y += this.vy;
        this.spin += this.vx * 0.05;

        if (this.gravity && physics) {
            const surface = physics.surfaces.find((s) => this.centerX >= s.left && this.centerX <= s.right && feetBefore <= s.y + 2 && this.y + this.height >= s.y);
            if (this.grounded && !physics.surfaces.some((s) => this.centerX >= s.left && this.centerX <= s.right && Math.abs(this.y + this.height - s.y) < 3)) {
                this.grounded = false; // rolled off the edge
            }
            if (surface && this.vy >= 0) {
                if (this.rolls) { this.y = surface.y - this.height; this.vy = 0; this.grounded = true; }
                else return this.end('ground');
            }
        }
        if (this.age >= this.life) return this.end('expired');
        if (this.y > SCREEN.height + OFFSCREEN || this.x > SCREEN.width + OFFSCREEN || this.x + this.width < -OFFSCREEN) this.end('offscreen');
    }

    end(reason) {
        this.dead = true;
        this.endReason = reason;
    }

    /** Sent back the other way by a reflector, now belonging to them. */
    reflect(newOwner) {
        this.owner = newOwner;
        this.dir = -this.dir;
        this.vx = -this.vx * 1.25;
        this.age = 0;
        this.hitTargets.clear();
    }
}

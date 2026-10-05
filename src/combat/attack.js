// ============================================================================
// ATTACK
// Immutable description of one move: frame data, damage, hitbox, and the
// presentation hints (pose, vfx, anim) the renderer uses to animate it.
// ============================================================================

export const AttackPhase = Object.freeze({ STARTUP: 'startup', ACTIVE: 'active', RECOVERY: 'recovery' });

/** Animation defaults by attack strength. `lean` = anticipation pull-back, `lunge` = strike push-forward (px). */
export const ATTACK_ANIM_DEFAULTS = Object.freeze({
    light: { lean: 3, lunge: 7, squash: 0.05 },
    heavy: { lean: 8, lunge: 14, squash: 0.09 },
    smash: { lean: 11, lunge: 18, squash: 0.11 },
    special: { lean: 7, lunge: 12, squash: 0.08 }
});

/** Smash attacks can be held at their windup to power up. */
export const CHARGE = Object.freeze({ maxFrames: 60, damage: 0.4, knockback: 0.3 });

export class Attack {
    constructor(config) {
        this.name = config.name || 'Attack';
        this.damage = config.damage ?? 5;
        this.startup = config.startup ?? 4;
        this.active = config.active ?? 3;
        this.recovery = config.recovery ?? 6;
        this.hitstun = config.hitstun ?? 12;
        // Frames a shield is frozen when this hits it.
        this.blockstun = config.blockstun ?? 8;
        // Push strength on hit. Converted to velocity via KNOCKBACK_SCALE and divided by defender weight.
        this.knockback = config.knockback ?? 50;
        // Upward velocity given to the defender on hit (negative spikes downward).
        this.launch = config.launch ?? 0;
        this.hitbox = config.hitbox;
        this.strength = config.strength || 'light';
        // Which body pose the sprite uses: 'stand' | 'crouch' | 'air'.
        this.pose = config.pose || 'stand';
        // Attack effect drawn during active frames (see graphics/attack-vfx.js).
        this.vfx = config.vfx || (this.strength === 'light' ? 'slash-small' : 'slash-large');
        this.knockdown = config.knockdown || false;
        // Super armor: absorbs this many hits during startup/active without flinching.
        this.armor = config.armor || 0;
        this.afterimages = config.afterimages || false;
        // Freeze frames on hit. Heavier hits pause longer for impact.
        this.hitstop = config.hitstop ?? (this.strength === 'light' ? 5 : 9);
        /**
         * Velocity the move gives its user, per phase: { start, startup, active, recovery } → { vx?, vy? }.
         * `start` applies on the first frame only; the others every frame of that phase. vx is in facing direction.
         */
        this.movement = config.movement || null;
        this.anim = { ...ATTACK_ANIM_DEFAULTS[this.strength], ...(config.anim || {}) };
        // Optional comic text shown when the move becomes active ("WOOF!").
        this.callout = config.callout || null;
        // Sound played when the move becomes active (see audio/sfx.js). Default: picked from vfx, else a whoosh.
        this.sfx = config.sfx || null;
        // Rig poses to use instead of the defaults, per phase: { startup: 'attack_rear', active: 'air_attack' }.
        this.poses = config.poses || null;

        // ---- Smash-style behavior
        // Hold the button during startup to power the move up (smash attacks).
        this.charge = config.charge || false;
        // Press attack again during this move to continue into another (jab 1-2-3).
        this.chain = config.chain || null;
        // Hits again every N active frames (multi-hit moves).
        this.rehit = config.rehit || 0;
        // Phases during which the user can't be hit: e.g. ['startup'].
        this.intangible = config.intangible || [];
        // Phases during which the user's sprite is hidden (burrowing).
        this.hidden = config.hidden || [];
        // Ends in a helpless fall if it finishes in the air (up specials).
        this.helpless = config.helpless || false;
        // Frames stuck on landing if this move is interrupted by touching the ground.
        this.landingLag = config.landingLag ?? (this.pose === 'air' ? (this.strength === 'light' ? 6 : 10) : 0);
        // Air moves end when you land; set false for moves that should keep going.
        this.endsOnLanding = config.endsOnLanding ?? this.pose === 'air';
        // Spawns a projectile when the move becomes active (see combat/projectile.js).
        this.projectile = config.projectile || null;
        // Turns projectiles around during active frames.
        this.reflect = config.reflect || false;
        // Counter: if hit during the active frames, take no damage and perform `counter.into` instead.
        this.counter = config.counter || null;
        // Grabs connect with shielding opponents and start a hold.
        this.grab = config.grab || false;
        // Throws: applied to the held opponent when the move becomes active. 'forward' | 'back' | 'up' | 'down'.
        this.throwDir = config.throwDir || null;
        // Leaves a grounded opponent dizzy (stars, can't act) for this many frames instead of normal hitstun.
        this.dizzy = config.dizzy || 0;
        // Sets the opponent on fire on a clean hit: this many ticks of burn damage (see BURN in config.js).
        this.burn = config.burn || 0;
        Object.freeze(this);
    }

    getTotalFrames() { return this.startup + this.active + this.recovery; }
    isHitboxActive(frame) { return frame >= this.startup && frame < this.startup + this.active; }

    phaseAt(frame) {
        if (frame < this.startup) return AttackPhase.STARTUP;
        if (frame < this.startup + this.active) return AttackPhase.ACTIVE;
        return AttackPhase.RECOVERY;
    }

    /** 0..1 progress through the phase that `frame` falls in. */
    phaseProgress(frame) {
        const phase = this.phaseAt(frame);
        if (phase === AttackPhase.STARTUP) return frame / this.startup;
        if (phase === AttackPhase.ACTIVE) return (frame - this.startup) / this.active;
        return Math.min(1, (frame - this.startup - this.active) / this.recovery);
    }

    /** Frame at which a charging move holds while its button is held. */
    get chargeFrame() { return Math.max(1, this.startup - 2); }

    /**
     * Returns a copy scaled by a fighter's stats.
     * power multiplies damage; attackSpeed divides startup and recovery (active frames are unchanged).
     */
    withStats({ power = 1, attackSpeed = 1 } = {}) {
        return new Attack({
            ...this,
            damage: Math.max(1, Math.round(this.damage * power)),
            startup: Math.max(1, Math.round(this.startup / attackSpeed)),
            recovery: Math.max(1, Math.round(this.recovery / attackSpeed))
        });
    }
}

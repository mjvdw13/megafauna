// ============================================================================
// COMBAT SYSTEM
// Resolves hitboxes against hurtboxes and applies the outcome: damage, stun,
// knockback, shields, armor, counters, grabs and throws. Each function returns
// an event describing what happened so the scene can play effects and sounds.
// No rendering happens here.
// ============================================================================
import { BURN, DEFENSE, KNOCKBACK_SCALE } from '../config.js';
import { checkBoxCollision } from './hitbox.js';
import { CharacterStates as S } from './states.js';

export const HitResult = Object.freeze({
    HIT: 'hit', BLOCK: 'block', ARMOR: 'armor', COUNTER: 'counter',
    SHIELD_BREAK: 'shieldBreak', GRAB: 'grab', REFLECT: 'reflect'
});

const COMBO_SCALING_STEP = 0.1;
const COMBO_SCALING_FLOOR = 0.3;
const SHIELD_PUSHBACK = 0.5;
const GRAB_ESCAPE_PUSH = 5;

/** Middle of the overlap between two boxes. */
function overlapCenter(a, b) {
    return {
        x: (Math.max(a.x, b.x) + Math.min(a.x + a.width, b.x + b.width)) / 2,
        y: (Math.max(a.y, b.y) + Math.min(a.y + a.height, b.y + b.height)) / 2
    };
}

/** Where the attacker's active hitbox touches the defender, or null. Does not change anything. */
export function findHit(attacker, defender) {
    if (!attacker.isHitboxActive() || defender.isIntangible()) return null;
    const hitbox = attacker.getAttackHitbox();
    const hurtbox = defender.getHurtbox();
    if (!checkBoxCollision(hitbox, hurtbox)) return null;
    return overlapCenter(hitbox, hurtbox);
}

/**
 * Check and apply one attacker → defender interaction for this step.
 * @returns {null | {result, attack, attacker, defender, damage, x, y}}
 */
export function resolveAttack(attacker, defender) {
    const impact = findHit(attacker, defender);
    return impact ? applyAttackHit(attacker, defender, impact) : null;
}

/** Apply an attacker's current move to a defender at `impact` (found earlier with findHit). */
export function applyAttackHit(attacker, defender, impact) {
    const attack = attacker.currentAttack;
    if (!attack) return null;
    attacker.hasHit = true;
    if (attack.grab) return startGrab(attacker, defender, impact);
    return applyHit({
        attack, attacker, defender, impact, sourceX: attacker.centerX,
        damageScale: attacker.damageScale, knockbackScale: attacker.knockbackScale
    });
}

/**
 * The shared outcome of any hit (melee or projectile).
 * @param sourceX  where the hit came from; knockback pushes away from it
 */
export function applyHit({ attack, attacker, defender, impact, sourceX, damageScale = 1, knockbackScale = 1, projectile = null }) {
    const sm = defender.stateMachine;
    const event = { attack, attacker, defender, damage: 0, x: impact.x, y: impact.y, projectile };
    const direction = Math.sign(defender.centerX - sourceX) || (attacker.facingRight ? 1 : -1);

    if (defender.isCountering()) {
        event.result = HitResult.COUNTER;
        const into = defender.currentAttack.counter.into;
        defender.facingRight = sourceX > defender.centerX;
        defender.startAttack(into);
        return event;
    }

    if (sm.isShielding()) {
        defender.shieldHP -= attack.damage * damageScale * DEFENSE.shieldDamageScale;
        if (defender.shieldHP <= 0) {
            sm.breakShield();
            event.result = HitResult.SHIELD_BREAK;
            return event;
        }
        event.result = HitResult.BLOCK;
        sm.stateData.stun = attack.blockstun;
        defender.velocityX = attack.knockback * KNOCKBACK_SCALE * SHIELD_PUSHBACK * direction / defender.weight;
        return event;
    }

    if (defender.absorbsWithArmor()) {
        event.result = HitResult.ARMOR;
        event.damage = Math.round(attack.damage * damageScale);
        defender.takeDamage(event.damage);
        defender.flash(6, 'armor');
        return event;
    }

    const comboHit = sm.isInHitstun() ? defender.comboHitCount + 1 : 1;
    const scaling = Math.max(COMBO_SCALING_FLOOR, 1 - (comboHit - 1) * COMBO_SCALING_STEP);
    event.result = HitResult.HIT;
    event.damage = Math.max(1, Math.floor(attack.damage * damageScale * scaling));
    event.comboHit = comboHit;
    defender.takeDamage(event.damage);
    defender.comboHitCount = comboHit;
    if (defender.holding) releaseGrab(defender);
    defender.cancelAttack();
    if (attack.dizzy && defender.isGrounded) {
        sm.setState(S.DIZZY, { duration: attack.dizzy });
        event.dizzy = true;
    } else if (attack.knockdown) sm.setState(S.KNOCKDOWN);
    else sm.setState(S.HITSTUN, { stunFrames: attack.hitstun });
    defender.velocityX = attack.knockback * KNOCKBACK_SCALE * knockbackScale * direction / defender.weight;
    defender.velocityY = -attack.launch * (attack.launch > 0 ? knockbackScale : 1);
    if (attack.launch > 0) { defender.isGrounded = false; defender.ground = null; }
    defender.fastFalling = false;
    defender.flash(3, 'hit');
    event.ignited = ignite(defender, attack);
    return event;
}

/** Set a fighter on fire for the attack's `burn` ticks. Returns true if they caught fire just now. */
export function ignite(defender, attack) {
    if (!attack.burn || defender.abilities.fireproof) return false;
    const wasBurning = defender.burnTicks > 0;
    defender.burnTicks = Math.min(BURN.maxTicks, Math.max(defender.burnTicks, attack.burn));
    if (!wasBurning) defender.burnTimer = BURN.interval;
    return !wasBurning;
}

// ---------------------------------------------------------------------------- grabs

function startGrab(attacker, defender, impact) {
    // Grabs only catch fighters standing on something.
    if (!defender.isGrounded || defender.stateMachine.isHanging() || defender.holding || defender.heldBy) return null;
    attacker.holding = defender;
    defender.heldBy = attacker;
    // The lower your health, the harder it is to wriggle free.
    attacker.holdTimer = DEFENSE.grab.holdFrames + Math.round((1 - defender.health / defender.maxHealth) * 40);
    defender.stateMachine.setState(S.GRABBED);
    return { result: HitResult.GRAB, attack: attacker.currentAttack, attacker, defender, damage: 0, x: impact.x, y: impact.y };
}

/** Let go of whoever `holder` is holding. Without a throw, both are pushed apart. */
export function releaseGrab(holder, { thrown = false } = {}) {
    const victim = holder.holding;
    if (!victim) return;
    holder.holding = null;
    victim.heldBy = null;
    victim.stateMachine.stateData.released = true;
    if (thrown) return;
    const dir = victim.centerX >= holder.centerX ? 1 : -1;
    victim.stateMachine.setState(S.IDLE);
    victim.velocityX = dir * GRAB_ESCAPE_PUSH;
    holder.velocityX = -dir * GRAB_ESCAPE_PUSH;
    if (holder.stateMachine.is(S.GRABBING)) holder.stateMachine.setState(S.IDLE);
}

/** Keep the held fighter in the holder's hands; count down the hold (mashing speeds it up). */
export function updateGrab(holder) {
    const victim = holder.holding;
    if (!victim) return null;
    const sm = holder.stateMachine;
    if (!sm.is(S.GRABBING) && !sm.isAttacking()) { releaseGrab(holder); return 'escape'; }
    const dir = holder.facingRight ? 1 : -1;
    victim.x = holder.centerX + dir * (holder.width / 2 + victim.width * 0.45) - victim.width / 2;
    victim.y = holder.feetY - victim.height;
    victim.facingRight = !holder.facingRight;
    const mashed = victim.input && (victim.input.attackPressed || victim.input.specialPressed || victim.input.jumpPressed
        || victim.input.smashPressed || victim.input.leftPressed || victim.input.rightPressed);
    holder.holdTimer -= 1 + (mashed ? DEFENSE.grab.mashFrames : 0);
    if (holder.holdTimer <= 0 && !sm.isAttacking()) { releaseGrab(holder); return 'escape'; }
    return null;
}

/** A pummel lands on the held fighter: a little damage, no release. */
export function applyPummel(holder, attack) {
    const victim = holder.holding;
    if (!victim) return null;
    const damage = attack.damage;
    victim.takeDamage(damage);
    victim.flash(3, 'hit');
    victim.shakeFrames = 4;
    return { result: HitResult.HIT, attack, attacker: holder, defender: victim, damage, x: victim.centerX, y: victim.y + victim.height * 0.4, pummel: true };
}

/** Throw the held fighter in the move's direction. */
export function applyThrow(holder, attack) {
    const victim = holder.holding;
    if (!victim) return null;
    const facing = holder.facingRight ? 1 : -1;
    let direction = facing;
    if (attack.throwDir === 'back') {
        direction = -facing;
        // Swing them round to the other side.
        victim.x = holder.centerX - facing * (holder.width / 2 + victim.width * 0.3) - victim.width / 2;
        holder.facingRight = !holder.facingRight;
    }
    releaseGrab(holder, { thrown: true });
    const sm = victim.stateMachine;
    const damage = attack.damage;
    victim.takeDamage(damage);
    victim.comboHitCount = 1;
    if (attack.knockdown) sm.setState(S.KNOCKDOWN);
    else sm.setState(S.HITSTUN, { stunFrames: attack.hitstun });
    const sideways = attack.throwDir === 'up' ? 0.2 : 1;
    victim.velocityX = attack.knockback * KNOCKBACK_SCALE * sideways * direction / victim.weight;
    victim.velocityY = -attack.launch;
    if (attack.launch > 0) { victim.isGrounded = false; victim.ground = null; }
    victim.flash(4, 'hit');
    const ignited = ignite(victim, attack);
    return { result: HitResult.HIT, attack, attacker: holder, defender: victim, damage, x: victim.centerX, y: victim.y + victim.height * 0.4, comboHit: 1, thrown: true, ignited };
}

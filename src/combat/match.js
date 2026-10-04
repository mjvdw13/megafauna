// ============================================================================
// MATCH
// One step of fighting, with no drawing or sound: fighters → physics →
// ledges → grabs → projectiles → hits → ring-outs. The fight scene turns the
// returned events into effects and sounds; tests and the CPU tuning script run
// the exact same code headless.
//
// Event types:
//   { type: 'fighter', fighter, event }   something a fighter did (jump, land, attackActive, dodge...)
//   { type: 'hit', hit }                  a hit, block, grab, throw... (see combat-system HitResult)
//   { type: 'projectile', projectile }    a projectile was fired
//   { type: 'projectileEnd', projectile } a projectile hit the ground / expired / hit someone
//   { type: 'splash', fighter, x, y }     a fighter fell into the pit
//   { type: 'ringOut', fighter, x, damage } a fighter left the screen and respawned
//   { type: 'grabEscape', fighter }       a held fighter broke free
// ============================================================================
import { DEFENSE, RING_OUT, SCREEN } from '../config.js';
import { clamp } from '../core/math.js';
import { Physics } from '../core/physics.js';
import { applyAttackHit, applyHit, applyPummel, applyThrow, findHit, HitResult, updateGrab } from './combat-system.js';
import { checkBoxCollision } from './hitbox.js';
import { Projectile } from './projectile.js';
import { CharacterStates as S } from './states.js';

export class Match {
    /**
     * @param stage     a Stage (stages/stage.js): layout, physics, ledges, pit
     * @param fighters  exactly two Fighters
     */
    constructor(stage, fighters) {
        this.stage = stage;
        this.fighters = fighters;
        this.physics = new Physics(stage);
        this.projectiles = [];
        this.ledges = stage.ledges.map((ledge) => ({ ...ledge, occupant: null }));
        for (const f of fighters) {
            f.physicsMain = this.physics.main;
            f.floatSurface = f.abilities.floats && stage.pit.floatable ? { left: -Infinity, right: Infinity, y: stage.floatY, solid: false, liquid: true } : null;
        }
    }

    /** Put both fighters at their spawn points and clear the field (start of each round). */
    resetPositions() {
        const spawn = this.stage.spawnPoints();
        const [a, b] = this.fighters;
        a.reset(spawn.p1, this.physics.main.y, true);
        b.reset(spawn.p2, this.physics.main.y, false);
        for (const f of this.fighters) { f.ground = this.physics.main; f.splashed = false; }
        for (const ledge of this.ledges) ledge.occupant = null;
        this.projectiles = [];
    }

    /** Advance one frame. `inputs[i]` drives fighters[i]. Returns the events that happened. */
    step(inputs) {
        const events = [];
        const [a, b] = this.fighters;
        a.update(inputs[0], b);
        b.update(inputs[1], a);
        for (const f of this.fighters) this.physics.update(f);
        this.physics.resolveCollision(a, b);
        this.updateLedges();

        for (const f of this.fighters) {
            if (f.holding && updateGrab(f) === 'escape') events.push({ type: 'grabEscape', fighter: f });
        }

        for (const f of this.fighters) {
            for (const event of f.drainEvents()) {
                events.push({ type: 'fighter', fighter: f, event });
                if (event.type === 'attackActive') this.onAttackActive(f, event, events);
            }
        }

        this.updateProjectiles(events);

        // Find both hits before applying either, so simultaneous hits trade.
        const impacts = [[a, b, findHit(a, b)], [b, a, findHit(b, a)]].filter(([, , impact]) => impact);
        for (const [attacker, defender, impact] of impacts) {
            const hit = applyAttackHit(attacker, defender, impact);
            if (hit) events.push({ type: 'hit', hit });
        }

        for (const f of this.fighters) this.checkPit(f, events);
        return events;
    }

    onAttackActive(fighter, event, events) {
        const { attack, key } = event;
        if (attack.projectile) {
            const projectile = new Projectile(fighter, attack);
            this.projectiles.push(projectile);
            events.push({ type: 'projectile', projectile });
        }
        if (attack.throwDir) {
            const hit = applyThrow(fighter, attack);
            if (hit) events.push({ type: 'hit', hit });
        } else if (key === 'pummel') {
            const hit = applyPummel(fighter, attack);
            if (hit) events.push({ type: 'hit', hit });
        }
    }

    // ------------------------------------------------------------------ ledges

    updateLedges() {
        const { reach, above, below } = DEFENSE.ledge;
        for (const f of this.fighters) {
            const sm = f.stateMachine;
            if (f.ledge || f.ledgeCooldown > 0 || f.anchored || f.isGrounded || f.heldBy) continue;
            const recovering = sm.isAttacking() && f.currentAttack?.helpless;
            const falling = (sm.is(S.FALLING) || sm.is(S.HELPLESS) || sm.is(S.JUMPING)) && f.velocityY >= -1;
            if (!recovering && !falling) continue;
            for (const ledge of this.ledges) {
                if (ledge.occupant) continue;
                // The fighter must be out over the pit, with its near side close to the ledge.
                const gap = ledge.side < 0 ? ledge.x - (f.x + f.width) : f.x - ledge.x;
                if (gap < -24 || gap > reach) continue;
                if (f.y < ledge.y - above || f.y > ledge.y + below) continue;
                this.grabLedge(f, ledge);
                break;
            }
        }
    }

    grabLedge(f, ledge) {
        ledge.occupant = f;
        f.ledge = ledge;
        f.cancelAttack();
        f.stateMachine.stateData.attackComplete = true;
        f.x = ledge.side < 0 ? ledge.x - f.width + 12 : ledge.x - 12;
        f.y = ledge.y - 16;
        f.velocityX = 0;
        f.velocityY = 0;
        f.facingRight = ledge.side < 0;
        f.stateMachine.setState(S.LEDGE);
    }

    // ------------------------------------------------------------------ projectiles

    updateProjectiles(events) {
        for (const p of this.projectiles) {
            p.update(this.physics);
            if (p.dead) continue;
            for (const target of this.fighters) {
                if (target === p.owner || p.hitTargets.has(target)) continue;
                // Reflectors (Quackers' QUACK!) send it back.
                if (target.currentAttack?.reflect && target.isHitboxActive() && checkBoxCollision(target.getAttackHitbox(), p.box())) {
                    p.reflect(target);
                    events.push({ type: 'hit', hit: { result: HitResult.REFLECT, attack: target.currentAttack, attacker: target, defender: target, damage: 0, x: p.centerX, y: p.centerY, projectile: p } });
                    break;
                }
                if (target.isIntangible() || !checkBoxCollision(p.box(), target.getHurtbox())) continue;
                const hit = applyHit({
                    attack: p.attack, attacker: p.owner, defender: target, impact: { x: p.centerX, y: p.centerY },
                    sourceX: p.centerX - p.dir * 40, projectile: p
                });
                p.hitTargets.add(target);
                events.push({ type: 'hit', hit });
                if (!p.pierce) p.end('hit');
                break;
            }
        }
        for (const p of this.projectiles) if (p.dead) events.push({ type: 'projectileEnd', projectile: p });
        this.projectiles = this.projectiles.filter((p) => !p.dead);
    }

    // ------------------------------------------------------------------ pits and ring-outs

    checkPit(f, events) {
        const main = this.physics.main;
        if (f.isGrounded && f.ground === main) f.splashed = false;
        const overPit = f.centerX < main.left || f.centerX > main.right;
        if (!f.splashed && overPit && !f.anchored && f.feetY > this.stage.pitSurfaceY && f.velocityY > 0 && !f.isGrounded) {
            f.splashed = true;
            events.push({ type: 'splash', fighter: f, x: f.centerX, y: this.stage.pitSurfaceY });
        }
        const out = f.y > SCREEN.height + RING_OUT.margin || f.x + f.width < -RING_OUT.margin || f.x > SCREEN.width + RING_OUT.margin;
        if (out) events.push(this.ringOut(f));
    }

    ringOut(f) {
        const x = clamp(f.centerX, 40, SCREEN.width - 40);
        const damage = Math.round(f.maxHealth * RING_OUT.healthFraction);
        if (f.heldBy) f.heldBy.holding = null;
        f.heldBy = null;
        if (f.ledge) f.ledge.occupant = null;
        f.takeDamage(damage);
        f.respawn((this.physics.main.left + this.physics.main.right) / 2, this.physics.main.y - RING_OUT.respawnHeight);
        f.invulnTimer = RING_OUT.respawnInvincible;
        f.splashed = false;
        return { type: 'ringOut', fighter: f, x, damage };
    }
}

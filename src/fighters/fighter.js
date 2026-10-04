// ============================================================================
// FIGHTER
// One runtime class for every character. Everything that makes a character
// unique lives in its definition object (see fighters/roster.js).
// ============================================================================
import { AttackPhase, CHARGE } from '../combat/attack.js';
import { DEFAULT_HURTBOXES, toWorldBox } from '../combat/hitbox.js';
import { buildMoveset, selectMove } from '../combat/moveset.js';
import { CharacterStateMachine } from '../combat/state-machine.js';
import { CharacterStates as S } from '../combat/states.js';
import { DEFENSE } from '../config.js';
import { easeInOutQuad, easeOutBack, easeOutQuad } from '../core/math.js';
import { blendPose, Puppet } from '../graphics/puppet.js';

const THREAT_RANGE = 260;

/** On-screen size of a character's rendered canvas; offsetY is how far it extends below the feet. */
export function spriteBoxFor(definition) {
    const { width, height, originY } = definition.rig.canvas;
    return { width, height, offsetY: height - originY };
}

const AFTERIMAGE_COUNT = 5;
const LAND_SQUASH_FRAMES = 8;

/** Rig poses used for each attack stance: neutral -> windup -> strike -> back to neutral. */
const ATTACK_POSES = {
    stand: { neutral: 'idle', windup: 'attack_windup', strike: 'attack_strike' },
    crouch: { neutral: 'crouching', windup: 'crouch_windup', strike: 'crouch_attack' },
    air: { neutral: 'falling', windup: 'air_windup', strike: 'air_attack' }
};

/** Rig pose for each state, in order of preference (rigs only need the core poses). */
const STATE_POSES = {
    running: ['running', 'walking'],
    shielding: ['shield', 'blocking'],
    rolling: ['roll', 'crouching'],
    spotdodge: ['spotdodge', 'crouching'],
    airdodge: ['airdodge', 'falling'],
    helpless: ['helpless', 'falling'],
    ledge: ['ledge', 'falling'],
    ledgeClimb: ['ledge_climb', 'getup'],
    landing: ['landing', 'crouching'],
    dizzy: ['dizzy', 'hitstun'],
    grabbing: ['grab', 'attack_strike'],
    grabbed: ['grabbed', 'hitstun']
};

export class Fighter {
    /**
     * @param definition  character definition (stats, body, moves, abilities, rig)
     * @param options.playerNumber 1 or 2
     * @param options.render       create a puppet for drawing (false for headless tests)
     * @param options.label        name tag prefix (default "P1"/"P2"; "CPU" for the computer)
     */
    constructor(definition, { playerNumber = 1, render = false, label = `P${playerNumber}` } = {}) {
        this.def = definition;
        this.id = definition.id;
        this.name = definition.name;
        this.playerNumber = playerNumber;
        this.label = label;
        this.color = definition.color;
        this.accentColor = definition.accentColor || definition.color;

        const { stats, body } = definition;
        this.maxHealth = stats.maxHealth;
        this.walkSpeed = stats.walkSpeed;
        this.runSpeed = stats.runSpeed ?? stats.walkSpeed * 1.8;
        this.jumpForce = stats.jumpForce;
        this.airJumpForce = stats.airJumpForce ?? stats.jumpForce * 0.9;
        this.airJumps = stats.airJumps ?? 1;
        this.airControl = stats.airControl;
        this.maxAirSpeed = stats.airSpeed ?? stats.walkSpeed * 1.1;
        this.maxFallSpeed = stats.fallSpeed ?? 14;
        this.weight = stats.weight;
        this.abilities = definition.abilities || {};

        this.width = body.width;
        this.height = body.height;
        this.hurtboxes = { ...DEFAULT_HURTBOXES, ...(body.hurtboxes || {}) };
        this.spriteBox = spriteBoxFor(definition);

        this.attacks = buildMoveset(definition);
        this.puppet = render ? new Puppet(definition.rig, { seed: playerNumber * 101 + definition.id.length }) : null;
        this.physicsMain = null; // the main platform, set by the match so ledge climbs know where to stand
        this.reset(0, this.height, true);
    }

    reset(centerX, groundY, facingRight) {
        this.x = centerX - this.width / 2;
        this.y = groundY - this.height;
        this.velocityX = 0;
        this.velocityY = 0;
        this.isGrounded = true;
        this.ground = this.physicsMain;
        this.justLanded = false;
        this.facingRight = facingRight;
        this.health = this.maxHealth;
        this.invincible = false;
        this.invulnTimer = 0;
        this.shieldHP = DEFENSE.shieldMax;
        this.airJumpsLeft = this.airJumps;
        this.airDodgeUsed = false;
        this.fastFalling = false;
        this.gliding = false;
        this.gravityScale = 1;
        this.dropTimer = 0;
        this.anchored = false;
        this.ledge = null;
        this.ledgeCooldown = 0;
        this.holding = null;
        this.heldBy = null;
        this.holdTimer = 0;
        this.bufferedThrow = null;
        this.comboHitCount = 0;
        this.input = null;
        this.cancelAttack();
        // Presentation state
        this.events = [];
        this.trail = [];
        this.flashFrames = 0;
        this.flashKind = 'hit';
        this.landTimer = 0;
        this.shakeFrames = 0;
        this.attackFromPose = null;
        this.stateMachine = new CharacterStateMachine(this);
        this.onStateChange(S.IDLE);
    }

    /** Back in the fight after a ring-out: dropped in from above, keeping current health. */
    respawn(centerX, groundY) {
        const health = this.health;
        this.reset(centerX, groundY, this.facingRight);
        this.health = health;
        this.isGrounded = false;
        this.ground = null;
        this.airJumpsLeft = this.airJumps;
        this.stateMachine.setState(S.FALLING);
    }

    /** Called by the state machine whenever the state changes. */
    onStateChange(state) {
        if (!this.puppet) return;
        const name = (STATE_POSES[state] || [state]).find((n) => this.puppet.has(n)) || 'idle';
        this.puppet.play(name, { speed: state === S.RUNNING ? 1.7 : 1 });
    }

    get centerX() { return this.x + this.width / 2; }
    get feetY() { return this.y + this.height; }

    // ------------------------------------------------------------------ update

    update(input, opponent) {
        this.input = input;
        if (this.justLanded) {
            this.airJumpsLeft = this.airJumps;
            this.airDodgeUsed = false;
            this.landTimer = LAND_SQUASH_FRAMES;
            this.events.push({ type: 'land' });
        }
        if (this.ledgeCooldown > 0) this.ledgeCooldown--;
        if (this.invulnTimer > 0) this.invulnTimer--;
        if (!this.stateMachine.isShielding()) this.shieldHP = Math.min(DEFENSE.shieldMax, this.shieldHP + DEFENSE.shieldRegen);

        this.gliding = false; // the air state turns it back on each frame while gliding
        this.handleAttackInput(input);
        this.stateMachine.update(input);
        if (this.stateMachine.isAttacking()) this.advanceAttack(input);
        if (opponent && this.stateMachine.canAct() && !this.stateMachine.is(S.RUNNING) && opponent.centerX !== this.centerX) {
            this.facingRight = this.centerX < opponent.centerX;
        }
        this.updatePresentation();
    }

    /** Animation-only update, used while the round is over and fighters are posing. */
    updateAnimationOnly() { this.updatePresentation(); }

    handleAttackInput(input) {
        const sm = this.stateMachine;
        let choice = null;
        if (sm.is(S.GRABBING)) {
            choice = selectMove(input, { holding: true, facingRight: this.facingRight }) || this.bufferedThrow;
            this.bufferedThrow = null;
        } else if (sm.isAttacking() && this.currentAttack?.grab && this.holding) {
            // A throw pressed while the grab is still closing comes out as soon as it can.
            this.bufferedThrow = selectMove(input, { holding: true, facingRight: this.facingRight }) || this.bufferedThrow;
        } else if (sm.isShielding()) {
            if (input.attackPressed && sm.stateData.stun <= 0) choice = { key: 'grab', turn: 0 };
        } else if (sm.canAttack()) {
            choice = selectMove(input, { grounded: this.isGrounded && !sm.isAirborne(), running: sm.is(S.RUNNING), facingRight: this.facingRight });
        } else if (sm.isAttacking() && this.currentAttack?.chain && input.attackPressed) {
            this.chainQueued = true;
        }
        if (!choice) return;
        if (choice.turn) this.facingRight = choice.turn > 0;
        this.startAttack(choice.key);
    }

    startAttack(key) {
        const attack = this.attacks[key];
        const sm = this.stateMachine;
        if (!attack) return false;
        if (sm.isAttacking()) sm.stateData.attackComplete = true; // continuing a chain
        if (!sm.setState(S.ATTACKING)) return false;
        this.currentAttack = attack;
        this.attackKey = key;
        this.attackFrame = 0;
        this.hasHit = false;
        this.armorHitsTaken = 0;
        this.chargeFrames = 0;
        this.damageScale = 1;
        this.knockbackScale = 1;
        this.chainQueued = false;
        this.attackFromPose = this.puppet?.pose ?? null;
        this.events.push({ type: 'attackStart', attack });
        return true;
    }

    advanceAttack(input) {
        const attack = this.currentAttack;
        const sm = this.stateMachine;
        if (!attack) { sm.stateData.attackComplete = true; return; }

        // Smash attacks hold at the end of their windup while the button stays down.
        if (attack.charge && this.attackFrame === attack.chargeFrame && input?.smash && this.chargeFrames < CHARGE.maxFrames) {
            this.chargeFrames++;
            const k = this.chargeFrames / CHARGE.maxFrames;
            this.damageScale = 1 + CHARGE.damage * k;
            this.knockbackScale = 1 + CHARGE.knockback * k;
            if (this.chargeFrames % 12 === 1) this.events.push({ type: 'charging', level: k });
            return;
        }

        this.attackFrame++;
        this.applyAttackMovement(attack);
        if (this.attackFrame === attack.startup) this.events.push({ type: 'attackActive', attack, key: this.attackKey });
        // Multi-hit moves can connect again every `rehit` frames.
        if (attack.rehit && attack.isHitboxActive(this.attackFrame) && (this.attackFrame - attack.startup) % attack.rehit === 0) this.hasHit = false;

        if (this.chainQueued && attack.chain && this.attackFrame >= attack.startup + attack.active) {
            this.startAttack(attack.chain);
            return;
        }
        if (attack.endsOnLanding && this.justLanded && this.attackFrame > 1) {
            sm.stateData.attackComplete = true;
            this.cancelAttack();
            sm.setState(S.LANDING, { duration: Math.max(DEFENSE.landingLag, attack.landingLag) });
            return;
        }
        if (this.attackFrame >= attack.getTotalFrames()) {
            sm.stateData.attackComplete = true;
            sm.stateData.helpless = attack.helpless && !this.isGrounded;
            this.cancelAttack();
        }
    }

    applyAttackMovement(attack) {
        const movement = attack.movement;
        if (!movement) return;
        const dir = this.facingRight ? 1 : -1;
        const set = (v) => {
            if (v.vx !== undefined) this.velocityX = v.vx * dir;
            if (v.vy !== undefined) {
                this.velocityY = v.vy;
                if (v.vy < 0) { this.isGrounded = false; this.ground = null; }
            }
        };
        if (this.attackFrame === 1 && movement.start) set(movement.start);
        const phaseMove = movement[attack.phaseAt(this.attackFrame)];
        if (phaseMove && this.attackFrame > 1) set(phaseMove);
    }

    cancelAttack() {
        this.currentAttack = null;
        this.attackKey = null;
        this.attackFrame = 0;
        this.hasHit = false;
        this.armorHitsTaken = 0;
        this.chargeFrames = 0;
        this.damageScale = 1;
        this.knockbackScale = 1;
        this.chainQueued = false;
    }

    updatePresentation() {
        if (this.flashFrames > 0) this.flashFrames--;
        if (this.landTimer > 0) this.landTimer--;
        if (!this.puppet) return;
        const dir = this.facingRight ? 1 : -1;
        this.puppet.update([this.velocityX * dir, this.velocityY]);

        // Footstep events (heavy characters kick up dust on each step).
        const stepFrames = this.def.rig.stepFrames || 12;
        if (this.stateMachine.isWalking() && Math.floor(this.puppet.stateTime) % stepFrames === 0) this.events.push({ type: 'step' });

        // Afterimage trail for moves flagged with afterimages.
        if (this.trailActive()) {
            this.trail.push({ x: this.x, y: this.y, pose: this.currentPose(), facingRight: this.facingRight, transform: this.poseTransform() });
            if (this.trail.length > AFTERIMAGE_COUNT) this.trail.shift();
        } else if (this.trail.length) {
            this.trail.shift();
        }
    }

    trailActive() {
        const attack = this.currentAttack;
        if (this.stateMachine.is(S.ROLLING) || this.stateMachine.is(S.AIRDODGE)) return true;
        return !!attack && attack.afterimages && attack.phaseAt(this.attackFrame) !== AttackPhase.STARTUP;
    }

    // ------------------------------------------------------------------ combat queries

    get attackPhase() { return this.currentAttack ? this.currentAttack.phaseAt(this.attackFrame) : null; }

    isHitboxActive() {
        const a = this.currentAttack;
        return !!a?.hitbox && !this.hasHit && !a.throwDir && this.attackKey !== 'pummel' && a.isHitboxActive(this.attackFrame);
    }

    getAttackHitbox() {
        return this.currentAttack?.hitbox ? toWorldBox(this, this.currentAttack.hitbox) : null;
    }

    getHurtbox() {
        let box = this.hurtboxes.standing;
        const sm = this.stateMachine;
        if (sm.isCrouching() || sm.is(S.LANDING) || sm.is(S.SPOTDODGE) || sm.is(S.ROLLING)) box = this.hurtboxes.crouching;
        else if (sm.isAirborne() || sm.isHanging() || !this.isGrounded) box = this.hurtboxes.airborne;
        return toWorldBox(this, box);
    }

    /** Can't be hit right now (dodging, respawning, getting up, burrowed...). */
    isIntangible() {
        if (this.invincible || this.invulnTimer > 0 || this.stateMachine.isDodgeIntangible()) return true;
        return !!this.currentAttack && this.currentAttack.intangible.includes(this.attackPhase);
    }

    isHidden() { return !!this.currentAttack && this.currentAttack.hidden.includes(this.attackPhase); }

    /** True while this fighter's attack is coming out close enough that the opponent should guard. */
    threatens(other) {
        const attack = this.currentAttack;
        if (!attack || attack.grab || attack.phaseAt(this.attackFrame) === AttackPhase.RECOVERY) return false;
        return Math.abs(this.centerX - other.centerX) < THREAT_RANGE;
    }

    /** Is this fighter's counter move ready to catch a hit? */
    isCountering() {
        return !!this.currentAttack?.counter && this.attackPhase === AttackPhase.ACTIVE;
    }

    /** Consume one hit of super armor if the current move has any left. */
    absorbsWithArmor() {
        const attack = this.currentAttack;
        if (!attack || this.armorHitsTaken >= attack.armor) return false;
        if (attack.phaseAt(this.attackFrame) === AttackPhase.RECOVERY) return false;
        this.armorHitsTaken++;
        return true;
    }

    takeDamage(amount) { this.health = Math.max(0, this.health - amount); }
    isDead() { return this.health <= 0; }
    flash(frames, kind = 'hit') { this.flashFrames = frames; this.flashKind = kind; }

    drainEvents() {
        const events = this.events;
        this.events = [];
        return events;
    }

    // ------------------------------------------------------------------ rendering

    /** The rig pose to draw this frame. */
    currentPose() {
        if (this.stateMachine.isAttacking() && this.currentAttack) return this.attackPose();
        if (this.gliding && this.puppet.has('glide')) return this.puppet.poseFor('glide');
        return this.puppet.currentPose();
    }

    /**
     * Attack poses follow the attack's frame data, so the swing always lines up with the hitbox:
     * ease into the windup during startup, snap to the strike when active, settle during recovery.
     */
    attackPose() {
        const attack = this.currentAttack;
        const names = ATTACK_POSES[attack.pose] || ATTACK_POSES.stand;
        const frame = this.attackFrame;
        const puppet = this.puppet;
        const windup = puppet.poseForFirst([attack.poses?.startup, names.windup, names.neutral], frame);
        const strike = puppet.poseForFirst([attack.poses?.active, names.strike], frame);
        const settle = puppet.poseForFirst([attack.poses?.recovery, names.neutral], puppet.time);
        const phase = attack.phaseAt(frame);
        const t = attack.phaseProgress(frame);
        if (phase === AttackPhase.STARTUP) return blendPose(this.attackFromPose || windup, windup, easeOutQuad(Math.min(1, t * 1.3)));
        if (phase === AttackPhase.ACTIVE) return blendPose(windup, strike, easeOutQuad(Math.min(1, (frame - attack.startup + 1) / 2)));
        return blendPose(strike, settle, easeInOutQuad(t));
    }

    /** Procedural squash/stretch and offsets layered on top of the sprite art. */
    poseTransform() {
        const pose = { dx: 0, dy: 0, scaleX: 1, scaleY: 1, flip: false, rotate: 0, alpha: 1 };
        const attack = this.currentAttack;
        const sm = this.stateMachine;
        if (sm.isAttacking() && attack) {
            const { lean, lunge, squash, spin, roll } = attack.anim;
            const phase = attack.phaseAt(this.attackFrame);
            const t = attack.phaseProgress(this.attackFrame);
            if (phase === AttackPhase.STARTUP) {
                // Anticipation: pull back and compress (charging smash attacks tremble).
                pose.dx = -lean * easeOutQuad(t) + (this.chargeFrames ? Math.sin(this.chargeFrames * 1.7) * 1.5 : 0);
                pose.scaleX = 1 + squash * t;
                pose.scaleY = 1 - squash * t;
            } else if (phase === AttackPhase.ACTIVE) {
                // Strike: snap forward with a small overshoot and stretch.
                const snap = easeOutBack(Math.min(1, t * 2 + 0.35));
                pose.dx = lunge * snap;
                pose.scaleX = 1 + squash * 1.2;
                pose.scaleY = 1 - squash * 0.6;
                if (spin) pose.flip = Math.floor(this.attackFrame / 3) % 2 === 1;
                if (roll) pose.rotate = roll * t * Math.PI * 2;
            } else {
                // Recovery: ease back to neutral.
                const k = 1 - easeInOutQuad(t);
                pose.dx = lunge * k;
                pose.scaleX = 1 + squash * 1.2 * k;
                pose.scaleY = 1 - squash * 0.6 * k;
            }
        } else if (sm.isInHitstun() || sm.is(S.GRABBED)) {
            const t = Math.min(1, sm.stateTime / Math.max(1, sm.stateData.stunFrames || 20));
            pose.dx = -7 * (1 - easeOutQuad(t));
            pose.scaleX = 1 - 0.05 * (1 - t);
            pose.scaleY = 1 + 0.04 * (1 - t);
            if (sm.is(S.GRABBED)) pose.dx = Math.sin(sm.stateTime * 0.9) * 2;
        } else if (sm.is(S.ROLLING)) {
            // Tuck into a ball and roll.
            const t = Math.min(1, sm.stateTime / DEFENSE.roll.frames);
            pose.rotate = sm.stateData.dir * easeInOutQuad(t) * Math.PI * 2 * (this.facingRight ? 1 : -1);
            pose.scaleY = 0.85;
        }
        if (sm.is(S.SPOTDODGE) || sm.is(S.AIRDODGE)) pose.alpha = sm.isDodgeIntangible() ? 0.45 : 0.8;
        if (this.landTimer > 0) {
            const k = (this.landTimer / LAND_SQUASH_FRAMES) * (this.def.landSquash ?? 0.12);
            pose.scaleX *= 1 + k;
            pose.scaleY *= 1 - k;
        }
        return pose;
    }

    drawSprite(ctx, image, x, y, facingRight, pose, alpha = 1) {
        const { width, height, offsetY } = this.spriteBox;
        ctx.save();
        ctx.globalAlpha = alpha * (pose.alpha ?? 1);
        if (pose.rotate) {
            // Spin around the middle of the body rather than the feet.
            ctx.translate(x + this.width / 2, y + this.height / 2);
            ctx.rotate(pose.rotate);
            ctx.translate(0, this.height / 2 + offsetY);
        } else {
            ctx.translate(x + this.width / 2, y + this.height + offsetY);
        }
        if (!facingRight !== pose.flip) ctx.scale(-1, 1);
        ctx.scale(pose.scaleX, pose.scaleY);
        ctx.drawImage(image, -width / 2 + pose.dx, -height + pose.dy, width, height);
        ctx.restore();
    }

    render(ctx) {
        if (!this.puppet) return this.renderFallback(ctx);
        if (this.isHidden()) return this.renderNameTag(ctx);
        const jitter = this.shakeFrames > 0 ? (Math.random() - 0.5) * 6 : 0;
        const x = this.x + jitter;
        const transform = this.poseTransform();
        const pose = this.currentPose();

        // Afterimages, oldest (faintest) first.
        this.trail.forEach((ghost, i) => {
            const image = this.puppet.renderFlat(ghost.pose, this.accentColor);
            this.drawSprite(ctx, image, ghost.x, ghost.y, ghost.facingRight, ghost.transform, 0.1 + 0.07 * i);
        });

        const blinking = (this.invincible || this.invulnTimer > 0) && Math.floor(this.stateMachine.stateTime / 3) % 2 === 0;
        this.drawSprite(ctx, this.puppet.render(pose), x, this.y, this.facingRight, transform, blinking ? 0.55 : 1);

        // Silhouette overlays: white hit flash, orange armor flash, golden charge glow.
        const overlay = this.overlayTint();
        if (overlay) this.drawSprite(ctx, this.puppet.renderFlat(pose, overlay.color), x, this.y, this.facingRight, transform, overlay.alpha);

        if (this.stateMachine.isShielding()) this.renderShield(ctx);
        if (this.stateMachine.is(S.DIZZY)) this.renderDizzyStars(ctx);
        this.renderNameTag(ctx);
    }

    overlayTint() {
        if (this.flashFrames > 0) {
            return this.flashKind === 'armor' ? { color: '#ff9f43', alpha: 0.7 } : { color: '#ffffff', alpha: 0.85 };
        }
        if (this.chargeFrames > 0) return { color: '#fff3a8', alpha: 0.2 + 0.25 * Math.abs(Math.sin(this.chargeFrames * 0.35)) };
        return null;
    }

    /** A bubble around the body that shrinks as the shield wears down. */
    renderShield(ctx) {
        const k = Math.max(0.15, this.shieldHP / DEFENSE.shieldMax);
        const r = Math.max(this.width, this.height) * 0.62 * (0.55 + 0.45 * k);
        const cx = this.centerX, cy = this.y + this.height * 0.55;
        ctx.save();
        ctx.globalAlpha = 0.28 + 0.12 * Math.sin(this.stateMachine.stateTime * 0.3);
        ctx.fillStyle = this.accentColor;
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2a1d17';
        ctx.stroke();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }

    renderDizzyStars(ctx) {
        const t = this.stateMachine.stateTime * 0.12;
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const a = t + (i * Math.PI * 2) / 3;
            const sx = this.centerX + Math.cos(a) * 30, sy = this.y - 12 + Math.sin(a) * 8;
            ctx.fillStyle = '#ffe14d';
            ctx.strokeStyle = '#2a1d17';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let p = 0; p < 10; p++) {
                const r = p % 2 === 0 ? 8 : 3.5, pa = (p / 10) * Math.PI * 2 - Math.PI / 2;
                const px = sx + Math.cos(pa) * r, py = sy + Math.sin(pa) * r;
                if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }

    renderNameTag(ctx) {
        ctx.save();
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        const label = `${this.label} ${this.name}`;
        const y = this.y - 14;
        ctx.strokeText(label, this.centerX, y);
        ctx.fillStyle = this.playerNumber === 1 ? '#85c1e9' : '#f1948a';
        ctx.fillText(label, this.centerX, y);
        ctx.restore();
    }

    renderFallback(ctx) {
        ctx.fillStyle = this.flashFrames > 0 ? '#fff' : this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        this.renderNameTag(ctx);
    }
}

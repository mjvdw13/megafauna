// ============================================================================
// CHARACTER STATE MACHINE
// Owns which state a fighter is in and the transitions driven by input.
// Each state has a handler: enter / update / exit. Combat outcomes (hitstun,
// knockdown, grabs, shield breaks) are pushed in from outside with setState.
// ============================================================================
import { DEFENSE } from '../config.js';
import { CharacterStates as S } from './states.js';

/** States anything can force a fighter into (even mid-attack). */
const FORCED_STATES = new Set([S.HITSTUN, S.KNOCKDOWN, S.GRABBED, S.DIZZY, S.LEDGE, S.VICTORY, S.DEFEAT]);
const END_STATES = new Set([S.VICTORY, S.DEFEAT]);
const KNOCKDOWN_FRAMES = 45;
const GETUP_FRAMES = 30;
const LEDGE_INPUT_DELAY = 8;
const AIR_DRIFT_DECAY = 0.93;
const RUN_MOMENTUM_DECAY = 0.97;

const GROUND_NEUTRAL = [S.IDLE, S.WALKING, S.RUNNING, S.CROUCHING];

// ---------------------------------------------------------------------------- shared behaviors

/** Steering in the air, capped at the fighter's air speed (knockback can still exceed it). */
function airControl(c, input, scale = 1) {
    if (!input.horizontal) return;
    const next = c.velocityX + input.horizontal * c.airControl * scale;
    const cap = c.maxAirSpeed;
    if (Math.abs(next) <= cap || Math.abs(next) < Math.abs(c.velocityX)) c.velocityX = next;
    else if (Math.abs(c.velocityX) < cap) c.velocityX = Math.sign(next) * cap;
}

/**
 * Free-falling (not launched): letting go of the direction bleeds off drift, so you can drop
 * straight down to a ledge. Extra speed carried from a run bleeds off too, more gently.
 */
function airDrift(c, input) {
    if (input.horizontal) return;
    c.velocityX *= Math.abs(c.velocityX) <= c.maxAirSpeed * 1.05 ? AIR_DRIFT_DECAY : RUN_MOMENTUM_DECAY;
}

function groundNeutral(sm, input) {
    const c = sm.character;
    const state = sm.currentState;
    if (!c.isGrounded) return sm.setState(S.FALLING);
    if (input.shield && c.shieldHP > 0) return sm.setState(S.SHIELDING);
    if (input.jumpPressed) return sm.jump(input);
    if (input.downPressed && c.ground && !c.ground.solid) return sm.dropThrough();
    if (input.dash) return sm.setState(S.RUNNING, { dir: input.dash });

    if (state === S.RUNNING) {
        const { dir } = sm.stateData;
        if (input.horizontal === dir) {
            c.velocityX = dir * c.runSpeed;
            c.facingRight = dir > 0;
            return;
        }
        return sm.setState(input.horizontal ? S.WALKING : S.IDLE);
    }
    if (input.down) {
        if (state !== S.CROUCHING) sm.setState(S.CROUCHING);
        return;
    }
    if (input.horizontal !== 0) {
        if (state !== S.WALKING) sm.setState(S.WALKING);
        c.velocityX = input.horizontal * c.walkSpeed;
        return;
    }
    if (state !== S.IDLE) sm.setState(S.IDLE);
}

function airborne(sm, input) {
    const c = sm.character;
    if (c.isGrounded) return sm.setState(input.down ? S.CROUCHING : S.IDLE);
    airControl(c, input);
    airDrift(c, input);
    if (input.jumpPressed && c.airJumpsLeft > 0) return sm.airJump(input);
    if (input.shieldPressed && !c.airDodgeUsed) return sm.setState(S.AIRDODGE, { dir: [input.horizontal, input.vertical] });
    if (input.downPressed && c.velocityY > -3) {
        c.fastFalling = true;
        c.velocityY = Math.max(c.velocityY, 8);
    }
    // Gliders (Quackers) sail down slowly while holding jump.
    if (c.abilities.glide && input.jump && c.velocityY > 0 && !c.fastFalling) {
        c.velocityY = Math.min(c.velocityY, 1.6);
        const dir = c.facingRight ? 1 : -1;
        if (Math.abs(c.velocityX) < 4.5 || Math.sign(c.velocityX) !== dir) c.velocityX = dir * 4.5;
        c.gliding = true;
    } else {
        c.gliding = false;
    }
    if (sm.currentState === S.JUMPING && c.velocityY >= 0) sm.setState(S.FALLING);
}

/** Handlers per state. `duration` (frames) makes a state locked until it has run its course. */
const HANDLERS = {
    [S.IDLE]: { update: groundNeutral },
    [S.WALKING]: { update: groundNeutral },
    [S.CROUCHING]: { update: groundNeutral },
    [S.RUNNING]: {
        enter(sm) { sm.character.facingRight = sm.stateData.dir > 0; },
        update: groundNeutral
    },
    [S.JUMPING]: { update: airborne },
    [S.FALLING]: { update: airborne },

    [S.ATTACKING]: {
        update(sm, input) {
            const c = sm.character;
            if (!c.isGrounded) airControl(c, input, c.currentAttack?.helpless ? 0.5 : 1);
            if (sm.stateData.attackComplete) sm.toNeutral(input);
        }
    },

    [S.LANDING]: {
        update(sm, input) { if (sm.stateTime >= sm.stateData.duration) sm.toNeutral(input); }
    },

    [S.SHIELDING]: {
        enter(sm) { sm.stateData.stun ??= 0; },
        update(sm, input) {
            const c = sm.character;
            const d = sm.stateData;
            if (!c.isGrounded) return sm.setState(S.FALLING);
            if (d.stun > 0) { d.stun--; return; }
            if (input.jumpPressed) return sm.jump(input);
            if (!input.shield) return sm.setState(S.IDLE);
            if (input.leftPressed || input.rightPressed) return sm.setState(S.ROLLING, { dir: input.leftPressed ? -1 : 1 });
            if (input.downPressed) return sm.setState(S.SPOTDODGE);
            c.shieldHP -= DEFENSE.shieldDecay;
            if (c.shieldHP <= 0) sm.breakShield();
        }
    },

    [S.ROLLING]: {
        enter(sm) { sm.stateData.duration = DEFENSE.roll.frames; sm.character.events.push({ type: 'dodge' }); },
        update(sm, input) {
            const c = sm.character;
            const t = sm.stateTime;
            c.velocityX = t >= 2 && t < DEFENSE.roll.frames - 6 ? sm.stateData.dir * DEFENSE.roll.speed : c.velocityX * 0.5;
            if (t >= sm.stateData.duration) sm.toNeutral(input);
        }
    },

    [S.SPOTDODGE]: {
        enter(sm) { sm.stateData.duration = DEFENSE.spotDodge.frames; sm.character.events.push({ type: 'dodge' }); },
        update(sm, input) { if (sm.stateTime >= sm.stateData.duration) sm.toNeutral(input); }
    },

    [S.AIRDODGE]: {
        enter(sm) {
            const c = sm.character;
            const d = sm.stateData;
            d.duration = DEFENSE.airDodge.frames;
            c.airDodgeUsed = true;
            c.fastFalling = false;
            const [dx, dy] = d.dir;
            const len = Math.hypot(dx, dy);
            if (len) {
                c.velocityX = (dx / len) * DEFENSE.airDodge.speed;
                c.velocityY = (dy / len) * DEFENSE.airDodge.speed;
                c.gravityScale = 0;
            } else {
                c.velocityY *= 0.3;
            }
            c.events.push({ type: 'dodge' });
        },
        update(sm, input) {
            const c = sm.character;
            if (sm.stateTime < 14 && c.gravityScale === 0) { c.velocityX *= 0.9; c.velocityY *= 0.9; } else c.gravityScale = 1;
            if (c.isGrounded) return sm.setState(S.LANDING, { duration: 8 });
            if (sm.stateTime >= sm.stateData.duration) sm.setState(S.FALLING);
        },
        exit(sm) { sm.character.gravityScale = 1; }
    },

    [S.HELPLESS]: {
        update(sm, input) {
            const c = sm.character;
            if (c.isGrounded) return sm.setState(S.LANDING, { duration: DEFENSE.helplessLandingLag });
            airControl(c, input, 0.6);
            airDrift(c, input);
        }
    },

    [S.LEDGE]: {
        enter(sm) {
            const c = sm.character;
            c.anchored = true;
            c.airJumpsLeft = c.airJumps;
            c.airDodgeUsed = false;
            c.fastFalling = false;
            c.events.push({ type: 'ledgeGrab' });
        },
        update(sm, input) {
            const c = sm.character;
            const ledge = c.ledge;
            if (!ledge) return sm.letGoOfLedge();
            if (sm.stateTime < LEDGE_INPUT_DELAY) return;
            const toward = -ledge.side; // the stage is on the other side of the ledge
            if (input.jumpPressed) {
                sm.letGoOfLedge();
                c.y = ledge.y - c.height * 0.7;
                c.velocityY = -c.jumpForce * 0.95;
                c.velocityX = toward * 2.5;
                c.events.push({ type: 'jump' });
                return sm.setState(S.JUMPING, { fromLedge: true });
            }
            if (input.up || input.attackPressed || input.horizontal === toward) return sm.setState(S.LEDGE_CLIMB);
            if (input.down || input.horizontal === -toward || sm.stateTime > DEFENSE.ledge.maxHang) {
                sm.letGoOfLedge();
                c.velocityY = 2;
                return sm.setState(S.FALLING);
            }
        },
        exit(sm, next) { if (next !== S.LEDGE_CLIMB) sm.letGoOfLedge(); }
    },

    [S.LEDGE_CLIMB]: {
        enter(sm) {
            const c = sm.character;
            const ledge = c.ledge;
            sm.stateData.duration = DEFENSE.ledge.climbFrames;
            sm.stateData.from = [c.x, c.y];
            sm.stateData.to = [ledge.side < 0 ? ledge.x + 8 : ledge.x - c.width - 8, ledge.y - c.height];
        },
        update(sm, input) {
            const c = sm.character;
            const { from, to, duration } = sm.stateData;
            const t = Math.min(1, sm.stateTime / duration);
            c.x = from[0] + (to[0] - from[0]) * t;
            c.y = from[1] + (to[1] - from[1]) * Math.min(1, t * 1.6);
            if (sm.stateTime >= duration) {
                sm.letGoOfLedge();
                c.x = to[0];
                c.y = to[1];
                c.isGrounded = true;
                c.ground = c.physicsMain;
                sm.toNeutral(input);
            }
        },
        exit(sm) { sm.character.anchored = false; }
    },

    [S.GRABBING]: { update(sm) { sm.character.velocityX = 0; } },
    [S.GRABBED]: {
        enter(sm) { sm.character.anchored = true; sm.character.cancelAttack(); },
        exit(sm) { sm.character.anchored = false; }
    },

    [S.DIZZY]: {
        update(sm, input) {
            const d = sm.stateData;
            if (input.attackPressed || input.specialPressed || input.jumpPressed) d.duration -= 3; // mash to recover sooner
            if (sm.stateTime >= d.duration) sm.toNeutral(input);
        }
    },

    [S.HITSTUN]: {
        update(sm, input) {
            const c = sm.character;
            if (!c.isGrounded) airControl(c, input, 0.25); // a little drift
            if (sm.stateTime >= sm.stateData.stunFrames) {
                c.comboHitCount = 0;
                sm.toNeutral(input);
            }
        }
    },

    [S.KNOCKDOWN]: {
        enter(sm) { sm.stateData.knockdownFrames ??= KNOCKDOWN_FRAMES; sm.character.invincible = true; },
        update(sm) {
            const c = sm.character;
            if (sm.stateTime >= sm.stateData.knockdownFrames && c.isGrounded) {
                c.comboHitCount = 0;
                sm.setState(S.GETUP);
            }
        }
    },

    [S.GETUP]: {
        enter(sm) { sm.stateData.getupFrames ??= GETUP_FRAMES; sm.character.invincible = true; },
        update(sm) { if (sm.stateTime >= sm.stateData.getupFrames) sm.setState(S.IDLE); },
        exit(sm) { sm.character.invincible = false; }
    },

    [S.VICTORY]: {},
    [S.DEFEAT]: {}
};

export class CharacterStateMachine {
    constructor(character) {
        this.character = character;
        this.currentState = S.IDLE;
        this.stateTime = 0;
        this.stateData = {};
    }

    setState(newState, data = {}) {
        if (!this.canTransitionTo(newState)) return false;
        const previous = this.currentState;
        HANDLERS[previous]?.exit?.(this, newState);
        this.currentState = newState;
        this.stateTime = 0;
        this.stateData = data;
        HANDLERS[newState]?.enter?.(this);
        this.character.onStateChange?.(newState, previous);
        return true;
    }

    canTransitionTo(newState) {
        if (END_STATES.has(this.currentState)) return false;
        if (FORCED_STATES.has(newState)) return true;
        const d = this.stateData;
        switch (this.currentState) {
            case S.ATTACKING: return !!d.attackComplete;
            case S.HITSTUN: return this.stateTime >= d.stunFrames;
            case S.KNOCKDOWN: return this.stateTime >= d.knockdownFrames;
            case S.GETUP: return this.stateTime >= d.getupFrames;
            case S.GRABBED: return !!d.released;
            default: return d.duration === undefined || this.stateTime >= d.duration;
        }
    }

    /** Return to a neutral state appropriate for where the fighter is. */
    toNeutral(input) {
        const c = this.character;
        if (c.holding) this.setState(S.GRABBING);
        else if (!c.isGrounded) this.setState(this.stateData.helpless ? S.HELPLESS : S.FALLING);
        else if (input.down) this.setState(S.CROUCHING);
        else this.setState(S.IDLE);
    }

    update(input) {
        this.stateTime++;
        HANDLERS[this.currentState]?.update?.(this, input);
    }

    // ------------------------------------------------------------------ actions

    jump(input) {
        const c = this.character;
        c.velocityY = -c.jumpForce;
        if (input.horizontal) c.velocityX = input.horizontal * Math.max(Math.abs(c.velocityX), c.walkSpeed * 0.9);
        c.isGrounded = false;
        c.ground = null;
        c.events.push({ type: 'jump' });
        return this.setState(S.JUMPING);
    }

    airJump(input) {
        const c = this.character;
        const used = c.airJumps - c.airJumpsLeft;
        c.airJumpsLeft--;
        // Multi-jumpers get a little less height from each extra flap.
        c.velocityY = -c.airJumpForce * Math.pow(0.92, used);
        c.velocityX = input.horizontal * c.maxAirSpeed * 0.8;
        c.fastFalling = false;
        c.events.push({ type: 'jump', double: true });
        this.setState(S.JUMPING);
        this.stateTime = 0;
        return true;
    }

    dropThrough() {
        const c = this.character;
        c.dropTimer = 14;
        c.isGrounded = false;
        c.ground = null;
        c.y += 2;
        return this.setState(S.FALLING);
    }

    breakShield() {
        const c = this.character;
        c.shieldHP = DEFENSE.shieldMax * 0.4;
        c.velocityY = -8;
        c.isGrounded = false;
        c.events.push({ type: 'shieldBreak' });
        return this.setState(S.DIZZY, { duration: DEFENSE.shieldBreakFrames });
    }

    letGoOfLedge() {
        const c = this.character;
        if (c.ledge) c.ledge.occupant = null;
        c.ledge = null;
        c.anchored = false;
        c.ledgeCooldown = DEFENSE.ledge.cooldown;
    }

    // ------------------------------------------------------------------ queries

    is(state) { return this.currentState === state; }
    isIdle() { return this.is(S.IDLE); }
    isWalking() { return this.is(S.WALKING) || this.is(S.RUNNING); }
    isCrouching() { return this.is(S.CROUCHING); }
    isAttacking() { return this.is(S.ATTACKING); }
    isShielding() { return this.is(S.SHIELDING); }
    isInHitstun() { return this.is(S.HITSTUN); }
    isKnockedDown() { return this.is(S.KNOCKDOWN) || this.is(S.GETUP); }
    isAirborne() { return this.is(S.JUMPING) || this.is(S.FALLING) || this.is(S.HELPLESS) || this.is(S.AIRDODGE); }
    isHanging() { return this.is(S.LEDGE) || this.is(S.LEDGE_CLIMB); }
    /** Grounded neutral states where any action may start. */
    canAct() { return GROUND_NEUTRAL.includes(this.currentState); }
    /** Aerials are also allowed while jumping or falling. */
    canAttack() { return this.canAct() || this.is(S.JUMPING) || this.is(S.FALLING); }

    /** Dodges and ledge actions make the fighter briefly untouchable. */
    isDodgeIntangible() {
        const t = this.stateTime;
        const within = ([a, b]) => t >= a && t <= b;
        switch (this.currentState) {
            case S.ROLLING: return within(DEFENSE.roll.intangible);
            case S.SPOTDODGE: return within(DEFENSE.spotDodge.intangible);
            case S.AIRDODGE: return within(DEFENSE.airDodge.intangible);
            case S.LEDGE: return t < DEFENSE.ledge.intangible;
            case S.LEDGE_CLIMB: return true;
            default: return false;
        }
    }
}

// ============================================================================
// CPU CONTROLLER
// Drives a fighter by producing the same input object a keyboard player does,
// so the CPU plays by exactly the same rules (frame data, shields, ledges).
//
// It "sees" the opponent through a delay (its reaction time; a shorter one for
// spotting an incoming attack to shield, like a player watching for it), and
// rolls once per situation, not once per frame, to decide whether to shield,
// punish, anti-air, grab or continue a combo. Difficulty sets those odds.
// Moves are chosen by reading the move data (hitbox, startup, travel,
// projectile range), so new characters work without CPU-specific code.
//
// Priorities each frame: get back to the stage → react (combo, shield, punish,
// anti-air, grab) → keep guarding → air game or ground game.
// ============================================================================
import { AttackPhase } from '../combat/attack.js';
import { checkBoxCollision, toWorldBox } from '../combat/hitbox.js';
import { CharacterStates as S } from '../combat/states.js';
import { createPlayerInput, finishInput } from '../core/input.js';
import { randRange } from '../core/math.js';

export const CPU_LEVELS = Object.freeze({
    easy: {
        label: 'Easy', reaction: 22, guardReaction: 10, block: 0.15, punish: 0.15, combo: 0.15, antiAir: 0.1, grab: 0.1,
        aggression: 0.45, think: [24, 50], whiff: 0.3, airAttack: 0.06, meaty: 0, dodge: 0, recovery: 0.75, mash: 0.15
    },
    normal: {
        label: 'Normal', reaction: 13, guardReaction: 6, block: 0.45, punish: 0.5, combo: 0.5, antiAir: 0.4, grab: 0.4,
        aggression: 0.55, think: [18, 40], whiff: 0.1, airAttack: 0.12, meaty: 0.3, dodge: 0.2, recovery: 0.95, mash: 0.35
    },
    hard: {
        label: 'Hard', reaction: 8, guardReaction: 3, block: 0.8, punish: 0.85, combo: 0.85, antiAir: 0.7, grab: 0.75,
        aggression: 0.7, think: [10, 24], whiff: 0.02, airAttack: 0.3, meaty: 0.7, dodge: 0.35, recovery: 1, mash: 0.7
    }
});
export const CPU_LEVEL_IDS = Object.freeze(Object.keys(CPU_LEVELS));

const GROUND_MOVES = ['jab', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'neutralSpecial', 'sideSpecial', 'downSpecial'];
const AIR_MOVES = ['nair', 'fair', 'bair', 'uair', 'dair'];
const POKES = ['jab', 'ftilt', 'dtilt', 'utilt'];
const ANTI_AIR = ['usmash', 'utilt', 'jab', 'ftilt'];
const EDGE_MARGIN = 50;
const PERCEPTION_MEMORY = 40;
const AIR_KEYS = { nair: [], fair: ['forward'], bair: ['back'], uair: ['up'], dair: ['down'] };

export class CpuController {
    /**
     * @param fighter  the Fighter this controller drives
     * @param level    a key of CPU_LEVELS
     * @param rng      random source (tests pass a seeded one)
     */
    constructor(fighter, level = 'normal', rng = Math.random) {
        this.fighter = fighter;
        this.level = CPU_LEVELS[level] || CPU_LEVELS.normal;
        this.rng = rng;
        this.pokeReach = Math.max(...POKES.map((key) => this.reachOf(fighter.attacks[key])));
        this.reset();
    }

    reset() {
        this.history = [];
        this.plan = [];
        this.intent = 'wait';
        this.thinkTimer = 30;
        this.guardTimer = 0;
        this.attackSerial = 0;
        this.lastSeenAttack = null;
        this.lastSeenFrame = 0;
        this.handled = { block: -1, punish: -1, antiAir: -1, grab: -1 };
        this.comboWanted = false;
        this.airAttackTried = false;
        this.lastHitCount = 0;
        this.jumpSerial = 0;
        this.wasAirborne = false;
        this.jumpingIn = false;
        this.ledgeWait = -1;
        this.recoveryJumpCooldown = 0;
        this.willRecover = true;
        this.wasOffstage = false;
    }

    roll(chance) { return this.rng() < chance; }

    // ------------------------------------------------------------------ perception

    /** Record what the opponent is doing now; decisions read a delayed copy. */
    observe(opp) {
        const attack = opp.currentAttack;
        if (attack && (attack !== this.lastSeenAttack || opp.attackFrame < this.lastSeenFrame)) this.attackSerial++;
        this.lastSeenAttack = attack;
        this.lastSeenFrame = opp.attackFrame;
        const airborne = !opp.isGrounded;
        if (airborne && !this.wasAirborne) this.jumpSerial++;
        this.wasAirborne = airborne;
        this.history.push({
            attack, frame: opp.attackFrame, serial: this.attackSerial,
            phase: attack ? attack.phaseAt(opp.attackFrame) : null,
            airborne, jumpSerial: this.jumpSerial, shielding: opp.stateMachine.isShielding()
        });
        if (this.history.length > PERCEPTION_MEMORY) this.history.shift();
    }

    /** The opponent as of `delay` frames ago (nothing until that much has been seen). */
    perceived(delay) {
        const index = this.history.length - 1 - delay;
        return index >= 0 ? this.history[index] : null;
    }

    // ------------------------------------------------------------------ move knowledge

    /** Distance the move carries the fighter forward while it is active. */
    travelOf(attack) {
        const m = attack.movement;
        if (!m) return 0;
        return Math.max(0, (m.active?.vx || 0) * attack.active + (m.startup?.vx || 0) * attack.startup + (m.start?.vx || 0) * 5);
    }

    /** How far in front of the fighter's center the move can reach. */
    reachOf(attack) {
        if (attack.projectile) return (attack.projectile.speed ?? 8) * (attack.projectile.life ?? 60) * 0.8;
        if (!attack.hitbox) return 0;
        return attack.hitbox.x + attack.hitbox.width - this.fighter.width / 2 + this.travelOf(attack);
    }

    /** Where the opponent's hurtbox will be after `frames` frames, assuming it keeps moving. */
    predictHurtbox(opp, frames) {
        const box = { ...opp.getHurtbox() };
        box.x += opp.velocityX * frames;
        if (!opp.isGrounded) box.y += opp.velocityY * frames + 0.4 * frames * frames;
        return box;
    }

    /**
     * Would this move connect if started right now?
     * @param ignoreIntangible  plan for the moment invincibility ends (timing a hit on someone getting up)
     */
    wouldHit(key, opp, { ignoreIntangible = false } = {}) {
        const f = this.fighter;
        const attack = f.attacks[key];
        if (!attack || attack.counter || attack.throwDir || (!ignoreIntangible && opp.isIntangible())) return false;
        const target = this.predictHurtbox(opp, Math.min(attack.startup, 12));
        if (attack.projectile) {
            // Straight-ish shots: the target has to be in front, at about the same height, within range.
            const ahead = (target.x + target.width / 2 - f.centerX) * (f.facingRight ? 1 : -1);
            const sameHeight = Math.abs(target.y + target.height / 2 - (f.y + f.height / 2)) < 70;
            return ahead > 40 && ahead < this.reachOf(attack) && sameHeight;
        }
        if (!attack.hitbox) return false;
        const box = toWorldBox(f, attack.hitbox);
        const travel = this.travelOf(attack);
        if (travel > 0) {
            box.width += travel;
            if (!f.facingRight) box.x -= travel;
        }
        return checkBoxCollision(box, target);
    }

    /**
     * Pick a move that would connect, scored for the situation.
     * @param maxStartup  only moves that come out this fast (for punishes and combos)
     */
    chooseMove(opp, { keys, maxStartup = Infinity, prefer = 'damage', ignoreIntangible = false }) {
        let best = null, bestScore = -Infinity;
        for (const key of keys) {
            const attack = this.fighter.attacks[key];
            if (!attack || attack.startup > maxStartup || !this.wouldHit(key, opp, { ignoreIntangible })) continue;
            let score;
            if (prefer === 'damage') score = attack.damage + (attack.knockdown ? 4 : 0) + attack.knockback * 0.03;
            else if (prefer === 'antiAir') score = attack.damage + (attack.launch > 0 ? 10 : 0) - (attack.hitbox?.y ?? 50) * 0.1;
            else score = (attack.damage / (attack.startup + attack.recovery)) * 10;
            score *= 0.7 + this.rng() * 0.6; // keep it unpredictable
            if (score > bestScore) { bestScore = score; best = key; }
        }
        return best;
    }

    // ------------------------------------------------------------------ stage awareness

    stageInfo(stage) {
        const main = stage.layout.main;
        const f = this.fighter;
        const offstage = f.centerX < main.left - 4 || f.centerX > main.right + 4 || f.feetY > main.y + 4;
        const toStage = f.centerX < (main.left + main.right) / 2 ? 'right' : 'left';
        return { main, offstage, toStage };
    }

    /** Would walking in this direction take us off the main platform's edge? */
    nearEdge(dir, main) {
        const f = this.fighter;
        if (!f.isGrounded || f.ground !== f.physicsMain) return false;
        return dir === 'left' ? f.centerX - main.left < EDGE_MARGIN : main.right - f.centerX < EDGE_MARGIN;
    }

    // ------------------------------------------------------------------ main entry

    /**
     * Produce this frame's input.
     * @param opp    the opposing Fighter
     * @param stage  the Stage (layout, so the CPU knows where the edges are)
     */
    getInput(opp, stage) {
        const f = this.fighter;
        const sm = f.stateMachine;
        const out = createPlayerInput();
        this.observe(opp);
        this.stage = this.stageInfo(stage);
        this.dir = {
            toward: opp.centerX >= f.centerX ? 'right' : 'left',
            away: opp.centerX >= f.centerX ? 'left' : 'right',
            forward: f.facingRight ? 'right' : 'left',
            back: f.facingRight ? 'left' : 'right'
        };
        if (this.recoveryJumpCooldown > 0) this.recoveryJumpCooldown--;

        if (sm.is(S.GRABBED)) return this.finish(out, this.roll(this.level.mash) ? { press: [this.rng() < 0.5 ? 'attack' : 'jump'] } : {});
        if (sm.is(S.LEDGE)) return this.finish(out, this.onLedge());
        if (sm.is(S.GRABBING)) return this.finish(out, this.throwStep(opp));
        if (this.plan.length) return this.finish(out, this.plan.shift());

        // Getting back to the stage beats everything else.
        if (f.ground?.liquid) return this.finish(out, this.swim());
        if (this.stage.offstage && !f.isGrounded) {
            if (!this.wasOffstage) this.willRecover = this.roll(this.level.recovery);
            this.wasOffstage = true;
            if (this.willRecover) return this.finish(out, this.recover());
        } else {
            this.wasOffstage = false;
        }

        if (this.guardTimer > 0) this.guardTimer--;
        if (!sm.canAttack() && !sm.isShielding()) return this.finish(out, this.guardTimer > 0 ? this.guardInput() : {});

        const seen = this.perceived(this.level.reaction);
        const gap = Math.abs(opp.centerX - f.centerX) - opp.width / 2;

        return this.finish(out,
            this.react(seen, opp)
            ?? (this.guardTimer > 0 ? this.guardInput() : null)
            ?? (sm.isAirborne() || !f.isGrounded ? this.airborne(opp) : this.neutral(opp, gap))
        );
    }

    /** Turn a step ({ hold: [...], press: [...] }) into an input object. Directions may be relative names. */
    finish(out, step = {}) {
        const resolve = (action) => this.dir[action] || action;
        for (const action of step.hold || []) out[resolve(action)] = true;
        for (const action of step.press || []) { const a = resolve(action); out[a] = true; out[`${a}Pressed`] = true; }
        return finishInput(out);
    }

    guardInput() { return { hold: ['shield'] }; }

    // ------------------------------------------------------------------ recovery

    recover() {
        const f = this.fighter;
        const { main, toStage } = this.stage;
        const step = { hold: [toStage] };
        const below = f.feetY > main.y - 10;
        const farOut = f.centerX < main.left - 220 || f.centerX > main.right + 220;
        if (!f.stateMachine.canAttack()) return step;

        // Jump while falling (not while still rising from the last one).
        if (f.airJumpsLeft > 0 && f.velocityY > -2 && this.recoveryJumpCooldown === 0 && (below || farOut || f.velocityY > 6)) {
            this.recoveryJumpCooldown = 12;
            step.press = ['jump'];
            return step;
        }
        if (f.airJumpsLeft === 0 && f.velocityY > 0) {
            // Out of jumps: dash sideways if far, else shoot upward.
            const side = f.attacks.sideSpecial;
            if (farOut && side && this.travelOf(side) > 60 && f.feetY < main.y + 60) return { hold: [toStage], press: ['special'] };
            if (below || farOut) return { hold: ['up', toStage], press: ['special'] };
        }
        return step;
    }

    /** Paddling in the water (Quackers): hop back toward the stage. */
    swim() {
        if (this.recoveryJumpCooldown > 0) return { hold: [this.stage.toStage] };
        this.recoveryJumpCooldown = 20;
        return { press: ['jump'], hold: [this.stage.toStage] };
    }

    onLedge() {
        const f = this.fighter;
        if (this.ledgeWait < 0) this.ledgeWait = Math.round(randRange(8, 30, this.rng));
        if (f.stateMachine.stateTime < this.ledgeWait) return {};
        this.ledgeWait = -1;
        const toStage = f.ledge?.side < 0 ? 'right' : 'left';
        return this.rng() < 0.65 ? { hold: [toStage] } : { press: ['jump'] };
    }

    // ------------------------------------------------------------------ grabs

    throwStep(opp) {
        const f = this.fighter;
        if (f.stateMachine.stateTime < 6) return {};
        if (this.rng() < 0.25 && f.holdTimer > 30) return { press: ['attack'] }; // pummel
        // Throw toward the nearer edge so they land near the pit.
        const main = this.stage.main;
        const nearLeft = opp.centerX - main.left < main.right - opp.centerX;
        const facingLeft = !f.facingRight;
        const options = [
            nearLeft === facingLeft ? 'forward' : 'back',
            this.rng() < 0.3 ? 'up' : null,
            this.rng() < 0.2 ? 'down' : null
        ].filter(Boolean);
        const choice = options[Math.floor(this.rng() * options.length)];
        return { press: [choice] };
    }

    // ------------------------------------------------------------------ reactions

    /** Situations the CPU reacts to as soon as it notices them. Returns an input step or null. */
    react(seen, opp) {
        const f = this.fighter;
        const L = this.level;
        const sm = f.stateMachine;
        const grounded = f.isGrounded && !sm.isAirborne();

        // Continue a combo: our hit landed, link another before hitstun runs out.
        if (opp.stateMachine.isInHitstun() && opp.comboHitCount !== this.lastHitCount) {
            this.lastHitCount = opp.comboHitCount;
            this.comboWanted = this.roll(L.combo);
        }
        if (!opp.stateMachine.isInHitstun()) { this.comboWanted = false; this.lastHitCount = 0; }
        if (this.comboWanted && sm.canAttack()) {
            const left = opp.stateMachine.stateData.stunFrames - opp.stateMachine.stateTime;
            const key = this.chooseMove(opp, { keys: grounded ? GROUND_MOVES : AIR_MOVES, maxStartup: left, prefer: 'damage' });
            if (key) { this.comboWanted = false; return this.attackStep(key); }
        }

        // Shield (or dodge) an incoming attack (rolled once per attack).
        const spotted = this.perceived(L.guardReaction);
        const threat = spotted?.attack && spotted.phase !== AttackPhase.RECOVERY && opp.threatens(f);
        if (threat && this.handled.block !== spotted.serial && grounded && (sm.canAct() || sm.isShielding())) {
            this.handled.block = spotted.serial;
            if (this.roll(L.block)) {
                const a = spotted.attack;
                if (a.grab) return { press: ['jump'], hold: ['away'] }; // shields don't stop grabs: hop out
                if (this.roll(L.dodge)) {
                    if (sm.isShielding()) return { hold: ['shield'], press: ['down'] };
                    this.plan.push({ hold: ['shield'], press: ['down'] }); // shield, then spot-dodge
                    return { hold: ['shield'] };
                }
                this.guardTimer = Math.min(30, a.startup + a.active - spotted.frame + a.blockstun + 4);
                return this.guardInput();
            }
        }

        if (!seen) return null;
        // The attack we were guarding against is over: drop the guard so we can punish.
        if (this.guardTimer > 0 && seen.phase === AttackPhase.RECOVERY && seen.serial === this.handled.block) this.guardTimer = 0;

        // Punish an attack that is recovering (whiffed or shielded).
        if (seen.attack && seen.phase === AttackPhase.RECOVERY && opp.currentAttack && grounded && (sm.canAct() || sm.isShielding())
            && this.handled.punish !== seen.serial) {
            this.handled.punish = seen.serial;
            const window = opp.currentAttack.getTotalFrames() - opp.attackFrame;
            if (this.roll(L.punish)) {
                const key = this.chooseMove(opp, { keys: GROUND_MOVES, maxStartup: window, prefer: 'damage' });
                if (key) return this.attackStep(key);
            }
        }

        // Grab a shield.
        if (seen.shielding && grounded && sm.canAct() && this.handled.grab !== this.history.length && this.wouldHit('grab', opp)) {
            this.handled.grab = this.history.length;
            if (this.roll(L.grab * 0.15)) return this.attackStep('grab');
        }

        // Anti-air an opponent jumping in.
        if (seen.airborne && grounded && sm.canAct() && this.handled.antiAir !== seen.jumpSerial) {
            const incoming = Math.abs(opp.centerX - f.centerX) < 220 && Math.sign(opp.velocityX || 0) !== Math.sign(opp.centerX - f.centerX);
            if (incoming && opp.velocityY > -6) {
                this.handled.antiAir = seen.jumpSerial;
                if (this.roll(L.antiAir)) {
                    const key = this.chooseMove(opp, { keys: ANTI_AIR, prefer: 'antiAir' });
                    if (key) return this.attackStep(key);
                }
                if (this.roll(L.block)) { this.guardTimer = 20; return this.guardInput(); }
            }
        }

        // Meaty: time an attack to land as the opponent gets up.
        if (opp.stateMachine.is(S.GETUP) && grounded && sm.canAct()) {
            const left = opp.stateMachine.stateData.getupFrames - opp.stateMachine.stateTime;
            const key = this.chooseMove(opp, { keys: POKES, prefer: 'damage', ignoreIntangible: true });
            if (key && left === f.attacks[key].startup && this.roll(L.meaty)) return this.attackStep(key);
        }
        return null;
    }

    // ------------------------------------------------------------------ air

    airborne(opp) {
        const f = this.fighter;
        const step = { hold: this.jumpingIn ? ['toward'] : [] };
        if (!this.airAttackTried && f.stateMachine.canAttack() && f.velocityY > -3) {
            const key = this.chooseMove(opp, { keys: AIR_MOVES, prefer: 'damage' });
            if (key && this.roll(this.jumpingIn ? 0.5 + this.level.airAttack : this.level.airAttack)) {
                this.airAttackTried = true;
                return { hold: AIR_KEYS[key], press: ['attack'] };
            }
        }
        return step;
    }

    // ------------------------------------------------------------------ neutral game

    neutral(opp, gap) {
        const L = this.level;
        const main = this.stage.main;
        this.airAttackTried = false;
        this.jumpingIn = false;
        const oppDown = opp.isIntangible() || opp.stateMachine.isKnockedDown();
        const oppOffstage = opp.centerX < main.left || opp.centerX > main.right;
        const inRange = POKES.some((key) => this.wouldHit(key, opp));
        const oppAbove = opp.isGrounded && opp.feetY < this.fighter.feetY - 40;

        if (--this.thinkTimer <= 0 || (this.intent === 'approach' && inRange)) this.think(gap, inRange, oppDown, oppOffstage, oppAbove);

        switch (this.intent) {
            case 'approach': {
                if (this.nearEdge(this.dir.toward, main)) return {}; // wait at the edge rather than walk off
                return { hold: ['toward'] };
            }
            case 'retreat':
                if (this.nearEdge(this.dir.away, main)) { this.intent = 'approach'; return {}; }
                return { hold: ['away'] };
            case 'guard':
                return this.guardInput();
            case 'attack': {
                this.intent = 'wait';
                if (oppDown) return {};
                const key = this.chooseMove(opp, { keys: GROUND_MOVES, prefer: 'poke' });
                if (key) return this.attackStep(key);
                if (this.roll(L.whiff)) return this.attackStep(POKES[Math.floor(this.rng() * POKES.length)]);
                this.intent = 'approach';
                return {};
            }
            case 'jumpIn':
                this.jumpingIn = true;
                this.intent = 'wait';
                this.thinkTimer = 6; // rethink soon after landing
                return { press: ['jump'], hold: ['toward'] };
            case 'shoot':
                this.intent = 'wait';
                return this.attackStep('neutralSpecial');
            case 'grab':
                this.intent = 'wait';
                return this.wouldHit('grab', opp) ? this.attackStep('grab') : { hold: ['toward'] };
            case 'dash':
                this.intent = 'wait';
                return this.attackStep('sideSpecial');
            default:
                return {};
        }
    }

    think(gap, inRange, oppDown, oppOffstage, oppAbove) {
        const L = this.level;
        const f = this.fighter;
        const r = this.rng();
        this.thinkTimer = Math.round(randRange(L.think[0], L.think[1], this.rng));
        const side = f.attacks.sideSpecial;
        const dashReach = side && this.travelOf(side) > 40 ? this.reachOf(side) : 0;
        const shot = f.attacks.neutralSpecial?.projectile ? this.reachOf(f.attacks.neutralSpecial) : 0;

        if (oppOffstage) {
            // Edge-guard: go to the edge and wait, maybe throw something at them.
            this.intent = shot && r < 0.3 ? 'shoot' : 'approach';
        } else if (oppDown) {
            this.intent = gap > this.pokeReach ? 'approach' : (this.roll(0.5) ? 'guard' : 'wait');
        } else if (oppAbove && r < 0.5) {
            this.intent = 'jumpIn';
        } else if (inRange) {
            if (r < L.grab * 0.2) this.intent = 'grab';
            else if (r < L.aggression) this.intent = 'attack';
            else if (r < L.aggression + 0.2) this.intent = 'guard';
            else if (r < L.aggression + 0.3) this.intent = 'retreat';
            else this.intent = 'wait';
        } else if (gap < this.pokeReach + 120) {
            if (r < L.aggression * 0.7) this.intent = 'approach';
            else if (r < L.aggression * 0.7 + 0.12) this.intent = 'jumpIn';
            else if (r < L.aggression * 0.7 + 0.2 && dashReach && gap < dashReach) this.intent = 'dash';
            else if (r < L.aggression * 0.7 + 0.3) this.intent = 'guard';
            else this.intent = this.roll(0.5) ? 'retreat' : 'wait';
        } else {
            if (shot && gap < shot && r < 0.25) this.intent = 'shoot';
            else if (r < L.aggression + 0.2) this.intent = 'approach';
            else if (r < L.aggression + 0.3) this.intent = 'jumpIn';
            else this.intent = 'wait';
        }
        if (this.intent === 'guard') this.thinkTimer = Math.min(this.thinkTimer, 24); // shields wear out
    }

    // ------------------------------------------------------------------ attacks as inputs

    /**
     * Input step that starts the given move. Out of a shield (anything but a grab), the
     * shield is dropped for a frame first.
     */
    attackStep(key) {
        const sm = this.fighter.stateMachine;
        let press;
        switch (key) {
            case 'jab': press = { press: ['attack'] }; break;
            case 'ftilt': press = { press: ['attack'], hold: ['toward'] }; break;
            case 'utilt': press = { press: ['attack'], hold: ['up'] }; break;
            case 'dtilt': press = { press: ['attack'], hold: ['down'] }; break;
            case 'fsmash': press = { press: ['smash'], hold: ['toward'] }; break;
            case 'usmash': press = { press: ['smash'], hold: ['up'] }; break;
            case 'dsmash': press = { press: ['smash'], hold: ['down'] }; break;
            case 'neutralSpecial': press = { press: ['special'] }; break;
            case 'sideSpecial': press = { press: ['special'], hold: ['toward'] }; break;
            case 'upSpecial': press = { press: ['special'], hold: ['up'] }; break;
            case 'downSpecial': press = { press: ['special'], hold: ['down'] }; break;
            case 'grab': press = { press: ['attack'], hold: ['shield'] }; break;
            default: press = AIR_KEYS[key] ? { press: ['attack'], hold: AIR_KEYS[key] } : { press: ['attack'] };
        }
        if (!sm.isShielding() || key === 'grab') return press;
        this.plan.push(press);
        return {};
    }
}

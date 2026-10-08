// ============================================================================
// FIGHT SCENE
// Runs a best-of-N match: round intro → fight → KO → next round / result.
// The fighting itself happens in combat/match.js; this scene feeds it inputs
// (player 2 is a keyboard player, a CpuController, or online, a friend whose
// inputs arrive through net/lockstep.js) and turns the events it
// returns into hit sparks, sounds, hitstop and camera shake. The fight is drawn
// in 3-D (render3d/fight-view.js) with 2-D effects and the HUD on top.
//
// Hit feel: every clean hit gets a tier (impactTier: light, heavy, smash) and
// HIT_TIERS sets what that tier gets: hitstop (the freeze), defender shudder,
// camera shake, a kick along the knockback and a zoom punch, the 3-D impact
// light, an impact star and sparks; smash hits add focus lines, shockwaves and
// a darkened frame. Hard launches trail smoke, sliding fighters kick up dust.
// The hit that wins the round freezes, zooms in on the impact, then plays out
// in slow motion behind letterbox bars before the K.O. lands.
// ============================================================================
import { CpuController } from '../ai/cpu-controller.js';
import { attackSound } from '../audio/sfx.js';
import { MATCH, SCREEN } from '../config.js';
import { FIGHT_TOUCH_BUTTONS } from '../core/touch.js';
import { HitResult } from '../combat/combat-system.js';
import { Match } from '../combat/match.js';
import { CharacterStates as S } from '../combat/states.js';
import { Fighter } from '../fighters/fighter.js';
import { getCharacter } from '../fighters/roster.js';
import { spawnAttackStartVfx, spawnAttackVfx } from '../graphics/attack-vfx.js';
import { Camera } from '../graphics/camera.js';
import { BlockSpark, burst, Callout, dustPuff, EffectsManager, RingPulse } from '../graphics/effects.js';
import { burningFlames, fireBurst } from '../graphics/fire.js';
import { debris, FocusLines, ImpactStar, impactSparks, launchSmoke, ShockRing } from '../graphics/impacts.js';
import { projectileEndEffect } from '../graphics/projectile-effects.js';
import { hashFighters } from '../net/lockstep.js';
import { FightView } from '../render3d/fight-view.js';
import { getStage } from '../stages/index.js';
import { Stage } from '../stages/stage.js';
import { FightHud } from '../ui/hud.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';

const Round = Object.freeze({ INTRO: 'intro', FIGHT: 'fight', KO: 'ko' });
const KO_SLOWMO_FRAMES = 50;
const KO_FREEZE_FRAMES = 40;   // the winning hit holds this long, zoomed in, before the slow motion
const KO_ZOOM = 1.45;
const MAX_HITSTOP = 20;
const LAUNCH_SPEED = 9;        // px/frame: launched faster than this trails smoke
const SKID_SPEED = 2.5;        // px/frame: reeling along the ground faster than this kicks up dust

/**
 * What each tier of clean hit gets (see impactTier).
 * stop: base hitstop frames (+0.35 per point of damage). shake/kick: px. punch: zoom (0.05 = 5%).
 * light: 3-D impact light power. star: impact star size (px). sparks: spark count.
 */
const HIT_TIERS = [
    { stop: 4, shake: 2, kick: 2, punch: 0, light: 0.3, star: 22, sparks: 3 },        // 0 pummel
    { stop: 5, shake: 4, kick: 4, punch: 0, light: 0.6, star: 32, sparks: 7 },        // 1 light
    { stop: 8, shake: 8, kick: 8, punch: 0.025, light: 1, star: 46, sparks: 12 },     // 2 heavy
    { stop: 12, shake: 14, kick: 14, punch: 0.06, light: 1.6, star: 64, sparks: 18 }  // 3 smash
];

/** How hard a clean hit was, for the presentation: 0 pummel, 1 light, 2 heavy, 3 smash. Multi-hit moves stay small. */
export function impactTier(hit) {
    if (hit.pummel) return 0;
    const { attack, damage } = hit;
    const tier = attack.strength === 'smash' || damage >= 14 ? 3 : attack.strength !== 'light' || damage >= 8 ? 2 : 1;
    return attack.rehit ? Math.min(tier, 2) : tier;
}
const TENSE_HEALTH = 0.3;
const TICK_SECONDS = 5;
const SHOW_WAITING_AFTER = 20; // online: frames stalled before "waiting for opponent" shows

export class FightScene {
    constructor(game) {
        this.game = game;
        this.effects = new EffectsManager();
        this.camera = new Camera();
        this.hud = new FightHud();
        this.paper = false; // no paper grain over the 3-D picture
        this.view3d = null;
    }

    get touchButtons() { return FIGHT_TOUCH_BUTTONS; }

    /**
     * @param cpu     CPU difficulty for player 2, or null for a second human player
     * @param online  the OnlineSession when playing a friend over the internet
     */
    enter({ p1, p2, stage, cpu = null, online = null }) {
        this.matchConfig = { p1, p2, stage, cpu, online };
        this.online = online;
        this.lockstep = online?.lockstep ?? null;
        this.netInputs = null;
        this.desyncShown = false;
        this.stage = new Stage(getStage(stage));
        const labels = online ? ['P1', 'P2'].map((l, i) => (i === online.localIndex ? 'YOU' : l)) : ['P1', cpu ? 'CPU' : 'P2'];
        this.fighters = [
            new Fighter(getCharacter(p1), { playerNumber: 1, render: true, label: labels[0] }),
            new Fighter(getCharacter(p2), { playerNumber: 2, render: true, label: labels[1] })
        ];
        this.match = new Match(this.stage, this.fighters);
        this.view3d?.dispose();
        this.view3d = new FightView(this.game.view, this.stage, this.fighters);
        this.cpu = cpu ? new CpuController(this.fighters[1], cpu) : null;
        this.wins = [0, 0];
        this.audio.music.play(this.stage.def.music || 'romp');
        this.startRound();
    }

    exit() {
        this.view3d?.dispose();
        this.view3d = null;
    }

    get audio() { return this.game.audio; }

    /** Effect environment for a fighter's attack effects (ground = where their feet are). */
    vfxEnv(fighter) { return { effects: this.effects, camera: this.camera, groundY: fighter.feetY }; }

    startRound() {
        this.match.resetPositions();
        this.round = Round.INTRO;
        this.roundTimer = 0;
        this.timeLeft = MATCH.roundSeconds * 60;
        this.hitstop = 0;
        this.slowmo = 0;
        this.koFlash = 0;
        this.koFreeze = 0;
        this.koFreezeTotal = 0;
        this.koReason = null;
        this.finalHit = null;
        this.screenFlash = 0;      // white flash over everything (0..1)
        this.darken = null;        // { x, y, amount }: the frame darkens around a smash hit
        this.launched = new Map(); // fighter → frames left of launch smoke
        this.effects.clear();
        this.camera.reset();
        this.hud.reset(this.fighters);
        this.cpu?.reset();
        this.audio.music.duck(false);
    }

    /** Both players are one round from winning. */
    isFinalRound() { return this.wins.every((w) => w === MATCH.roundsToWin - 1); }

    // ------------------------------------------------------------------ update

    /** Online: true while the other side's input for the next frame hasn't arrived (the game holds the frame). */
    waiting() {
        if (!this.lockstep || this.lockstep.ready()) return false;
        this.lockstep.stall();
        return true;
    }

    update() {
        // Online, every frame (intro and KO too) runs on both players' inputs for that frame.
        const frame = this.lockstep?.frame;
        if (this.lockstep) this.netInputs = this.lockstep.advance(this.game.input.combined());
        this.updateFrame();
        if (this.lockstep) this.checkSync(frame);
    }

    /** Online: compare the fight with the other copy now and then. A mismatch is only reported. */
    checkSync(frame) {
        this.lockstep.check(frame, hashFighters(this.fighters, [this.timeLeft, this.round, this.roundTimer, this.hitstop, ...this.wins]));
        if (this.lockstep.desyncFrame >= 0 && !this.desyncShown) {
            this.desyncShown = true;
            console.warn(`Online fight out of sync at frame ${this.lockstep.desyncFrame}`);
            this.game.toast = { text: 'OUT OF SYNC: THE TWO SCREENS DISAGREE', frames: 300 };
        }
    }

    /** The two fighters' inputs this frame: from the network online, else the keyboard / controllers / CPU. */
    frameInputs() {
        if (this.netInputs) return this.netInputs;
        const input = this.game.input;
        // Read both inputs before anyone moves, so the CPU sees the same moment a human would.
        return [input.getPlayerInput(1), this.cpu ? this.cpu.getInput(this.fighters[0], this.stage) : input.getPlayerInput(2)];
    }

    /** Rumble the controller of the person playing `fighter`, if they're at this computer. */
    rumble(fighter, options) {
        if (!this.online) this.game.input.gamepads.rumble(fighter.playerNumber, options);
        else if (this.fighters.indexOf(fighter) === this.online.localIndex) this.game.input.gamepads.rumble(1, options);
    }

    updateFrame() {
        this.stage.update();
        this.roundTimer++;
        if (this.round === Round.INTRO) this.updateIntro();
        else if (this.round === Round.FIGHT) this.updateFight();
        else this.updateKo();
        this.hud.update();
    }

    updateIntro() {
        if (this.roundTimer === 1) {
            this.audio.play('drum');
            this.audio.announce(this.isFinalRound() ? 'Final round!' : `Round ${this.wins[0] + this.wins[1] + 1}`);
        } else if (this.roundTimer === 60) {
            this.audio.play('gong');
            this.audio.announce('Fight!', { pitch: 0.8, rate: 1.1 });
        }
        for (const f of this.fighters) f.updateAnimationOnly();
        if (this.roundTimer >= MATCH.introFrames) { this.round = Round.FIGHT; this.roundTimer = 0; }
    }

    updateFight() {
        // Hitstop: freeze fighters for a few frames on impact so hits land with weight.
        if (this.hitstop > 0) {
            this.hitstop--;
            for (const f of this.fighters) if (f.shakeFrames > 0) f.shakeFrames--;
            // Presses made during the freeze still count: they wait in the fighters' input buffers.
            const inputs = this.netInputs ?? [this.game.input.getPlayerInput(1), this.cpu ? null : this.game.input.getPlayerInput(2)];
            this.fighters.forEach((f, i) => { if (inputs[i]) f.bufferPresses(inputs[i]); });
            this.updateScreenFx();
            return;
        }

        this.timeLeft--;
        if (this.timeLeft % 60 === 0 && this.timeLeft > 0 && this.timeLeft <= TICK_SECONDS * 60) this.audio.play('tick');
        const events = this.match.step(this.frameInputs());
        for (const event of events) this.onMatchEvent(event);

        // Burrowing fighters leave a trail of churned-up dirt.
        for (const f of this.fighters) {
            if (f.isHidden() && this.stage.time % 4 === 0) this.effects.add(dustPuff(f.centerX, f.feetY, { count: 3, spread: 30, size: [10, 16], color: 'rgba(120,90,60,0.9)' }));
            // Burning fighters trail flames.
            if (f.burnTicks > 0 && !f.isHidden() && this.stage.time % 2 === 0) this.effects.add(burningFlames(f));
        }
        this.updateTrails();

        const tense = this.isFinalRound() || this.fighters.some((f) => f.health / f.maxHealth < TENSE_HEALTH);
        this.audio.music.setIntensity(tense ? 1 : 0);
        this.updateScreenFx();
        this.checkRoundOver();
    }

    /** Effects, camera and screen flashes advance even while the fight is frozen. */
    updateScreenFx() {
        this.effects.update();
        this.camera.update();
        if (this.koFlash > 0) this.koFlash--;
        this.screenFlash *= 0.6;
        if (this.screenFlash < 0.02) this.screenFlash = 0;
        if (this.darken && (this.darken.amount *= 0.88) < 0.02) this.darken = null;
        for (const { player, level } of this.hud.finishedCombos()) {
            this.audio.play('combo', { level, x: this.fighters[player].centerX });
            if (level >= 3) this.camera.shake(4);
        }
    }

    /** Smoke behind hard-launched fighters; dust under fighters reeling along the ground. */
    updateTrails() {
        for (const f of this.fighters) {
            const sm = f.stateMachine;
            const reeling = sm.isInHitstun() || sm.is(S.KNOCKDOWN);
            const speed = Math.hypot(f.velocityX, f.velocityY);
            const left = this.launched.get(f) || 0;
            if (left > 0) {
                if (!reeling || f.isGrounded) this.launched.delete(f);
                else {
                    this.launched.set(f, left - 1);
                    if (speed > LAUNCH_SPEED * 0.6 && this.stage.time % 2 === 0) {
                        this.effects.add(launchSmoke(f.centerX, f.y + f.height * 0.5, { size: 22 + speed * 1.4, vx: -f.velocityX, vy: -f.velocityY }));
                    }
                }
            }
            if (reeling && f.isGrounded && Math.abs(f.velocityX) > SKID_SPEED && this.stage.time % 3 === 0) {
                this.effects.add(dustPuff(f.centerX, f.feetY, { count: 2, spread: f.width * 0.4, size: [10, 16], direction: -Math.sign(f.velocityX) }));
            }
        }
    }

    updateKo() {
        // The winning hit holds, zoomed in on the impact, then lets go into slow motion.
        if (this.koFreeze > 0) {
            this.koFreeze--;
            for (const f of this.fighters) if (f.shakeFrames > 0) f.shakeFrames--;
            if (this.koFreeze === 0) { this.camera.release(); this.camera.shake(10); }
            this.updateScreenFx();
            return;
        }
        // Slow motion right after a knockout: simulate every other frame.
        if (this.slowmo > 0) {
            this.slowmo--;
            if (this.slowmo % 2 === 1) return;
        }
        for (const f of this.fighters) {
            this.match.physics.update(f);
            // Anyone still over the pit when the round ends is brought back to pose on stage.
            if (f.y > SCREEN.height) {
                const main = this.match.physics.main;
                f.x = (main.left + main.right) / 2 - f.width / 2;
                f.y = main.y - f.height - 200;
                f.velocityX = 0;
                f.velocityY = 0;
            }
            f.updateAnimationOnly();
            f.drainEvents();
        }
        this.updateTrails();
        this.updateScreenFx();

        if (this.roundTimer >= MATCH.koFrames + KO_SLOWMO_FRAMES / 2 + this.koFreezeTotal) this.finishRound();
    }

    // ------------------------------------------------------------------ events → effects and sound

    onMatchEvent(event) {
        switch (event.type) {
            case 'hit': return this.onHit(event.hit);
            case 'fighter': return this.onFighterEvent(event.fighter, event.event);
            case 'projectileEnd': return projectileEndEffect(event.projectile, this.effects, this.audio);
            case 'splash': return this.onSplash(event);
            case 'ringOut': return this.onRingOut(event);
            case 'grabEscape':
                this.audio.play('menu-back', { x: event.fighter.centerX });
                return;
            case 'burn': {
                const f = event.fighter;
                this.effects.add(fireBurst(f.centerX, f.y + f.height * 0.5, { count: 5, speed: [1, 3], size: [12, 20], life: [10, 18], offset: f.width * 0.25 }));
                this.audio.play('crackle', { x: f.centerX });
                return;
            }
            case 'douse':
                this.effects.add(burst(event.x, event.y - 20, { count: 14, colors: ['rgba(240,240,240,0.8)', 'rgba(200,205,210,0.7)'], speed: [1, 4], size: [16, 28], angle: -Math.PI / 2, spread: 1.2, gravity: -0.08, drag: 0.95, shrink: 1.02, life: [26, 40] }));
                this.effects.add(new Callout(event.x, event.y - 100, 'PSSSH!', { color: '#d6eaf8', size: 26 }));
                this.audio.play('sizzle', { x: event.x });
                return;
            default:
        }
    }

    onHit(hit) {
        const { attack, attacker, defender, result, x, y } = hit;
        const direction = Math.sign(defender.centerX - attacker.centerX) || (attacker.facingRight ? 1 : -1);
        switch (result) {
            case HitResult.BLOCK:
                this.effects.add(new BlockSpark(x, y, direction));
                this.effects.add(burst(x, y, { count: 8, colors: ['#85c1e9', '#d6eaf8', '#ffffff'], speed: [3, 7], size: [3, 6], angle: direction > 0 ? Math.PI : 0, spread: 1.6, shape: 'line', additive: true }));
                this.view3d.shieldHit(defender);
                this.view3d.flash(x, y, '#9fd3ff', 0.5);
                this.hitstop = Math.max(this.hitstop, Math.ceil(attack.hitstop / 2) + 1);
                this.camera.shake(3);
                this.camera.kick(direction * 3);
                this.audio.play('block', { x });
                return;
            case HitResult.SHIELD_BREAK:
                this.hitstop = Math.max(this.hitstop, 16);
                this.camera.shake(12);
                this.camera.punch(x, y, 0.05);
                this.view3d.flash(x, y, '#ff6b6b', 1.5);
                this.effects.add(new ShockRing(defender.centerX, defender.y + defender.height / 2, { radius: 160, color: '#ff8f8f', width: 12 }));
                this.screenFlash = Math.max(this.screenFlash, 0.3);
                return; // the fighter's shieldBreak event plays the shatter
            case HitResult.ARMOR:
                this.effects.add(new RingPulse(defender.centerX, defender.y + defender.height / 2, { color: '#ff9f43', from: 30, to: 110, life: 14, width: 7 }));
                this.effects.add(burst(x, y, { count: 10, colors: ['#ff9f43', '#fff'], speed: [4, 9], size: [2, 4], shape: 'line', gravity: 0, additive: true }));
                this.view3d.flash(x, y, '#ff9f43', 0.8);
                this.hitstop = Math.max(this.hitstop, 7);
                this.camera.shake(6);
                this.audio.play('armor', { x });
                return;
            case HitResult.COUNTER: {
                const cy = defender.y + defender.height / 2;
                this.effects.add(new RingPulse(defender.centerX, cy, { color: '#ffffff', from: 120, to: 30, life: 14, width: 8 }));
                this.effects.add(new Callout(defender.centerX, defender.y - 20, 'COUNTER!', { color: defender.accentColor }));
                this.view3d.flash(defender.centerX, cy, '#ffffff', 1.2);
                this.camera.punch(defender.centerX, cy, 0.04);
                this.hitstop = Math.max(this.hitstop, 12);
                this.audio.play('armor', { x });
                return;
            }
            case HitResult.REFLECT:
                this.effects.add(new RingPulse(x, y, { color: attacker.accentColor, from: 10, to: 70, life: 12, width: 5 }));
                this.view3d.flash(x, y, attacker.accentColor, 0.7);
                this.hitstop = Math.max(this.hitstop, 5);
                this.audio.play('reflect', { x });
                return;
            case HitResult.GRAB:
                this.hitstop = Math.max(this.hitstop, 4);
                this.camera.kick(direction * 2);
                this.audio.play('grab', { x });
                return;
            default:
        }
        this.onCleanHit(hit, direction);
    }

    /** A hit that landed: freeze, shake, light, sparks and sound, all scaled by how hard it was. */
    onCleanHit(hit, direction) {
        const { attack, attacker, defender, x, y } = hit;
        const tier = impactTier(hit);
        const T = HIT_TIERS[tier];
        const ko = defender.isDead();
        const combo = hit.comboHit || 1;
        const bonus = Math.min(0.4, (combo - 1) * 0.05); // long combos hit a little bigger
        const speed = Math.hypot(defender.velocityX, defender.velocityY);
        // Effects fly along the knockback.
        const angle = speed > 0.5 ? Math.atan2(defender.velocityY, defender.velocityX) : (direction > 0 ? 0 : Math.PI);
        const heavy = tier >= 2;

        // Freeze and shudder
        let hitstop = attack.rehit ? attack.hitstop : Math.max(attack.hitstop, T.stop + Math.round(hit.damage * 0.35));
        if (!hit.projectile) hitstop += Math.round((attacker.damageScale - 1) * 10);
        if (hit.counterHit) hitstop += 4;
        hitstop = Math.min(MAX_HITSTOP, hitstop);
        this.hitstop = Math.max(this.hitstop, hitstop);
        defender.shakeFrames = defender.shakeTotal = hitstop;
        defender.shakeAmp = 2 + hit.damage * 0.5;

        // Camera and light
        this.camera.shake(T.shake + hit.damage * 0.3);
        this.camera.kick(Math.cos(angle) * T.kick, Math.sin(angle) * T.kick * 0.6);
        if (T.punch) this.camera.punch(x, y, T.punch + bonus * 0.05 + (hit.counterHit ? 0.02 : 0));
        this.view3d.flash(x, y, tier >= 3 ? '#ffd9a0' : '#fff2dc', T.light * (1 + bonus));

        // Sparks
        this.effects.add(new ImpactStar(x, y, { size: T.star * (1 + bonus), color: attacker.accentColor, angle, life: tier >= 3 ? 12 : 9 }));
        this.effects.add(new ShockRing(x, y, { radius: 50 + 25 * tier, color: '#fff6e0', width: 3 + 2 * tier, life: 10 }));
        this.effects.add(impactSparks(x, y, { angle, count: T.sparks, speed: heavy ? [8, 17] : [5, 11] }));
        if (tier >= 3) {
            this.effects.add(new FocusLines(x, y, { life: 12, inner: 150 }));
            this.effects.add(new ShockRing(x, y, { radius: 190, color: '#fff3d0', width: 10, life: 16 }));
            this.darken = { x, y, amount: 1 };
            this.screenFlash = Math.max(this.screenFlash, 0.12);
        }
        // Heavy hits on (or into) the ground send a shockwave along it.
        if (heavy && (defender.isGrounded || attack.launch < 0) && Math.abs(defender.feetY - this.stage.groundY) < 30) {
            this.effects.add(new ShockRing(defender.centerX, this.stage.groundY, { radius: 140 + 40 * tier, squash: 0.18, color: '#fff7e6', width: 8 }));
            this.effects.add(debris(defender.centerX, this.stage.groundY, { count: 4 + tier * 3 }));
        }
        if (speed > LAUNCH_SPEED) {
            this.launched.set(defender, 40);
            this.audio.play('launch', { x, power: Math.min(1, speed / 25) });
        }

        // Callouts
        if (hit.counterHit && !ko) this.effects.add(new Callout(defender.centerX, defender.y - 34, 'COUNTER HIT!', { color: '#ffe14d', size: 26 }));
        else if (hit.punish && heavy && !ko) this.effects.add(new Callout(defender.centerX, defender.y - 34, 'PUNISH!', { color: '#ff8a5c', size: 26 }));

        this.audio.play('hit', { x, damage: hit.damage, heavy, combo, tier, counter: hit.counterHit });
        if (ko) {
            this.finalHit = { x, y };
            this.audio.play('kohit', { x });
        }
        this.hud.comboHit(this.fighters.indexOf(attacker), hit);

        // Controller rumble: the one who got hit feels it most.
        const k = Math.min(1, hit.damage / 18);
        const big = tier >= 3 ? 1 : 0;
        this.rumble(defender, { strong: 0.3 + 0.7 * k, weak: 0.5, duration: 80 + 160 * k + 120 * big });
        this.rumble(attacker, { strong: 0.1 + 0.3 * big, weak: 0.3 * k + 0.1, duration: 60 + 60 * big });

        if (attack.knockdown) {
            this.effects.add(dustPuff(defender.centerX, defender.feetY, { count: 8, spread: defender.width }));
            this.audio.play('knockdown', { x });
        }
        if (hit.thrown) this.audio.play('whoosh', { x, strength: 'heavy' });
        if (hit.dizzy) this.effects.add(new Callout(defender.centerX, defender.y - 30, 'P-U!', { color: '#9ccc4a', size: 30 }));
        if (hit.ignited) {
            this.effects.add(new Callout(defender.centerX, defender.y - 30, 'BURN!', { color: '#ff7a1a', size: 30 }));
            this.effects.add(fireBurst(defender.centerX, defender.y + defender.height * 0.5, { count: 14, speed: [2, 6], size: [14, 26], offset: defender.width * 0.3 }));
        }
    }

    onFighterEvent(fighter, event) {
        const heavy = !!fighter.def.heavyFootsteps;
        const x = fighter.centerX;
        switch (event.type) {
            case 'attackStart':
                spawnAttackStartVfx(fighter, event.attack, this.vfxEnv(fighter));
                break;
            case 'attackActive':
                spawnAttackVfx(fighter, event.attack, this.vfxEnv(fighter));
                if (!event.attack.throwDir && event.key !== 'pummel') this.audio.play(attackSound(event.attack), { x, strength: event.attack.strength });
                break;
            case 'charging':
                this.effects.add(burst(x, fighter.y + fighter.height * 0.4, { count: 4, colors: ['#fff3a8', '#ffffff'], speed: [1, 3], size: [3, 5], gravity: -0.05, life: [10, 16] }));
                this.audio.play('charge', { x, level: event.level });
                break;
            case 'chargeFull':
                this.effects.add(new RingPulse(x, fighter.y + fighter.height / 2, { color: '#ffd34d', from: 110, to: 20, life: 12, width: 6 }));
                this.view3d.flash(x, fighter.y + fighter.height / 2, '#ffc94d', 0.6);
                this.camera.shake(2);
                this.audio.play('chargefull', { x });
                break;
            case 'jump':
                this.audio.play(event.double ? 'flap' : 'jump', { x });
                if (event.double) this.effects.add(new RingPulse(x, fighter.feetY, { color: '#ffffff', from: 10, to: 40, life: 10, width: 3 }));
                break;
            case 'land': {
                // Slammed into the floor (knocked down): a heavy thud however light the fighter.
                const thud = heavy || fighter.stateMachine.is(S.KNOCKDOWN);
                this.effects.add(dustPuff(x, fighter.feetY, { count: thud ? 10 : 5, spread: fighter.width * 0.8, size: thud ? [14, 22] : [8, 14] }));
                if (thud) this.camera.shake(5);
                if (thud && !heavy) this.effects.add(debris(x, fighter.feetY, { count: 6 }));
                this.audio.play('land', { x, heavy: thud });
                break;
            }
            case 'step':
                if (!heavy || !fighter.isGrounded) break;
                this.effects.add(dustPuff(x, fighter.feetY, { count: 3, spread: fighter.width * 0.6, size: [8, 12] }));
                this.camera.shake(1.5);
                this.audio.play('step', { x });
                break;
            case 'dodge':
                this.audio.play('dodge', { x });
                break;
            case 'ledgeGrab':
                this.audio.play('ledge', { x });
                break;
            case 'shieldBreak':
                this.effects.add(burst(x, fighter.y + fighter.height / 2, { count: 16, colors: [fighter.accentColor, '#ffffff'], speed: [4, 10], size: [4, 8], shape: 'line', gravity: 0.2 }));
                this.effects.add(new Callout(x, fighter.y - 20, 'SHIELD BREAK!', { color: '#ff6b6b' }));
                this.audio.play('shatter', { x });
                break;
            default:
        }
    }

    onSplash({ fighter, x, y }) {
        const pit = this.stage.pit;
        if (pit.splash.length) {
            this.effects.add(burst(x, y, { count: 18, colors: pit.splash, speed: [4, 11], size: [5, 10], angle: -Math.PI / 2, spread: 1.4, gravity: 0.45, life: [20, 34] }));
            this.effects.add(new RingPulse(x, y, { color: pit.splash[1], from: 10, to: 70, life: 16, width: 4 }));
        }
        this.audio.play(pit.sound, { x });
        this.camera.shake(4);
        if (fighter.floatSurface) this.effects.add(new Callout(x, y - 60, 'SPLASH!', { color: fighter.accentColor, size: 26 }));
    }

    onRingOut({ fighter, x, damage }) {
        if (fighter.isDead()) this.finalHit = { x, y: SCREEN.height - 140 };
        this.effects.add(new Callout(x, SCREEN.height - 120, 'RING OUT!', { color: '#ff6b6b' }));
        this.effects.add(new Callout(x, SCREEN.height - 80, `-${damage}`, { color: '#ffffff', size: 28 }));
        this.camera.shake(10);
        this.hitstop = Math.max(this.hitstop, 8);
        this.audio.play('ringout', { x });
        this.rumble(fighter, { strong: 1, weak: 0.6, duration: 350 });
        this.effects.add(new RingPulse(fighter.centerX, fighter.y + fighter.height / 2, { color: fighter.accentColor, from: 90, to: 20, life: 20, width: 5 }));
    }

    // ------------------------------------------------------------------ round flow

    checkRoundOver() {
        const [p1, p2] = this.fighters;
        const knockout = p1.isDead() || p2.isDead();
        if (!knockout && this.timeLeft > 0) return;

        this.round = Round.KO;
        this.roundTimer = 0;
        this.koReason = knockout ? 'ko' : (p1.health === p2.health ? 'draw' : 'time');
        if (knockout) {
            this.slowmo = KO_SLOWMO_FRAMES;
            this.koFlash = 8;
            this.camera.shake(14);
            // Hold on the winning hit, zoomed in, before the slow motion.
            const loser = p1.isDead() ? p1 : p2;
            const at = this.finalHit || { x: loser.centerX, y: loser.y + loser.height / 2 };
            this.koFreeze = this.koFreezeTotal = KO_FREEZE_FRAMES;
            loser.shakeFrames = loser.shakeTotal = KO_FREEZE_FRAMES;
            loser.shakeAmp = Math.max(loser.shakeAmp, 8);
            this.camera.focusOn(at.x, at.y, KO_ZOOM);
            this.effects.add(new FocusLines(at.x, at.y, { life: KO_FREEZE_FRAMES, inner: 190, count: 40, alpha: 0.6 }));
            this.effects.add(new ShockRing(at.x, at.y, { radius: 320, color: '#ffffff', width: 18, life: 24 }));
            this.view3d.flash(at.x, at.y, '#ffffff', 1.8);
            this.darken = { x: at.x, y: at.y, amount: 1.4 };
        }
        this.audio.play(knockout ? 'ko' : 'gong');
        if (knockout) for (const f of this.fighters) this.rumble(f, { strong: 0.8, weak: 0.8, duration: 500 });
        this.audio.announce({ ko: 'K. O.!', time: 'Time!', draw: 'Draw!' }[this.koReason], { pitch: 0.6, rate: 0.85 });
        this.audio.music.duck(true);
        for (const [me, other] of [[p1, p2], [p2, p1]]) {
            me.cancelAttack();
            me.burnTicks = 0;
            if (me.holding) { me.holding.heldBy = null; me.holding.stateMachine.stateData.released = true; me.holding = null; }
            const lost = me.isDead() || (!knockout && me.health < other.health);
            if (this.koReason !== 'draw') me.stateMachine.setState(lost ? S.DEFEAT : S.VICTORY);
            me.anchored = false;
        }
        this.match.projectiles = [];
    }

    finishRound() {
        const [p1, p2] = this.fighters;
        if (p2.isDead() || (!p1.isDead() && p1.health > p2.health)) this.wins[0]++;
        else if (p1.isDead() || p2.health > p1.health) this.wins[1]++;

        const winnerIndex = this.wins.findIndex((w) => w >= MATCH.roundsToWin);
        if (winnerIndex >= 0) {
            this.game.changeScene('result', { ...this.matchConfig, winner: winnerIndex + 1 });
        } else {
            this.startRound();
        }
    }

    // ------------------------------------------------------------------ render

    render(ctx) {
        // The 3-D picture and the 2-D layers both show the camera's view window.
        const view = this.camera.view();
        this.view3d.sync(this.match.projectiles);
        this.view3d.render(ctx, view);
        ctx.save();
        this.camera.apply(ctx, view);
        this.effects.render(ctx);
        for (const f of this.fighters) if (!f.isHidden()) f.renderNameTag(ctx);
        if (this.game.debug) this.renderDebug(ctx);
        ctx.restore();

        this.renderScreenFx(ctx);
        this.renderOffscreenMarkers(ctx);
        this.hud.render(ctx, { wins: this.wins, roundsToWin: MATCH.roundsToWin, seconds: Math.max(0, Math.ceil(this.timeLeft / 60)), time: this.stage.time, studio: this.game.studio });
        this.renderOverlay(ctx);
        if (this.online) this.renderNetStatus(ctx);
    }

    /** Online: the ping in the corner, and a notice while the other side's input is late. */
    renderNetStatus(ctx) {
        const { width, height } = SCREEN;
        if (this.online.rtt !== null) drawText(ctx, `PING ${Math.round(this.online.rtt)} ms`, 16, height - 14, { size: 16, align: 'left', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4, alpha: 0.8 });
        if (this.lockstep.stalls > SHOW_WAITING_AFTER) {
            drawText(ctx, 'WAITING FOR OPPONENT...', width / 2, height / 2 + 150, { size: 40, font: DISPLAY_FONT, weight: 'normal', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 7 });
        }
    }

    /** Darkened frame around a smash hit, white flashes, and the letterbox bars during a knockout. */
    renderScreenFx(ctx) {
        const { width, height } = SCREEN;
        if (this.darken) {
            const { x, y, amount } = this.darken;
            const g = ctx.createRadialGradient(x, y, 80, x, y, 900);
            g.addColorStop(0, 'rgba(12,6,20,0)');
            g.addColorStop(1, `rgba(12,6,20,${Math.min(0.75, 0.55 * amount)})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, width, height);
        }
        const flash = Math.max(this.screenFlash, this.koFlash / 10);
        if (flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, flash)})`;
            ctx.fillRect(0, 0, width, height);
        }
        if (this.round === Round.KO && this.koReason === 'ko') {
            const bar = 64 * Math.min(1, this.roundTimer / 10);
            ctx.fillStyle = '#0b0710';
            ctx.fillRect(0, 0, width, bar);
            ctx.fillRect(0, height - bar, width, bar);
        }
    }

    /** Fighters launched above the screen show up as an arrow at the top edge. */
    renderOffscreenMarkers(ctx) {
        for (const f of this.fighters) {
            if (f.y + f.height > 0) continue;
            const x = Math.max(20, Math.min(SCREEN.width - 20, f.centerX));
            const color = f.playerNumber === 1 ? '#85c1e9' : '#f1948a';
            ctx.save();
            ctx.fillStyle = color;
            ctx.strokeStyle = '#2a1d17';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x - 14, 30); ctx.lineTo(x + 14, 30); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
            drawText(ctx, f.label, x, 48, { size: 16, color, outline: '#2a1d17', outlineWidth: 4 });
        }
    }

    renderOverlay(ctx) {
        const { width, height } = SCREEN;
        if (this.round === Round.INTRO) {
            const roundNumber = this.wins[0] + this.wins[1] + 1;
            const first = this.roundTimer < 60;
            const local = (first ? this.roundTimer : this.roundTimer - 60) / 60;
            const scale = 1 + Math.max(0, 0.6 - local * 3);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(scale, scale);
            const title = this.isFinalRound() ? 'FINAL ROUND' : `ROUND ${roundNumber}`;
            drawText(ctx, first ? title : 'FIGHT!', 0, 0, {
                size: 120, font: DISPLAY_FONT, weight: 'normal', color: first ? '#fdf3dc' : '#f7c948', outline: '#2a1d17', outlineWidth: 12, baseline: 'middle'
            });
            ctx.restore();
            if (first) drawText(ctx, this.stage.name, width / 2, height / 2 + 64, { size: 30, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 6 });
        } else if (this.round === Round.KO) {
            // After a knockout the K.O. slams down once the frozen moment lets go.
            const t = this.roundTimer - this.koFreezeTotal;
            if (t < 0) return;
            const text = { ko: 'K.O.!', time: 'TIME!', draw: 'DRAW' }[this.koReason];
            ctx.fillStyle = 'rgba(42,29,23,0.45)';
            ctx.fillRect(0, height / 2 - 80, width, 160);
            const pop = this.koReason === 'ko' ? 1 + 1.6 * Math.max(0, 1 - t / 6) ** 2 : 1 + Math.max(0, 0.5 - t / 20);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(-0.05);
            ctx.scale(pop, pop);
            drawText(ctx, text, 0, 0, { size: 150, font: DISPLAY_FONT, weight: 'normal', color: '#f25c3b', outline: '#2a1d17', outlineWidth: 14, baseline: 'middle' });
            ctx.restore();
        }
    }

    /** Hurtboxes (green), active hitboxes (red), platforms and ledges (yellow). Toggle with the ` key. */
    renderDebug(ctx) {
        ctx.lineWidth = 2;
        for (const f of this.fighters) {
            const hurt = f.getHurtbox();
            ctx.strokeStyle = f.isIntangible() ? '#5dade2' : '#2ecc71';
            ctx.strokeRect(hurt.x, hurt.y, hurt.width, hurt.height);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.strokeRect(f.x, f.y, f.width, f.height);
            const hit = f.getAttackHitbox();
            if (hit) {
                ctx.strokeStyle = f.isHitboxActive() ? '#e74c3c' : 'rgba(231,76,60,0.35)';
                ctx.strokeRect(hit.x, hit.y, hit.width, hit.height);
            }
            drawText(ctx, `${f.stateMachine.currentState}${f.currentAttack ? ` · ${f.currentAttack.name} f${f.attackFrame}` : ''} · shield ${Math.round(f.shieldHP)}`, f.centerX, f.y + f.height + 18, { size: 12, color: '#fff', outline: '#000', outlineWidth: 3 });
        }
        for (const p of this.match.projectiles) { ctx.strokeStyle = '#e74c3c'; ctx.strokeRect(p.x, p.y, p.width, p.height); }
        ctx.strokeStyle = 'rgba(255,255,0,0.7)';
        for (const s of this.match.physics.surfaces) { ctx.beginPath(); ctx.moveTo(s.left, s.y); ctx.lineTo(s.right, s.y); ctx.stroke(); }
        for (const l of this.match.ledges) { ctx.fillStyle = l.occupant ? '#e74c3c' : '#f1c40f'; ctx.fillRect(l.x - 4, l.y - 4, 8, 8); }
    }
}

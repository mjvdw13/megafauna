// ============================================================================
// FIGHT SCENE
// Runs a best-of-N match: round intro → fight → KO → next round / result.
// The fighting itself happens in combat/match.js; this scene feeds it inputs
// (player 2 is a keyboard player or a CpuController) and turns the events it
// returns into hit sparks, sounds, hitstop and camera shake.
// ============================================================================
import { CpuController } from '../ai/cpu-controller.js';
import { attackSound } from '../audio/sfx.js';
import { MATCH, SCREEN } from '../config.js';
import { HitResult } from '../combat/combat-system.js';
import { Match } from '../combat/match.js';
import { CharacterStates as S } from '../combat/states.js';
import { Fighter } from '../fighters/fighter.js';
import { getCharacter } from '../fighters/roster.js';
import { spawnAttackStartVfx, spawnAttackVfx } from '../graphics/attack-vfx.js';
import { BlockSpark, burst, Callout, Camera, dustPuff, EffectsManager, HitSpark, RingPulse } from '../graphics/effects.js';
import { drawProjectile, projectileEndEffect } from '../graphics/projectile-art.js';
import { getStage } from '../stages/index.js';
import { Stage } from '../stages/stage.js';
import { FightHud } from '../ui/hud.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';

const Round = Object.freeze({ INTRO: 'intro', FIGHT: 'fight', KO: 'ko' });
const KO_SLOWMO_FRAMES = 50;
const TENSE_HEALTH = 0.3;
const TICK_SECONDS = 5;

export class FightScene {
    constructor(game) {
        this.game = game;
        this.effects = new EffectsManager();
        this.camera = new Camera();
        this.hud = new FightHud();
    }

    /** @param cpu  CPU difficulty for player 2, or null for a second human player */
    enter({ p1, p2, stage, cpu = null }) {
        this.matchConfig = { p1, p2, stage, cpu };
        this.stage = new Stage(getStage(stage));
        this.fighters = [
            new Fighter(getCharacter(p1), { playerNumber: 1, render: true }),
            new Fighter(getCharacter(p2), { playerNumber: 2, render: true, label: cpu ? 'CPU' : 'P2' })
        ];
        this.match = new Match(this.stage, this.fighters);
        this.cpu = cpu ? new CpuController(this.fighters[1], cpu) : null;
        this.wins = [0, 0];
        this.audio.music.play(this.stage.def.music || 'romp');
        this.startRound();
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
        this.koReason = null;
        this.effects.clear();
        this.camera.reset();
        this.hud.reset(this.fighters);
        this.cpu?.reset();
        this.audio.music.duck(false);
    }

    /** Both players are one round from winning. */
    isFinalRound() { return this.wins.every((w) => w === MATCH.roundsToWin - 1); }

    // ------------------------------------------------------------------ update

    update() {
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
            this.effects.update();
            this.camera.update();
            return;
        }

        this.timeLeft--;
        if (this.timeLeft % 60 === 0 && this.timeLeft > 0 && this.timeLeft <= TICK_SECONDS * 60) this.audio.play('tick');
        const [p1, p2] = this.fighters;
        const input = this.game.input;
        // Read both inputs before anyone moves, so the CPU sees the same moment a human would.
        const p2Input = this.cpu ? this.cpu.getInput(p1, this.stage) : input.getPlayerInput(2);
        const events = this.match.step([input.getPlayerInput(1), p2Input]);
        for (const event of events) this.onMatchEvent(event);

        // Burrowing fighters leave a trail of churned-up dirt.
        for (const f of this.fighters) {
            if (f.isHidden() && this.stage.time % 4 === 0) this.effects.add(dustPuff(f.centerX, f.feetY, { count: 3, spread: 30, size: [10, 16], color: 'rgba(120,90,60,0.9)' }));
        }

        const tense = this.isFinalRound() || this.fighters.some((f) => f.health / f.maxHealth < TENSE_HEALTH);
        this.audio.music.setIntensity(tense ? 1 : 0);
        this.effects.update();
        this.camera.update();
        this.checkRoundOver();
    }

    updateKo() {
        // Slow motion right after a knockout: simulate every other frame.
        if (this.slowmo > 0) {
            this.slowmo--;
            if (this.slowmo % 2 === 1) return;
        }
        if (this.koFlash > 0) this.koFlash--;
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
        this.effects.update();
        this.camera.update();

        if (this.roundTimer >= MATCH.koFrames + KO_SLOWMO_FRAMES / 2) this.finishRound();
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
            default:
        }
    }

    onHit(hit) {
        const { attack, attacker, defender, result, x, y } = hit;
        const direction = Math.sign(defender.centerX - attacker.centerX) || (attacker.facingRight ? 1 : -1);
        switch (result) {
            case HitResult.BLOCK:
                this.effects.add(new BlockSpark(x, y, direction));
                this.effects.add(burst(x, y, { count: 6, colors: ['#85c1e9', '#d6eaf8'], speed: [2, 5], size: [3, 6], angle: direction > 0 ? Math.PI : 0, spread: 1.6 }));
                this.hitstop = Math.max(this.hitstop, Math.ceil(attack.hitstop / 2));
                this.camera.shake(2);
                this.audio.play('block', { x });
                return;
            case HitResult.SHIELD_BREAK:
                this.hitstop = Math.max(this.hitstop, 14);
                this.camera.shake(10);
                return; // the fighter's shieldBreak event plays the shatter
            case HitResult.ARMOR:
                this.effects.add(new RingPulse(defender.centerX, defender.y + defender.height / 2, { color: '#ff9f43', from: 30, to: 110, life: 14, width: 7 }));
                this.effects.add(burst(x, y, { count: 10, colors: ['#ff9f43', '#fff'], speed: [4, 9], size: [2, 4], shape: 'line', gravity: 0 }));
                this.hitstop = Math.max(this.hitstop, 7);
                this.camera.shake(6);
                this.audio.play('armor', { x });
                return;
            case HitResult.COUNTER:
                this.effects.add(new RingPulse(defender.centerX, defender.y + defender.height / 2, { color: '#ffffff', from: 120, to: 30, life: 14, width: 8 }));
                this.effects.add(new Callout(defender.centerX, defender.y - 20, 'COUNTER!', { color: defender.accentColor }));
                this.hitstop = Math.max(this.hitstop, 10);
                this.audio.play('armor', { x });
                return;
            case HitResult.REFLECT:
                this.effects.add(new RingPulse(x, y, { color: attacker.accentColor, from: 10, to: 70, life: 12, width: 5 }));
                this.audio.play('reflect', { x });
                return;
            case HitResult.GRAB:
                this.hitstop = Math.max(this.hitstop, 4);
                this.audio.play('grab', { x });
                return;
            default:
        }
        // A clean hit
        const heavy = attack.strength !== 'light';
        this.effects.add(new HitSpark(x, y, { heavy: heavy && !hit.pummel, color: attacker.accentColor, direction }));
        this.effects.add(burst(x, y, {
            count: heavy ? 14 : 8, colors: ['#f1c40f', '#e74c3c', '#fff', attacker.accentColor],
            speed: heavy ? [5, 11] : [3, 7], size: heavy ? [4, 9] : [3, 7],
            angle: direction > 0 ? 0 : Math.PI, spread: 2.4
        }));
        const hitstop = hit.pummel ? 4 : attack.hitstop + Math.round((attacker.damageScale - 1) * 10);
        this.hitstop = Math.max(this.hitstop, hitstop);
        defender.shakeFrames = hitstop;
        this.camera.shake(heavy ? Math.min(16, 6 + hit.damage * 0.4) : 4);
        this.audio.play('hit', { x, damage: hit.damage, heavy, combo: hit.comboHit });
        // Controller rumble: the one who got hit feels it most.
        const pads = this.game.input.gamepads;
        const k = Math.min(1, hit.damage / 18);
        pads.rumble(defender.playerNumber, { strong: 0.3 + 0.7 * k, weak: 0.5, duration: 80 + 160 * k });
        pads.rumble(attacker.playerNumber, { strong: 0.1, weak: 0.3 * k + 0.1, duration: 60 });
        if (attack.knockdown) {
            this.effects.add(dustPuff(defender.centerX, defender.feetY, { count: 8, spread: defender.width }));
            this.audio.play('knockdown', { x });
        }
        if (hit.thrown) this.audio.play('whoosh', { x, strength: 'heavy' });
        if (hit.dizzy) this.effects.add(new Callout(defender.centerX, defender.y - 30, 'P-U!', { color: '#9ccc4a', size: 30 }));
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
            case 'jump':
                this.audio.play(event.double ? 'flap' : 'jump', { x });
                if (event.double) this.effects.add(new RingPulse(x, fighter.feetY, { color: '#ffffff', from: 10, to: 40, life: 10, width: 3 }));
                break;
            case 'land':
                this.effects.add(dustPuff(x, fighter.feetY, { count: heavy ? 10 : 5, spread: fighter.width * 0.8, size: heavy ? [14, 22] : [8, 14] }));
                if (heavy) this.camera.shake(5);
                this.audio.play('land', { x, heavy });
                break;
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
        this.effects.add(new Callout(x, SCREEN.height - 120, 'RING OUT!', { color: '#ff6b6b' }));
        this.effects.add(new Callout(x, SCREEN.height - 80, `-${damage}`, { color: '#ffffff', size: 28 }));
        this.camera.shake(10);
        this.hitstop = Math.max(this.hitstop, 8);
        this.audio.play('ringout', { x });
        this.game.input.gamepads.rumble(fighter.playerNumber, { strong: 1, weak: 0.6, duration: 350 });
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
        if (knockout) { this.slowmo = KO_SLOWMO_FRAMES; this.koFlash = 8; this.camera.shake(14); }
        this.audio.play(knockout ? 'ko' : 'gong');
        if (knockout) for (const f of this.fighters) this.game.input.gamepads.rumble(f.playerNumber, { strong: 0.8, weak: 0.8, duration: 500 });
        this.audio.announce({ ko: 'K. O.!', time: 'Time!', draw: 'Draw!' }[this.koReason], { pitch: 0.6, rate: 0.85 });
        this.audio.music.duck(true);
        for (const [me, other] of [[p1, p2], [p2, p1]]) {
            me.cancelAttack();
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
        ctx.save();
        this.camera.apply(ctx);
        this.stage.renderBack(ctx);
        // Draw the attacker on top so their swing reads clearly.
        const order = [...this.fighters].sort((a, b) => Number(a.stateMachine.isAttacking()) - Number(b.stateMachine.isAttacking()));
        for (const f of order) f.render(ctx);
        for (const p of this.match.projectiles) drawProjectile(ctx, p, this.stage.time);
        this.effects.render(ctx);
        this.stage.renderFront(ctx);
        if (this.game.debug) this.renderDebug(ctx);
        ctx.restore();

        this.renderOffscreenMarkers(ctx);
        if (this.koFlash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.koFlash / 10})`;
            ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
        }
        this.hud.render(ctx, { wins: this.wins, roundsToWin: MATCH.roundsToWin, seconds: Math.max(0, Math.ceil(this.timeLeft / 60)), time: this.stage.time });
        this.renderOverlay(ctx);
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
            const text = { ko: 'K.O.!', time: 'TIME!', draw: 'DRAW' }[this.koReason];
            ctx.fillStyle = 'rgba(42,29,23,0.45)';
            ctx.fillRect(0, height / 2 - 80, width, 160);
            const pop = 1 + Math.max(0, 0.5 - this.roundTimer / 20);
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

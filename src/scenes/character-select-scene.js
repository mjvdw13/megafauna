// ============================================================================
// CHARACTER SELECT SCENE
// Versus: each player moves their own cursor. Vs CPU: player 1 picks their
// fighter, then picks the CPU's.
// Secret: press up five times to unlock Dad.
// ============================================================================
import { SCREEN } from '../config.js';
import { SecretCode, unlock } from '../core/unlocks.js';
import { availableRoster } from '../fighters/roster.js';
import { INK_COLOR as INK } from '../graphics/ink.js';
import { characterBadges, renderStatBars } from '../ui/stat-bars.js';
import { beginUi, inkPanel, inkRectPath } from '../ui/ink-ui.js';
import { drawText, drawWrappedText, DISPLAY_FONT } from '../ui/text.js';

const PANEL = { width: 470, height: 470, y: 92 };
const PLAYER_COLORS = { 1: '#2f80c9', 2: '#d6452f' };
const SECRET = Object.freeze({ id: 'dad', code: ['up', 'up', 'up', 'up', 'up'] });
const REVEAL_FRAMES = 170;

class PlayerCursor {
    /** @param scene  the select scene; its `roster` is the list being browsed */
    constructor(scene, playerNumber, index) {
        this.scene = scene;
        this.playerNumber = playerNumber;
        this.index = index;
        this.ready = false;
    }

    get def() { return this.scene.roster[this.index]; }

    move(delta) {
        const count = this.scene.roster.length;
        this.index = (this.index + delta + count) % count;
    }

    setReady(ready) {
        this.ready = ready;
    }
}

export class CharacterSelectScene {
    constructor(game) {
        this.game = game;
        this.time = 0;
        this.reveal = 0;
    }

    enter() {
        const { session } = this.game;
        this.vsCpu = session.mode === 'cpu';
        this.game.audio.music.play('title');
        this.loadRoster();
        this.cursors = [
            new PlayerCursor(this, 1, this.indexOf(session.p1, 0)),
            new PlayerCursor(this, 2, this.indexOf(session.p2, 1 % this.roster.length))
        ];
        this.codes = [new SecretCode(SECRET.code), new SecretCode(SECRET.code)];
        this.reveal = 0;
    }

    loadRoster() {
        this.roster = availableRoster();
    }

    indexOf(id, fallback) {
        const i = this.roster.findIndex((c) => c.id === id);
        return i >= 0 ? i : fallback;
    }

    /** The secret code was entered: unlock the secret character (if needed) and jump that player's cursor to them. */
    revealSecret(cursor) {
        const { audio } = this.game;
        const ids = this.cursors.map((c) => c.def.id);
        const isNew = unlock(SECRET.id);
        this.loadRoster();
        this.cursors.forEach((c, i) => { c.index = this.indexOf(ids[i], 0); });
        if (!cursor.ready) {
            cursor.index = this.indexOf(SECRET.id, cursor.index);
        }
        if (isNew) {
            this.reveal = REVEAL_FRAMES;
            audio.play('secret');
            audio.announce('Here comes Dad!', { pitch: 0.6, rate: 0.9 });
        } else {
            audio.play('ready');
        }
    }

    /** The cursor player 1 is steering in vs-CPU mode: their own, then the CPU's once theirs is locked in. */
    get activeCpuModeCursor() { return this.cursors[0].ready ? this.cursors[1] : this.cursors[0]; }

    update() {
        this.time++;
        const { input, audio } = this.game;
        if (this.reveal > 0) this.reveal--;
        // Secret code: in vs-CPU mode player 1 enters it for whichever cursor they're steering.
        if (this.codes[0].feed(input.player1)) this.revealSecret(this.vsCpu ? this.activeCpuModeCursor : this.cursors[0]);
        if (!this.vsCpu && this.codes[1].feed(input.player2)) this.revealSecret(this.cursors[1]);
        // Cancel with nobody ready goes back to the title (checked before this frame's cancel un-readies anyone).
        const nobodyReady = this.cursors.every((c) => !c.ready);
        if (this.vsCpu) {
            const [mine, cpu] = this.cursors;
            const pad = input.player1;
            if (pad.cancelPressed && (mine.ready || cpu.ready)) {
                (cpu.ready ? cpu : mine).setReady(false);
                audio.play('menu-back');
            } else {
                this.steer(this.activeCpuModeCursor, pad);
            }
        } else {
            for (const cursor of this.cursors) {
                const pad = input.getPlayerInput(cursor.playerNumber);
                if (!cursor.ready) this.steer(cursor, pad);
                else if (pad.cancelPressed) { cursor.setReady(false); audio.play('menu-back'); }
            }
        }

        if (this.cursors.every((c) => c.ready)) {
            this.game.session.p1 = this.cursors[0].def.id;
            this.game.session.p2 = this.cursors[1].def.id;
            this.game.changeScene('stageSelect');
        } else if (input.menu.back || (nobodyReady && input.anyCancel())) {
            audio.play('menu-back');
            this.game.changeScene('title');
        }
    }

    steer(cursor, pad) {
        if (cursor.ready) return;
        const { audio } = this.game;
        if (pad.leftPressed) { cursor.move(-1); audio.play('menu-move'); }
        if (pad.rightPressed) { cursor.move(1); audio.play('menu-move'); }
        if (pad.confirmPressed) { cursor.setReady(true); audio.play('ready'); }
    }

    playerTag(cursor) { return this.vsCpu && cursor.playerNumber === 2 ? 'CPU' : `P${cursor.playerNumber}`; }

    render(ctx) {
        const { width, height } = SCREEN;
        beginUi(this.time);
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#e9a65a'); grad.addColorStop(0.55, '#d7744a'); grad.addColorStop(1, '#8c3d3a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        // Painted sunburst behind the cards
        ctx.save();
        ctx.translate(width / 2, 330);
        ctx.fillStyle = 'rgba(255,240,200,0.12)';
        for (let i = 0; i < 16; i++) {
            ctx.rotate(Math.PI / 8);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-50, -900); ctx.lineTo(50, -900); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        const pickingCpu = this.vsCpu && this.cursors[0].ready && !this.cursors[1].ready;
        drawText(ctx, pickingCpu ? 'PICK YOUR OPPONENT' : 'SELECT YOUR FIGHTER', width / 2, 66, { size: 58, font: DISPLAY_FONT, weight: 'normal', color: '#fdf3dc', outline: INK, outlineWidth: 8 });
        this.renderPanel(ctx, this.cursors[0], 50);
        this.renderPanel(ctx, this.cursors[1], width - 50 - PANEL.width);
        drawText(ctx, 'VS', width / 2, 350, { size: 92, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: INK, outlineWidth: 9 });
        this.renderRosterStrip(ctx);
        if (this.reveal > 0) this.renderReveal(ctx);
        const help = this.vsCpu ? 'A/D choose · J confirm · K cancel · ESC back' : 'A/D or ←/→ choose · J / Num1 confirm · K / Num2 cancel · ESC back';
        drawText(ctx, help, width / 2, 708, { size: 18, color: '#fdf3dc', outline: INK, outlineWidth: 4 });
    }

    renderPanel(ctx, cursor, x) {
        const { def, ready } = cursor;
        const y = PANEL.y;
        const pColor = PLAYER_COLORS[cursor.playerNumber];
        inkPanel(ctx, x, y, PANEL.width, PANEL.height, { fill: ready ? '#e4f5d2' : '#fdf3dc', radius: 18, lineWidth: 4 });

        drawText(ctx, this.playerTag(cursor), x + 26, y + 40, { size: 34, font: DISPLAY_FONT, weight: 'normal', color: pColor, align: 'left', outline: INK, outlineWidth: 4 });
        drawText(ctx, def.name.toUpperCase(), x + PANEL.width / 2, y + 48, { size: 50, font: DISPLAY_FONT, weight: 'normal', color: def.color, outline: INK, outlineWidth: 6 });
        drawText(ctx, `${def.species} · ${def.tagline}`, x + PANEL.width / 2, y + 76, { size: 20, color: '#6b5a4e' });

        // Animated 3-D preview, facing the opponent's panel
        this.game.studio.draw(ctx, { x: x + 14, y: y + 92, width: 200, height: 200 }, def, {
            key: `card-${cursor.playerNumber}`, state: ready ? 'victory' : 'idle', facingRight: cursor.playerNumber === 1
        });
        if (!ready) {
            drawText(ctx, '◀', x + 18, y + 200, { size: 28, color: INK });
            drawText(ctx, '▶', x + 212, y + 200, { size: 28, color: INK });
        }

        renderStatBars(ctx, def.stats, x + 230, y + 100, { width: 220, color: def.color });

        let bx = x + 230;
        for (const badge of characterBadges(def)) {
            ctx.font = '15px "Patrick Hand", sans-serif';
            const w = ctx.measureText(badge).width + 18;
            inkPanel(ctx, bx, y + 266, w, 24, { fill: '#f7c948', radius: 12, lineWidth: 2.2, shadow: false });
            drawText(ctx, badge, bx + w / 2, y + 284, { size: 15, color: INK });
            bx += w + 6;
        }

        const lines = drawWrappedText(ctx, def.description, x + PANEL.width / 2, y + 314, PANEL.width - 48, 19, { size: 16, color: '#4a3b30' });

        // Special moves list: special alone, or with a direction
        const top = y + 314 + lines * 19 + 8;
        const specials = [['•', 'neutralSpecial'], ['←→', 'sideSpecial'], ['↑', 'upSpecial'], ['↓', 'downSpecial']];
        drawText(ctx, `SPECIALS  (${cursor.playerNumber === 1 ? 'L' : 'Num3'} + direction)`, x + 26, top, { size: 16, font: DISPLAY_FONT, weight: 'normal', color: '#8c7a6b', align: 'left' });
        specials.forEach(([keys, slot], i) => {
            const move = def.moves[slot];
            if (!move) return;
            drawText(ctx, keys, x + 26, top + 21 + i * 19, { size: 17, color: pColor, align: 'left' });
            drawText(ctx, move.name, x + 62, top + 21 + i * 19, { size: 17, color: INK, align: 'left' });
        });

        if (ready) drawText(ctx, 'READY!', x + PANEL.width - 28, y + 448, { size: 42, font: DISPLAY_FONT, weight: 'normal', color: '#5fb83f', align: 'right', outline: INK, outlineWidth: 5 });
    }

    renderRosterStrip(ctx) {
        const size = 82, gap = 18;
        const total = this.roster.length * size + (this.roster.length - 1) * gap;
        const startX = SCREEN.width / 2 - total / 2, y = 590;
        this.roster.forEach((def, i) => {
            const x = startX + i * (size + gap);
            inkPanel(ctx, x, y, size, size, { fill: def.color, radius: 14, lineWidth: 3 });
            ctx.save();
            ctx.clip(inkRectPath(x + 4, y + 4, size - 8, size - 8, 10));
            ctx.fillStyle = '#fdf3dc';
            ctx.fillRect(x, y, size, size);
            this.game.studio.draw(ctx, { x, y, width: size, height: size }, def, { key: `roster-${i}`, portrait: true });
            ctx.restore();
            this.cursors.filter((c) => c.index === i).forEach((c, k) => {
                ctx.lineWidth = 5;
                ctx.strokeStyle = PLAYER_COLORS[c.playerNumber];
                const inset = -6 + k * 7;
                ctx.stroke(inkRectPath(x + inset, y + inset, size - inset * 2, size - inset * 2, 16));
            });
        });
    }

    /** "SECRET CHARACTER UNLOCKED!" banner that pops in over the middle of the screen. */
    renderReveal(ctx) {
        const { width } = SCREEN;
        const age = REVEAL_FRAMES - this.reveal;
        const fade = Math.min(1, this.reveal / 20);
        const pop = 1 + Math.max(0, 0.6 - age / 12);
        ctx.save();
        ctx.globalAlpha = fade;
        // Spinning light rays
        ctx.translate(width / 2, 330);
        ctx.save();
        ctx.rotate(age * 0.02);
        ctx.fillStyle = 'rgba(255,240,170,0.35)';
        for (let i = 0; i < 12; i++) {
            ctx.rotate(Math.PI / 6);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -420); ctx.lineTo(40, -420); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.scale(pop, pop);
        inkPanel(ctx, -330, -70, 660, 140, { fill: '#2a1d17', radius: 20, lineWidth: 4 });
        drawText(ctx, 'SECRET CHARACTER UNLOCKED!', 0, -12, { size: 46, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: INK, outlineWidth: 7 });
        drawText(ctx, 'DAD JOINS THE BRAWL!', 0, 44, { size: 40, font: DISPLAY_FONT, weight: 'normal', color: '#4aa3df', outline: INK, outlineWidth: 6 });
        ctx.restore();
    }
}

// ============================================================================
// ONLINE SCENE
// The lobby for a 1v1 with a friend over the internet (see net/online.js).
// Host: shows the invite link (C copies it) until the friend joins.
// Both: pick a fighter with ←/→, confirm when ready. The host also picks the
// stage (↑/↓). When both are ready the host starts the fight on both screens.
// After a fight the result screen comes back here, still connected.
// ============================================================================
import { SCREEN } from '../config.js';
import { availableRoster, getCharacter } from '../fighters/roster.js';
import { INK_COLOR as INK } from '../graphics/ink.js';
import { clearInviteFromUrl, OnlineSession } from '../net/online.js';
import { STAGES } from '../stages/index.js';
import { beginUi, inkPanel } from '../ui/ink-ui.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';

const PANEL = { width: 420, height: 400, y: 150 };
const PLAYER_COLORS = ['#2f80c9', '#d6452f'];

export class OnlineScene {
    constructor(game) {
        this.game = game;
        this.time = 0;
        this.pickIndex = 0;
        this.stageIndex = 0;
    }

    /** @param role  'host' or 'guest' to start a new session; omit to come back to the current one */
    enter({ role, code } = {}) {
        const { game } = this;
        this.roster = availableRoster();
        if (role) {
            game.online?.close();
            game.online = new OnlineSession(role, code);
            game.online.start();
            // Host starts on the first fighter, guest on the second, so a quick double-confirm isn't a mirror match.
            this.pickIndex = game.online.localIndex % this.roster.length;
        }
        this.session = game.online;
        this.ready = false;
        this.announced = false;
        this.time = 0;
        game.audio.music.play('title');
    }

    /** On-screen buttons for each stage of the lobby (see core/touch.js). */
    get touchButtons() {
        const session = this.session;
        if (session.closed || !session.connected) {
            return session.status === 'waiting' && !session.closed ? { smash: 'CANCEL', share: 'SHARE LINK' } : { smash: 'BACK' };
        }
        return this.ready ? { smash: 'CHANGE' } : { attack: 'READY', smash: 'LEAVE' };
    }

    get isHost() { return this.session.role === 'host'; }
    get myPick() { return this.roster[this.pickIndex].id; }
    get stageId() { return STAGES[this.stageIndex].id; }

    shareLobby() { this.session.sendLobby(this.myPick, this.ready, this.isHost ? this.stageId : null); }

    leave() {
        this.session.close();
        this.game.online = null;
        clearInviteFromUrl();
        this.game.audio.play('menu-back');
        this.game.changeScene('title');
    }

    update() {
        this.time++;
        const { input, audio } = this.game;
        const session = this.session;
        const pad = input.combined();

        if (session.closed || !session.connected) {
            if (input.menu.back || pad.cancelPressed) { this.leave(); return; }
            if (session.status === 'waiting' && input.menu.copy) this.copyLink();
            return;
        }
        // Just connected (or back from a fight): tell the other side where we are.
        if (!this.announced) { this.announced = true; this.shareLobby(); audio.play('ready'); }

        const start = session.takeStart();
        if (start) {
            audio.play('menu-confirm');
            this.game.changeScene('fight', { ...start, online: session });
            return;
        }

        let changed = false;
        if (!this.ready) {
            if (pad.leftPressed || pad.rightPressed) {
                const n = this.roster.length;
                this.pickIndex = (this.pickIndex + (pad.leftPressed ? -1 : 1) + n) % n;
                changed = true;
            }
            if (this.isHost && (pad.upPressed || pad.downPressed)) {
                const n = STAGES.length;
                this.stageIndex = (this.stageIndex + (pad.upPressed ? -1 : 1) + n) % n;
                changed = true;
            }
            if (changed) audio.play('menu-move');
            if (pad.confirmPressed || input.menu.confirm) { this.ready = true; changed = true; audio.play('ready'); }
            else if (input.menu.back || pad.cancelPressed) { this.leave(); return; }
        } else if (input.menu.back || pad.cancelPressed) {
            this.ready = false;
            changed = true;
            audio.play('menu-back');
        }
        if (changed) this.shareLobby();

        const remote = session.remote;
        if (this.isHost && this.ready && remote.ready && remote.pick) {
            session.hostStart({ p1: this.myPick, p2: remote.pick, stage: this.stageId });
        }
    }

    /** Touch: open the phone's share sheet for the invite (or copy it where there isn't one). Runs inside the tap. */
    shareLink() {
        if (this.session?.status !== 'waiting') return;
        if (!navigator.share) { this.copyLink(); return; }
        navigator.share({ title: 'MegaFauna', text: 'Fight me in MegaFauna!', url: this.session.inviteUrl }).catch(() => {});
    }

    copyLink() {
        const { game } = this;
        navigator.clipboard.writeText(this.session.inviteUrl).then(
            () => { game.toast = { text: 'INVITE LINK COPIED', frames: 120 }; game.audio.play('menu-confirm'); },
            () => { game.toast = { text: "COULDN'T COPY: TYPE THE LINK INSTEAD", frames: 180 }; }
        );
    }

    // ------------------------------------------------------------------ render

    render(ctx) {
        const { width, height } = SCREEN;
        beginUi(this.time);
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#5a8fc9'); grad.addColorStop(0.6, '#3c5f9a'); grad.addColorStop(1, '#2a3560');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        drawText(ctx, 'PLAY ONLINE', width / 2, 70, { size: 64, font: DISPLAY_FONT, weight: 'normal', color: '#fdf3dc', outline: INK, outlineWidth: 8 });

        const session = this.session;
        const touch = this.game.touchActive;
        if (session.closed) this.renderMessage(ctx, session.error || 'Disconnected.', touch ? 'BACK: back to the title screen' : 'ESC or K: back to the title screen');
        else if (session.status === 'connecting') this.renderMessage(ctx, this.isHost ? 'Creating your invite...' : 'Joining your friend...', touch ? 'BACK: cancel' : 'ESC: cancel');
        else if (session.status === 'waiting') this.renderInvite(ctx);
        else this.renderLobby(ctx);
    }

    renderMessage(ctx, text, hint) {
        const { width } = SCREEN;
        inkPanel(ctx, width / 2 - 420, 250, 840, 180, { fill: '#fdf3dc', radius: 18, lineWidth: 4 });
        drawText(ctx, text, width / 2, 350, { size: 34, color: INK });
        drawText(ctx, hint, width / 2, 640, { size: 22, color: '#fdf3dc', outline: INK, outlineWidth: 4 });
    }

    renderInvite(ctx) {
        const { width } = SCREEN;
        inkPanel(ctx, width / 2 - 520, 170, 1040, 300, { fill: '#fdf3dc', radius: 18, lineWidth: 4 });
        drawText(ctx, 'Send this link to a friend:', width / 2, 240, { size: 34, color: INK });
        drawText(ctx, this.session.inviteUrl, width / 2, 320, { size: 30, font: 'monospace', color: '#2f80c9' });
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 0.1);
        // With touch controls the SHARE LINK button sits here instead (see core/touch.js).
        if (!this.game.touchActive) drawText(ctx, 'Press C to copy it', width / 2, 400, { size: 40, font: DISPLAY_FONT, weight: 'normal', color: '#f25c3b', outline: INK, outlineWidth: 5 });
        drawText(ctx, `Waiting for your friend to open it${'.'.repeat(Math.floor(this.time / 20) % 4)}`, width / 2, 530, { size: 28, color: '#fdf3dc', outline: INK, outlineWidth: 5, alpha: pulse });
        drawText(ctx, 'When they join you each pick a fighter. You play on the left; your friend on the right.', width / 2, 590, { size: 20, color: '#fdf3dc', outline: INK, outlineWidth: 4 });
        drawText(ctx, this.game.touchActive ? 'CANCEL: stop waiting' : 'ESC: cancel', width / 2, 690, { size: 20, color: '#fdf3dc', outline: INK, outlineWidth: 4 });
    }

    renderLobby(ctx) {
        const { width } = SCREEN;
        const session = this.session;
        const me = { pick: this.myPick, ready: this.ready };
        const them = session.remote;
        const sides = this.isHost ? [me, them] : [them, me];
        sides.forEach((side, i) => this.renderPanel(ctx, side, i, i === session.localIndex, i === 0 ? 60 : width - 60 - PANEL.width));

        // The stage, picked by the host
        const stageId = this.isHost ? this.stageId : them.stage;
        const stage = STAGES.find((s) => s.id === stageId);
        drawText(ctx, 'VS', width / 2, 300, { size: 92, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: INK, outlineWidth: 9 });
        drawText(ctx, 'STAGE', width / 2, 400, { size: 22, color: '#fdf3dc', outline: INK, outlineWidth: 4 });
        drawText(ctx, stage ? stage.name : '...', width / 2, 440, { size: 32, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: INK, outlineWidth: 5 });
        if (this.isHost && !this.ready) drawText(ctx, this.game.touchActive ? '▲ stick ▼' : '▲ W / S ▼', width / 2, 474, { size: 18, color: '#fdf3dc', outline: INK, outlineWidth: 4 });

        const ping = session.rtt === null ? '' : `   ·   ping ${Math.round(session.rtt)} ms`;
        drawText(ctx, `Connected${ping}`, width / 2, 600, { size: 22, color: '#bdf5a0', outline: INK, outlineWidth: 4 });
        const touch = this.game.touchActive;
        const help = this.ready
            ? (them.ready ? 'Starting...' : `Waiting for your opponent to be ready · ${touch ? 'CHANGE' : 'K / ESC'}: change your pick`)
            : touch ? `Stick ← / → choose${this.isHost ? ' · ↑ / ↓ stage' : ''} · READY when set · LEAVE to quit`
                : `A/D or ←/→ choose · J confirm${this.isHost ? ' · W/S stage' : ''} · ESC leave`;
        drawText(ctx, help, width / 2, 690, { size: 20, color: '#fdf3dc', outline: INK, outlineWidth: 4 });
    }

    renderPanel(ctx, side, index, mine, x) {
        const y = PANEL.y;
        inkPanel(ctx, x, y, PANEL.width, PANEL.height, { fill: side.ready ? '#e4f5d2' : '#fdf3dc', radius: 18, lineWidth: 4 });
        drawText(ctx, mine ? `P${index + 1} · YOU` : `P${index + 1} · FRIEND`, x + 24, y + 40, { size: 30, font: DISPLAY_FONT, weight: 'normal', color: PLAYER_COLORS[index], align: 'left', outline: INK, outlineWidth: 4 });
        if (!side.pick) {
            drawText(ctx, 'choosing...', x + PANEL.width / 2, y + 220, { size: 30, color: '#8c7a6b' });
            return;
        }
        const def = getCharacter(side.pick);
        drawText(ctx, def.name.toUpperCase(), x + PANEL.width / 2, y + 96, { size: 50, font: DISPLAY_FONT, weight: 'normal', color: def.color, outline: INK, outlineWidth: 6 });
        drawText(ctx, def.species, x + PANEL.width / 2, y + 124, { size: 20, color: '#6b5a4e' });
        this.game.studio.draw(ctx, { x: x + PANEL.width / 2 - 120, y: y + 136, width: 240, height: 220 }, def, {
            key: `online-${index}`, state: side.ready ? 'victory' : 'idle', facingRight: index === 0
        });
        if (mine && !side.ready) {
            drawText(ctx, '◀', x + 40, y + 250, { size: 32, color: INK });
            drawText(ctx, '▶', x + PANEL.width - 40, y + 250, { size: 32, color: INK });
        }
        if (side.ready) drawText(ctx, 'READY!', x + PANEL.width - 24, y + PANEL.height - 20, { size: 40, font: DISPLAY_FONT, weight: 'normal', color: '#5fb83f', align: 'right', outline: INK, outlineWidth: 5 });
    }
}

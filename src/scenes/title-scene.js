// ============================================================================
// TITLE SCENE
// Main menu: fight the CPU, another player here or a friend online, and pick
// the CPU's difficulty.
// Behind it, the roster stands on the Sunny Meadow island in 3-D.
// ============================================================================
import { CPU_LEVEL_IDS, CPU_LEVELS } from '../ai/cpu-controller.js';
import { SCREEN } from '../config.js';
import { availableRoster } from '../fighters/roster.js';
import { Actor } from '../render3d/actor.js';
import { getWorld } from '../render3d/worlds.js';
import { STAGES } from '../stages/index.js';
import { beginUi, inkPanel } from '../ui/ink-ui.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';

const MENU = Object.freeze([
    { id: 'cpu', label: '1 PLAYER  VS  CPU' },
    { id: 'versus', label: '2 PLAYERS' },
    { id: 'online', label: 'PLAY A FRIEND ONLINE' },
    { id: 'level', label: 'CPU LEVEL' }
]);
const MENU_TOP = 316;
const ROW_HEIGHT = 44;

export class TitleScene {
    constructor(game) {
        this.game = game;
        this.time = 0;
        this.paper = false;
        this.actors = [];
    }

    enter() {
        this.time = 0;
        // Line up everyone who can be picked (a secret character joins once unlocked).
        this.roster = availableRoster();
        this.world = getWorld(STAGES[0], this.game.view);
        this.actors = this.roster.map((def) => new Actor(def));
        const slot = 260, startX = SCREEN.width / 2 - (this.roster.length * slot) / 2;
        this.actors.forEach((actor, i) => {
            actor.facingRight = i < this.roster.length / 2;
            actor.holder.position.set(this.world.toWorldX(startX + i * slot + slot / 2), 0, 0.4);
            this.world.scene.add(actor.holder);
        });
        this.index = this.game.session.mode === 'versus' ? 1 : 0;
        this.game.audio.music.play('title');
    }

    exit() {
        for (const actor of this.actors) this.world.scene.remove(actor.holder);
        this.actors = [];
    }

    update() {
        this.time++;
        const { input, audio, session } = this.game;
        const pads = [input.player1, input.player2];
        const pressed = (action) => pads.some((pad) => pad[`${action}Pressed`]);

        if (pressed('up') || pressed('down')) {
            this.index = (this.index + (pressed('up') ? -1 : 1) + MENU.length) % MENU.length;
            audio.play('menu-move');
        }
        if (MENU[this.index].id === 'level' && (pressed('left') || pressed('right'))) {
            const i = CPU_LEVEL_IDS.indexOf(session.cpuLevel);
            session.cpuLevel = CPU_LEVEL_IDS[(i + (pressed('left') ? -1 : 1) + CPU_LEVEL_IDS.length) % CPU_LEVEL_IDS.length];
            audio.play('menu-move');
        }
        if (input.anyConfirm() && MENU[this.index].id === 'online') {
            audio.play('menu-confirm');
            this.game.changeScene('online', { role: 'host' });
        } else if (input.anyConfirm()) {
            session.mode = MENU[this.index].id === 'versus' ? 'versus' : 'cpu';
            audio.play('menu-confirm');
            this.game.changeScene('characterSelect');
        }
    }

    render(ctx) {
        const { width, height } = SCREEN;
        for (const actor of this.actors) actor.update(actor.facingRight);
        this.world.update(1 / 60);
        this.world.render(ctx, this.game.view);
        ctx.fillStyle = 'rgba(40,24,30,0.3)';
        ctx.fillRect(0, 0, width, height);

        const scale = 1 + Math.sin(this.time * 0.05) * 0.04;
        ctx.save();
        ctx.translate(width / 2, 190);
        ctx.scale(scale, scale);
        drawText(ctx, 'MEGAFAUNA', 0, 0, { size: 140, font: DISPLAY_FONT, weight: 'normal', color: '#f25c3b', outline: '#2a1d17', outlineWidth: 12 });
        ctx.restore();
        drawText(ctx, 'A Browser Brawl of Beasts', width / 2, 256, { size: 30, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5 });

        // The roster lined up along the bottom
        const slot = 260;
        const startX = width / 2 - (this.roster.length * slot) / 2;
        this.roster.forEach((def, i) => {
            drawText(ctx, def.name, startX + i * slot + slot / 2, 620, { size: 26, font: DISPLAY_FONT, weight: 'normal', color: def.color, outline: '#2a1d17', outlineWidth: 5 });
        });

        this.renderMenu(ctx);
        const hint = { size: 16, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4 };
        drawText(ctx, 'P1: WASD move · W or Space jump · J attack · K smash · L special · ; shield', width / 2, 642, hint);
        drawText(ctx, 'P2: Arrows move · ↑ or Num5 jump · Num1 attack · Num2 smash · Num3 special · Num0 shield   (laptop: , . / RShift)', width / 2, 663, hint);
        drawText(ctx, 'Controller: ✕ jump · □ attack · △ smash · ○ special · R1 shield · L1 grab · right stick = smash attacks', width / 2, 684, hint);
        drawText(ctx, 'Hold a direction to change any move · shield + attack = grab · hold smash to charge · M: sound', width / 2, 705, hint);
    }

    renderMenu(ctx) {
        const cx = SCREEN.width / 2;
        beginUi(this.time);
        inkPanel(ctx, cx - 230, MENU_TOP - 38, 460, MENU.length * ROW_HEIGHT + 30, { fill: 'rgba(42,29,23,0.72)', radius: 16, lineWidth: 3 });
        MENU.forEach((item, i) => {
            const y = MENU_TOP + i * ROW_HEIGHT;
            const selected = i === this.index;
            const pulse = selected ? 1 + Math.sin(this.time * 0.15) * 0.04 : 1;
            let label = item.label;
            if (item.id === 'level') {
                const level = CPU_LEVELS[this.game.session.cpuLevel].label.toUpperCase();
                label = selected ? `CPU LEVEL   ◀ ${level} ▶` : `CPU LEVEL   ${level}`;
            }
            ctx.save();
            ctx.translate(cx, y);
            ctx.scale(pulse, pulse);
            drawText(ctx, label, 0, 0, {
                size: selected ? 36 : 30, font: DISPLAY_FONT, weight: 'normal',
                color: selected ? '#f7c948' : '#fdf3dc', outline: '#2a1d17', outlineWidth: 6, alpha: selected ? 1 : 0.8
            });
            ctx.restore();
            if (selected) drawText(ctx, '▶', cx - 205, y, { size: 28, color: '#f25c3b', outline: '#2a1d17', outlineWidth: 4 });
        });
        drawText(ctx, 'W/S or ↑/↓ choose   ·   ENTER, J or ✕ to start', cx, MENU_TOP + MENU.length * ROW_HEIGHT + 20, { size: 19, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4 });
    }
}

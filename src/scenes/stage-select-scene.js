// ============================================================================
// STAGE SELECT SCENE
// Either player can move the cursor. The highlighted stage plays live behind
// the grid. The last tile picks a random stage.
// ============================================================================
import { SCREEN } from '../config.js';
import { getSnapshot, getWorld } from '../render3d/worlds.js';
import { Stage } from '../stages/stage.js';
import { STAGES } from '../stages/index.js';
import { beginUi, inkPanel, inkRectPath } from '../ui/ink-ui.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';

const COLS = 4;
const TILE = { width: 220, height: 124, gap: 24, top: 318 };
const RANDOM = 'random';

export class StageSelectScene {
    constructor(game) {
        this.game = game;
        this.stages = new Map(STAGES.map((def) => [def.id, new Stage(def)]));
        this.options = [...STAGES.map((s) => s.id), RANDOM];
        this.index = 0;
        this.time = 0;
        this.paper = false;
    }

    enter() {
        const current = this.options.indexOf(this.game.session.stage);
        this.index = current >= 0 ? current : 0;
        this.time = 0;
        this.game.audio.music.play('title');
    }

    get selectedId() { return this.options[this.index]; }

    /** Stage shown behind the grid. While on "Random", cycle through stages. */
    get previewStage() {
        const id = this.selectedId === RANDOM ? STAGES[Math.floor(this.time / 45) % STAGES.length].id : this.selectedId;
        return this.stages.get(id);
    }

    update() {
        this.time++;
        const { input } = this.game;
        const move = (dx, dy) => {
            const rows = Math.ceil(this.options.length / COLS);
            let col = this.index % COLS, row = Math.floor(this.index / COLS);
            col = (col + dx + COLS) % COLS;
            row = (row + dy + rows) % rows;
            this.index = Math.min(this.options.length - 1, row * COLS + col);
            this.game.audio.play('menu-move');
        };
        for (const pad of [input.player1, input.player2]) {
            if (pad.leftPressed) move(-1, 0);
            if (pad.rightPressed) move(1, 0);
            if (pad.upPressed) move(0, -1);
            if (pad.downPressed) move(0, 1);
        }
        this.previewStage.update();

        if (input.anyConfirm()) {
            const id = this.selectedId === RANDOM ? STAGES[Math.floor(Math.random() * STAGES.length)].id : this.selectedId;
            const { session, audio } = this.game;
            session.stage = this.selectedId === RANDOM ? RANDOM : id;
            audio.play('menu-confirm');
            this.game.changeScene('fight', { p1: session.p1, p2: session.p2, stage: id, cpu: session.mode === 'cpu' ? session.cpuLevel : null });
        } else if (input.anyCancel()) {
            this.game.audio.play('menu-back');
            this.game.changeScene('characterSelect');
        }
    }

    render(ctx) {
        const { width, height } = SCREEN;
        const preview = getWorld(this.previewStage, this.game.view);
        preview.update(1 / 60);
        preview.render(ctx, this.game.view);
        const shade = ctx.createLinearGradient(0, 0, 0, height);
        shade.addColorStop(0, 'rgba(42,29,23,0.45)');
        shade.addColorStop(0.4, 'rgba(42,29,23,0.2)');
        shade.addColorStop(1, 'rgba(42,29,23,0.75)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, width, height);

        beginUi(this.time);
        drawText(ctx, 'SELECT STAGE', width / 2, 64, { size: 56, font: DISPLAY_FONT, weight: 'normal', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 8 });
        const isRandom = this.selectedId === RANDOM;
        const def = isRandom ? null : this.stages.get(this.selectedId).def;
        drawText(ctx, isRandom ? 'RANDOM STAGE' : def.name.toUpperCase(), width / 2, 132, { size: 64, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: '#2a1d17', outlineWidth: 8 });
        drawText(ctx, isRandom ? 'Let fate decide.' : def.description, width / 2, 172, { size: 24, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5 });
        const traits = isRandom ? [] : (def.traits.length ? def.traits : ['Standard rules']);
        traits.forEach((trait, i) => {
            drawText(ctx, `★ ${trait}`, width / 2, 216 + i * 28, { size: 24, color: def.accent, outline: '#2a1d17', outlineWidth: 5 });
        });

        this.renderGrid(ctx);
        drawText(ctx, 'Arrows / WASD choose · J / Enter fight · K / ESC back', width / 2, 706, { size: 19, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4 });
    }

    renderGrid(ctx) {
        const rowWidth = COLS * TILE.width + (COLS - 1) * TILE.gap;
        const startX = SCREEN.width / 2 - rowWidth / 2;
        this.options.forEach((id, i) => {
            const x = startX + (i % COLS) * (TILE.width + TILE.gap);
            const y = TILE.top + Math.floor(i / COLS) * (TILE.height + TILE.gap + 6);
            const selected = i === this.index;
            const stage = this.stages.get(id);

            const lift = selected ? -6 : 0;
            inkPanel(ctx, x, y + lift, TILE.width, TILE.height, { fill: '#fdf3dc', radius: 12, lineWidth: selected ? 5 : 3 });
            ctx.save();
            ctx.clip(inkRectPath(x + 5, y + lift + 5, TILE.width - 10, TILE.height - 10, 8));
            if (stage) ctx.drawImage(getSnapshot(stage.def, this.game.view), x, y + lift, TILE.width, TILE.height);
            else {
                ctx.fillStyle = '#3b2a24'; ctx.fillRect(x, y + lift, TILE.width, TILE.height);
                drawText(ctx, '?', x + TILE.width / 2, y + lift + 86, { size: 84, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: '#2a1d17', outlineWidth: 6 });
            }
            ctx.fillStyle = 'rgba(42,29,23,0.7)';
            ctx.fillRect(x, y + lift + TILE.height - 30, TILE.width, 30);
            drawText(ctx, stage ? stage.name : 'Random', x + TILE.width / 2, y + lift + TILE.height - 10, { size: 20, color: '#fdf3dc' });
            if (!selected) { ctx.fillStyle = 'rgba(42,29,23,0.35)'; ctx.fillRect(x, y, TILE.width, TILE.height); }
            ctx.restore();
            if (selected) {
                ctx.lineWidth = 5;
                ctx.strokeStyle = stage?.def.accent || '#f7c948';
                ctx.stroke(inkRectPath(x - 6, y + lift - 6, TILE.width + 12, TILE.height + 12, 16));
            }
        });
    }
}

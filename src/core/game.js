// ============================================================================
// GAME
// Owns shared services (input, audio, session, the 3-D view) and the active
// scene. Runs the simulation at a fixed 60 Hz so speed doesn't depend on the
// monitor. Scenes draw into one 2-D canvas; 3-D pictures from the view are
// composited into it.
// ============================================================================
import { CPU_LEVEL_IDS } from '../ai/cpu-controller.js';
import { AudioEngine } from '../audio/audio-engine.js';
import { FIXED_STEP_MS, MAX_STEPS_PER_FRAME, SCREEN } from '../config.js';
import { ROSTER } from '../fighters/roster.js';
import { createPaperOverlay, drawPaper } from '../graphics/paper.js';
import { inviteCodeFromUrl } from '../net/online.js';
import { getTemplate } from '../render3d/models.js';
import { Studio } from '../render3d/studio.js';
import { View3D } from '../render3d/view.js';
import { getSnapshot } from '../render3d/worlds.js';
import { CharacterSelectScene } from '../scenes/character-select-scene.js';
import { FightScene } from '../scenes/fight-scene.js';
import { OnlineScene } from '../scenes/online-scene.js';
import { ResultScene } from '../scenes/result-scene.js';
import { StageSelectScene } from '../scenes/stage-select-scene.js';
import { TitleScene } from '../scenes/title-scene.js';
import { STAGES } from '../stages/index.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';
import { InputHandler } from './input.js';

const TOAST_FRAMES = 90;

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = new InputHandler();
        this.audio = new AudioEngine();
        this.toast = null;
        this.paper = createPaperOverlay(SCREEN.width, SCREEN.height);
        this.view = new View3D();
        this.studio = new Studio(this.view);

        // Choices that persist between scenes (and rematches).
        // mode: 'cpu' (P1 vs the computer) or 'versus' (two players). cpuLevel: a key of CPU_LEVELS.
        this.session = { mode: 'cpu', cpuLevel: CPU_LEVEL_IDS[1], p1: ROSTER[0].id, p2: ROSTER[1 % ROSTER.length].id, stage: STAGES[0].id };
        this.online = null; // the OnlineSession while playing a friend over the internet
        this.debug = new URLSearchParams(window.location.search).has('debug');
        window.addEventListener('keydown', (e) => { if (e.code === 'Backquote') this.debug = !this.debug; });

        this.scenes = {
            title: new TitleScene(this),
            characterSelect: new CharacterSelectScene(this),
            stageSelect: new StageSelectScene(this),
            fight: new FightScene(this),
            result: new ResultScene(this),
            online: new OnlineScene(this)
        };
    }

    /**
     * Build every character model and stage world before the first frame, so menus
     * and fights never stall. Draws a progress bar while it works.
     */
    async preload() {
        const jobs = [
            ...ROSTER.map((def) => [`Building ${def.name}`, () => getTemplate(def)]),
            ...STAGES.map((def) => [`Building ${def.name}`, () => getSnapshot(def, this.view)])
        ];
        for (const [i, [label, job]] of jobs.entries()) {
            this.drawLoading(label, i / jobs.length);
            await new Promise((resolve) => setTimeout(resolve, 16)); // let the progress bar paint
            job();
        }
        // Opened from an invite link: straight into the online lobby.
        const code = inviteCodeFromUrl();
        if (code) this.changeScene('online', { role: 'guest', code });
        else this.changeScene('title');
    }

    drawLoading(label, progress) {
        const { ctx } = this;
        const { width, height } = SCREEN;
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, width, height);
        drawText(ctx, 'MEGAFAUNA', width / 2, height / 2 - 60, { size: 96, font: DISPLAY_FONT, weight: 'normal', color: '#f25c3b', outline: '#2a1d17', outlineWidth: 10 });
        ctx.fillStyle = '#2a1d17';
        ctx.fillRect(width / 2 - 252, height / 2 + 18, 504, 28);
        ctx.fillStyle = '#f7c948';
        ctx.fillRect(width / 2 - 248, height / 2 + 22, 496 * progress, 20);
        drawText(ctx, `${label}...`, width / 2, height / 2 + 84, { size: 24, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4 });
    }

    changeScene(name, params = {}) {
        const scene = this.scenes[name];
        if (!scene) throw new Error(`Unknown scene "${name}"`);
        this.scene?.exit?.();
        this.sceneName = name;
        this.scene = scene;
        scene.enter?.(params);
    }

    start() {
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.clock = 0;
        requestAnimationFrame((t) => this.frame(t));
    }

    frame(now) {
        const elapsed = now - this.lastTime;
        this.clock += elapsed / 1000;
        this.view.endFrame(elapsed, this.clock);
        // Clamp long gaps (tab in background) so we don't fast-forward.
        this.accumulator += Math.min(250, elapsed);
        this.lastTime = now;
        let steps = 0;
        while (this.accumulator >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
            this.step();
            this.accumulator -= FIXED_STEP_MS;
            steps++;
        }
        if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
        this.render();
        requestAnimationFrame((t) => this.frame(t));
    }

    step() {
        if (this.toast && --this.toast.frames <= 0) this.toast = null;
        // The online opponent left mid-fight: back to the lobby, which says what happened.
        if (this.online?.closed && this.sceneName !== 'online') this.changeScene('online');
        // Online, waiting for the other side's input: hold this frame, and keep any presses for when it runs.
        if (this.scene.waiting?.()) return;
        this.input.update();
        if (this.input.menu.mute) {
            const muted = this.audio.toggleMute();
            this.toast = { text: muted ? 'SOUND OFF  (M)' : 'SOUND ON  (M)', frames: TOAST_FRAMES };
        }
        for (const event of this.input.gamepads.drainEvents()) {
            const text = event.type === 'connected' ? `CONTROLLER CONNECTED: P${event.player}` : `CONTROLLER UNPLUGGED: P${event.player}`;
            this.toast = { text, frames: TOAST_FRAMES * 2 };
            this.audio.play(event.type === 'connected' ? 'ready' : 'menu-back');
            if (event.type === 'connected') this.input.gamepads.rumble(event.player, { strong: 0.6, weak: 0.3, duration: 200 });
        }
        this.scene.update();
    }

    render() {
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
        this.scene.render(this.ctx);
        if (this.scene.paper !== false) drawPaper(this.ctx, this.paper);
        if (this.toast) {
            const alpha = Math.min(1, this.toast.frames / 20);
            drawText(this.ctx, this.toast.text, SCREEN.width - 24, SCREEN.height - 22, { size: 22, align: 'right', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5, alpha });
        }
    }
}

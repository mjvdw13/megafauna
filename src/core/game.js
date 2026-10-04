// ============================================================================
// GAME
// Owns shared services (input, audio, session) and the active scene.
// Runs the simulation at a fixed 60 Hz so speed doesn't depend on the monitor.
// ============================================================================
import { CPU_LEVEL_IDS } from '../ai/cpu-controller.js';
import { AudioEngine } from '../audio/audio-engine.js';
import { FIXED_STEP_MS, MAX_STEPS_PER_FRAME, SCREEN } from '../config.js';
import { ROSTER } from '../fighters/roster.js';
import { createPaperOverlay, drawPaper } from '../graphics/paper.js';
import { CharacterSelectScene } from '../scenes/character-select-scene.js';
import { FightScene } from '../scenes/fight-scene.js';
import { ResultScene } from '../scenes/result-scene.js';
import { StageSelectScene } from '../scenes/stage-select-scene.js';
import { TitleScene } from '../scenes/title-scene.js';
import { STAGES } from '../stages/index.js';
import { drawText } from '../ui/text.js';
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

        // Choices that persist between scenes (and rematches).
        // mode: 'cpu' (P1 vs the computer) or 'versus' (two players). cpuLevel: a key of CPU_LEVELS.
        this.session = { mode: 'cpu', cpuLevel: CPU_LEVEL_IDS[1], p1: ROSTER[0].id, p2: ROSTER[1 % ROSTER.length].id, stage: STAGES[0].id };
        this.debug = new URLSearchParams(window.location.search).has('debug');
        window.addEventListener('keydown', (e) => { if (e.code === 'Backquote') this.debug = !this.debug; });

        this.scenes = {
            title: new TitleScene(this),
            characterSelect: new CharacterSelectScene(this),
            stageSelect: new StageSelectScene(this),
            fight: new FightScene(this),
            result: new ResultScene(this)
        };
        this.changeScene('title');
    }

    changeScene(name, params = {}) {
        const scene = this.scenes[name];
        if (!scene) throw new Error(`Unknown scene "${name}"`);
        this.sceneName = name;
        this.scene = scene;
        scene.enter?.(params);
    }

    start() {
        this.lastTime = performance.now();
        this.accumulator = 0;
        requestAnimationFrame((t) => this.frame(t));
    }

    frame(now) {
        // Clamp long gaps (tab in background) so we don't fast-forward.
        this.accumulator += Math.min(250, now - this.lastTime);
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
        if (this.toast && --this.toast.frames <= 0) this.toast = null;
        this.scene.update();
    }

    render() {
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
        this.scene.render(this.ctx);
        drawPaper(this.ctx, this.paper);
        if (this.toast) {
            const alpha = Math.min(1, this.toast.frames / 20);
            drawText(this.ctx, this.toast.text, SCREEN.width - 24, SCREEN.height - 22, { size: 22, align: 'right', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5, alpha });
        }
    }
}

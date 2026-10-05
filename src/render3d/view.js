// ============================================================================
// VIEW 3D
// The game's single WebGL renderer. It draws into an offscreen canvas, and
// each draw() is immediately copied into the game's 2-D canvas, so scenes keep
// layering 3-D pictures, 2-D effects and the hand-drawn UI exactly as before.
//
// Resolution adapts to the frame rate: when frames run long the 3-D picture is
// rendered smaller (and scaled up when copied); when there's headroom again
// it climbs back to full size.
// ============================================================================
import * as THREE from 'three';
import { SCREEN } from '../config.js';
import { materialTime } from './materials.js';

const MIN_SCALE = 0.6;

export class View3D {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = SCREEN.width;
        this.canvas.height = SCREEN.height;
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        const r = this.renderer;
        r.setPixelRatio(1);
        r.setSize(SCREEN.width, SCREEN.height, false);
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFShadowMap;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 0.65;
        r.autoClear = false;
        this.scale = 1;
        this.frameMs = 16.7;
        this.slowFor = 0;
        this.fastFor = 0;
    }

    /**
     * Render `scene` through `camera` and paint it into `ctx` at rect (screen px).
     * transparent: keep the background see-through (menu portraits over 2-D panels).
     */
    draw(ctx, scene, camera, rect = { x: 0, y: 0, width: SCREEN.width, height: SCREEN.height }, { transparent = false } = {}) {
        const r = this.renderer;
        const w = Math.max(1, Math.round(rect.width * this.scale)), h = Math.max(1, Math.round(rect.height * this.scale));
        if (camera.isPerspectiveCamera && Math.abs(camera.aspect - rect.width / rect.height) > 1e-4) {
            camera.aspect = rect.width / rect.height;
            camera.updateProjectionMatrix();
        }
        r.setViewport(0, 0, w, h);
        r.setScissor(0, 0, w, h);
        r.setScissorTest(true);
        r.setClearColor(0x000000, transparent ? 0 : 1);
        r.clear();
        r.render(scene, camera);
        r.setScissorTest(false);
        ctx.drawImage(this.canvas, 0, this.canvas.height - h, w, h, rect.x, rect.y, rect.width, rect.height);
    }

    /** Compile a scene's shaders ahead of time so its first frame doesn't hitch. */
    warm(scene, camera) { this.renderer.compile(scene, camera); }

    /** Called once per displayed frame with the real time since the last one. */
    endFrame(frameMs, seconds) {
        materialTime.value = seconds;
        this.frameMs = this.frameMs * 0.92 + Math.min(frameMs, 100) * 0.08;
        const dt = frameMs / 1000;
        if (this.frameMs > 22) { this.slowFor += dt; this.fastFor = 0; }
        else if (this.frameMs < 18) { this.fastFor += dt; this.slowFor = 0; }
        else { this.slowFor = this.fastFor = 0; }
        if (this.slowFor > 0.7 && this.scale > MIN_SCALE) {
            this.scale = Math.max(MIN_SCALE, +(this.scale - 0.1).toFixed(2));
            this.slowFor = 0;
        } else if (this.fastFor > 5 && this.scale < 1) {
            this.scale = Math.min(1, +(this.scale + 0.1).toFixed(2));
            this.fastFor = 0;
        }
    }
}

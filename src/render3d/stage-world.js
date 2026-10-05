// ============================================================================
// STAGE WORLD
// A stage's 3-D scene: whatever its world(kit) builds, plus the arena from its
// layout. The camera is fixed and frames the 1280x720 playfield exactly at the
// fighters' depth (z = 0), so a point at screen pixel (x, y) in the game's
// coordinates sits at the same pixel in the 3-D picture. That's what lets the
// 2-D effects, name tags and debug boxes keep lining up with the 3-D fighters.
// ============================================================================
import * as THREE from 'three';
import { SCREEN } from '../config.js';
import { createWorldKit } from './world-kit.js';

const PX = 0.01;    // world units per pixel
const FOV = 35;     // vertical field of view (degrees): fairly flat, like a long lens

export class StageWorld {
    constructor(stage, view) {
        this.stage = stage;
        this.groundY = stage.groundY;
        this.scene = new THREE.Scene();
        this.updaters = [];
        this.sun = null;
        const distance = (SCREEN.height / 2) * PX / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        this.camera = new THREE.PerspectiveCamera(FOV, SCREEN.width / SCREEN.height, 0.1, 1500);
        const cy = this.toWorldY(SCREEN.height / 2);
        this.camera.position.set(0, cy, distance);
        this.camera.lookAt(0, cy, 0);
        const kit = createWorldKit(this, view);
        stage.def.world(kit);
        kit.finish();
        // Lights up fighters and ground for a moment on a hit (fight-view.js). It's built in, switched off,
        // so shaders are compiled with it up front and the first hit doesn't stall to recompile them.
        this.impactLight = new THREE.PointLight('#ffffff', 0, 6, 2);
        this.scene.add(this.impactLight);
        this.time = 0;
    }

    toWorldX(px) { return (px - SCREEN.width / 2) * PX; }
    toWorldY(py) { return (this.groundY - py) * PX; }

    /** Animate water, particles, lights. */
    update(dt) {
        this.time += dt;
        for (const fn of this.updaters) fn(this.time, dt);
    }

    /** Draw the world into the 2-D canvas (full screen unless rect is given; keep 16:9). */
    render(ctx, view, rect) { view.draw(ctx, this.scene, this.camera, rect); }
}

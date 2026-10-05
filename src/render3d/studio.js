// ============================================================================
// STUDIO
// Draws characters into the 2-D menus: full-body previews on character cards
// and the result screen, and close-up portraits for the HUD and roster strip.
// One small lit scene; each slot (a key like 'p1-card') keeps its own actor.
// ============================================================================
import * as THREE from 'three';
import { Actor } from './actor.js';
import { bakeSky } from './sky.js';

export class Studio {
    constructor(view) {
        this.view = view;
        this.scene = new THREE.Scene();
        this.scene.environment = bakeSky(view.renderer, { elevation: 35, azimuth: 30, turbidity: 3, rayleigh: 1.2 }).environment;
        this.scene.environmentIntensity = 0.9;
        const key = new THREE.DirectionalLight('#fff3e2', 3.2);
        key.position.set(2, 3, 4);
        const rim = new THREE.DirectionalLight('#cfe0ff', 2.2);
        rim.position.set(-3, 2, -3);
        this.scene.add(key, rim, new THREE.HemisphereLight('#dfe8ff', '#4a3e30', 0.5));
        this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
        this.slots = new Map();
    }

    actor(key, def) {
        let actor = this.slots.get(key);
        if (!actor || actor.def !== def) {
            if (actor) this.scene.remove(actor.holder);
            actor = new Actor(def);
            this.scene.add(actor.holder);
            this.slots.set(key, actor);
        }
        return actor;
    }

    /**
     * Draw a character into rect (screen px).
     * options: state (pose to play), facingRight, portrait (head close-up), scale (zoom).
     */
    draw(ctx, rect, def, { key, state = 'idle', facingRight = true, portrait = false, scale = 1 } = {}) {
        const actor = this.actor(key, def);
        actor.play(state);
        actor.update(facingRight);
        for (const a of this.slots.values()) a.holder.visible = a === actor;
        const cam = this.camera;
        const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const aspect = rect.width / rect.height;
        if (portrait) {
            const s = def.model.scale ?? 1, p = def.model.portrait;
            // The face, after the three-quarter turn toward the camera.
            const fx = p.target[0] * s, ty = p.target[1] * s;
            const tx = fx * Math.cos(0.35) * (facingRight ? 1 : -1), tz = fx * Math.sin(0.35);
            const d = (p.distance * s) / scale;
            cam.position.set(tx + d * 0.35 * (facingRight ? 1 : -1), ty + d * 0.12, tz + d);
            cam.lookAt(tx, ty, tz);
        } else {
            const { min, max } = actor.template.bounds;
            const h = max.y, w = (max.x - min.x) * 0.95;
            const d = Math.max(h / (2 * tan), w / (2 * tan * aspect)) * 1.12 / scale;
            cam.position.set(0, h * 0.55, d);
            cam.lookAt(0, h * 0.45, 0);
        }
        this.view.draw(ctx, this.scene, cam, rect, { transparent: true });
    }
}

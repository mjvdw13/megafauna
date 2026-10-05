// ============================================================================
// FIGHT VIEW
// The 3-D picture of a fight: the stage's world, a FighterView per fighter and
// the projectiles in flight. The fight scene syncs it once per displayed frame
// and draws it under the 2-D effects and HUD, through the fight camera's view
// window (graphics/camera.js), and flashes the impact light on hits.
// ============================================================================
import { SCREEN } from '../config.js';
import { FighterView } from './fighter-view.js';
import { ProjectileViews } from './projectile-view.js';
import { getWorld } from './worlds.js';

const LIGHT_PEAK = 32;  // impact light intensity at power 1
const LIGHT_FADE = 16;  // per second

export class FightView {
    constructor(view, stage, fighters) {
        this.view = view;
        this.world = getWorld(stage, view);
        this.fighters = fighters.map((f) => new FighterView(f, this.world));
        this.projectiles = new ProjectileViews(this.world);
        this.lastTime = performance.now();
        this.light = this.world.impactLight;
        this.lightLevel = 0;
    }

    /** Light the scene from (x, y) in screen px for a moment. `power` ~1 for a solid hit. */
    flash(x, y, color = '#ffffff', power = 1) {
        if (power < this.lightLevel * 0.6) return; // a weaker hit doesn't steal a stronger hit's light
        this.light.position.set(this.world.toWorldX(x), this.world.toWorldY(y), 0.7);
        this.light.color.set(color);
        this.lightLevel = power;
    }

    /** The shield of `fighter` took a hit: pulse it. */
    shieldHit(fighter) { this.fighters.find((v) => v.fighter === fighter)?.shieldHit(); }

    /** Pose everything for this frame. */
    sync(projectiles) {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.world.update(dt);
        this.lightLevel *= Math.exp(-dt * LIGHT_FADE);
        if (this.lightLevel < 0.01) this.lightLevel = 0;
        this.light.intensity = this.lightLevel * LIGHT_PEAK;
        for (const f of this.fighters) f.sync(dt);
        this.projectiles.sync(projectiles, this.world.time);
    }

    /** Draw the window `view` ({ x, y, width, height, roll } in screen px) of the playfield, filling the screen. */
    render(ctx, view = null) {
        const camera = this.world.camera;
        if (view) {
            camera.setViewOffset(SCREEN.width, SCREEN.height, view.x, view.y, view.width, view.height);
            camera.rotation.z = view.roll;
        }
        this.world.render(ctx, this.view);
        if (view) {
            camera.clearViewOffset();
            camera.rotation.z = 0;
        }
    }

    dispose() {
        this.light.intensity = 0;
        for (const f of this.fighters) f.dispose();
        this.projectiles.clear();
    }
}

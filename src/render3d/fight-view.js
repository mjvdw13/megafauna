// ============================================================================
// FIGHT VIEW
// The 3-D picture of a fight: the stage's world, a FighterView per fighter and
// the projectiles in flight. The fight scene syncs it once per displayed frame
// and draws it under the 2-D effects and HUD.
// ============================================================================
import { FighterView } from './fighter-view.js';
import { ProjectileViews } from './projectile-view.js';
import { getWorld } from './worlds.js';

export class FightView {
    constructor(view, stage, fighters) {
        this.view = view;
        this.world = getWorld(stage, view);
        this.fighters = fighters.map((f) => new FighterView(f, this.world));
        this.projectiles = new ProjectileViews(this.world);
        this.lastTime = performance.now();
    }

    /** Pose everything for this frame. */
    sync(projectiles) {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.world.update(dt);
        for (const f of this.fighters) f.sync(dt);
        this.projectiles.sync(projectiles, this.world.time);
    }

    render(ctx) { this.world.render(ctx, this.view); }

    dispose() {
        for (const f of this.fighters) f.dispose();
        this.projectiles.clear();
    }
}

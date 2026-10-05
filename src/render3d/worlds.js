// ============================================================================
// WORLD CACHE
// Each stage's 3-D world is built once and reused (fights, rematches, the
// stage-select preview). Snapshots are small still pictures for menu tiles.
// ============================================================================
import { createCanvas } from '../graphics/canvas.js';
import { Stage } from '../stages/stage.js';
import { StageWorld } from './stage-world.js';

const worlds = new Map();
const snapshots = new Map();

/** The world for a stage (a Stage instance or a stage definition). */
export function getWorld(stage, view) {
    const s = stage instanceof Stage ? stage : new Stage(stage);
    let world = worlds.get(s.id);
    if (!world) {
        world = new StageWorld(s, view);
        view.warm(world.scene, world.camera);
        worlds.set(s.id, world);
    }
    return world;
}

/** A still of a stage's world, rendered once (stage-select tiles). */
export function getSnapshot(def, view, width = 320, height = 180) {
    let canvas = snapshots.get(def.id);
    if (!canvas) {
        const world = getWorld(def, view);
        canvas = createCanvas(width, height);
        world.update(0);
        world.render(canvas.getContext('2d'), view, { x: 0, y: 0, width, height });
        snapshots.set(def.id, canvas);
    }
    return canvas;
}

// ============================================================================
// STAGE
// Runtime wrapper around a stage definition: caches the painted background,
// runs its animated layers, and exposes the platform layout, ledges, pit and
// physics for the fight.
// ============================================================================
import { PHYSICS_DEFAULTS, SCREEN, SPAWN_INSET, STAGE_DEFAULTS } from '../config.js';
import { seededRandom } from '../core/math.js';
import { createCanvas } from '../graphics/canvas.js';
import { createSketch, paintPit, paintPlatforms, PIT_STYLES } from './sketch-kit.js';

const DEFAULT_LAYOUT = Object.freeze({ main: { left: 200, right: 1080 }, platforms: [] });

function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

export class Stage {
    constructor(definition) {
        this.def = definition;
        this.id = definition.id;
        this.name = definition.name;
        this.groundY = definition.groundY ?? STAGE_DEFAULTS.groundY;
        const layout = definition.layout || DEFAULT_LAYOUT;
        this.layout = {
            main: { left: layout.main.left, right: layout.main.right, y: this.groundY },
            platforms: (layout.platforms || []).map(([left, right, y]) => ({ left, right, y }))
        };
        const { main } = this.layout;
        this.ledges = [{ x: main.left, y: main.y, side: -1 }, { x: main.right, y: main.y, side: 1 }];
        this.pit = { style: definition.pit || 'chasm', ...PIT_STYLES[definition.pit || 'chasm'] };
        this.pitSurfaceY = main.y + 40;   // falling past this over the pit makes a splash
        this.floatY = main.y + 28;        // where floaters (Quackers) sit on water
        this.physics = { ...PHYSICS_DEFAULTS, ...(definition.physics || {}) };
        this.layers = definition.createLayers ? definition.createLayers() : [];
        this.time = 0;
        this.backgroundCanvas = null;
    }

    get background() {
        if (!this.backgroundCanvas) {
            const canvas = createCanvas(SCREEN.width, SCREEN.height);
            const ctx = canvas.getContext('2d');
            const kit = createSketch(ctx, seededRandom(hashString(this.id)));
            this.def.paint(kit);
            paintPit(kit, this.layout, this.pit);
            paintPlatforms(kit, this.layout, this.def.platformStyle);
            this.backgroundCanvas = canvas;
        }
        return this.backgroundCanvas;
    }

    spawnPoints() {
        const { main } = this.layout;
        return { p1: main.left + SPAWN_INSET, p2: main.right - SPAWN_INSET };
    }

    update() {
        this.time++;
        for (const layer of this.layers) layer.update?.(this.time);
    }

    renderBack(ctx) {
        ctx.drawImage(this.background, 0, 0);
        for (const layer of this.layers) if (!layer.front) layer.render(ctx, this.time);
    }

    renderFront(ctx) {
        for (const layer of this.layers) if (layer.front) layer.render(ctx, this.time);
    }

    /** Full animated render (used by the stage-select preview). */
    render(ctx) {
        this.renderBack(ctx);
        this.renderFront(ctx);
    }
}

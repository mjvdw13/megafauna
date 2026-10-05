// ============================================================================
// STAGE
// Runtime wrapper around a stage definition: the platform layout, ledges, pit
// and physics for the fight. The 3-D scenery is built from the definition's
// world(kit) by render3d/stage-world.js.
// ============================================================================
import { PHYSICS_DEFAULTS, SPAWN_INSET, STAGE_DEFAULTS } from '../config.js';
import { PIT_STYLES } from './pits.js';

const DEFAULT_LAYOUT = Object.freeze({ main: { left: 200, right: 1080 }, platforms: [] });

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
        this.time = 0;
    }

    spawnPoints() {
        const { main } = this.layout;
        return { p1: main.left + SPAWN_INSET, p2: main.right - SPAWN_INSET };
    }

    update() { this.time++; }
}

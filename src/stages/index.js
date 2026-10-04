// ============================================================================
// STAGE REGISTRY
// To add a stage: create stages/<id>.js exporting a definition and list it here.
// Definition fields: id, name, description, traits[], accent, paint(kit),
// layout { main: {left, right}, platforms: [[left, right, y], ...] }, pit (see PIT_STYLES),
// and optionally platformStyle, groundY, physics {gravity, friction}, createLayers(),
// music (a track name from audio/music.js).
// ============================================================================
import backyard from './backyard.js';
import duckPond from './duck-pond.js';
import fernJungle from './fern-jungle.js';
import frozenTundra from './frozen-tundra.js';
import meadow from './meadow.js';
import tarPits from './tar-pits.js';
import volcano from './volcano.js';

export const STAGES = Object.freeze([meadow, backyard, duckPond, tarPits, frozenTundra, volcano, fernJungle]);

export function getStage(id) {
    const def = STAGES.find((s) => s.id === id);
    if (!def) throw new Error(`Unknown stage "${id}"`);
    return def;
}

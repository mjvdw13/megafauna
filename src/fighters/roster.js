// ============================================================================
// ROSTER
// To add a character: create fighters/<id>/<id>.js (+ a rig) and list it here.
// Order here is the order on the character select screen.
// ============================================================================
import quackers from './quackers/quackers.js';
import randy from './randy/randy.js';
import riley from './riley/riley.js';

export const ROSTER = Object.freeze([riley, quackers, randy]);

export function getCharacter(id) {
    const def = ROSTER.find((c) => c.id === id);
    if (!def) throw new Error(`Unknown character "${id}"`);
    return def;
}

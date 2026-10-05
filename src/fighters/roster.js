// ============================================================================
// ROSTER
// To add a character: create fighters/<id>/<id>.js (+ a 3-D model) and list it here.
// Order here is the order on the character select screen. Characters marked
// `secret: true` only appear once unlocked (see core/unlocks.js).
// ============================================================================
import { isUnlocked } from '../core/unlocks.js';
import dad from './dad/dad.js';
import quackers from './quackers/quackers.js';
import randy from './randy/randy.js';
import riley from './riley/riley.js';

export const ROSTER = Object.freeze([riley, quackers, randy, dad]);

/** The characters that can be picked right now: everyone except secrets not yet unlocked. */
export function availableRoster() {
    return ROSTER.filter((c) => !c.secret || isUnlocked(c.id));
}

export function getCharacter(id) {
    const def = ROSTER.find((c) => c.id === id);
    if (!def) throw new Error(`Unknown character "${id}"`);
    return def;
}

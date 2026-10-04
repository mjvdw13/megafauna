// ============================================================================
// MOVESETS
// Smash-style move slots: which move comes out depends on the button, the
// direction held, and whether the fighter is on the ground, running, in the
// air or holding an opponent.
//
//              ground                          air
//   attack     jab / ftilt / utilt / dtilt     nair / fair / bair / uair / dair
//              dashAttack while running
//   smash      fsmash / usmash / dsmash        (same as attack in the air)
//   special    neutral / side / up / down special (ground and air)
//   shield + attack: grab → pummel (attack) or throw (direction)
//
// Every fighter starts from BASE_MOVES, overrides moves via `moves`, then has
// its stats applied. Extra keys in `moves` (e.g. jab2) are reachable through `chain`.
// ============================================================================
import { Attack } from './attack.js';

export const MOVE_SLOTS = Object.freeze([
    'jab', 'ftilt', 'utilt', 'dtilt', 'dashAttack',
    'fsmash', 'usmash', 'dsmash',
    'nair', 'fair', 'bair', 'uair', 'dair',
    'neutralSpecial', 'sideSpecial', 'upSpecial', 'downSpecial',
    'grab', 'pummel', 'fthrow', 'bthrow', 'uthrow', 'dthrow'
]);

export const THROW_KEYS = Object.freeze({ forward: 'fthrow', back: 'bthrow', up: 'uthrow', down: 'dthrow' });

/** Generic moves for an 80x120 body. Characters replace these with their own. */
export const BASE_MOVES = Object.freeze({
    jab: { name: 'Jab', damage: 3, startup: 3, active: 2, recovery: 7, hitstun: 10, blockstun: 5, knockback: 18, hitbox: { x: 60, y: 30, width: 50, height: 30 } },
    ftilt: { name: 'Forward Tilt', damage: 8, startup: 7, active: 3, recovery: 12, hitstun: 16, blockstun: 9, knockback: 60, hitbox: { x: 55, y: 35, width: 70, height: 35 } },
    utilt: { name: 'Up Tilt', damage: 7, startup: 6, active: 4, recovery: 10, hitstun: 16, blockstun: 8, knockback: 20, launch: 9, hitbox: { x: 10, y: -30, width: 80, height: 50 } },
    dtilt: { name: 'Down Tilt', damage: 6, startup: 5, active: 3, recovery: 8, hitstun: 14, blockstun: 7, knockback: 30, launch: 3, hitbox: { x: 50, y: 90, width: 65, height: 28 }, pose: 'crouch', vfx: 'sweep' },
    dashAttack: { name: 'Dash Attack', damage: 9, startup: 6, active: 6, recovery: 16, hitstun: 18, blockstun: 10, knockback: 70, launch: 4, hitbox: { x: 40, y: 30, width: 70, height: 60 }, strength: 'heavy', movement: { active: { vx: 7 } } },
    fsmash: { name: 'Forward Smash', damage: 16, startup: 14, active: 4, recovery: 22, hitstun: 26, blockstun: 14, knockback: 120, launch: 6, hitbox: { x: 55, y: 20, width: 80, height: 50 }, strength: 'smash', charge: true },
    usmash: { name: 'Up Smash', damage: 14, startup: 10, active: 5, recovery: 22, hitstun: 26, blockstun: 12, knockback: 25, launch: 14, hitbox: { x: 0, y: -50, width: 80, height: 70 }, strength: 'smash', charge: true, vfx: 'uppercut' },
    dsmash: { name: 'Down Smash', damage: 13, startup: 9, active: 4, recovery: 22, hitstun: 24, blockstun: 12, knockback: 90, launch: 4, hitbox: { x: -40, y: 90, width: 160, height: 30 }, strength: 'smash', charge: true, pose: 'crouch', vfx: 'sweep' },
    nair: { name: 'Neutral Air', damage: 7, startup: 4, active: 8, recovery: 10, hitstun: 14, blockstun: 8, knockback: 40, launch: 3, hitbox: { x: 0, y: 20, width: 80, height: 80 }, pose: 'air' },
    fair: { name: 'Forward Air', damage: 10, startup: 7, active: 4, recovery: 12, hitstun: 18, blockstun: 10, knockback: 70, launch: 3, hitbox: { x: 50, y: 30, width: 55, height: 50 }, pose: 'air', strength: 'heavy', vfx: 'slash-air' },
    bair: { name: 'Back Air', damage: 11, startup: 6, active: 3, recovery: 12, hitstun: 18, blockstun: 10, knockback: 80, launch: 3, hitbox: { x: -35, y: 35, width: 55, height: 45 }, pose: 'air', strength: 'heavy', anim: { lunge: -12 } },
    uair: { name: 'Up Air', damage: 8, startup: 5, active: 4, recovery: 10, hitstun: 16, blockstun: 8, knockback: 20, launch: 10, hitbox: { x: 5, y: -30, width: 70, height: 50 }, pose: 'air', vfx: 'uppercut' },
    dair: { name: 'Down Air', damage: 11, startup: 10, active: 4, recovery: 16, hitstun: 18, blockstun: 10, knockback: 30, launch: -10, hitbox: { x: 15, y: 90, width: 50, height: 50 }, pose: 'air', strength: 'heavy' },
    neutralSpecial: { name: 'Neutral Special', damage: 8, startup: 12, active: 6, recovery: 16, hitstun: 16, blockstun: 10, knockback: 50, hitbox: { x: 60, y: 30, width: 60, height: 40 } },
    sideSpecial: { name: 'Side Special', damage: 10, startup: 10, active: 8, recovery: 18, hitstun: 20, blockstun: 12, knockback: 80, hitbox: { x: 40, y: 20, width: 80, height: 60 }, movement: { active: { vx: 10 } }, endsOnLanding: false },
    upSpecial: { name: 'Up Special', damage: 7, startup: 4, active: 14, recovery: 10, hitstun: 16, blockstun: 8, knockback: 30, launch: 10, hitbox: { x: 0, y: -10, width: 80, height: 80 }, movement: { start: { vy: -15 }, active: { vy: -7 } }, helpless: true },
    downSpecial: { name: 'Down Special', damage: 10, startup: 12, active: 6, recovery: 18, hitstun: 20, blockstun: 12, knockback: 60, hitbox: { x: -20, y: 60, width: 120, height: 60 } },
    grab: { name: 'Grab', damage: 0, startup: 6, active: 2, recovery: 20, hitbox: { x: 55, y: 30, width: 45, height: 55 }, grab: true, vfx: 'none' },
    pummel: { name: 'Pummel', damage: 2, startup: 4, active: 1, recovery: 10, hitstun: 0, knockback: 0, hitbox: { x: 55, y: 30, width: 10, height: 10 }, vfx: 'none' },
    fthrow: { name: 'Forward Throw', damage: 8, startup: 8, active: 1, recovery: 16, hitstun: 22, knockback: 90, launch: 6, hitbox: { x: 55, y: 30, width: 10, height: 10 }, throwDir: 'forward', strength: 'heavy' },
    bthrow: { name: 'Back Throw', damage: 9, startup: 10, active: 1, recovery: 16, hitstun: 22, knockback: 100, launch: 7, hitbox: { x: 55, y: 30, width: 10, height: 10 }, throwDir: 'back', strength: 'heavy' },
    uthrow: { name: 'Up Throw', damage: 7, startup: 8, active: 1, recovery: 16, hitstun: 22, knockback: 10, launch: 15, hitbox: { x: 55, y: 30, width: 10, height: 10 }, throwDir: 'up', strength: 'heavy' },
    dthrow: { name: 'Down Throw', damage: 6, startup: 8, active: 1, recovery: 16, hitstun: 24, knockback: 30, launch: 4, knockdown: true, hitbox: { x: 55, y: 30, width: 10, height: 10 }, throwDir: 'down', strength: 'heavy' }
});

const STRENGTH_BY_SLOT = {
    jab: 'light', ftilt: 'light', utilt: 'light', dtilt: 'light', nair: 'light', uair: 'light',
    fsmash: 'smash', usmash: 'smash', dsmash: 'smash',
    neutralSpecial: 'special', sideSpecial: 'special', upSpecial: 'special', downSpecial: 'special'
};

/** Build a fighter's final Attack objects (base + overrides + extra chained moves, scaled by stats). */
export function buildMoveset(definition) {
    const overrides = definition.moves || {};
    const configs = {};
    for (const key of new Set([...Object.keys(BASE_MOVES), ...Object.keys(overrides)])) {
        const base = BASE_MOVES[key] || {};
        configs[key] = { strength: STRENGTH_BY_SLOT[key] || base.strength || 'heavy', ...base, ...(overrides[key] || {}) };
    }
    const moveset = {};
    for (const [key, config] of Object.entries(configs)) moveset[key] = new Attack(config).withStats(definition.stats);
    return moveset;
}

function aerialKey(vertical, relative) {
    if (vertical < 0) return 'uair';
    if (vertical > 0) return 'dair';
    if (relative > 0) return 'fair';
    if (relative < 0) return 'bair';
    return 'nair';
}

/**
 * Which move slot a button press asks for.
 * @param input  player input (held/pressed flags, horizontal, vertical)
 * @param ctx    { grounded, running, holding, facingRight }
 * @returns {null | { key, turn }}  turn = direction (-1/1) to face first, or 0
 */
export function selectMove(input, { grounded, running = false, holding = false, facingRight = true }) {
    const h = input.horizontal, v = input.vertical;
    const relative = h * (facingRight ? 1 : -1);

    if (holding) {
        if (input.attackPressed) return { key: 'pummel', turn: 0 };
        const pressedDir = input.upPressed ? 'up' : input.downPressed ? 'down'
            : (input.leftPressed || input.rightPressed) ? (relative >= 0 ? 'forward' : 'back')
                : (input.smashPressed || input.specialPressed) ? (v < 0 ? 'up' : v > 0 ? 'down' : relative < 0 ? 'back' : 'forward') : null;
        return pressedDir ? { key: THROW_KEYS[pressedDir], turn: 0 } : null;
    }

    if (input.specialPressed) {
        if (v < 0) return { key: 'upSpecial', turn: h };
        if (v > 0) return { key: 'downSpecial', turn: 0 };
        if (h !== 0) return { key: 'sideSpecial', turn: h };
        return { key: 'neutralSpecial', turn: 0 };
    }

    if (grounded && input.shield && input.attackPressed) return { key: 'grab', turn: 0 };

    if (input.smashPressed) {
        if (!grounded) return { key: aerialKey(v, relative), turn: 0 };
        if (v < 0) return { key: 'usmash', turn: 0 };
        if (v > 0) return { key: 'dsmash', turn: 0 };
        return { key: 'fsmash', turn: h };
    }

    if (input.attackPressed) {
        if (!grounded) return { key: aerialKey(v, relative), turn: 0 };
        if (running) return { key: 'dashAttack', turn: 0 };
        if (v < 0) return { key: 'utilt', turn: 0 };
        if (v > 0) return { key: 'dtilt', turn: 0 };
        if (h !== 0) return { key: 'ftilt', turn: h };
        return { key: 'jab', turn: 0 };
    }
    return null;
}

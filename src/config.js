// ============================================================================
// GLOBAL CONFIGURATION
// Tunable numbers that are not specific to a character or stage live here.
// ============================================================================

export const SCREEN = Object.freeze({ width: 1280, height: 720 });

// Simulation runs at a fixed 60 steps per second regardless of monitor refresh rate.
export const FIXED_STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 5;

// Defaults used by stages that do not override them.
export const PHYSICS_DEFAULTS = Object.freeze({ gravity: 0.8, friction: 0.85 });
export const STAGE_DEFAULTS = Object.freeze({ groundY: 550 });

// Attack knockback → defender velocity. Divided by the defender's weight stat.
// (The original game used 1.0, which slid fighters ~200px on a jab and made combos impossible.)
export const KNOCKBACK_SCALE = 0.25;

// Fighters spawn this far (in px, measured to their center) inside the main platform's edges.
export const SPAWN_INSET = 170;

export const MATCH = Object.freeze({
    roundsToWin: 2,
    roundSeconds: 99,
    introFrames: 120,
    koFrames: 180
});

// Falling into a pit (or flying off the screen) costs this share of max health, then you respawn.
export const RING_OUT = Object.freeze({
    healthFraction: 0.2,
    margin: 140,            // how far past the screen edge counts as "out" (sides and bottom)
    respawnHeight: 330,     // respawn this far above the main platform
    respawnInvincible: 120  // frames of invincibility after respawning
});

// Shield, dodges, ledges, grabs. Frame counts are at 60 fps.
export const DEFENSE = Object.freeze({
    shieldMax: 50,
    shieldDecay: 0.14,        // per frame while held
    shieldRegen: 0.07,        // per frame while not held
    shieldDamageScale: 1.2,   // shield HP lost per point of attack damage
    shieldBreakFrames: 150,   // dizzy time when the shield pops
    roll: { frames: 26, intangible: [3, 18], speed: 7.5 },
    spotDodge: { frames: 22, intangible: [3, 16] },
    airDodge: { frames: 30, intangible: [3, 20], speed: 9 },
    ledge: { reach: 70, above: 60, below: 80, intangible: 40, maxHang: 240, cooldown: 30, climbFrames: 22 },
    grab: { holdFrames: 80, mashFrames: 5 },
    landingLag: 4,
    helplessLandingLag: 14
});

// Input timing (frames).
export const INPUT_TIMING = Object.freeze({
    tapJumpGrace: 3,   // up waits this long for an attack/special before it becomes a jump
    doubleTap: 12      // two taps of a direction within this many frames = run
});

// Key bindings. Each action accepts several keys so laptops without a numpad can play.
// Up also jumps (tap jump), so jump has its own key mainly for comfort.
export const CONTROLS = Object.freeze({
    p1: {
        left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space'],
        attack: ['KeyJ'], smash: ['KeyK'], special: ['KeyL'], shield: ['Semicolon']
    },
    p2: {
        left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Numpad5'],
        attack: ['Numpad1', 'Comma'], smash: ['Numpad2', 'Period'], special: ['Numpad3', 'Slash'], shield: ['Numpad0', 'ShiftRight']
    },
    menu: { confirm: ['Enter', 'Space'], back: ['Escape'], mute: ['KeyM'] }
});

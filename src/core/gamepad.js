// ============================================================================
// GAMEPADS
// Reads PlayStation / Xbox / most USB controllers through the browser's Gamepad
// API and turns them into the same actions the keyboard produces. The first
// controller connected plays as P1, the second as P2. Keyboard still works too.
//
// Layout (by button position, so PlayStation and Xbox match):
//   ✕ / A (bottom)  jump, confirm in menus      □ / X (left)   attack
//   △ / Y (top)     smash (hold to charge)      ○ / B (right)  special, back in menus
//   R1 R2 L2        shield                      L1             grab
//   Left stick / D-pad  move                    Right stick    smash attack in that direction
//   Options / Menu  confirm                     Create / View  back
//
// Browsers only reveal a controller after one of its buttons is pressed on the page.
// ============================================================================

const STICK_THRESHOLD = 0.45;
const RIGHT_STICK_THRESHOLD = 0.6;
const MAX_PLAYERS = 2;

// Standard-mapping button indices (Chrome/Edge map DualSense, DualShock 4 and Xbox pads to these).
const B = Object.freeze({
    bottom: 0, right: 1, left: 2, top: 3, l1: 4, r1: 5, l2: 6, r2: 7,
    select: 8, start: 9, up: 12, down: 13, dpadLeft: 14, dpadRight: 15
});

/** What each button does in a fight. Several buttons may map to one action. */
const BUTTON_ACTIONS = Object.freeze({
    jump: [B.bottom],
    attack: [B.left],
    smash: [B.top],
    special: [B.right],
    shield: [B.r1, B.r2, B.l2]
});

function isDown(pad, index) {
    const b = pad.buttons[index];
    return !!b && (b.pressed || b.value > 0.5);
}

/** One controller's state this frame: actions held, plus a few raw readings. */
function readPad(pad) {
    const held = {};
    for (const [action, buttons] of Object.entries(BUTTON_ACTIONS)) held[action] = buttons.some((i) => isDown(pad, i));
    const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
    held.left = lx < -STICK_THRESHOLD || isDown(pad, B.dpadLeft);
    held.right = lx > STICK_THRESHOLD || isDown(pad, B.dpadRight);
    held.up = ly < -STICK_THRESHOLD || isDown(pad, B.up);
    held.down = ly > STICK_THRESHOLD || isDown(pad, B.down);
    held.grab = isDown(pad, B.l1);
    held.confirm = isDown(pad, B.bottom) || isDown(pad, B.start);
    held.cancel = isDown(pad, B.right) || isDown(pad, B.select);
    // Right stick: which way it's pushed, if far enough (like Smash's C-stick).
    const len = Math.hypot(rx, ry);
    held.cstick = len < RIGHT_STICK_THRESHOLD ? null
        : Math.abs(rx) > Math.abs(ry) ? (rx < 0 ? 'left' : 'right') : (ry < 0 ? 'up' : 'down');
    return held;
}

export class GamepadReader {
    /** @param getGamepads  returns the browser's gamepad list (tests pass a fake) */
    constructor(getGamepads = () => globalThis.navigator?.getGamepads?.() ?? []) {
        this.getGamepads = getGamepads;
        this.slots = new Array(MAX_PLAYERS).fill(null); // gamepad index for P1, P2
        this.previous = [{}, {}];
        this.events = [];
    }

    /** Give newly seen controllers a player slot, and free the slots of unplugged ones. */
    assign(pads) {
        const present = new Set(pads.filter(Boolean).map((p) => p.index));
        this.slots.forEach((index, player) => {
            if (index !== null && !present.has(index)) {
                this.slots[player] = null;
                this.previous[player] = {};
                this.events.push({ type: 'disconnected', player: player + 1 });
            }
        });
        for (const pad of pads) {
            if (!pad || this.slots.includes(pad.index)) continue;
            const free = this.slots.indexOf(null);
            if (free < 0) break;
            this.slots[free] = pad.index;
            this.events.push({ type: 'connected', player: free + 1, name: pad.id });
        }
    }

    /** The controller playing as `playerNumber`, if any. */
    padFor(playerNumber, pads) {
        const index = this.slots[playerNumber - 1];
        return index === null ? null : pads.find((p) => p && p.index === index) ?? null;
    }

    /**
     * OR this frame's controller state into a player's input (which already has the keyboard).
     * Sets held flags, `<action>Pressed` on the frame a button goes down, and confirm/cancel for menus.
     */
    applyTo(input, playerNumber) {
        const pads = Array.from(this.getGamepads() || []);
        if (playerNumber === 1) this.assign(pads);
        const pad = this.padFor(playerNumber, pads);
        if (!pad) return input;
        const held = readPad(pad);
        const before = this.previous[playerNumber - 1];
        const pressed = (key) => !!held[key] && !before[key];

        for (const action of ['left', 'right', 'up', 'down', 'jump', 'attack', 'smash', 'special', 'shield']) {
            input[action] = input[action] || held[action];
            input[`${action}Pressed`] = input[`${action}Pressed`] || pressed(action);
        }
        // L1 grabs: shield + attack in one press.
        if (held.grab) input.shield = true;
        if (pressed('grab')) { input.shield = true; input.attack = true; input.attackPressed = true; }
        // Right stick: a smash attack aimed that way (only the frame it's flicked; holding it charges).
        if (held.cstick) {
            input.smash = true;
            if (held.cstick !== before.cstick) {
                input.smashPressed = true;
                for (const dir of ['left', 'right', 'up', 'down']) input[dir] = dir === held.cstick;
            }
        }
        input.confirmPressed = input.confirmPressed || pressed('confirm');
        input.cancelPressed = input.cancelPressed || pressed('cancel');
        this.previous[playerNumber - 1] = held;
        return input;
    }

    /** Rumble a player's controller, if it supports it (most do in Chrome and Edge; quietly ignored otherwise). */
    rumble(playerNumber, { strong = 0.5, weak = 0.5, duration = 120 } = {}) {
        try {
            const pad = this.padFor(playerNumber, Array.from(this.getGamepads() || []));
            pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => {});
        } catch { /* no rumble support */ }
    }

    drainEvents() {
        const events = this.events;
        this.events = [];
        return events;
    }
}

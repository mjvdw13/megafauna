// ============================================================================
// INPUT HANDLER
// Polls keyboard state (and any game controllers, see gamepad.js) once per
// simulation step and exposes held/pressed flags per player. Key bindings come
// from CONTROLS in config.js.
//
// Menus read `confirmPressed` / `cancelPressed` rather than fight buttons:
// keyboard attack / smash, controller ✕ / ○.
//
// Besides raw keys it works out two Smash-style gestures:
//   tap jump   — up becomes a jump unless an attack/special follows within a few frames
//                (so up + attack is an up attack, not a jump)
//   dash       — double-tap left/right to run
// ============================================================================
import { CONTROLS, INPUT_TIMING } from '../config.js';
import { GamepadReader } from './gamepad.js';

export const PLAYER_ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'smash', 'special', 'shield'];
const NEVER = 999;

/** A fresh input object: each action has a held flag and a `<action>Pressed` flag (true for one step). */
export function createPlayerInput() {
    const input = { horizontal: 0, vertical: 0, dash: 0, confirmPressed: false, cancelPressed: false };
    for (const action of PLAYER_ACTIONS) {
        input[action] = false;
        input[`${action}Pressed`] = false;
    }
    return input;
}

/** Fill in `horizontal` / `vertical` from the held directions. Returns the input. */
export function finishInput(input) {
    input.horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    input.vertical = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    return input;
}

/** An input object with nothing held, for fighters that should not act (e.g. during KO). */
export const NEUTRAL_INPUT = Object.freeze(createPlayerInput());

/** Per-player gesture tracking that turns raw presses into tap-jumps and dashes. */
class GestureTracker {
    constructor() {
        this.pendingJump = 0;
        this.lastTap = { left: -NEVER, right: -NEVER };
        this.frame = 0;
    }

    apply(input) {
        this.frame++;

        // Double-tap to dash
        input.dash = 0;
        for (const [dir, sign] of [['left', -1], ['right', 1]]) {
            if (!input[`${dir}Pressed`]) continue;
            if (this.frame - this.lastTap[dir] <= INPUT_TIMING.doubleTap) { input.dash = sign; this.lastTap[dir] = -NEVER; }
            else this.lastTap[dir] = this.frame;
        }

        // Tap jump: wait a moment to see if up was the start of an up attack or up special
        const actionPressed = input.attackPressed || input.smashPressed || input.specialPressed || input.shield;
        if (input.upPressed) this.pendingJump = INPUT_TIMING.tapJumpGrace;
        if (this.pendingJump > 0) {
            if (actionPressed) this.pendingJump = 0;
            else if (--this.pendingJump === 0) input.jumpPressed = true;
        }
        input.jump = input.jump || input.up;
        return finishInput(input);
    }
}

export class InputHandler {
    constructor(target = window, controls = CONTROLS, gamepads = new GamepadReader()) {
        this.controls = controls;
        this.gamepads = gamepads;
        this.keys = new Map();
        this.previousKeys = new Map();
        // Keys pressed since the last poll, so a tap shorter than one frame still registers.
        this.tapped = new Set();
        this.player1 = createPlayerInput();
        this.player2 = createPlayerInput();
        this.gestures = [new GestureTracker(), new GestureTracker()];
        this.menu = { confirm: false, back: false, mute: false };
        this.boundCodes = new Set(
            [controls.p1, controls.p2, controls.menu].flatMap((map) => Object.values(map).flat())
        );

        target.addEventListener('keydown', (e) => {
            if (!e.repeat) this.tapped.add(e.code);
            this.keys.set(e.code, true);
            // Only swallow keys the game uses, so browser shortcuts (F5, F12...) still work.
            if (this.boundCodes.has(e.code)) e.preventDefault();
        });
        target.addEventListener('keyup', (e) => this.keys.set(e.code, false));
        // Releasing keys while the tab is unfocused would otherwise leave them "stuck".
        target.addEventListener('blur', () => this.keys.clear());
    }

    isDown(codes) { return codes.some((code) => this.keys.get(code) || this.tapped.has(code)); }
    isPressed(codes) { return codes.some((code) => this.tapped.has(code) || (this.keys.get(code) && !this.previousKeys.get(code))); }

    updatePlayer(input, playerNumber, bindings, gestures) {
        for (const action of PLAYER_ACTIONS) {
            input[action] = this.isDown(bindings[action]);
            input[`${action}Pressed`] = this.isPressed(bindings[action]);
        }
        input.confirmPressed = input.attackPressed;
        input.cancelPressed = input.smashPressed;
        this.gamepads.applyTo(input, playerNumber);
        gestures.apply(input);
    }

    update() {
        this.updatePlayer(this.player1, 1, this.controls.p1, this.gestures[0]);
        this.updatePlayer(this.player2, 2, this.controls.p2, this.gestures[1]);
        this.menu.confirm = this.isPressed(this.controls.menu.confirm);
        this.menu.back = this.isPressed(this.controls.menu.back);
        this.menu.mute = this.isPressed(this.controls.menu.mute);
        // Snapshot AFTER evaluating presses so "pressed" is true for exactly one step.
        this.previousKeys = new Map(this.keys);
        this.tapped.clear();
    }

    getPlayerInput(playerNumber) { return playerNumber === 1 ? this.player1 : this.player2; }

    /** Menu confirm from Enter/Space, either player's attack key, or a controller's ✕. */
    anyConfirm() { return this.menu.confirm || this.player1.confirmPressed || this.player2.confirmPressed; }

    /** Menu back from Esc, either player's smash key, or a controller's ○. */
    anyCancel() { return this.menu.back || this.player1.cancelPressed || this.player2.cancelPressed; }
}

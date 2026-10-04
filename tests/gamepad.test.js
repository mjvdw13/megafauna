import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GamepadReader } from '../src/core/gamepad.js';
import { InputHandler } from '../src/core/input.js';

/** A fake standard-mapping controller (DualSense / Xbox layout). */
function fakePad(index = 0) {
    return {
        index, id: `Fake Controller ${index}`, mapping: 'standard',
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        axes: [0, 0, 0, 0],
        press(i, down = true) { this.buttons[i] = { pressed: down, value: down ? 1 : 0 }; return this; }
    };
}

/** An InputHandler wired to fake controllers (no real keyboard or browser). */
function handlerWith(pads) {
    return new InputHandler(new EventTarget(), undefined, new GamepadReader(() => pads));
}

test('face buttons map by position: ✕ jump, □ attack, △ smash, ○ special, R1 shield', () => {
    const pad = fakePad();
    const input = handlerWith([pad]);
    for (const [button, action] of [[0, 'jump'], [2, 'attack'], [3, 'smash'], [1, 'special'], [5, 'shield']]) {
        pad.press(button);
        input.update();
        assert.ok(input.player1[action], `button ${button} holds ${action}`);
        assert.ok(input.player1[`${action}Pressed`], `button ${button} presses ${action}`);
        input.update();
        assert.ok(!input.player1[`${action}Pressed`], `${action}Pressed lasts one frame`);
        pad.press(button, false);
        input.update();
    }
});

test('left stick and D-pad move, with a dead zone', () => {
    const pad = fakePad();
    const input = handlerWith([pad]);
    pad.axes[0] = 0.2;
    input.update();
    assert.equal(input.player1.horizontal, 0, 'small tilt ignored');
    pad.axes[0] = -0.9;
    input.update();
    assert.equal(input.player1.horizontal, -1);
    pad.axes[0] = 0;
    pad.press(15);
    input.update();
    assert.equal(input.player1.horizontal, 1, 'D-pad right');
});

test('the right stick does a smash attack in that direction', () => {
    const pad = fakePad();
    const input = handlerWith([pad]);
    pad.axes[3] = -1; // right stick up
    input.update();
    assert.ok(input.player1.smashPressed && input.player1.up, 'up smash');
    input.update();
    assert.ok(input.player1.smash && !input.player1.smashPressed, 'holding the stick keeps charging');
});

test('L1 grabs (shield + attack in one press)', () => {
    const pad = fakePad();
    const input = handlerWith([pad]);
    pad.press(4);
    input.update();
    assert.ok(input.player1.shield && input.player1.attackPressed);
});

test('✕ confirms and ○ cancels in menus', () => {
    const pad = fakePad();
    const input = handlerWith([pad]);
    pad.press(0);
    input.update();
    assert.ok(input.anyConfirm());
    pad.press(0, false).press(1);
    input.update();
    assert.ok(input.anyCancel());
});

test('first controller is P1, second is P2; unplugging frees the slot', () => {
    const pads = [fakePad(0)];
    const reader = new GamepadReader(() => pads);
    const input = new InputHandler(new EventTarget(), undefined, reader);
    input.update();
    pads.push(fakePad(1));
    input.update();
    assert.deepEqual(reader.drainEvents().map((e) => [e.type, e.player]), [['connected', 1], ['connected', 2]]);
    pads[1].press(2);
    input.update();
    assert.ok(input.player2.attackPressed && !input.player1.attackPressed, 'second controller drives P2');
    pads.pop();
    input.update();
    assert.deepEqual(reader.drainEvents().map((e) => [e.type, e.player]), [['disconnected', 2]]);
});

test('without the Gamepad API nothing breaks', () => {
    const input = new InputHandler(new EventTarget(), undefined, new GamepadReader(() => undefined));
    input.update();
    assert.equal(input.player1.horizontal, 0);
    new GamepadReader(() => []).rumble(1);
});

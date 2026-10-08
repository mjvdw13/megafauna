import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GamepadReader } from '../src/core/gamepad.js';
import { InputHandler } from '../src/core/input.js';
import { TouchPad } from '../src/core/touch.js';

/** An InputHandler wired to a touch pad (no real keyboard, controllers or screen). */
function handlerWithTouch() {
    const touch = new TouchPad();
    const input = new InputHandler(new EventTarget(), undefined, new GamepadReader(() => []), touch);
    return { touch, input };
}

test('touch buttons hold and press their actions for player 1 only', () => {
    const { touch, input } = handlerWithTouch();
    for (const action of ['jump', 'attack', 'smash', 'special', 'shield']) {
        touch.press(action);
        input.update();
        assert.ok(input.player1[action], `${action} held`);
        assert.ok(input.player1[`${action}Pressed`], `${action} pressed`);
        assert.ok(!input.player2[action], 'player 2 is untouched');
        input.update();
        assert.ok(input.player1[action] && !input.player1[`${action}Pressed`], `${action}Pressed lasts one frame`);
        touch.release(action);
        input.update();
        assert.ok(!input.player1[action]);
    }
});

test('a tap shorter than a frame still registers', () => {
    const { touch, input } = handlerWithTouch();
    touch.press('attack');
    touch.release('attack');
    input.update();
    assert.ok(input.player1.attackPressed);
    input.update();
    assert.ok(!input.player1.attack && !input.player1.attackPressed);
});

test('attack confirms and smash cancels in menus', () => {
    const { touch, input } = handlerWithTouch();
    touch.press('attack');
    input.update();
    assert.ok(input.anyConfirm());
    touch.release('attack');
    touch.press('smash');
    input.update();
    assert.ok(input.anyCancel());
});

test('grab is shield + attack in one press', () => {
    const { touch, input } = handlerWithTouch();
    touch.press('grab');
    input.update();
    assert.ok(input.player1.shield && input.player1.attackPressed);
});

test('the stick moves with a dead zone, and needs a firmer push to jump or crouch', () => {
    const { touch, input } = handlerWithTouch();
    touch.setStick(0.2, 0);
    input.update();
    assert.equal(input.player1.horizontal, 0, 'small push ignored');
    touch.setStick(-0.5, -0.4);
    input.update();
    assert.equal(input.player1.horizontal, -1);
    assert.equal(input.player1.vertical, 0, 'walking at a slight upward angle does not jump');
    touch.setStick(0, -0.9);
    input.update();
    assert.ok(input.player1.upPressed && input.player1.jump, 'up is a tap jump');
});

test('flicking the stick sideways starts a run; pushing slowly walks', () => {
    const { touch, input } = handlerWithTouch();
    input.update();
    touch.setStick(1, 0);
    input.update();
    assert.equal(input.player1.dash, 1, 'flick runs');
    input.update();
    assert.equal(input.player1.dash, 0, 'one run per flick');

    touch.setStick(0, 0);
    input.update();
    for (const x of [-0.4, -0.5, -0.6, -0.7, -0.75, -0.8, -1]) {
        touch.setStick(x, 0);
        input.update();
        assert.equal(input.player1.dash, 0, `slow push at ${x} walks`);
    }
});

test('touch menu buttons press back and mute once', () => {
    const { touch, input } = handlerWithTouch();
    touch.pressMenu('back');
    touch.pressMenu('mute');
    input.update();
    assert.ok(input.menu.back && input.menu.mute);
    input.update();
    assert.ok(!input.menu.back && !input.menu.mute);
});

test('touch shows up in online play through combined()', () => {
    const { touch, input } = handlerWithTouch();
    touch.press('special');
    input.update();
    assert.ok(input.combined().specialPressed);
});

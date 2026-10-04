import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Attack, AttackPhase } from '../src/combat/attack.js';
import { selectMove } from '../src/combat/moveset.js';
import { createPlayerInput, finishInput } from '../src/core/input.js';

const base = new Attack({ name: 'Test', damage: 10, startup: 5, active: 3, recovery: 8, hitbox: { x: 0, y: 0, width: 10, height: 10 } });

/** Input with these actions held, and these pressed this frame. */
function input({ hold = [], press = [] } = {}) {
    const i = createPlayerInput();
    for (const a of hold) i[a] = true;
    for (const a of press) { i[a] = true; i[`${a}Pressed`] = true; }
    return finishInput(i);
}

test('phases follow frame data', () => {
    assert.equal(base.phaseAt(0), AttackPhase.STARTUP);
    assert.equal(base.phaseAt(4), AttackPhase.STARTUP);
    assert.equal(base.phaseAt(5), AttackPhase.ACTIVE);
    assert.equal(base.phaseAt(7), AttackPhase.ACTIVE);
    assert.equal(base.phaseAt(8), AttackPhase.RECOVERY);
    assert.equal(base.getTotalFrames(), 16);
    assert.ok(base.isHitboxActive(5) && !base.isHitboxActive(8));
});

test('power scales damage; attackSpeed scales startup and recovery only', () => {
    const scaled = base.withStats({ power: 1.5, attackSpeed: 0.5 });
    assert.equal(scaled.damage, 15);
    assert.equal(scaled.startup, 10);
    assert.equal(scaled.active, 3);
    assert.equal(scaled.recovery, 16);
});

test('ground moves come from the button plus the direction held', () => {
    const ground = { grounded: true, facingRight: true };
    const cases = [
        [{ press: ['attack'] }, 'jab'],
        [{ press: ['attack'], hold: ['right'] }, 'ftilt'],
        [{ press: ['attack'], hold: ['up'] }, 'utilt'],
        [{ press: ['attack'], hold: ['down'] }, 'dtilt'],
        [{ press: ['smash'] }, 'fsmash'],
        [{ press: ['smash'], hold: ['up'] }, 'usmash'],
        [{ press: ['smash'], hold: ['down'] }, 'dsmash'],
        [{ press: ['special'] }, 'neutralSpecial'],
        [{ press: ['special'], hold: ['left'] }, 'sideSpecial'],
        [{ press: ['special'], hold: ['up'] }, 'upSpecial'],
        [{ press: ['special'], hold: ['down'] }, 'downSpecial'],
        [{ press: ['attack'], hold: ['shield'] }, 'grab']
    ];
    for (const [i, key] of cases) assert.equal(selectMove(input(i), ground)?.key, key, JSON.stringify(i));
    assert.equal(selectMove(input({ press: ['attack'] }), { ...ground, running: true }).key, 'dashAttack');
    assert.equal(selectMove(input(), ground), null, 'no button, no move');
});

test('forward tilts, smashes and side specials turn to face the direction held', () => {
    assert.deepEqual(selectMove(input({ press: ['attack'], hold: ['left'] }), { grounded: true, facingRight: true }), { key: 'ftilt', turn: -1 });
    assert.deepEqual(selectMove(input({ press: ['special'], hold: ['right'] }), { grounded: true, facingRight: false }), { key: 'sideSpecial', turn: 1 });
});

test('aerials depend on direction relative to facing', () => {
    const facingRight = { grounded: false, facingRight: true };
    const facingLeft = { grounded: false, facingRight: false };
    assert.equal(selectMove(input({ press: ['attack'] }), facingRight).key, 'nair');
    assert.equal(selectMove(input({ press: ['attack'], hold: ['right'] }), facingRight).key, 'fair');
    assert.equal(selectMove(input({ press: ['attack'], hold: ['left'] }), facingRight).key, 'bair');
    assert.equal(selectMove(input({ press: ['attack'], hold: ['right'] }), facingLeft).key, 'bair');
    assert.equal(selectMove(input({ press: ['attack'], hold: ['up'] }), facingRight).key, 'uair');
    assert.equal(selectMove(input({ press: ['smash'], hold: ['down'] }), facingRight).key, 'dair', 'smash works like attack in the air');
});

test('while holding someone: attack pummels, a direction throws', () => {
    const holding = { holding: true, facingRight: true };
    assert.equal(selectMove(input({ press: ['attack'] }), holding).key, 'pummel');
    assert.equal(selectMove(input({ press: ['right'] }), holding).key, 'fthrow');
    assert.equal(selectMove(input({ press: ['left'] }), holding).key, 'bthrow');
    assert.equal(selectMove(input({ press: ['up'] }), holding).key, 'uthrow');
    assert.equal(selectMove(input({ press: ['down'] }), holding).key, 'dthrow');
    assert.equal(selectMove(input(), holding), null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HitResult } from '../src/combat/combat-system.js';
import { CharacterStates as S } from '../src/combat/states.js';
import { createPlayerInput, finishInput, NEUTRAL_INPUT } from '../src/core/input.js';
import { isUnlocked, relock, SecretCode, unlock } from '../src/core/unlocks.js';
import { availableRoster, ROSTER } from '../src/fighters/roster.js';
import { createMatch } from './helpers/simulate.js';

const UP5 = ['up', 'up', 'up', 'up', 'up'];

function press(dir) {
    const input = createPlayerInput();
    if (dir) { input[dir] = true; input[`${dir}Pressed`] = true; }
    return finishInput(input);
}

/** Feed a list of presses (null = an idle frame) and report whether the code completed. */
function enter(code, presses) {
    return presses.some((dir) => code.feed(press(dir)));
}

test('pressing up five times enters the code', () => {
    assert.ok(enter(new SecretCode(UP5), ['up', null, 'up', null, null, 'up', 'up', null, 'up']));
});

test('four presses is not enough, and a different direction starts it over', () => {
    assert.ok(!enter(new SecretCode(UP5), ['up', 'up', 'up', 'up']));
    assert.ok(!enter(new SecretCode(UP5), ['up', 'up', 'left', 'up', 'up', 'up']));
});

test('waiting too long between presses starts it over', () => {
    const code = new SecretCode(UP5, { maxGap: 30 });
    assert.ok(!enter(code, ['up', 'up', ...new Array(40).fill(null), 'up', 'up', 'up']));
});

test('Dad is hidden until unlocked, then stays unlocked', () => {
    relock('dad');
    assert.ok(ROSTER.some((c) => c.id === 'dad'), 'Dad is in the full roster');
    assert.ok(!availableRoster().some((c) => c.id === 'dad'), 'hidden at first');
    assert.equal(unlock('dad'), true, 'newly unlocked');
    assert.equal(unlock('dad'), false, 'already unlocked');
    assert.ok(isUnlocked('dad'));
    assert.equal(availableRoster().at(-1).id, 'dad', 'appears at the end of the roster');
    relock('dad');
});

test("Dad's Bad Breath leaves a grounded opponent dizzy", () => {
    const { match, fighters } = createMatch('dad', 'riley');
    const [dad, riley] = fighters;
    const y = match.physics.main.y;
    dad.reset(480, y, true);
    riley.reset(700, y, false);
    for (const f of fighters) f.ground = match.physics.main;
    dad.startAttack('neutralSpecial');
    let hit = null;
    for (let i = 0; i < 90 && !hit; i++) {
        hit = match.step([NEUTRAL_INPUT, NEUTRAL_INPUT]).find((e) => e.type === 'hit')?.hit ?? null;
    }
    assert.ok(hit, 'the breath cloud reached Riley');
    assert.equal(hit.result, HitResult.HIT);
    assert.ok(hit.dizzy);
    assert.equal(riley.stateMachine.currentState, S.DIZZY);
});

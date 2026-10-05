import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyHit, HitResult } from '../src/combat/combat-system.js';
import { CharacterStates as S } from '../src/combat/states.js';
import { BURN } from '../src/config.js';
import { NEUTRAL_INPUT } from '../src/core/input.js';
import { createMatch } from './helpers/simulate.js';

/** Two fighters face to face in the middle of a stage. */
function setup(p1Id = 'gary', p2Id = 'riley', stage = 'meadow', gap = 100) {
    const { match, fighters } = createMatch(p1Id, p2Id, { stage });
    const [a, b] = fighters;
    const y = match.physics.main.y;
    a.reset(600, y, true);
    b.reset(600 + gap, y, false);
    for (const f of fighters) { f.ground = match.physics.main; f.input = NEUTRAL_INPUT; }
    return { a, b, match };
}

function hitWith(attacker, defender, key) {
    const attack = attacker.attacks[key];
    return applyHit({ attack, attacker, defender, impact: { x: defender.centerX, y: defender.y }, sourceX: attacker.centerX });
}

function run(match, frames) {
    const events = [];
    for (let i = 0; i < frames; i++) events.push(...match.step([NEUTRAL_INPUT, NEUTRAL_INPUT]));
    return events;
}

test('a fire move sets the opponent burning: 1 damage per tick until it burns out', () => {
    const { a, b, match } = setup();
    const fire = a.attacks.neutralSpecial;
    assert.ok(fire.burn > 0, 'Fire Breath burns');
    const hit = hitWith(a, b, 'neutralSpecial');
    assert.equal(hit.result, HitResult.HIT);
    assert.ok(hit.ignited, 'reported as a new burn');
    assert.equal(b.burnTicks, fire.burn);

    const afterHit = b.health;
    const events = run(match, BURN.interval * (fire.burn + 2));
    const ticks = events.filter((e) => e.type === 'burn' && e.fighter === b);
    assert.equal(ticks.length, fire.burn, 'one tick per point of burn');
    assert.equal(b.health, afterHit - fire.burn);
    assert.equal(b.burnTicks, 0, 'burnt out');
});

test('burns don\'t stack past the longer one, and a shield stops the fire', () => {
    const { a, b } = setup();
    hitWith(a, b, 'fsmash');
    const ticks = b.burnTicks;
    const again = hitWith(a, b, 'jab3');
    assert.ok(!again.ignited, 'already burning');
    assert.equal(b.burnTicks, ticks, 'a weaker burn doesn\'t shorten or add to a stronger one');
    assert.ok(b.burnTicks <= BURN.maxTicks);

    const { a: a2, b: b2 } = setup();
    b2.stateMachine.setState(S.SHIELDING);
    assert.equal(hitWith(a2, b2, 'fsmash').result, HitResult.BLOCK);
    assert.equal(b2.burnTicks, 0, 'shielded fire doesn\'t burn');
});

test('Gary is fireproof', () => {
    const { a, b } = setup('gary', 'gary');
    hitWith(a, b, 'fsmash');
    assert.equal(b.burnTicks, 0);
});

test('fire throws burn too', () => {
    const { a, b, match } = setup('gary', 'riley', 'meadow', 70);
    a.startAttack('grab');
    let grabbed = false;
    for (let i = 0; i < 30 && !grabbed; i++) grabbed = match.step([NEUTRAL_INPUT, NEUTRAL_INPUT]).some((e) => e.type === 'hit' && e.hit.result === HitResult.GRAB);
    assert.ok(grabbed, 'grabbed');
    a.startAttack('fthrow');
    const events = run(match, 20);
    assert.ok(events.some((e) => e.type === 'hit' && e.hit.thrown && e.hit.ignited), 'Roast sets them alight');
    assert.ok(b.burnTicks > 0 || events.some((e) => e.type === 'burn'));
});

test('falling into water puts the fire out; lava doesn\'t', () => {
    for (const [stage, douses] of [['duck-pond', true], ['volcano', false]]) {
        const { a, b, match } = setup('gary', 'riley', stage);
        hitWith(a, b, 'fsmash');
        b.x = 20;
        b.y = match.physics.main.y + 20;
        b.velocityY = 4;
        b.isGrounded = false;
        b.ground = null;
        b.stateMachine.setState(S.FALLING);
        const events = run(match, 6);
        assert.ok(events.some((e) => e.type === 'splash' && e.fighter === b), `${stage}: splashed`);
        assert.equal(events.some((e) => e.type === 'douse'), douses, `${stage}: douse`);
        assert.equal(b.burnTicks === 0, douses, `${stage}: still burning?`);
    }
});

test('Hot Foot leaves one ember patch on the ground; a new one replaces it', () => {
    const { a, match } = setup('gary', 'riley');
    a.x -= 200; // well away from Riley
    const patches = () => match.projectiles.filter((p) => p.kind === 'embers');
    a.startAttack('downSpecial');
    run(match, a.attacks.downSpecial.getTotalFrames() + 10);
    assert.equal(patches().length, 1);
    const first = patches()[0];
    assert.ok(first.grounded, 'settled on the ground');
    assert.equal(first.y + first.height, match.physics.main.y, 'sits on the platform');

    a.startAttack('downSpecial');
    const events = run(match, a.attacks.downSpecial.getTotalFrames() + 2);
    assert.equal(patches().length, 1, 'still only one');
    assert.notEqual(patches()[0], first);
    assert.ok(events.some((e) => e.type === 'projectileEnd' && e.projectile === first), 'the old one went out');
});

test('walking into the ember patch burns and pops the victim up', () => {
    const { a, b, match } = setup('gary', 'riley', 'meadow', 400);
    a.startAttack('downSpecial');
    run(match, a.attacks.downSpecial.getTotalFrames() + 10);
    const patch = match.projectiles.find((p) => p.kind === 'embers');
    assert.ok(patch, 'patch is down');
    b.x = patch.centerX - b.width / 2;
    const events = run(match, 2);
    const hit = events.find((e) => e.type === 'hit' && e.hit.projectile === patch);
    assert.ok(hit, 'stepped in it');
    assert.ok(b.burnTicks > 0, 'burning');
    assert.ok(b.velocityY < 0 && !b.isGrounded, 'hopped');
    assert.ok(!match.projectiles.includes(patch), 'the patch is used up');
});

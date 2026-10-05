import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HitResult, resolveAttack } from '../src/combat/combat-system.js';
import { CharacterStates as S } from '../src/combat/states.js';
import { DEFENSE, RING_OUT } from '../src/config.js';
import { createPlayerInput, finishInput, NEUTRAL_INPUT } from '../src/core/input.js';
import { Physics } from '../src/core/physics.js';
import { createMatch } from './helpers/simulate.js';

/** Input with these actions held, and these pressed this frame. */
function input({ hold = [], press = [] } = {}) {
    const i = createPlayerInput();
    for (const a of hold) i[a] = true;
    for (const a of press) { i[a] = true; i[`${a}Pressed`] = true; }
    return finishInput(i);
}

/** Two fighters standing face to face in the middle of Sunny Meadow, `gap` px apart (center to center). */
function setup(p1Id = 'riley', p2Id = 'riley', gap = 90, stage = 'meadow') {
    const { match, fighters } = createMatch(p1Id, p2Id, { stage });
    const [a, b] = fighters;
    const y = match.physics.main.y;
    a.reset(640 - gap / 2, y, true);
    b.reset(640 + gap / 2, y, false);
    for (const f of fighters) { f.ground = match.physics.main; f.input = NEUTRAL_INPUT; }
    return { a, b, match };
}

/** Advance the attacker until its hitbox is active. */
function attackUntilActive(attacker, key) {
    assert.ok(attacker.startAttack(key), `could start ${key}`);
    while (!attacker.isHitboxActive()) attacker.advanceAttack(NEUTRAL_INPUT);
}

/** Run the match for `frames` steps with fixed inputs. Returns all events. */
function run(match, frames, inputs = [NEUTRAL_INPUT, NEUTRAL_INPUT]) {
    const events = [];
    for (let i = 0; i < frames; i++) events.push(...match.step(typeof inputs === 'function' ? inputs(i) : inputs));
    return events;
}

// ---------------------------------------------------------------------------- hits and shields

test('a clean hit deals damage and puts the defender in hitstun', () => {
    const { a, b } = setup();
    attackUntilActive(a, 'ftilt');
    const hit = resolveAttack(a, b);
    assert.equal(hit.result, HitResult.HIT);
    assert.equal(b.health, b.maxHealth - a.attacks.ftilt.damage);
    assert.equal(b.stateMachine.currentState, S.HITSTUN);
    assert.ok(b.velocityX > 0, 'pushed away from attacker');
    assert.equal(resolveAttack(a, b), null, 'one hit per attack');
});

test('a shield blocks all damage but wears down', () => {
    const { a, b } = setup();
    b.stateMachine.setState(S.SHIELDING);
    attackUntilActive(a, 'ftilt');
    const hit = resolveAttack(a, b);
    assert.equal(hit.result, HitResult.BLOCK);
    assert.equal(b.health, b.maxHealth, 'no damage through a shield');
    assert.ok(b.shieldHP < DEFENSE.shieldMax, 'shield took the hit');
    assert.ok(b.stateMachine.stateData.stun > 0, 'shieldstun');
});

test('a worn-out shield breaks and leaves the fighter dizzy', () => {
    const { a, b } = setup('randy', 'riley', 160);
    b.shieldHP = 5;
    b.stateMachine.setState(S.SHIELDING);
    attackUntilActive(a, 'fsmash');
    assert.equal(resolveAttack(a, b).result, HitResult.SHIELD_BREAK);
    assert.equal(b.stateMachine.currentState, S.DIZZY);
});

test('holding a shield too long breaks it by itself', () => {
    const { b, match } = setup();
    const shield = input({ hold: ['shield'] });
    run(match, Math.ceil(DEFENSE.shieldMax / DEFENSE.shieldDecay) + 5, [NEUTRAL_INPUT, shield]);
    assert.equal(b.stateMachine.currentState, S.DIZZY);
});

// ---------------------------------------------------------------------------- grabs and throws

test('grabs go straight through shields, and throws deal damage and launch', () => {
    const { a, b, match } = setup('riley', 'riley', 70);
    b.stateMachine.setState(S.SHIELDING);
    attackUntilActive(a, 'grab');
    assert.equal(resolveAttack(a, b).result, HitResult.GRAB);
    assert.equal(b.stateMachine.currentState, S.GRABBED);
    assert.equal(a.holding, b);

    // Finish the grab animation, then throw forward.
    run(match, 30, [NEUTRAL_INPUT, input({ hold: ['shield'] })]);
    assert.equal(a.stateMachine.currentState, S.GRABBING);
    const events = run(match, 20, (i) => [i === 0 ? input({ press: ['right'] }) : NEUTRAL_INPUT, NEUTRAL_INPUT]);
    const thrown = events.find((e) => e.type === 'hit' && e.hit.thrown);
    assert.ok(thrown, 'throw happened');
    assert.equal(a.holding, null);
    assert.ok(b.health < b.maxHealth, 'throw damage');
    assert.ok(b.velocityX > 0, 'thrown forward');
});

test('a throw pressed while the grab is still closing is not lost', () => {
    const { a, b, match } = setup('riley', 'riley', 70);
    attackUntilActive(a, 'grab');
    resolveAttack(a, b);
    match.step([input({ press: ['up'] }), NEUTRAL_INPUT]);
    run(match, 40);
    assert.equal(a.holding, null, 'threw');
    assert.ok(b.health < b.maxHealth);
});

test('mashing gets out of a grab sooner', () => {
    const escapeTime = (mash) => {
        const { a, b, match } = setup('riley', 'riley', 70);
        attackUntilActive(a, 'grab');
        resolveAttack(a, b);
        for (let i = 1; i < 400; i++) {
            match.step([NEUTRAL_INPUT, mash && i % 2 ? input({ press: ['attack'] }) : NEUTRAL_INPUT]);
            if (!a.holding) return i;
        }
        return Infinity;
    };
    assert.ok(escapeTime(true) < escapeTime(false));
});

// ---------------------------------------------------------------------------- dodges, armor, counters

test('a spot dodge is untouchable in its middle frames', () => {
    const { a, b } = setup();
    b.stateMachine.setState(S.SPOTDODGE);
    for (let i = 0; i < 5; i++) b.stateMachine.update(NEUTRAL_INPUT);
    attackUntilActive(a, 'ftilt');
    assert.equal(resolveAttack(a, b), null);
});

test("Randy's smash attacks shrug off one hit", () => {
    const { a: randy, b: riley } = setup('randy', 'riley', 150);
    randy.startAttack('fsmash');
    randy.advanceAttack(NEUTRAL_INPUT);
    attackUntilActive(riley, 'jab');
    riley.x = randy.x + randy.width - 50;
    const hit = resolveAttack(riley, randy);
    assert.equal(hit.result, HitResult.ARMOR);
    assert.equal(randy.stateMachine.currentState, S.ATTACKING, 'still swinging');
    assert.ok(randy.health < randy.maxHealth, 'armor still takes damage');
});

test("Randy's Frill Guard counters a hit with no damage", () => {
    const { a: randy, b: riley } = setup('randy', 'riley', 150);
    attackUntilActive(riley, 'ftilt');
    randy.startAttack('downSpecial');
    while (randy.currentAttack.phaseAt(randy.attackFrame) !== 'active') randy.advanceAttack(NEUTRAL_INPUT);
    riley.x = randy.x + randy.width - 50;
    const hit = resolveAttack(riley, randy);
    assert.equal(hit.result, HitResult.COUNTER);
    assert.equal(randy.health, randy.maxHealth);
    assert.equal(randy.attackKey, 'frillCounter');
});

test('heavier fighters are pushed less by the same hit', () => {
    const push = (target, gap) => {
        const { a, b } = setup('riley', target, gap);
        attackUntilActive(a, 'ftilt');
        resolveAttack(a, b);
        return Math.abs(b.velocityX);
    };
    assert.ok(push('randy', 130) < push('quackers', 90));
});

test('knockdown attacks knock down and grant invincibility', () => {
    const { a: randy, b: riley } = setup('randy', 'riley', 140);
    attackUntilActive(randy, 'dtilt');
    assert.equal(resolveAttack(randy, riley).result, HitResult.HIT);
    assert.equal(riley.stateMachine.currentState, S.KNOCKDOWN);
    assert.ok(riley.isIntangible());
});

// ---------------------------------------------------------------------------- move mechanics

test('multi-hit moves connect more than once', () => {
    const { a, b, match } = setup('riley', 'riley', 70);
    a.startAttack('upSpecial');
    const events = run(match, 30);
    const hits = events.filter((e) => e.type === 'hit' && e.hit.attacker === a && e.hit.result === HitResult.HIT);
    assert.ok(hits.length >= 2, `Tail Tornado hit ${hits.length} times`);
});

test('holding the smash button charges a smash attack for more damage', () => {
    const damageAfter = (chargeFrames) => {
        const { a, b, match } = setup('riley', 'riley', 110);
        const hold = input({ hold: ['smash'] });
        let frame = 0;
        match.step([input({ press: ['smash'] }), NEUTRAL_INPUT]);
        while (b.health === b.maxHealth && frame++ < 200) match.step([frame < chargeFrames ? hold : NEUTRAL_INPUT, NEUTRAL_INPUT]);
        return b.maxHealth - b.health;
    };
    assert.ok(damageAfter(60) > damageAfter(0));
});

test('jab presses chain into a 1-2-3 combo', () => {
    const { a, match } = setup('riley', 'riley', 300);
    const keys = new Set();
    for (let i = 0; i < 60; i++) {
        match.step([i % 3 === 0 ? input({ press: ['attack'] }) : NEUTRAL_INPUT, NEUTRAL_INPUT]);
        if (a.attackKey) keys.add(a.attackKey);
    }
    assert.ok(keys.has('jab') && keys.has('jab2') && keys.has('jab3'), [...keys].join(','));
});

test("projectiles hit from range: Riley's Bark Blast", () => {
    const { a, b, match } = setup('riley', 'quackers', 280);
    a.startAttack('neutralSpecial');
    const events = run(match, 60);
    assert.ok(events.some((e) => e.type === 'projectile'), 'fired');
    assert.ok(events.some((e) => e.type === 'hit' && e.hit.projectile && e.hit.result === HitResult.HIT), 'hit');
    assert.ok(b.health < b.maxHealth);
});

test("Quackers' QUACK! sends a projectile back at its owner", () => {
    const { a: riley, b: duck, match } = setup('riley', 'quackers', 300);
    riley.startAttack('neutralSpecial');
    let reflected = false;
    for (let i = 0; i < 80 && !reflected; i++) {
        const p = match.projectiles[0];
        if (p && !duck.currentAttack && Math.abs(p.centerX - duck.centerX) < 170) duck.startAttack('downSpecial');
        reflected = match.step([NEUTRAL_INPUT, NEUTRAL_INPUT]).some((e) => e.type === 'hit' && e.hit.result === HitResult.REFLECT);
    }
    assert.ok(reflected, 'reflected');
    assert.equal(match.projectiles[0]?.owner, duck, 'now belongs to Quackers');
});

// ---------------------------------------------------------------------------- stages: platforms, ledges, pits

test('fighters land on platforms from above, jump up through them, and drop through with down', () => {
    const { a, match } = setup();
    const platform = match.physics.platforms[0];
    a.x = (platform.left + platform.right) / 2 - a.width / 2;
    a.y = platform.y - a.height - 60;
    a.isGrounded = false;
    a.ground = null;
    a.stateMachine.setState(S.FALLING);
    run(match, 30);
    assert.equal(a.ground, platform, 'landed on the platform');

    match.step([input({ press: ['down'] }), NEUTRAL_INPUT]);
    run(match, 40);
    assert.equal(a.ground, match.physics.main, 'dropped through to the stage');

    match.step([input({ press: ['jump'] }), NEUTRAL_INPUT]);
    run(match, 12);
    assert.ok(a.y + a.height < platform.y, 'jumped up through the platform');
});

test('walking off the edge falls into the pit, and the ledge catches you', () => {
    const { a, match } = setup();
    const main = match.physics.main;
    a.x = main.left + 10 - a.width / 2;
    run(match, 6, [input({ hold: ['left'] }), NEUTRAL_INPUT]);
    run(match, 40);
    assert.equal(a.stateMachine.currentState, S.LEDGE, 'caught the ledge');
    assert.ok(a.isIntangible(), 'briefly invincible on the ledge');
    run(match, 40, [input({ hold: ['right'] }), NEUTRAL_INPUT]);
    assert.equal(a.ground, main, 'climbed back up');
});

test('falling out of the stage costs health and respawns you', () => {
    const { a, match } = setup();
    a.x = 40;
    a.y = 600;
    a.isGrounded = false;
    a.ground = null;
    a.stateMachine.setState(S.FALLING);
    const events = run(match, 90);
    const ringOut = events.find((e) => e.type === 'ringOut');
    assert.ok(ringOut, 'rang out');
    assert.equal(a.health, a.maxHealth - Math.round(a.maxHealth * RING_OUT.healthFraction));
    assert.ok(events.some((e) => e.type === 'splash'), 'splashed into the pit first');
    assert.ok(a.invulnTimer > 0 || a.isGrounded, 'respawned safely');
});

test('Quackers floats on water; Riley sinks', () => {
    for (const [id, floats] of [['quackers', true], ['riley', false]]) {
        const { match, fighters } = createMatch(id, 'randy', { stage: 'duck-pond' });
        const f = fighters[0];
        f.x = 60;
        f.y = 420;
        f.isGrounded = false;
        f.ground = null;
        f.stateMachine.setState(S.FALLING);
        const events = run(match, 120);
        assert.equal(events.some((e) => e.type === 'ringOut' && e.fighter === f), !floats, `${id}`);
    }
});

test('stage physics: ice keeps fighters sliding longer than tar', () => {
    const slide = (friction) => {
        const physics = new Physics({ physics: { friction }, layout: { main: { left: -100000, right: 100000, y: 550 }, platforms: [] } });
        const { a } = setup();
        a.ground = physics.main;
        a.velocityX = 10;
        for (let i = 0; i < 120; i++) physics.update(a);
        return a.x;
    };
    assert.ok(slide(0.95) > slide(0.85));
    assert.ok(slide(0.85) > slide(0.72));
});

test('air attacks can be started while airborne', () => {
    const { a } = setup();
    a.isGrounded = false;
    a.stateMachine.setState(S.JUMPING);
    a.handleAttackInput(input({ press: ['attack'], hold: ['down'] }));
    assert.equal(a.attackKey, 'dair');
});

// ---------------------------------------------------------------------------- input buffer

test('an attack pressed a few frames before recovery ends comes out on the first free frame', () => {
    const { a, match } = setup('riley', 'riley', 400);
    run(match, 1, [input({ hold: ['right'], press: ['attack'] }), NEUTRAL_INPUT]); // forward tilt
    assert.equal(a.attackKey, 'ftilt');
    const total = a.currentAttack.getTotalFrames();
    run(match, total - 4); // still recovering
    run(match, 1, [input({ press: ['special'] }), NEUTRAL_INPUT]);
    assert.equal(a.attackKey, 'ftilt', 'still busy when the button was pressed');
    run(match, 6);
    assert.equal(a.attackKey, 'neutralSpecial', 'the buffered press came out');
});

test('a buffered press expires after the buffer window', () => {
    const { a, match } = setup('riley', 'riley', 400);
    run(match, 1, [input({ hold: ['right'], press: ['attack'] }), NEUTRAL_INPUT]);
    const total = a.currentAttack.getTotalFrames();
    run(match, 1, [input({ press: ['special'] }), NEUTRAL_INPUT]); // far too early
    run(match, total + 2);
    assert.equal(a.currentAttack, null, 'nothing came out');
});

test('presses buffered during hitstop continue a jab combo', () => {
    const { a, b, match } = setup('riley', 'riley', 90);
    const events = run(match, 8, (i) => (i === 0 ? [input({ press: ['attack'] }), NEUTRAL_INPUT] : [NEUTRAL_INPUT, NEUTRAL_INPUT]));
    assert.ok(events.some((e) => e.type === 'hit' && e.hit.attack.name === 'Paw Jab'), 'the first jab connected');
    // The fight scene freezes the match on a hit; presses made during the freeze go to the buffer.
    a.bufferPresses(input({ press: ['attack'] }));
    const later = run(match, 12);
    assert.ok(later.some((e) => e.type === 'hit' && e.hit.attack.name === 'Paw Jab 2'), 'the second jab came out and connected');
    assert.equal(b.comboHitCount, 2);
});

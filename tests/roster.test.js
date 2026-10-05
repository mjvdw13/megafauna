import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVE_SLOTS } from '../src/combat/moveset.js';
import { ROSTER } from '../src/fighters/roster.js';
import { STAT_DISPLAY } from '../src/ui/stat-bars.js';
import { Fighter } from '../src/fighters/fighter.js';

const REQUIRED_STATS = ['maxHealth', 'walkSpeed', 'jumpForce', 'airControl', 'weight', 'power', 'attackSpeed'];

test('character ids are unique', () => {
    const ids = ROSTER.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('every character defines the full stat block, body and model', () => {
    for (const def of ROSTER) {
        for (const stat of REQUIRED_STATS) assert.equal(typeof def.stats[stat], 'number', `${def.id}.stats.${stat}`);
        assert.ok(def.body.width > 0 && def.body.height > 0, `${def.id} body`);
        assert.equal(typeof def.model.apply, 'function', `${def.id} model apply`);
        assert.ok(def.model.bones.length > 0 && def.model.parts.length > 0, `${def.id} model skeleton and body`);
        assert.ok(def.name && def.species && def.tagline && def.description, `${def.id} display text`);
    }
});

test('every character has its own version of every move slot', () => {
    for (const def of ROSTER) {
        for (const slot of MOVE_SLOTS) assert.ok(def.moves[slot], `${def.id} doesn't define ${slot}`);
    }
    // No move name is shared between characters: each one has its own moveset.
    const owner = new Map();
    for (const def of ROSTER) {
        for (const move of Object.values(def.moves)) {
            assert.ok(!owner.has(move.name) || owner.get(move.name) === def.id, `"${move.name}" is used by ${owner.get(move.name)} and ${def.id}`);
            owner.set(move.name, def.id);
        }
    }
});

test('chained and counter moves point at moves that exist', () => {
    for (const def of ROSTER) {
        const attacks = new Fighter(def).attacks;
        for (const [key, attack] of Object.entries(attacks)) {
            if (attack.chain) assert.ok(attacks[attack.chain], `${def.id} ${key} chains into missing "${attack.chain}"`);
            if (attack.counter) assert.ok(attacks[attack.counter.into], `${def.id} ${key} counters into missing "${attack.counter.into}"`);
        }
    }
});

test('every character can recover: an up special that rises, and at least one air jump', () => {
    for (const def of ROSTER) {
        const up = new Fighter(def).attacks.upSpecial;
        assert.ok((up.movement?.start?.vy ?? 0) < -10, `${def.id} up special launches upward`);
        assert.ok(up.helpless, `${def.id} up special leaves them helpless`);
        assert.ok((def.stats.airJumps ?? 1) >= 1, `${def.id} air jumps`);
    }
});

test('no two characters share the same value for any displayed stat', () => {
    for (const { key } of STAT_DISPLAY) {
        const values = ROSTER.map((c) => c.stats[key]);
        assert.equal(new Set(values).size, values.length, `duplicate ${key}: ${values.join(', ')}`);
    }
});

test('Randy is the slowest and hardest-hitting character', () => {
    const randy = ROSTER.find((c) => c.id === 'randy');
    assert.ok(randy, 'Randy is on the roster');
    for (const other of ROSTER.filter((c) => c !== randy)) {
        assert.ok(randy.stats.walkSpeed < other.stats.walkSpeed, `slower than ${other.id}`);
        assert.ok(randy.stats.power > other.stats.power, `stronger than ${other.id}`);
    }
    // And that power carries through to actual attack damage.
    const randySmash = new Fighter(randy).attacks.fsmash.damage;
    for (const other of ROSTER.filter((c) => c !== randy)) {
        assert.ok(randySmash > new Fighter(other).attacks.fsmash.damage, `forward smash outdamages ${other.id}`);
    }
});

const REQUIRED_POSES = ['idle', 'walking', 'crouching', 'jumping', 'falling', 'blocking', 'hitstun', 'knockdown', 'getup', 'victory', 'defeat',
    'attack_windup', 'attack_strike', 'crouch_windup', 'crouch_attack', 'air_windup', 'air_attack'];

test('every model has all required poses, and every pose a move names exists', () => {
    for (const def of ROSTER) {
        const has = (name) => !!(def.model.poses?.[name] || def.model.cycles?.[name]);
        for (const name of REQUIRED_POSES) assert.ok(has(name), `${def.id} model missing "${name}"`);
        for (const attack of Object.values(new Fighter(def).attacks)) {
            for (const name of Object.values(attack.poses || {})) assert.ok(has(name), `${def.id} ${attack.name} uses missing pose "${name}"`);
        }
    }
});

test('model parts, feet and poses only name bones and parameters that exist', () => {
    for (const def of ROSTER) {
        const m = def.model;
        const bones = new Set(m.bones.map(([name]) => name));
        for (const [name, parent] of m.bones) assert.ok(!parent || bones.has(parent), `${def.id} bone ${name} has unknown parent ${parent}`);
        for (const part of m.parts) {
            for (const prim of part.prims) {
                assert.ok(bones.has(prim.bone), `${def.id} shape on unknown bone "${prim.bone}"`);
                assert.ok(m.colors[prim.col], `${def.id} shape uses unknown color "${prim.col}"`);
            }
        }
        for (const foot of m.feet) assert.ok(bones.has(foot.bone), `${def.id} foot on unknown bone "${foot.bone}"`);
        const params = new Set(Object.keys(m.basePose));
        const check = (pose, name) => { for (const key of Object.keys(pose)) assert.ok(params.has(key), `${def.id} pose "${name}" sets unknown parameter "${key}"`); };
        for (const [name, pose] of Object.entries(m.poses)) check(pose, name);
        for (const [name, cycle] of Object.entries(m.cycles)) for (const t of [0, 17, 50]) check(cycle(t), name);
    }
});

/** Stand-in bones: plain objects shaped like three.js Object3Ds, so apply() runs in Node. */
function fakeNode() {
    const v = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar(s) { this.x = this.y = this.z = s; } });
    return { position: v(), rotation: v(), scale: v() };
}

test('every pose drives the skeleton to finite angles', () => {
    for (const def of ROSTER) {
        const m = def.model;
        const bones = Object.fromEntries(m.bones.map(([name]) => [name, fakeNode()]));
        const extras = new Proxy({}, { get: (target, key) => (target[key] ??= fakeNode()) });
        const state = {};
        const names = [...Object.keys(m.poses), ...Object.keys(m.cycles)];
        for (const name of names) {
            const pose = { ...m.basePose, ...(m.cycles[name] ? m.cycles[name](23) : m.poses[name]) };
            for (let frame = 0; frame < 3; frame++) m.apply({ bones, extras, state }, pose, { time: 40 + frame, dt: 1 / 60, motion: [3, -2], grounded: true });
            for (const [bone, node] of Object.entries(bones)) {
                for (const axis of ['x', 'y', 'z']) assert.ok(Number.isFinite(node.rotation[axis]), `${def.id} pose "${name}" gives ${bone}.rotation.${axis} = ${node.rotation[axis]}`);
            }
        }
    }
});

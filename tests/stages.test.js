import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN, SPAWN_INSET } from '../src/config.js';
import { STAGES } from '../src/stages/index.js';
import { PIT_STYLES } from '../src/stages/pits.js';
import { Stage } from '../src/stages/stage.js';

test('stage ids are unique and every stage has display info and a 3-D world', () => {
    assert.equal(new Set(STAGES.map((s) => s.id)).size, STAGES.length);
    for (const def of STAGES) {
        assert.ok(def.name && def.description && def.accent, `${def.id} display info`);
        assert.ok(Array.isArray(def.traits), `${def.id} traits`);
        assert.equal(typeof def.world, 'function', `${def.id} world`);
    }
});

test('there are several stages, and some change the rules', () => {
    assert.ok(STAGES.length >= 6);
    const modified = STAGES.filter((s) => s.physics);
    assert.ok(modified.length >= 3);
    // Any stage that changes physics should say so on the select screen.
    for (const s of modified) assert.ok(s.traits.length > 0, `${s.id} explains its twist`);
});

test('every stage has a main platform with pits on both sides, and platforms on screen', () => {
    for (const def of STAGES) {
        const { layout, ledges, pit } = new Stage(def);
        const { main, platforms } = layout;
        assert.ok(PIT_STYLES[def.pit], `${def.id} pit style "${def.pit}"`);
        assert.ok(pit.colors.length === 2, `${def.id} pit colors`);
        assert.ok(main.left > 100 && main.right < SCREEN.width - 100, `${def.id} leaves room for pits`);
        assert.ok(main.right - main.left >= 700, `${def.id} main platform is wide enough to fight on`);
        assert.equal(ledges.length, 2);
        for (const p of platforms) {
            assert.ok(p.left >= main.left && p.right <= main.right, `${def.id} platform over the stage`);
            assert.ok(p.y < main.y - 80 && p.y > 200, `${def.id} platform height ${p.y}`);
        }
    }
});

test('spawn points sit on the main platform with room between fighters', () => {
    for (const def of STAGES) {
        const stage = new Stage(def);
        const { p1, p2 } = stage.spawnPoints();
        assert.equal(p1, stage.layout.main.left + SPAWN_INSET);
        assert.ok(p2 - p1 > 400, `${def.id} spawn gap`);
    }
});

test('every world builds the arena and runs without the 3-D engine', () => {
    for (const def of STAGES) {
        const calls = [];
        const kit = new Proxy({ x: (px) => px / 100, y: (py) => py / 100, main: { left: -4, right: 4, width: 8 }, pitY: -0.4, random: (a, b) => (a + b) / 2 }, {
            get: (target, key) => target[key] ?? ((...args) => { calls.push(key); return { node: {}, pos: args[2] ?? [0, 0, 0] }; })
        });
        def.world(kit);
        assert.ok(calls.includes('ground'), `${def.id} world builds its main platform`);
        assert.ok(calls.includes('sky') && calls.includes('light'), `${def.id} world sets a sky and a light`);
    }
});

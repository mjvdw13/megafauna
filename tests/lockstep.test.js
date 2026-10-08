import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayerInput, finishInput, PLAYER_ACTIONS } from '../src/core/input.js';
import { decodeInput, encodeInput, hashFighters, Lockstep } from '../src/net/lockstep.js';
import { createMatch } from './helpers/simulate.js';

/** Seeded random numbers (mulberry32), so failures repeat. */
function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Button mashing: each action held some of the time, pressed on the frame it goes down. */
function masher(rng) {
    const held = {};
    return () => {
        const input = createPlayerInput();
        for (const action of PLAYER_ACTIONS) {
            const down = held[action] ? rng() < 0.8 : rng() < 0.08;
            input[action] = down;
            input[`${action}Pressed`] = down && !held[action];
            held[action] = down;
        }
        input.dash = rng() < 0.03 ? (rng() < 0.5 ? -1 : 1) : 0;
        input.confirmPressed = input.attackPressed;
        input.cancelPressed = input.smashPressed;
        return finishInput(input);
    };
}

test('inputs survive encoding', () => {
    const next = masher(seeded(1));
    for (let i = 0; i < 500; i++) {
        const input = next();
        assert.deepEqual(decodeInput(encodeInput(input)), input);
    }
});

/**
 * Two computers, each with its own copy of the fight, joined by a network that delivers
 * each message after a random number of ticks (in order, like a WebRTC data channel).
 * Each tick, each side runs a frame if it has the other side's input for it.
 */
function playOnline({ seed, frames, latency: [minLag, maxLag], delay }) {
    const rng = seeded(seed);
    const sides = [0, 1].map((localIndex) => ({ localIndex, outbox: [], ...createMatch('riley', 'gary', { stage: 'volcano' }), next: masher(seeded(seed * 10 + localIndex)), hashes: [] }));
    let tick = 0;
    for (const side of sides) {
        side.lockstep = new Lockstep({ localIndex: side.localIndex, delay, send: (msg) => {
            const last = side.outbox.at(-1)?.at ?? 0;
            side.outbox.push({ at: Math.max(last, tick + minLag + Math.floor(rng() * (maxLag - minLag + 1))), msg });
        } });
    }
    let stalls = 0;
    for (; tick < frames * 4 && sides.some((s) => s.lockstep.frame < frames); tick++) {
        for (const [i, side] of sides.entries()) {
            const other = sides[1 - i];
            while (side.outbox.length && side.outbox[0].at <= tick) other.lockstep.receive(side.outbox.shift().msg);
        }
        for (const side of sides) {
            if (side.lockstep.frame >= frames) continue;
            if (!side.lockstep.ready()) { stalls++; continue; }
            const frame = side.lockstep.frame;
            side.match.step(side.lockstep.advance(side.next()));
            const hash = hashFighters(side.fighters);
            side.hashes.push(hash);
            side.lockstep.check(frame, hash);
        }
    }
    return { sides, stalls };
}

test('two computers stay in step over a laggy network', () => {
    const { sides, stalls } = playOnline({ seed: 7, frames: 1500, latency: [1, 8], delay: 3 });
    assert.equal(sides[0].lockstep.frame, 1500);
    assert.equal(sides[1].lockstep.frame, 1500);
    assert.deepEqual(sides[0].hashes, sides[1].hashes, 'both fights identical, frame by frame');
    assert.ok(sides.every((s) => s.lockstep.desyncFrame < 0));
    assert.ok(stalls > 0, 'a link slower than the input delay stalls sometimes');
    // The fight actually happened: someone got hit.
    assert.ok(sides[0].fighters.some((f) => f.health < f.maxHealth));
});

test('a link faster than the input delay never stalls', () => {
    const { sides, stalls } = playOnline({ seed: 3, frames: 600, latency: [1, 2], delay: 3 });
    assert.equal(stalls, 0);
    assert.deepEqual(sides[0].hashes, sides[1].hashes);
});

test('a drifted copy is reported as a desync', () => {
    const outbox = [[], []];
    const sides = [0, 1].map((i) => new Lockstep({ localIndex: i, delay: 2, send: (m) => outbox[i].push(m) }));
    const flush = () => { for (const i of [0, 1]) for (const m of outbox[i].splice(0)) sides[1 - i].receive(m); };
    for (let frame = 0; frame <= 60; frame++) {
        for (const [i, side] of sides.entries()) {
            assert.ok(side.ready());
            side.advance(createPlayerInput());
            side.check(frame, frame === 60 && i === 1 ? 999 : frame);
        }
        flush();
    }
    assert.equal(sides[0].desyncFrame, 60);
    assert.equal(sides[1].desyncFrame, 60);
});

test('messages from an earlier fight are ignored', () => {
    const lockstep = new Lockstep({ localIndex: 0, delay: 1, match: 2, send: () => {} });
    lockstep.advance(createPlayerInput());
    lockstep.receive({ t: 'in', m: 1, f: 1, b: 0 });
    assert.ok(!lockstep.ready());
    lockstep.receive({ t: 'in', m: 2, f: 1, b: 0 });
    assert.ok(lockstep.ready());
});

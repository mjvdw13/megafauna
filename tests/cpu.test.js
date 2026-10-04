import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CPU_LEVEL_IDS, CpuController } from '../src/ai/cpu-controller.js';
import { CharacterStates as S } from '../src/combat/states.js';
import { createPlayerInput, finishInput } from '../src/core/input.js';
import { seededRandom } from '../src/core/math.js';
import { ROSTER } from '../src/fighters/roster.js';
import { simulateRound } from './helpers/simulate.js';

const ids = ROSTER.map((c) => c.id);

/** A controller factory for simulateRound: CPU at `level` with a seeded random source. */
const cpu = (level, seed) => (fighters, i) => {
    const controller = new CpuController(fighters[i], level, seededRandom(seed));
    return (self, opp, stage) => controller.getInput(opp, stage);
};

/** A scripted player that stands still, then throws one forward tilt on `onFrame`. */
const oneTilt = (onFrame) => {
    let frame = 0;
    return () => {
        frame++;
        const input = createPlayerInput();
        if (frame === onFrame) { input.attack = true; input.attackPressed = true; input.right = true; }
        return finishInput(input);
    };
};

test('every character, at every level, can KO a dummy that does nothing', () => {
    for (const level of CPU_LEVEL_IDS) {
        for (const id of ids) {
            const result = simulateRound(id, 'riley', (f) => [cpu(level, 11)(f, 0), null]);
            assert.equal(result.winner, 0, `${level} ${id} wins`);
            assert.equal(result.health[1], 0, `${level} ${id} gets the KO before time runs out`);
            assert.equal(result.stats[0].ringOuts, 0, `${level} ${id} never falls off by itself`);
        }
    }
});

test('the CPU attacks from both sides of the screen', () => {
    for (const id of ids) {
        const result = simulateRound('riley', id, (f) => [null, cpu('normal', 5)(f, 1)]);
        assert.equal(result.winner, 1, `${id} as player 2 wins`);
    }
});

test('the CPU gets back to the stage after being knocked off', () => {
    for (const id of ids) {
        for (const level of ['normal', 'hard']) {
            for (const [dx, dy] of [[-150, -60], [-110, 70], [150, 40]]) {
                const result = simulateRound('riley', id, (f) => [null, cpu(level, 3)(f, 1)], {
                    frames: 300,
                    setup: ([, f], match) => {
                        const main = match.physics.main;
                        f.x = (dx < 0 ? main.left : main.right) + dx - f.width / 2;
                        f.y = main.y + dy - f.height;
                        f.isGrounded = false;
                        f.ground = null;
                        f.stateMachine.setState(S.FALLING);
                    }
                });
                assert.equal(result.stats[1].ringOuts, 0, `${level} ${id} recovers from (${dx}, ${dy})`);
            }
        }
    }
});

test('harder CPUs beat easier ones', () => {
    const record = (a, b) => {
        let wins = 0, games = 0;
        for (const p1 of ids) for (const p2 of ids) for (let seed = 1; seed <= 2; seed++) {
            const r = simulateRound(p1, p2, (f) => [cpu(a, seed * 31)(f, 0), cpu(b, seed * 77)(f, 1)]);
            if (r.winner === 0) wins++;
            games++;
        }
        return wins / games;
    };
    assert.ok(record('hard', 'easy') > 0.75, 'hard beats easy');
    assert.ok(record('normal', 'easy') > 0.6, 'normal beats easy');
    assert.ok(record('hard', 'normal') > 0.6, 'hard beats normal');
});

test('harder CPUs defend (shield or dodge) more attacks on reaction', () => {
    const defenseRate = (level) => {
        let defended = 0, trials = 0;
        for (const id of ids) {
            for (let seed = 1; seed <= 30; seed++) {
                // Close enough that Riley's Headbutt connects; the CPU is still sizing things up when it comes.
                const result = simulateRound('riley', id, (f) => [oneTilt(16), cpu(level, seed)(f, 1)], {
                    frames: 50,
                    setup: ([a, b], match) => {
                        const y = match.physics.main.y;
                        a.reset(560, y, true);
                        b.reset(560 + 50 + b.width / 2, y, false);
                        for (const f of [a, b]) f.ground = match.physics.main;
                    }
                });
                if (result.stats[0].hits === 0) defended++;
                trials++;
            }
        }
        return defended / trials;
    };
    const easy = defenseRate('easy'), normal = defenseRate('normal'), hard = defenseRate('hard');
    assert.ok(easy < normal && normal < hard, `defense rate rises with level (${easy.toFixed(2)}, ${normal.toFixed(2)}, ${hard.toFixed(2)})`);
    assert.ok(hard > 0.6, `hard defends most attacks (${hard.toFixed(2)})`);
    assert.ok(easy < 0.3, `easy rarely defends (${easy.toFixed(2)})`);
});

test('CPU input looks exactly like keyboard input', () => {
    simulateRound('quackers', 'randy', (fighters) => {
        const controller = new CpuController(fighters[0], 'hard', seededRandom(3));
        return [(self, opp, stage) => {
            const input = controller.getInput(opp, stage);
            assert.equal(input.horizontal, (input.right ? 1 : 0) - (input.left ? 1 : 0));
            assert.equal(input.vertical, (input.down ? 1 : 0) - (input.up ? 1 : 0));
            for (const action of ['up', 'jump', 'attack', 'smash', 'special', 'shield']) {
                if (input[`${action}Pressed`]) assert.ok(input[action], `${action}Pressed implies ${action} held`);
            }
            return input;
        }, cpu('normal', 4)(fighters, 1)];
    }, { frames: 1500 });
});

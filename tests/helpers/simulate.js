// Headless match simulation shared by tests: the real Match (combat/match.js), no rendering.
import { HitResult } from '../../src/combat/combat-system.js';
import { Match } from '../../src/combat/match.js';
import { NEUTRAL_INPUT } from '../../src/core/input.js';
import { Fighter } from '../../src/fighters/fighter.js';
import { getCharacter } from '../../src/fighters/roster.js';
import { getStage } from '../../src/stages/index.js';
import { Stage } from '../../src/stages/stage.js';

/** Set up a match on a stage (default: Sunny Meadow). Fighters start at the stage's spawn points. */
export function createMatch(p1Id, p2Id, { stage = 'meadow' } = {}) {
    const fighters = [
        new Fighter(getCharacter(p1Id), { playerNumber: 1 }),
        new Fighter(getCharacter(p2Id), { playerNumber: 2 })
    ];
    const match = new Match(new Stage(getStage(stage)), fighters);
    match.resetPositions();
    return { match, fighters, stage: match.stage };
}

/**
 * Run one round. `makeControllers(fighters, stage)` returns one function per fighter,
 * (self, opponent, stage) => input, or null for an idle dummy.
 * @param options.setup  (fighters, match) => void, to place fighters before the round starts
 * @returns per-fighter stats and the winner index (0, 1, or -1 for a timeout draw)
 */
export function simulateRound(p1Id, p2Id, makeControllers, { frames = 99 * 60, stage = 'meadow', setup = null } = {}) {
    const { match, fighters, stage: stageRuntime } = createMatch(p1Id, p2Id, { stage });
    setup?.(fighters, match);
    const controllers = makeControllers(fighters, stageRuntime);
    const stats = fighters.map(() => ({ hits: 0, blocked: 0, armored: 0, damage: 0, attacks: 0, maxCombo: 0, grabs: 0, ringOuts: 0 }));

    let frame = 0;
    for (; frame < frames; frame++) {
        // Read every input before anyone moves, as the fight scene does, so neither side sees the future.
        const inputs = fighters.map((f, i) => (controllers[i] ? controllers[i](f, fighters[1 - i], stageRuntime) : NEUTRAL_INPUT));
        for (const event of match.step(inputs)) {
            if (event.type === 'ringOut') stats[fighters.indexOf(event.fighter)].ringOuts++;
            if (event.type === 'fighter' && event.event.type === 'attackStart') stats[fighters.indexOf(event.fighter)].attacks++;
            if (event.type !== 'hit') continue;
            const hit = event.hit;
            const i = fighters.indexOf(hit.attacker);
            if (i < 0) continue;
            const s = stats[i];
            if (hit.result === HitResult.HIT) { s.hits++; s.maxCombo = Math.max(s.maxCombo, hit.comboHit || 1); }
            else if (hit.result === HitResult.BLOCK) stats[1 - i].blocked++;
            else if (hit.result === HitResult.GRAB) s.grabs++;
            else if (hit.result === HitResult.ARMOR) s.armored++;
            s.damage += hit.damage;
        }
        if (fighters.some((f) => f.isDead())) break;
    }
    const [a, b] = fighters;
    const winner = a.health === b.health ? -1 : a.health > b.health ? 0 : 1;
    return { winner, frames: frame, stats, health: fighters.map((f) => f.health), fighters, match };
}

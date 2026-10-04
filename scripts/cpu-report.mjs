// CPU tuning report: how fast each level beats a dummy, and how levels fare against each other.
// Usage: node scripts/cpu-report.mjs [stage]
import { CpuController } from '../src/ai/cpu-controller.js';
import { seededRandom } from '../src/core/math.js';
import { ROSTER } from '../src/fighters/roster.js';
import { simulateRound } from '../tests/helpers/simulate.js';

const stage = process.argv[2] || 'meadow';
const cpu = (level, seed) => (fighters, i) => {
    const c = new CpuController(fighters[i], level, seededRandom(seed));
    return (self, opp, stageRuntime) => c.getInput(opp, stageRuntime);
};
const ids = ROSTER.map((c) => c.id);
const levels = ['easy', 'normal', 'hard'];

console.log(`--- CPU vs idle dummy on ${stage} (seconds to KO, ring-outs it suffered) ---`);
for (const lvl of levels) for (const id of ids) {
    const r = simulateRound(id, 'riley', (f) => [cpu(lvl, 7)(f, 0), null], { stage });
    console.log(lvl.padEnd(7), id.padEnd(9), 'sec', (r.frames / 60).toFixed(1).padStart(5), 'winner', r.winner, 'hits', r.stats[0].hits, 'attacks', r.stats[0].attacks, 'selfRingOuts', r.stats[0].ringOuts, 'dummyRingOuts', r.stats[1].ringOuts);
}

console.log('--- level vs level, all pairings, 4 seeds ---');
for (const a of levels) for (const b of levels) {
    let wins = 0, losses = 0, draws = 0, frames = 0, blocks = [0, 0], hits = [0, 0], grabs = [0, 0], ringOuts = [0, 0], combo = 0, n = 0;
    for (const p1 of ids) for (const p2 of ids) for (let seed = 1; seed <= 4; seed++) {
        const r = simulateRound(p1, p2, (f) => [cpu(a, seed * 31)(f, 0), cpu(b, seed * 77)(f, 1)], { stage });
        if (r.winner === 0) wins++; else if (r.winner === 1) losses++; else draws++;
        frames += r.frames; n++;
        for (const i of [0, 1]) {
            blocks[i] += r.stats[i].blocked; hits[i] += r.stats[i].hits; grabs[i] += r.stats[i].grabs; ringOuts[i] += r.stats[i].ringOuts;
        }
        combo = Math.max(combo, r.stats[0].maxCombo, r.stats[1].maxCombo);
    }
    const avg = (pair) => pair.map((h) => (h / n).toFixed(1)).join(',');
    console.log(`${a.padEnd(7)} vs ${b.padEnd(7)} W${wins} L${losses} D${draws} avgSec ${(frames / n / 60).toFixed(1)} hits ${avg(hits)} shields ${avg(blocks)} grabs ${avg(grabs)} ringOuts ${avg(ringOuts)} maxCombo ${combo}`);
}

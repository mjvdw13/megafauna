// ============================================================================
// SOUND EFFECTS
// Named recipes, each (voices, opts) => schedules a few synth voices.
// To add a sound, add an entry here and play it with audio.play('<name>').
// A move picks its own sound with an `sfx` field (see combat/attack.js).
// ============================================================================

const semitones = (n) => Math.pow(2, n / 12);

export const SFX = {
    // ------------------------------------------------------------- impacts

    /** opts: { damage, heavy, combo } */
    hit: (v, { damage = 6, heavy = false, combo = 1 } = {}) => {
        const weight = Math.min(1, damage / 20);
        // Body thump
        v.tone({ freq: heavy ? 150 : 190, to: heavy ? 42 : 60, dur: heavy ? 0.28 : 0.15, gain: 0.7 + weight * 0.3 });
        // Smack
        v.noise({ dur: heavy ? 0.16 : 0.08, gain: 0.55, filter: { type: 'bandpass', freq: heavy ? 1400 : 2200, to: 500, Q: 0.9 } });
        // Crack on top, brighter for light hits
        v.tone({ type: 'square', freq: heavy ? 520 : 900, to: 140, dur: 0.05, gain: 0.12 });
        if (heavy) v.noise({ dur: 0.35, gain: 0.25, delay: 0.02, filter: { type: 'lowpass', freq: 700, to: 120 } });
        // Combo chime climbs a step with every extra hit
        if (combo >= 2) {
            const step = Math.min(combo - 2, 10);
            v.tone({ type: 'triangle', freq: 660 * semitones(step * 2), dur: 0.18, gain: 0.14, delay: 0.03 });
        }
    },

    block: (v) => {
        v.tone({ type: 'triangle', freq: 1250, to: 900, dur: 0.09, gain: 0.25 });
        v.tone({ type: 'square', freq: 1870, dur: 0.05, gain: 0.06 });
        v.noise({ dur: 0.05, gain: 0.3, filter: { type: 'highpass', freq: 2500 } });
        v.tone({ freq: 220, to: 120, dur: 0.08, gain: 0.3 });
    },

    armor: (v) => {
        // Low metallic clang: the hit bounces off
        for (const [freq, gain] of [[196, 0.3], [293, 0.22], [415, 0.14]]) {
            v.tone({ type: 'triangle', freq, to: freq * 0.97, dur: 0.5, gain });
        }
        v.noise({ dur: 0.12, gain: 0.35, filter: { type: 'bandpass', freq: 1800, Q: 2 } });
    },

    knockdown: (v) => {
        v.tone({ freq: 110, to: 38, dur: 0.35, gain: 0.8, delay: 0.05 });
        v.noise({ dur: 0.3, gain: 0.35, delay: 0.05, filter: { type: 'lowpass', freq: 600, to: 150 } });
    },

    ko: (v) => {
        v.tone({ freq: 95, to: 28, dur: 1.4, gain: 1 });
        v.noise({ dur: 1.1, gain: 0.55, filter: { type: 'lowpass', freq: 1400, to: 90 } });
        v.noise({ dur: 1.6, gain: 0.18, attack: 0.01, filter: { type: 'highpass', freq: 5000 } });
        v.tone({ type: 'sawtooth', freq: 70, to: 35, dur: 0.9, gain: 0.18, filter: { type: 'lowpass', freq: 400 } });
    },

    // ------------------------------------------------------------- swings

    whoosh: (v, { strength = 'light' } = {}) => {
        const big = strength !== 'light';
        v.noise({ dur: big ? 0.2 : 0.12, gain: big ? 0.3 : 0.2, attack: 0.03, filter: { type: 'bandpass', freq: big ? 350 : 700, to: big ? 1800 : 2600, Q: 2.5 } });
        if (strength === 'special') v.tone({ type: 'triangle', freq: 300, to: 700, dur: 0.18, gain: 0.08, attack: 0.04 });
    },

    uppercut: (v) => {
        v.noise({ dur: 0.25, gain: 0.35, attack: 0.03, filter: { type: 'bandpass', freq: 300, to: 3200, Q: 3 } });
        v.tone({ type: 'triangle', freq: 220, to: 880, dur: 0.22, gain: 0.1 });
    },

    whirlwind: (v) => {
        v.noise({ dur: 0.4, gain: 0.35, attack: 0.05, filter: { type: 'bandpass', points: [[0, 400], [0.15, 2000], [0.4, 500]], Q: 3 } });
        v.noise({ dur: 0.3, gain: 0.2, attack: 0.05, delay: 0.08, filter: { type: 'bandpass', points: [[0, 600], [0.12, 2600], [0.3, 700]], Q: 3 } });
    },

    feathers: (v) => {
        for (let i = 0; i < 6; i++) {
            v.noise({ dur: 0.05, gain: 0.22, delay: i * 0.035, filter: { type: 'bandpass', freq: 2500 + (i % 2) * 900, Q: 1.5 } });
        }
    },

    charge: (v) => {
        // Stampede: a run of heavy hoofbeats under a rising rumble
        v.noise({ dur: 0.5, gain: 0.4, attack: 0.08, filter: { type: 'lowpass', freq: 250, to: 600 } });
        for (let i = 0; i < 4; i++) v.tone({ freq: 90, to: 45, dur: 0.1, gain: 0.55, delay: i * 0.08 });
    },

    quake: (v) => {
        v.tone({ freq: 62, to: 26, dur: 0.8, gain: 1 });
        v.noise({ dur: 0.8, gain: 0.5, filter: { type: 'lowpass', freq: 260, to: 60 } });
        // Rocks clattering after the boom
        for (let i = 0; i < 5; i++) {
            v.noise({ dur: 0.04, gain: 0.18, delay: 0.12 + i * 0.07 + Math.random() * 0.03, filter: { type: 'bandpass', freq: 900 + Math.random() * 900, Q: 4 } });
        }
    },

    soundwave: (v) => {
        v.tone({ type: 'sawtooth', freq: 300, to: 180, dur: 0.3, gain: 0.2, vibrato: { rate: 30, depth: 40 }, filter: { type: 'lowpass', freq: 1500 } });
    },

    // ------------------------------------------------------------- creature voices

    bark: (v) => {
        // "Rwoof!": a pitch scoop through a mouth-like formant, with breath noise
        const points = [[0, 260], [0.035, 480], [0.16, 210]];
        v.tone({ type: 'sawtooth', points, dur: 0.17, gain: 0.5, filter: { type: 'bandpass', freq: 950, Q: 2.2 } });
        v.tone({ type: 'sawtooth', points, dur: 0.15, gain: 0.25, filter: { type: 'bandpass', freq: 2100, Q: 4 } });
        v.noise({ dur: 0.1, gain: 0.3, filter: { type: 'bandpass', freq: 1400, Q: 1 } });
    },

    quack: (v) => {
        // Nasal "qua-ACK": buzzy, squeezed through narrow formants
        const points = [[0, 480], [0.05, 560], [0.22, 380]];
        v.tone({ type: 'sawtooth', points, dur: 0.24, gain: 0.45, filter: { type: 'bandpass', freq: 1300, Q: 7 }, vibrato: { rate: 38, depth: 18 } });
        v.tone({ type: 'square', points, dur: 0.22, gain: 0.12, filter: { type: 'bandpass', freq: 2600, Q: 5 } });
    },

    chomp: (v) => {
        v.tone({ type: 'square', freq: 320, to: 120, dur: 0.06, gain: 0.18, filter: { type: 'lowpass', freq: 1800 } });
        v.noise({ dur: 0.05, gain: 0.35, filter: { type: 'bandpass', freq: 2400, Q: 2 } });
        v.noise({ dur: 0.04, gain: 0.3, delay: 0.07, filter: { type: 'bandpass', freq: 1800, Q: 2 } });
    },

    dig: (v) => {
        for (let i = 0; i < 4; i++) v.noise({ dur: 0.08, gain: 0.3, delay: i * 0.06, filter: { type: 'lowpass', freq: 700 - i * 80 } });
        v.tone({ freq: 90, to: 50, dur: 0.3, gain: 0.4 });
    },

    boulder: (v) => {
        v.tone({ freq: 70, to: 45, dur: 0.35, gain: 0.7 });
        v.noise({ dur: 0.5, gain: 0.3, attack: 0.05, filter: { type: 'lowpass', freq: 300 } });
    },

    splat: (v) => {
        v.noise({ dur: 0.12, gain: 0.45, filter: { type: 'lowpass', freq: 900, to: 300 } });
        v.tone({ freq: 220, to: 90, dur: 0.1, gain: 0.25 });
    },

    // ------------------------------------------------------------- defense

    dodge: (v) => {
        v.noise({ dur: 0.14, gain: 0.18, attack: 0.03, filter: { type: 'bandpass', freq: 1200, to: 3200, Q: 3 } });
    },

    grab: (v) => {
        v.tone({ type: 'triangle', freq: 500, to: 260, dur: 0.08, gain: 0.25 });
        v.noise({ dur: 0.05, gain: 0.3, filter: { type: 'bandpass', freq: 1500, Q: 2 } });
    },

    shatter: (v) => {
        // Glassy pop of a breaking shield
        for (let i = 0; i < 6; i++) {
            v.tone({ type: 'triangle', freq: 1400 + Math.random() * 1600, to: 600, dur: 0.25 + Math.random() * 0.2, gain: 0.08, delay: i * 0.02 });
        }
        v.noise({ dur: 0.4, gain: 0.35, filter: { type: 'highpass', freq: 3000 } });
        v.tone({ freq: 160, to: 60, dur: 0.3, gain: 0.5 });
    },

    reflect: (v) => {
        v.tone({ type: 'square', freq: 880, to: 1760, dur: 0.12, gain: 0.12, filter: { type: 'lowpass', freq: 4000 } });
        v.tone({ type: 'triangle', freq: 1320, dur: 0.2, gain: 0.1, delay: 0.05 });
    },

    charge: (v, { level = 0 } = {}) => {
        v.tone({ type: 'triangle', freq: 500 + level * 700, to: 700 + level * 900, dur: 0.15, gain: 0.07 });
    },

    ledge: (v) => {
        v.tone({ freq: 180, to: 110, dur: 0.08, gain: 0.35 });
        v.noise({ dur: 0.04, gain: 0.2, filter: { type: 'bandpass', freq: 1200, Q: 2 } });
    },

    // ------------------------------------------------------------- pits

    splash: (v) => {
        v.noise({ dur: 0.5, gain: 0.5, attack: 0.01, filter: { type: 'lowpass', freq: 2400, to: 400 } });
        v.tone({ freq: 300, to: 900, dur: 0.12, gain: 0.12 });
        for (let i = 0; i < 4; i++) v.tone({ type: 'sine', freq: 600 + Math.random() * 600, to: 1200, dur: 0.06, gain: 0.08, delay: 0.15 + i * 0.07 });
    },

    sizzle: (v) => {
        v.noise({ dur: 0.9, gain: 0.35, attack: 0.02, filter: { type: 'highpass', freq: 3500 } });
        v.tone({ freq: 120, to: 50, dur: 0.4, gain: 0.5 });
    },

    gloop: (v) => {
        v.tone({ freq: 140, to: 60, dur: 0.35, gain: 0.6 });
        v.tone({ freq: 90, to: 220, dur: 0.12, gain: 0.25, delay: 0.25 });
        v.noise({ dur: 0.3, gain: 0.2, filter: { type: 'lowpass', freq: 400 } });
    },

    fall: (v) => {
        v.tone({ type: 'triangle', freq: 1400, to: 300, dur: 0.7, gain: 0.12 });
    },

    ringout: (v) => {
        v.tone({ freq: 90, to: 35, dur: 0.6, gain: 0.8 });
        v.noise({ dur: 0.5, gain: 0.35, filter: { type: 'lowpass', freq: 900, to: 120 } });
        [0, 4, 7].forEach((n, i) => v.tone({ type: 'square', freq: 660 * semitones(-n), dur: 0.1, gain: 0.07, delay: 0.1 + i * 0.08, filter: { type: 'lowpass', freq: 2500 } }));
    },

    breath: (v) => {
        // A long, gross "HAAAAAH": breathy noise through a mouth-shaped filter over a low groan
        v.noise({ dur: 0.9, gain: 0.45, attack: 0.08, filter: { type: 'bandpass', points: [[0, 700], [0.3, 1100], [0.9, 450]], Q: 1.6 } });
        v.noise({ dur: 0.8, gain: 0.2, attack: 0.1, filter: { type: 'lowpass', freq: 500 } });
        v.tone({ type: 'sawtooth', points: [[0, 110], [0.3, 125], [0.85, 85]], dur: 0.85, gain: 0.12, attack: 0.08, filter: { type: 'lowpass', freq: 600 } });
        // ...and a fly buzzing off
        v.tone({ type: 'sawtooth', freq: 220, dur: 0.4, gain: 0.04, delay: 0.5, vibrato: { rate: 40, depth: 30 }, filter: { type: 'bandpass', freq: 900, Q: 3 } });
    },

    chestpound: (v) => {
        // Hollow thumps on a big chest, alternating hands
        for (let i = 0; i < 6; i++) {
            v.tone({ freq: i % 2 ? 105 : 130, to: 60, dur: 0.16, gain: 0.8, delay: i * 0.09 });
            v.noise({ dur: 0.04, gain: 0.15, delay: i * 0.09, filter: { type: 'lowpass', freq: 900 } });
        }
    },

    secret: (v) => {
        // Unlock jingle: a rising run and a sparkly held chord
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => v.tone({ type: 'square', freq: 330 * semitones(n), dur: 0.12, gain: 0.09, delay: i * 0.07, filter: { type: 'lowpass', freq: 3500 } }));
        for (const n of [12, 16, 19, 24]) v.tone({ type: 'triangle', freq: 330 * semitones(n), dur: 1.4, gain: 0.08, attack: 0.02, delay: 0.5 });
        for (let i = 0; i < 8; i++) v.tone({ freq: 2000 + Math.random() * 2000, dur: 0.08, gain: 0.04, delay: 0.5 + i * 0.09 });
        v.tone({ freq: 90, to: 45, dur: 0.6, gain: 0.7, delay: 0.5 });
    },

    // ------------------------------------------------------------- movement

    jump: (v) => {
        v.noise({ dur: 0.1, gain: 0.12, attack: 0.02, filter: { type: 'bandpass', freq: 800, to: 2000, Q: 2 } });
        v.tone({ type: 'triangle', freq: 240, to: 420, dur: 0.08, gain: 0.06 });
    },

    flap: (v) => {
        for (let i = 0; i < 3; i++) v.noise({ dur: 0.05, gain: 0.18, delay: i * 0.05, filter: { type: 'bandpass', freq: 1300, Q: 1.4 } });
    },

    land: (v, { heavy = false } = {}) => {
        v.tone({ freq: heavy ? 80 : 120, to: heavy ? 30 : 50, dur: heavy ? 0.3 : 0.1, gain: heavy ? 0.9 : 0.35 });
        v.noise({ dur: heavy ? 0.2 : 0.07, gain: heavy ? 0.3 : 0.15, filter: { type: 'lowpass', freq: 800 } });
    },

    step: (v) => {
        v.tone({ freq: 70, to: 34, dur: 0.16, gain: 0.5 });
        v.noise({ dur: 0.07, gain: 0.12, filter: { type: 'lowpass', freq: 400 } });
    },

    // ------------------------------------------------------------- match flow

    drum: (v) => {
        // Taiko hit for "ROUND 1"
        v.tone({ freq: 130, to: 62, dur: 0.6, gain: 0.9 });
        v.noise({ dur: 0.08, gain: 0.3, filter: { type: 'lowpass', freq: 1200 } });
        v.tone({ freq: 130, to: 62, dur: 0.4, gain: 0.5, delay: 0.16 });
    },

    gong: (v) => {
        // "FIGHT!": taiko + crash
        v.tone({ freq: 110, to: 50, dur: 0.7, gain: 1 });
        v.noise({ dur: 1.4, gain: 0.3, attack: 0.005, filter: { type: 'highpass', freq: 3500 } });
        for (const [freq, gain] of [[180, 0.12], [267, 0.1], [403, 0.06]]) v.tone({ type: 'triangle', freq, to: freq * 0.98, dur: 1.2, gain });
    },

    tick: (v) => {
        v.tone({ type: 'square', freq: 1600, dur: 0.035, gain: 0.08, filter: { type: 'bandpass', freq: 1600, Q: 6 } });
    },

    fanfare: (v) => {
        // Victory: a quick major arpeggio and a held chord
        const notes = [0, 4, 7, 12];
        notes.forEach((n, i) => v.tone({ type: 'square', freq: 392 * semitones(n), dur: 0.14, gain: 0.12, delay: i * 0.09, filter: { type: 'lowpass', freq: 3000 } }));
        for (const n of [0, 4, 7, 12]) v.tone({ type: 'sawtooth', freq: 392 * semitones(n), dur: 1.2, gain: 0.07, attack: 0.02, delay: 0.38, filter: { type: 'lowpass', freq: 2200 } });
        v.noise({ dur: 1.0, gain: 0.15, delay: 0.38, filter: { type: 'highpass', freq: 5000 } });
    },

    // ------------------------------------------------------------- menus

    'menu-move': (v) => v.tone({ type: 'triangle', freq: 880, dur: 0.05, gain: 0.18 }),
    'menu-confirm': (v) => {
        v.tone({ type: 'square', freq: 660, dur: 0.07, gain: 0.1, filter: { type: 'lowpass', freq: 2500 } });
        v.tone({ type: 'square', freq: 990, dur: 0.12, gain: 0.1, delay: 0.06, filter: { type: 'lowpass', freq: 2500 } });
    },
    'menu-back': (v) => v.tone({ type: 'triangle', freq: 660, to: 330, dur: 0.12, gain: 0.18 }),
    ready: (v) => {
        [0, 4, 7].forEach((n, i) => v.tone({ type: 'square', freq: 523 * semitones(n), dur: 0.1, gain: 0.09, delay: i * 0.05, filter: { type: 'lowpass', freq: 3000 } }));
    }
};

/** Sounds played for an attack effect when the move does not name its own `sfx`. */
const VFX_SFX = { uppercut: 'uppercut', whirlwind: 'whirlwind', feathers: 'feathers', charge: 'charge', quake: 'quake', soundwave: 'soundwave' };

/** The sound for an attack's active frames: its own `sfx`, else one matching its vfx, else a whoosh. */
export function attackSound(attack) {
    return attack.sfx || VFX_SFX[attack.vfx] || 'whoosh';
}

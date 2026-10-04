// ============================================================================
// MUSIC
// A small step sequencer playing synthesized "prehistoric rock": taiko-ish toms,
// a punchy kick and snare, a plucked bass and a marimba arpeggio.
//
// Tracks are data. Each bar is 16 steps; patterns are 16-character strings.
//   Drums:     'x' hit, 'o' accent / open hat, '.' rest
//   Bass/arp:  chord tones relative to the bar's chord: '1' root, '3' third,
//              '5' fifth, '7' minor seventh, '8' octave, 'T'/'F' third/fifth an
//              octave up, '.' rest
// `chords` is one entry per bar: [semitones from root, 'm' | 'M'].
// `hype` layers join when the fight gets tense (setIntensity(1)).
// ============================================================================
import { Voices } from './voices.js';

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const FADE = 0.4;

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORD_TONES = {
    m: { 1: 0, 3: 3, 5: 7, 7: 10, 8: 12, T: 15, F: 19 },
    M: { 1: 0, 3: 4, 5: 7, 7: 10, 8: 12, T: 16, F: 19 }
};

export const TRACKS = {
    // Menus: relaxed, tribal, marimba-led
    title: {
        bpm: 96, root: 45, // A
        chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [0, 'm']],
        drums: {
            kick: 'x.......x..x....',
            tom: '......x.......xx',
            shaker: '..x...x...x...x.'
        },
        bass: '1.....1...5.....',
        arp: '1.5.8.5.T.8.5.3.'
    },
    // Meadow / backyard: bouncy and bright
    romp: {
        bpm: 132, root: 40, // E
        chords: [[0, 'm'], [0, 'm'], [3, 'M'], [5, 'M'], [0, 'm'], [0, 'm'], [-2, 'M'], [-2, 'M']],
        drums: {
            kick: 'x.....x.x.......',
            snare: '....x.......x...',
            hat: 'x.x.x.x.x.x.x.xo'
        },
        bass: '1.1.8.1.1.5.7.8.',
        arp: '1..5..8.........',
        hype: { arp: '1.5.8.5.T.8.5.8.', tom: '............x.xx' }
    },
    // Jungle and pond: rolling toms, shakers, call-and-response marimba
    jungle: {
        bpm: 118, root: 43, // G
        chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']],
        drums: {
            kick: 'x..x....x..x....',
            tom: '..x...xx..x...x.',
            shaker: 'xxxxxxxxxxxxxxxx',
            snare: '....x.......x...'
        },
        bass: '1..1..5.1..1..7.',
        arp: '8.5.....T.8.....',
        hype: { arp: '8.5.3.5.T.8.F.8.', hat: '..o...o...o...o.' }
    },
    // Tar pits, volcano, tundra: fast and heavy
    stampede: {
        bpm: 146, root: 38, // D
        chords: [[0, 'm'], [0, 'm'], [1, 'M'], [0, 'm'], [0, 'm'], [0, 'm'], [-2, 'M'], [-4, 'M']],
        drums: {
            kick: 'x.x...x.x.x...x.',
            snare: '....o.......o...',
            hat: 'x.x.x.x.x.x.x.x.'
        },
        bass: '1.1.1.1.1.1.8.7.',
        bassTone: 'saw',
        hype: { arp: '1...5...8...5...', tom: '..........x.xxxx', hat: 'xxxxxxxxxxxxxxxx' }
    }
};

/** Instrument voices, all scheduled at an absolute time. */
const INSTRUMENTS = {
    kick: (v, accent) => {
        v.tone({ freq: 160, to: 42, dur: 0.28, gain: accent ? 0.95 : 0.85 });
    },
    snare: (v, accent) => {
        v.noise({ dur: accent ? 0.22 : 0.15, gain: accent ? 0.42 : 0.32, filter: { type: 'bandpass', freq: 1900, Q: 0.8 } });
        v.tone({ type: 'triangle', freq: 200, to: 140, dur: 0.08, gain: 0.25 });
    },
    hat: (v, accent) => {
        v.noise({ dur: accent ? 0.18 : 0.04, gain: accent ? 0.1 : 0.08, filter: { type: 'highpass', freq: 7000 } });
    },
    shaker: (v, accent) => {
        v.noise({ dur: 0.06, gain: accent ? 0.08 : 0.05, attack: 0.02, filter: { type: 'bandpass', freq: 5200, Q: 1.2 } });
    },
    tom: (v, accent, step) => {
        // Alternate high and low toms so rolls move around
        const high = step % 2 === 0;
        v.tone({ freq: high ? 150 : 105, to: high ? 95 : 68, dur: 0.3, gain: accent ? 0.6 : 0.5 });
    },
    bass: (v, hz, stepDur, tone) => {
        const dur = stepDur * 1.8;
        if (tone === 'saw') {
            v.tone({ type: 'sawtooth', freq: hz, dur, gain: 0.32, filter: { type: 'lowpass', freq: 1400, to: 300, Q: 4 } });
        } else {
            v.tone({ type: 'triangle', freq: hz, dur, gain: 0.5 });
            v.tone({ type: 'sawtooth', freq: hz, dur: dur * 0.6, gain: 0.12, filter: { type: 'lowpass', freq: 900, to: 200, Q: 2 } });
        }
    },
    marimba: (v, hz) => {
        v.tone({ freq: hz, dur: 0.35, gain: 0.2, attack: 0.002 });
        v.tone({ freq: hz * 4, dur: 0.06, gain: 0.05, attack: 0.001 });
    }
};

export class MusicPlayer {
    constructor(engine) {
        this.engine = engine;
        this.wanted = null;    // track name requested (may be before audio unlocks)
        this.current = null;   // { name, track, bus, step, nextTime }
        this.intensity = 0;
        this.timer = null;
    }

    /** Start a track (no-op if it is already playing). null stops the music. */
    play(name) {
        if (name && !TRACKS[name]) name = 'romp';
        this.wanted = name;
        if (!this.engine.ready) return;
        if (this.current?.name === name) return;
        this.fadeOutCurrent();
        if (!name) return;
        const ctx = this.engine.ctx;
        const bus = ctx.createGain();
        bus.gain.setValueAtTime(0.0001, ctx.currentTime);
        bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.05);
        bus.connect(this.engine.musicBus);
        this.current = { name, track: TRACKS[name], bus, step: 0, nextTime: ctx.currentTime + 0.06 };
        this.intensity = 0;
        this.timer ??= setInterval(() => this.tick(), TICK_MS);
    }

    stop() { this.play(null); }

    /** 0 = normal, 1 = adds the track's `hype` layers. */
    setIntensity(level) { this.intensity = level; }

    /** Duck the music under a big moment (KO), or restore it. */
    duck(on) {
        if (!this.current) return;
        const g = this.current.bus.gain;
        g.setTargetAtTime(on ? 0.15 : 1, this.engine.now, 0.08);
    }

    onUnlock() {
        if (this.wanted && this.current?.name !== this.wanted) this.play(this.wanted);
    }

    fadeOutCurrent() {
        if (!this.current) return;
        const { bus } = this.current;
        const now = this.engine.now;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
        bus.gain.exponentialRampToValueAtTime(0.0001, now + FADE);
        setTimeout(() => bus.disconnect(), FADE * 1000 + 100);
        this.current = null;
    }

    tick() {
        const cur = this.current;
        if (!cur || !this.engine.ready) return;
        const now = this.engine.now;
        const stepDur = 60 / cur.track.bpm / 4;
        // After a long stall (background tab) skip ahead instead of playing a burst of notes.
        if (cur.nextTime < now - 0.2) cur.nextTime = now + 0.05;
        while (cur.nextTime < now + LOOKAHEAD) {
            this.scheduleStep(cur, cur.step, cur.nextTime, stepDur);
            cur.nextTime += stepDur;
            cur.step++;
        }
    }

    scheduleStep(cur, step, time, stepDur) {
        const { track } = cur;
        const i = step % 16;
        const bar = Math.floor(step / 16) % track.chords.length;
        const [chordRoot, quality] = track.chords[bar];
        const v = new Voices(this.engine, cur.bus, 0, time);
        const hype = this.intensity >= 1 ? track.hype || {} : {};

        for (const [name, pattern] of Object.entries(track.drums)) {
            const ch = (hype[name] || pattern)[i];
            if (ch && ch !== '.') INSTRUMENTS[name](v, ch === 'o', step);
        }
        for (const name of ['tom', 'hat', 'snare']) {
            if (hype[name] && !track.drums[name]) {
                const ch = hype[name][i];
                if (ch !== '.') INSTRUMENTS[name](v, ch === 'o', step);
            }
        }

        const note = (ch, octave) => midiToHz(track.root + chordRoot + octave * 12 + CHORD_TONES[quality][ch]);
        const b = track.bass[i];
        if (b !== '.') INSTRUMENTS.bass(v, note(b, 0), stepDur, track.bassTone);
        const arp = hype.arp || track.arp;
        const a = arp?.[i];
        if (a && a !== '.') INSTRUMENTS.marimba(v, note(a, 2));
    }
}

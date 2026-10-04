import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioEngine } from '../src/audio/audio-engine.js';
import { TRACKS } from '../src/audio/music.js';
import { attackSound, SFX } from '../src/audio/sfx.js';
import { buildMoveset } from '../src/combat/moveset.js';
import { ROSTER } from '../src/fighters/roster.js';
import { STAGES } from '../src/stages/index.js';

/** Stand-in for Voices that records what a recipe asked for. */
function recorder() {
    const calls = [];
    return { calls, tone: (o) => calls.push(['tone', o]), noise: (o) => calls.push(['noise', o]) };
}

test('without Web Audio the engine is silent and never throws', () => {
    const audio = new AudioEngine(null);
    audio.play('hit', { x: 100, damage: 10 });
    audio.announce('Round 1');
    audio.music.play('romp');
    audio.music.setIntensity(1);
    audio.music.duck(true);
    audio.music.stop();
    assert.equal(audio.ready, false);
});

test('every sound recipe schedules valid voices', () => {
    for (const [name, recipe] of Object.entries(SFX)) {
        const v = recorder();
        recipe(v, { x: 640, damage: 12, heavy: true, combo: 3, strength: 'special' });
        assert.ok(v.calls.length > 0, `${name} makes a sound`);
        for (const [kind, o] of v.calls) {
            assert.ok(o.dur > 0 && o.gain > 0 && o.gain <= 1, `${name} ${kind} has a sane envelope`);
            const freqs = [o.freq, o.to, ...(o.points || []).map((p) => p[1]), o.filter?.freq, o.filter?.to].filter((f) => f !== undefined);
            for (const f of freqs) assert.ok(f > 0 && f < 20000, `${name} ${kind} frequency ${f} is audible and positive`);
        }
    }
});

test('every move on the roster has a sound', () => {
    for (const def of ROSTER) {
        for (const [key, attack] of Object.entries(buildMoveset(def))) {
            assert.ok(SFX[attackSound(attack)], `${def.id} ${key} → ${attackSound(attack)}`);
        }
    }
});

test('music patterns are well formed and every stage names a real track', () => {
    const drumChars = /^[xo.]{16}$/;
    const noteChars = /^[1357+8TF.]{16}$/;
    for (const [name, track] of Object.entries(TRACKS)) {
        assert.ok(track.bpm > 0 && track.chords.length > 0, `${name} tempo and chords`);
        for (const [, quality] of track.chords) assert.ok(quality === 'm' || quality === 'M', `${name} chord quality`);
        const drums = { ...track.drums, ...Object.fromEntries(Object.entries(track.hype || {}).filter(([k]) => k !== 'arp')) };
        for (const [part, pattern] of Object.entries(drums)) assert.match(pattern, drumChars, `${name} ${part}`);
        for (const pattern of [track.bass, track.arp, track.hype?.arp].filter(Boolean)) assert.match(pattern, noteChars, `${name} notes`);
    }
    for (const stage of STAGES) assert.ok(!stage.music || TRACKS[stage.music], `${stage.id} music "${stage.music}"`);
});

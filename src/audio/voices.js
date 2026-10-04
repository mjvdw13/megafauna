// ============================================================================
// VOICES
// The synth toolkit sound recipes and music are written with: one-shot
// oscillator notes and filtered noise bursts, each with its own envelope.
// ============================================================================

/**
 * Building blocks for sound recipes. Times are seconds relative to "now" (+ delay).
 * Frequencies: `freq` start, optional `to` end (exponential glide), or `points` [[t, hz], ...].
 */
export class Voices {
    constructor(engine, bus, pan = 0, startTime = null) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.t0 = startTime ?? engine.now;
        this.out = bus;
        if (pan && this.ctx.createStereoPanner) {
            this.out = this.ctx.createStereoPanner();
            this.out.pan.value = Math.max(-1, Math.min(1, pan));
            this.out.connect(bus);
        }
    }

    envelope(start, { gain = 0.5, attack = 0.004, dur = 0.2 }) {
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(gain, start + attack);
        env.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.01, dur));
        return env;
    }

    glide(param, start, { freq, to, points, dur }) {
        if (points) {
            param.setValueAtTime(points[0][1], start);
            for (const [t, hz] of points.slice(1)) param.exponentialRampToValueAtTime(hz, start + t);
        } else {
            param.setValueAtTime(freq, start);
            if (to) param.exponentialRampToValueAtTime(to, start + dur);
        }
    }

    filtered(source, start, dur, filter) {
        if (!filter) return source;
        const f = this.ctx.createBiquadFilter();
        f.type = filter.type || 'lowpass';
        f.Q.value = filter.Q ?? 1;
        this.glide(f.frequency, start, { freq: filter.freq, to: filter.to, points: filter.points, dur });
        source.connect(f);
        return f;
    }

    /** An oscillator note. */
    tone({ type = 'sine', freq = 440, to, points, dur = 0.2, gain = 0.4, attack, delay = 0, filter, vibrato }) {
        const start = this.t0 + delay;
        const osc = this.ctx.createOscillator();
        osc.type = type;
        this.glide(osc.frequency, start, { freq, to, points, dur });
        if (vibrato) {
            const lfo = this.ctx.createOscillator();
            const depth = this.ctx.createGain();
            lfo.frequency.value = vibrato.rate;
            depth.gain.value = vibrato.depth;
            lfo.connect(depth).connect(osc.frequency);
            lfo.start(start);
            lfo.stop(start + dur + 0.05);
        }
        this.filtered(osc, start, dur, filter).connect(this.envelope(start, { gain, attack, dur })).connect(this.out);
        osc.start(start);
        osc.stop(start + dur + 0.05);
    }

    /** A burst of filtered white noise. */
    noise({ dur = 0.2, gain = 0.4, attack, delay = 0, filter }) {
        const start = this.t0 + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.engine.noiseBuffer;
        src.loop = true;
        // Random offset so repeated noise hits don't sound identical.
        const offset = Math.random() * 0.5;
        this.filtered(src, start, dur, filter).connect(this.envelope(start, { gain, attack, dur })).connect(this.out);
        src.start(start, offset);
        src.stop(start + dur + 0.05);
    }
}

// ============================================================================
// LOCKSTEP
// Keeps two copies of a fight, one on each computer, in step. The fight is
// deterministic: the same inputs give the same fight. So each side only sends
// its own button presses, one small number per frame, and a frame is run only
// once both players' inputs for it are in.
//
// Input delay: a press is scheduled DELAY frames ahead of the frame being run,
// which gives it time to cross the network before the other side needs it.
// With DELAY 3 (50 ms) a friend with up to ~50 ms one-way latency never stalls;
// slower links stall now and then while the other side's input arrives.
//
// Neither side can get more than DELAY frames ahead of the other, so the two
// can never both be waiting (no deadlock).
//
// Desync check: every CHECK_EVERY frames each side sends a hash of the fight
// state; a mismatch means the copies drifted apart (reported, not repaired).
// ============================================================================
import { createPlayerInput, finishInput, PLAYER_ACTIONS } from '../core/input.js';

export const DEFAULT_DELAY = 3;
const CHECK_EVERY = 60;

// ------------------------------------------------------------------ input codec

const FLAGS = [...PLAYER_ACTIONS, ...PLAYER_ACTIONS.map((a) => `${a}Pressed`), 'confirmPressed', 'cancelPressed'];
const DASH_SHIFT = FLAGS.length;

/** A player's input for one frame as a single integer (held/pressed flags + dash). */
export function encodeInput(input) {
    let bits = 0;
    FLAGS.forEach((flag, i) => { if (input[flag]) bits |= 1 << i; });
    return bits | ((input.dash + 1) << DASH_SHIFT); // dash -1/0/1 → 0/1/2
}

export function decodeInput(bits) {
    const input = createPlayerInput();
    FLAGS.forEach((flag, i) => { input[flag] = (bits & (1 << i)) !== 0; });
    input.dash = ((bits >> DASH_SHIFT) & 3) - 1;
    return finishInput(input);
}

const NEUTRAL_BITS = encodeInput(createPlayerInput());

// ------------------------------------------------------------------ state hash

/** A hash of the fight state that matters, for spotting desyncs. */
export function hashFighters(fighters, extra = []) {
    const parts = [...extra];
    for (const f of fighters) parts.push(f.x, f.y, f.velocityX, f.velocityY, f.health, f.shieldHP, f.stateMachine.currentState, f.facingRight);
    // FNV-1a over the text form: exact, so even the last bit of a float counts.
    let h = 0x811c9dc5;
    for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    return h >>> 0;
}

// ------------------------------------------------------------------ lockstep

export class Lockstep {
    /**
     * @param localIndex  0 if this computer plays P1, 1 if P2
     * @param send        (message) => void, delivers to the other side's receive()
     * @param match       which fight this is (messages from an earlier fight are ignored)
     */
    constructor({ localIndex, send, delay = DEFAULT_DELAY, match = 0 }) {
        if (delay < 1) throw new Error('Lockstep needs a delay of at least 1 frame');
        this.localIndex = localIndex;
        this.remoteIndex = 1 - localIndex;
        this.send = send;
        this.delay = delay;
        this.match = match;
        this.frame = 0;                     // next frame to run
        this.inputs = [new Map(), new Map()];
        for (let f = 0; f < delay; f++) for (const m of this.inputs) m.set(f, NEUTRAL_BITS);
        this.hashes = new Map();            // frame → our hash, waiting for theirs
        this.theirHashes = new Map();
        this.desyncFrame = -1;
        this.stalls = 0;                    // ticks spent waiting, in a row
    }

    /** True when the other side's input for the next frame has arrived. */
    ready() { return this.inputs[this.remoteIndex].has(this.frame); }

    /** Note a tick spent waiting. Returns how many in a row. */
    stall() { return ++this.stalls; }

    /**
     * Run one frame: schedule (and send) this tick's local input DELAY frames ahead,
     * then return [p1Input, p2Input] for the current frame. Only call when ready().
     */
    advance(localInput) {
        const ahead = this.frame + this.delay;
        const bits = encodeInput(localInput);
        this.inputs[this.localIndex].set(ahead, bits);
        this.send({ t: 'in', m: this.match, f: ahead, b: bits });
        const frame = this.frame++;
        const out = this.inputs.map((m) => decodeInput(m.get(frame)));
        for (const m of this.inputs) m.delete(frame);
        this.stalls = 0;
        return out;
    }

    /** Record the state hash after a frame; every CHECK_EVERY frames it is compared with the other side's. */
    check(frame, hash) {
        if (frame % CHECK_EVERY !== 0) return;
        this.hashes.set(frame, hash);
        this.send({ t: 'sum', m: this.match, f: frame, h: hash });
        this.compare(frame);
    }

    compare(frame) {
        if (!this.hashes.has(frame) || !this.theirHashes.has(frame)) return;
        if (this.hashes.get(frame) !== this.theirHashes.get(frame) && this.desyncFrame < 0) this.desyncFrame = frame;
        this.hashes.delete(frame);
        this.theirHashes.delete(frame);
    }

    /** Handle a message from the other side. Returns true if it was a lockstep message. */
    receive(msg) {
        if (msg.t !== 'in' && msg.t !== 'sum') return false;
        if (msg.m !== this.match) return true; // left over from an earlier fight
        if (msg.t === 'in') this.inputs[this.remoteIndex].set(msg.f, msg.b);
        else { this.theirHashes.set(msg.f, msg.h); this.compare(msg.f); }
        return true;
    }
}

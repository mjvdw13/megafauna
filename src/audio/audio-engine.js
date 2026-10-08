// ============================================================================
// AUDIO ENGINE
// Every sound is synthesized with Web Audio. There are no sound files.
// Owns the AudioContext, the mix (sfx bus + music bus -> compressor), the mute
// toggle, and a tiny voice toolkit (tone / noise) that sound recipes use.
//
// Browsers only allow audio after the player presses a key or clicks, so the
// context is created on the first input. Before that, play() is a no-op and the
// requested music track is remembered and started on unlock.
// Without Web Audio (e.g. node tests) everything is a silent no-op.
// ============================================================================
import { SCREEN } from '../config.js';
import { MusicPlayer } from './music.js';
import { SFX } from './sfx.js';
import { Voices } from './voices.js';

const MASTER_VOLUME = 0.8;
const MUSIC_VOLUME = 0.42;
const MUTE_KEY = 'megafauna.muted';
const PAN_WIDTH = 0.55;

function loadMuted() {
    try { return globalThis.localStorage?.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
function saveMuted(muted) {
    try { globalThis.localStorage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage unavailable */ }
}

export class AudioEngine {
    constructor(target = globalThis.window) {
        this.AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.ctx = null;
        this.muted = loadMuted();
        this.music = new MusicPlayer(this);
        this.speech = globalThis.speechSynthesis || null;
        if (!this.AudioContext || !target) return;
        const unlock = () => this.unlock();
        target.addEventListener('keydown', unlock);
        target.addEventListener('pointerdown', unlock);
        // Phones only count the end of a touch as a gesture that may start sound.
        target.addEventListener('pointerup', unlock);
        target.addEventListener('touchend', unlock);
    }

    /** True once sound can actually be heard. */
    get ready() { return !!this.ctx && this.ctx.state === 'running'; }
    get now() { return this.ctx.currentTime; }

    unlock() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume().then(() => this.music.onUnlock());
    }

    init() {
        const ctx = this.ctx = new this.AudioContext();
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        // Glue compressor: lets big hits be loud without clipping when sounds stack.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        this.master.connect(comp).connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = MUSIC_VOLUME;
        this.musicBus.connect(this.master);

        // One second of white noise, reused by every noise voice.
        const length = ctx.sampleRate;
        this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        this.music.onUnlock();
    }

    toggleMute() {
        this.muted = !this.muted;
        saveMuted(this.muted);
        if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOLUME, this.now, 0.02);
        if (this.muted) this.speech?.cancel();
        return this.muted;
    }

    /**
     * Play a named sound from SFX.
     * @param opts.x  world x of the source, for stereo panning (P1 side left, P2 side right)
     */
    play(name, opts = {}) {
        if (!this.ready || this.muted) return;
        const recipe = SFX[name];
        if (!recipe) return;
        const pan = opts.x === undefined ? 0 : ((opts.x / SCREEN.width) * 2 - 1) * PAN_WIDTH;
        recipe(new Voices(this, this.sfxBus, pan), opts);
    }

    /** Spoken announcer line ("Round one!", "Fight!"). Uses the browser's built-in speech voice. */
    announce(text, { pitch = 0.7, rate = 0.95 } = {}) {
        if (!this.speech || !this.ready || this.muted) return;
        const line = new SpeechSynthesisUtterance(text);
        line.pitch = pitch;
        line.rate = rate;
        line.volume = 1;
        line.voice = this.announcerVoice();
        this.speech.cancel();
        this.speech.speak(line);
    }

    announcerVoice() {
        if (this.voice !== undefined) return this.voice;
        const voices = this.speech.getVoices().filter((v) => v.lang?.startsWith('en'));
        if (!voices.length) return null; // voices load asynchronously; try again next time
        // A deep voice suits an announcer. Patterns in order of preference.
        const prefer = [/google uk english male/i, /\bdavid\b/i, /\bguy\b/i, /\bdaniel\b/i, /\bmale\b/i];
        this.voice = prefer.map((re) => voices.find((v) => re.test(v.name))).find(Boolean) || voices[0];
        return this.voice;
    }
}

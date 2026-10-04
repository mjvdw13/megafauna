// ============================================================================
// UNLOCKS
// Secret characters, and the button codes that reveal them. Unlocks are
// remembered in this browser (localStorage); if storage isn't available they
// last until the page is closed.
// ============================================================================

const STORAGE_KEY = 'megafauna.unlocked';

function load() {
    try { return JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

const unlocked = new Set(load());

export function isUnlocked(id) { return unlocked.has(id); }

/** Unlock a character. Returns true if it was newly unlocked. */
export function unlock(id) {
    if (unlocked.has(id)) return false;
    unlocked.add(id);
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...unlocked])); } catch { /* storage unavailable */ }
    return true;
}

/** Forget an unlock (used by tests). */
export function relock(id) {
    unlocked.delete(id);
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...unlocked])); } catch { /* storage unavailable */ }
}

const DIRECTIONS = ['up', 'down', 'left', 'right'];

/**
 * Watches one player's input for a sequence of direction presses, e.g. up ×5.
 * A wrong direction, or waiting too long between presses, starts it over.
 */
export class SecretCode {
    constructor(sequence, { maxGap = 90 } = {}) {
        this.sequence = sequence;
        this.maxGap = maxGap;
        this.reset();
    }

    reset() { this.progress = 0; this.idle = 0; }

    /** Feed one frame of input. Returns true on the frame the code is completed. */
    feed(input) {
        const pressed = DIRECTIONS.find((d) => input[`${d}Pressed`]);
        if (!pressed) {
            if (this.progress > 0 && ++this.idle > this.maxGap) this.reset();
            return false;
        }
        this.idle = 0;
        if (pressed === this.sequence[this.progress]) this.progress++;
        else this.progress = pressed === this.sequence[0] ? 1 : 0;
        if (this.progress < this.sequence.length) return false;
        this.reset();
        return true;
    }
}

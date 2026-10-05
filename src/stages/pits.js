// ============================================================================
// PIT STYLES
// What fills the pit on both sides of the main platform. Sets the splash
// colors and sound, and whether floaters (Quackers) can sit on it. The 3-D
// look of each style is built by render3d/world-kit.js.
// ============================================================================

export const PIT_STYLES = Object.freeze({
    water: { colors: ['#6db6d8', '#2f6d8c'], floatable: true, splash: ['#e8f7ff', '#8fd0ee', '#4f9cc0'], sound: 'splash' },
    pool: { colors: ['#7fdcf0', '#2b8fb3'], floatable: true, splash: ['#ffffff', '#a8ecfb', '#4fc0dd'], sound: 'splash' },
    swamp: { colors: ['#6f8a42', '#2c3a1a'], floatable: true, splash: ['#a7c26a', '#5f7a3a', '#3e4f24'], sound: 'splash' },
    icewater: { colors: ['#4d93b0', '#123449'], floatable: false, splash: ['#ffffff', '#cdeefa', '#6fb6d3'], sound: 'splash' },
    tar: { colors: ['#3a2f2a', '#0b0807'], floatable: false, splash: ['#4a3b33', '#1a1311', '#000000'], sound: 'gloop' },
    lava: { colors: ['#ffb238', '#b3240c'], floatable: false, splash: ['#fff2a8', '#ff8a1f', '#d9300f'], sound: 'sizzle' },
    chasm: { colors: ['#5a4639', '#0c0806'], floatable: false, splash: [], sound: 'fall' }
});

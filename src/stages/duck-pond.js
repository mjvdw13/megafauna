// ============================================================================
// DUCK POND — Quackers' wooden dock at sunrise, mist on the water.
// ============================================================================

export default {
    id: 'duck-pond',
    name: 'Duck Pond',
    description: "Quackers' dock at sunrise. Mind the splinters.",
    traits: ['Quackers floats on the pond'],
    accent: '#4f9cc0',
    music: 'jungle',
    layout: { main: { left: 230, right: 1050 }, platforms: [[290, 470, 430], [810, 990, 430]] },
    pit: 'water',
    platformStyle: { kind: 'wood' },

    world(k) {
        k.sky({ elevation: 4, azimuth: -20, turbidity: 6, rayleigh: 2.5, mie: 0.006 }, { envIntensity: 0.9 });
        k.light({ dir: [-0.5, 0.35, 0.75], color: '#ffd2a0', intensity: 3.2, fill: ['#f2c7b0', '#4a5a6a', 0.35] });
        k.fog('#d9c3b4', 0.007);
        k.terrain({ y: -0.2, rough: 2.5, mountains: { height: 10, start: 60, end: 150 }, near: -14, colors: { low: '#4d5e36', high: '#5d6a40' } });
        k.forest({ kind: 'broadleaf', count: 320, x: [-140, 140], z: [-30, -120], scale: [5, 8], minY: -0.3 });
        k.ground({ top: 'planks', body: 'dock' });
        k.reeds({ x: [-12, -6], z: [-4, 1.4] });
        k.reeds({ x: [6.2, 12], z: [-4, 1.4] });
        k.lilyPads({ count: 34, x: [-11, -5.2], z: [-6, 1.8] });
        k.mist({ count: 12, color: '#f3e2d4', y: 0, opacity: 0.16 });
        k.fireflies({ count: 10, color: '#ffe6a8' });
    }
};

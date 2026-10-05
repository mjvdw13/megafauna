// ============================================================================
// BACKYARD BRAWL — Riley's lawn between two swimming pools, on a summer noon.
// ============================================================================

export default {
    id: 'backyard',
    name: 'Backyard Brawl',
    description: "Riley's turf. Pools on both sides, so watch your step.",
    traits: ['Tight quarters: narrower stage', 'Quackers can swim in the pools'],
    accent: '#c0392b',
    music: 'romp',
    layout: { main: { left: 250, right: 1030 }, platforms: [[520, 760, 415]] },
    pit: 'pool',
    platformStyle: { kind: 'wood' },

    world(k) {
        k.sky({ elevation: 55, azimuth: 30, turbidity: 3, rayleigh: 1 });
        k.light({ dir: [0.35, 0.8, 0.5], intensity: 3.8, fill: ['#d6e8ff', '#6a7a4a', 0.3] });
        k.fog('#c6d6e2', 0.004);
        k.terrain({ y: -0.22, rough: 1.5, mountains: { height: 14, start: 70, end: 160 }, near: -2.6, colors: { low: '#5b7a3a', high: '#6d8a45' } });
        k.forest({ kind: 'broadleaf', count: 260, x: [-120, 120], z: [-28, -110], scale: [5, 9] });
        k.ground({ top: 'lawn', body: 'cliff', palette: ['#b9b2a6', '#a49c90', '#c7c0b4', '#968f84'] });
        k.fence({ z: -4.3, x: [-16, 16], y: -0.22, height: 1.7 });
        k.house({ pos: [-10.5, -0.22, -14], size: [9, 4.6, 6] });
        k.house({ pos: [11, -0.22, -22], size: [7, 4, 6], wall: '#c9b7a0', roof: '#4a4f5a' });
        k.tree('broadleaf', [6.8, -0.22, -6.5], 4.2);
        k.tree('broadleaf', [-6.2, -0.22, -8], 3.6);
        k.bushes({ count: 10, x: [-12, 12], z: [-4.0, -3.4], y: -0.22 });
        k.leaves({ count: 14 });
    }
};

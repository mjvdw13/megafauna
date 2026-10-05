// ============================================================================
// SUNNY MEADOW — a grassy rock outcrop floating over a mountain valley.
// ============================================================================

export default {
    id: 'meadow',
    name: 'Sunny Meadow',
    description: 'Where it all began. Wide open, nothing to hide behind.',
    traits: [],
    accent: '#7BA828',
    music: 'romp',
    layout: { main: { left: 200, right: 1080 }, platforms: [[330, 530, 425], [750, 950, 425], [540, 740, 315]] },
    pit: 'chasm',
    platformStyle: { kind: 'turf' },

    world(k) {
        k.sky({ elevation: 32, azimuth: 25, turbidity: 4, rayleigh: 1.2 });
        k.light({ dir: [0.45, 0.62, 0.65], intensity: 3.6, fill: ['#cfe3ff', '#6d8a52', 0.25] });
        k.fog('#b9c9d6', 0.0055);
        k.terrain({ y: -9, rough: 7, mountains: { height: 24, start: 60, end: 200 }, snowLine: 16, near: -2, water: { y: -10.5, color: '#4f6f80' } });
        k.forest({ kind: 'conifer', count: 700, x: [-170, 170], z: [-34, -160], scale: [6, 10], minY: -10.3 });
        k.ground({ top: 'grass', body: 'island' });
        k.rocks([[3.6, 0, -1.1, 0.32], [3.2, 0, -1.3, 0.18], [-3.9, 0, -1.0, 0.26], [-3.5, 0, 1.2, 0.14]]);
        k.tree('conifer', [-3.7, 0, -1.25], 1.6);
        k.leaves({ count: 8, color: '#9cbf5a' });
    }
};

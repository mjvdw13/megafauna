// ============================================================================
// CRETACEOUS JUNGLE — Randy's misty swamp at dusk: giant ferns, fireflies, and
// long-necked dinosaurs grazing in the distance.
// ============================================================================

export default {
    id: 'fern-jungle',
    name: 'Cretaceous Jungle',
    description: "Randy's home turf. Misty ferns, distant giants, and fireflies at dusk.",
    traits: ['Quackers can paddle in the swamp'],
    accent: '#6fae8a',
    music: 'jungle',
    layout: { main: { left: 210, right: 1070 }, platforms: [[360, 560, 425], [720, 920, 390]] },
    pit: 'swamp',
    platformStyle: { kind: 'log' },

    world(k) {
        k.sky({ elevation: 3, azimuth: 30, turbidity: 8, rayleigh: 2, mie: 0.01 }, { envIntensity: 0.8 });
        k.light({ dir: [0.5, 0.45, 0.7], color: '#ffcf9a', intensity: 2.8, fill: ['#9fc4a0', '#2a3320', 0.5] });
        k.fog('#6f8a7a', 0.016);
        k.terrain({ y: -0.25, rough: 2, mountains: { height: 18, start: 50, end: 140 }, near: -9, colors: { low: '#34452a', high: '#41553a', rock: '#3a3a2e' }, snowLine: 999 });
        k.forest({ kind: 'araucaria', count: 160, x: [-120, 120], z: [-26, -100], scale: [6, 10] });
        k.forest({ kind: 'treefern', count: 160, x: [-80, 80], z: [-11, -50], scale: [2.5, 4], seed: 4 });
        k.sauropods([[-34, -48, 1], [46, -75, 1.3]]);
        k.ground({ top: 'moss', body: 'cliff', palette: ['#4a3f2c', '#3c3324', '#584a34', '#2f281d'] });
        k.ferns({ count: 34, x: [-14, 14], z: [-8, -2.6], y: -0.3, scale: [1, 2] });
        k.ferns({ count: 10, x: [-4, 4], z: [-1.5, -1.1], y: 0, scale: [0.5, 0.8] });
        k.tree('treefern', [-6.5, -0.3, -3.2], 2.6);
        k.tree('treefern', [7, -0.3, -4], 3);
        k.mist({ count: 14, color: '#c8dccf', y: 0.2, opacity: 0.2 });
        k.fireflies({ count: 28 });
    }
};

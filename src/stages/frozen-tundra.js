// ============================================================================
// FROZEN TUNDRA — an Ice Age night under the aurora. The ice is slippery.
// ============================================================================

export default {
    id: 'frozen-tundra',
    name: 'Frozen Tundra',
    description: 'An Ice Age night under the aurora. Keep your footing.',
    traits: ['Slippery ice: you slide after moving and when hit'],
    accent: '#7fdbff',
    music: 'stampede',
    layout: { main: { left: 240, right: 1040 }, platforms: [[560, 720, 405]] },
    pit: 'icewater',
    platformStyle: { kind: 'ice' },
    physics: { friction: 0.95 },

    world(k) {
        k.sky({ gradient: [[-1, '#04070d'], [0, '#1b2a44'], [0.25, '#0d1730'], [1, '#03050c']] }, { envIntensity: 1.4 });
        k.light({ dir: [-0.4, 0.55, 0.7], color: '#b8cfff', intensity: 2.4, fill: ['#5a78b0', '#1a2230', 0.6] });
        k.fog('#1a2740', 0.006);
        k.stars({ count: 900 });
        k.moon({ at: [-150, 190, -520] });
        k.aurora();
        k.terrain({ y: -0.3, rough: 2, mountains: { height: 28, start: 50, end: 170 }, snowLine: 4, near: -14, colors: { low: '#c9d8e6', high: '#e6eef5', rock: '#5a6878', snow: '#f2f6fa' } });
        k.forest({ kind: 'snowConifer', count: 260, x: [-150, 150], z: [-30, -120], scale: [4, 7], maxY: 12 });
        k.ground({ top: 'snow', body: 'shelf' });
        k.floes({ count: 20 });
        k.snow({ count: 170 });
    }
};

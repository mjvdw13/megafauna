// ============================================================================
// VOLCANO RIM — a basalt ledge between lava pools. Updrafts make jumps floaty.
// ============================================================================

export default {
    id: 'volcano',
    name: 'Volcano Rim',
    description: 'Scorching updrafts make every leap linger.',
    traits: ['Hot updrafts: higher, floatier jumps'],
    accent: '#ff6b1a',
    music: 'stampede',
    layout: { main: { left: 220, right: 1060 }, platforms: [[300, 470, 445], [810, 980, 445], [555, 725, 330]] },
    pit: 'lava',
    platformStyle: { kind: 'stone' },
    physics: { gravity: 0.66 },

    world(k) {
        k.sky({ elevation: 1, azimuth: -10, turbidity: 18, rayleigh: 4, mie: 0.02, mieG: 0.9 }, { envIntensity: 0.6 });
        k.light({ dir: [0.4, 0.5, 0.75], color: '#ffb08a', intensity: 2.6, fill: ['#ff7a4a', '#2a0f08', 0.45] });
        k.fog('#4a2018', 0.009);
        k.terrain({ y: -0.3, rough: 2.5, mountains: { height: 22, start: 40, end: 130 }, near: -12, colors: { low: '#2c2626', high: '#3a3230', rock: '#1f1b1b', snow: '#3a3230' }, snowLine: 999 });
        k.volcano({ at: [14, -1, -110], height: 26, radius: 44 });
        k.ground({ top: 'basalt', body: 'cliff', palette: ['#3a3433', '#2c2727', '#47403e', '#242020'] });
        k.rocks([[-4.0, 0, -1.2, 0.3], [3.9, 0, -1.1, 0.24]], '#3e3636');
        k.embers({ count: 80 });
        k.smoke({ at: [-9, -0.4, -6], count: 8, size: 4, color: '#2a2020' });
    }
};

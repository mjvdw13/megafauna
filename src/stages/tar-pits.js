// ============================================================================
// TAR PITS — sunset over the La Brea tar pits. The sticky ground cuts knockback.
// ============================================================================

export default {
    id: 'tar-pits',
    name: 'La Brea Tar Pits',
    description: 'Sunset over the sticky pits. Many megafauna went in. Few came out.',
    traits: ['Sticky tar: knockback slides are short'],
    accent: '#f28a4b',
    music: 'stampede',
    layout: { main: { left: 180, right: 1100 }, platforms: [[380, 580, 420], [700, 900, 420]] },
    pit: 'tar',
    platformStyle: { kind: 'bone' },
    physics: { friction: 0.72 },

    world(k) {
        k.sky({ elevation: 2, azimuth: 15, turbidity: 9, rayleigh: 3, mie: 0.008, mieG: 0.85 }, { envIntensity: 0.9 });
        k.light({ dir: [0.55, 0.3, 0.7], color: '#ffb27a', intensity: 3.4, fill: ['#f0a070', '#3a2a2a', 0.35] });
        k.fog('#c98a66', 0.006);
        k.terrain({ y: -0.3, rough: 1.8, mountains: { height: 16, start: 70, end: 190 }, near: -10, colors: { low: '#8a7444', high: '#a8915a', rock: '#7a5e4a' } });
        k.forest({ kind: 'acacia', count: 90, x: [-160, 160], z: [-25, -140], scale: [5, 8] });
        k.ground({ top: 'earth', body: 'cliff', palette: ['#a8865c', '#8f6e48', '#b89468', '#7a5c3c'] });
        k.bones({ spots: [[-7.2, -3], [6.4, -4.5]] });
        k.rocks([[-4.2, 0, -1.2, 0.22], [4.1, 0, -1.3, 0.3]], '#8a7058');
    }
};

// ============================================================================
// BACKYARD BRAWL — Riley's turf: a narrow lawn between two swimming pools.
// ============================================================================
import { driftingClouds, fallingLeaves } from './ambient.js';
import { FLOOR_TOP } from './sketch-kit.js';

export default {
    id: 'backyard',
    name: 'Backyard Brawl',
    description: "Riley's turf. Pools on both sides, so watch your step.",
    traits: ['Tight quarters: narrower stage', 'Quackers can swim in the pools'],
    accent: '#c0392b',
    music: 'romp',
    layout: { main: { left: 250, right: 1030 }, platforms: [[520, 760, 415]] },
    pit: 'pool',
    platformStyle: { top: '#d1a675', front: '#9c7247', kind: 'wood' },

    paint(k) {
        const { ctx, ink } = k;
        k.sky(['#7cc3ea', '#a8d7ef', '#d8ecf1', '#fbe7c6']);
        // Neighbours' houses
        for (const [x, w, wall, roof] of [[220, 190, '#e8dcc8', '#a0544a'], [560, 230, '#d7e1e6', '#6f5a4e'], [890, 200, '#efe0c2', '#8e4f43']]) {
            k.wash(ink.polygon([[x, 300], [x + w, 300], [x + w, 200], [x, 200]], 1.5), wall, { texture: 0.08, strokes: 20 });
            k.wash(ink.polygon([[x - 16, 204], [x + w / 2, 130], [x + w + 16, 204]], 1.5), roof, { texture: 0.12, strokes: 20 });
            for (const wx of [x + 26, x + w - 60]) {
                k.wash(ink.polygon([[wx, 228], [wx + 34, 228], [wx + 34, 262], [wx, 262]], 1), '#fdf3d0', { texture: 0, lineWidth: 2.4 });
                ink.line(ctx, [[wx + 17, 228], [wx + 17, 262]], { width: 2 });
            }
        }
        k.tree(110, 330, { size: 95, trunkHeight: 90 });
        k.tree(1190, 330, { size: 70, trunkHeight: 70, leaves: '#6cb04a', shade: '#4a8a33' });

        // Wooden fence
        for (let x = -10; x < 1290; x += 34) {
            const plank = ink.closedCurve([[x, 448], [x, 262], [x + 15, 248], [x + 30, 262], [x + 30, 448]], 1.2);
            k.wash(plank, k.rng() < 0.5 ? '#d1a675' : '#c99c6a', { texture: 0.12, strokes: 6, lineWidth: 2.4 });
            ink.line(ctx, [[x + 10, 300 + k.rand(0, 40)], [x + 12, 340 + k.rand(0, 60)]], { width: 1.5, color: '#9c7247' });
        }
        for (const y of [292, 400]) k.wash(ink.polygon([[0, y], [1280, y], [1280, y + 14], [0, y + 14]], 1.5), '#b88a5a', { texture: 0.1, strokes: 20, lineWidth: 2.4 });
        // Flower bed
        k.wash(ink.polygon([[0, 432], [1280, 432], [1280, 452], [0, 452]], 1), '#6d4c33', { texture: 0.15, strokes: 30 });
        for (let x = 10; x < 1280; x += 26) {
            ink.line(ctx, [[x, 440], [x + 2, 420]], { width: 2, color: '#3d7a2a' });
            k.puffs([[x + 2, 418, 6]], ['#e74c3c', '#f1c40f', '#9b59b6', '#ffffff'][Math.floor(k.rng() * 4)], { lineWidth: 1.5 });
        }
        // Doghouse
        k.wash(ink.polygon([[940, 452], [940, 350], [1080, 350], [1080, 452]], 1.5), '#c0392b', { texture: 0.12 });
        k.wash(ink.polygon([[920, 356], [1010, 290], [1100, 356]], 1.5), '#6e2c00', { texture: 0.15 });
        const door = new Path2D();
        door.moveTo(982, 452); door.lineTo(982, 400); door.arc(1010, 400, 28, Math.PI, 0); door.lineTo(1038, 452); door.closePath();
        k.wash(door, '#2c1a12', { texture: 0 });
        k.wash(ink.polygon([[975, 362], [1045, 362], [1045, 384], [975, 384]], 1), '#f5e6c8', { texture: 0, lineWidth: 2.2 });
        ctx.font = '20px Bangers, "Arial Black", sans-serif'; ctx.fillStyle = '#6e2c00'; ctx.textAlign = 'center';
        ctx.fillText('RILEY', 1010, 381);
        k.wash(ink.ellipse(1110, 446, 22, 8, 0, 10), '#3498db', { texture: 0, lineWidth: 2.4 });

        // Striped lawn
        k.floor('#6cb844', { lines: '#ffffff', lineAlpha: 0.1 });
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#2f6d1f';
        for (let i = 0; i < 6; i++) ctx.fillRect(0, FLOOR_TOP + 20 + i * 46, 1280, 22);
        ctx.restore();
        k.grass(FLOOR_TOP + 4, { count: 70, color: '#3d7a2a' });
        // Toys outside the play area
        k.wash(ink.ellipse(60, 620, 26, 8, 0.2, 8), '#f5f5f5', { texture: 0, lineWidth: 2.2 });
        k.wash(ink.ellipse(1220, 650, 18, 18, 0, 10), '#e74c3c', { texture: 0, lineWidth: 2.4 });
    },

    createLayers: () => [
        driftingClouds([{ x: 60, y: 40, size: 60, speed: 0.1 }, { x: 720, y: 70, size: 50, speed: 0.14 }]),
        fallingLeaves({ count: 8, colors: ['#4caf50', '#8bc34a', '#cddc39'], area: { left: 0, right: 300 } })
    ]
};

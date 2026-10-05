// ============================================================================
// STAT BARS
// How character stats are shown on the select screen. Ranges are fixed (not
// relative to the roster) so adding a character doesn't rescale everyone.
// ============================================================================
import { clamp } from '../core/math.js';
import { uiInk } from './ink-ui.js';
import { drawText } from './text.js';

export const STAT_DISPLAY = Object.freeze([
    { key: 'maxHealth', label: 'HEALTH', min: 60, max: 140, format: (v) => `${v}` },
    { key: 'power', label: 'POWER', min: 0.6, max: 1.5, format: (v) => `${v.toFixed(2)}x` },
    { key: 'walkSpeed', label: 'SPEED', min: 2, max: 7, format: (v) => v.toFixed(1) },
    { key: 'attackSpeed', label: 'ATK SPEED', min: 0.6, max: 1.4, format: (v) => `${v.toFixed(2)}x` },
    { key: 'jumpForce', label: 'JUMP', min: 10, max: 20, format: (v) => `${v}` },
    { key: 'weight', label: 'WEIGHT', min: 0.6, max: 1.8, format: (v) => v.toFixed(1) }
]);

/** Short feature badges derived from a character definition (at most three fit on the card). */
export function characterBadges(def) {
    const badges = [];
    const airJumps = def.stats.airJumps ?? 1;
    if (airJumps > 1) badges.push(`${airJumps} AIR JUMPS`);
    if (def.abilities?.glide) badges.push('GLIDES');
    if (def.abilities?.floats) badges.push('SWIMS');
    const moves = Object.values(def.moves || {});
    if (moves.some((m) => m.burn)) badges.push('BURNS');
    if (def.abilities?.fireproof) badges.push('FIREPROOF');
    if (moves.some((m) => m.counter)) badges.push('COUNTER');
    if (moves.some((m) => m.armor)) badges.push('SUPER ARMOR');
    if (moves.some((m) => m.intangible?.length)) badges.push('BURROWS');
    if ((def.stats.runSpeed ?? 0) >= 9) badges.push('FAST RUNNER');
    return badges.slice(0, 3);
}

export function renderStatBars(ctx, stats, x, y, { width = 220, rowHeight = 26, color = '#e94560' } = {}) {
    const labelW = 86, valueW = 44, barW = width - labelW - valueW;
    STAT_DISPLAY.forEach((stat, i) => {
        const value = stats[stat.key];
        const rowY = y + i * rowHeight;
        const pct = clamp((value - stat.min) / (stat.max - stat.min), 0.04, 1);
        drawText(ctx, stat.label, x, rowY + 15, { size: 16, color: '#6b5a4e', align: 'left' });
        const track = uiInk.polygon([[x + labelW, rowY + 3], [x + labelW + barW, rowY + 3], [x + labelW + barW, rowY + 16], [x + labelW, rowY + 16]], 0.6);
        ctx.fillStyle = 'rgba(42,29,23,0.12)';
        ctx.fill(track);
        ctx.fillStyle = color;
        ctx.fillRect(x + labelW, rowY + 3, Math.round(barW * pct), 13);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2a1d17';
        ctx.stroke(track);
        drawText(ctx, stat.format(value), x + width, rowY + 15, { size: 16, color: '#2a1d17', align: 'right' });
    });
}

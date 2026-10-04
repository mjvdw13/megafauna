// ============================================================================
// TEXT HELPERS
// ============================================================================

// Hand-lettered fonts (loaded in index.html) with system fallbacks.
export const FONT_FAMILY = '"Patrick Hand", "Comic Sans MS", "Segoe UI", sans-serif';
export const DISPLAY_FONT = '"Bangers", "Arial Black", Impact, sans-serif';

/** Draw text with optional outline. */
export function drawText(ctx, text, x, y, {
    size = 20, color = '#fff', align = 'center', baseline = 'alphabetic', weight = 'bold',
    font = FONT_FAMILY, outline = null, outlineWidth = 4, alpha = 1
} = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = outlineWidth;
        ctx.strokeStyle = outline;
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

/** Draw text wrapped to maxWidth. Returns the number of lines drawn. */
export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, options = {}) {
    const { size = 14, weight = 'normal', font = FONT_FAMILY } = options;
    ctx.save();
    ctx.font = `${weight} ${size}px ${font}`;
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
        else line = candidate;
    }
    if (line) lines.push(line);
    ctx.restore();
    lines.forEach((l, i) => drawText(ctx, l, x, y + i * lineHeight, { size, weight, font, ...options }));
    return lines.length;
}

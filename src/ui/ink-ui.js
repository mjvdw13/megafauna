// ============================================================================
// INK UI
// Hand-drawn UI pieces (panels, bars, badges) that share the game's ink style.
// UI lines boil gently like the characters do.
// ============================================================================
import { Ink, INK_COLOR } from '../graphics/ink.js';

export const uiInk = new Ink({ seed: 4242, wobble: 1.2, lineWidth: 3 });

/** Call once per frame before drawing UI so UI outlines boil in step with the game. */
export function beginUi(time) { uiInk.begin(time); }

/** Points around a rounded rectangle (for wobbly outlines). */
function roundedRectPoints(x, y, w, h, r) {
    const pts = [];
    const corner = (cx, cy, from) => {
        for (let i = 0; i <= 3; i++) {
            const a = from + (i / 3) * (Math.PI / 2);
            pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
}

export function inkRectPath(x, y, w, h, r = 10) {
    return uiInk.polygon(roundedRectPoints(x, y, w, h, Math.min(r, w / 2, h / 2)), 0.9);
}

/** A hand-drawn panel: fill, optional drop shadow, ink outline. */
export function inkPanel(ctx, x, y, w, h, { fill = '#fdf3dc', outline = INK_COLOR, radius = 12, lineWidth = 3.5, shadow = true, alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (shadow) {
        ctx.fillStyle = 'rgba(42,29,23,0.35)';
        ctx.fill(inkRectPath(x + 5, y + 6, w, h, radius));
    }
    const path = inkRectPath(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.stroke(inkRectPath(x, y, w, h, radius));
}

/** Hand-drawn five-point star (round-win markers). */
export function inkStar(ctx, cx, cy, r, fill) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    const path = uiInk.polygon(pts, 0.5);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLOR;
    ctx.stroke(path);
}

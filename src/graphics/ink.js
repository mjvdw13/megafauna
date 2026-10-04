// ============================================================================
// INK
// Hand-drawn rendering toolkit. Shapes are built as Path2D with a little
// deterministic wobble. The wobble pattern changes every few frames
// ("line boil"), which gives drawings the jittery life of hand animation.
// ============================================================================

export const INK_COLOR = '#2a1d17';
/** Game frames per boil frame: lines redraw on "fours", like limited animation. */
export const BOIL_RATE = 4;

/** Deterministic hash → [-1, 1]. */
function hash(n) {
    n = (n << 13) ^ n;
    return 1 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824;
}

export class Ink {
    /**
     * @param seed       separates the wobble of different drawings
     * @param wobble     max jitter in px
     * @param lineWidth  outline width in px
     */
    constructor({ seed = 1, wobble = 1.1, lineWidth = 3.2, outline = INK_COLOR } = {}) {
        Object.assign(this, { seed, wobble, lineWidth, outline });
        this.boil = 0;
        this.counter = 0;
        this.flat = null;
    }

    /** Start a new drawing pass. Same boil frame + same draw order = identical lines. */
    begin(time, { flat = null } = {}) {
        this.boil = Math.floor(time / BOIL_RATE);
        this.counter = 0;
        this.flat = flat; // when set, every fill and line uses this color (silhouettes)
    }

    /** Next jitter value in [-amount, amount]. */
    j(amount = this.wobble) {
        this.counter++;
        return hash(this.seed * 92821 + this.boil * 7919 + this.counter * 131) * amount;
    }

    color(c) { return this.flat || c; }

    // ------------------------------------------------------------------ paths

    /** Smooth closed path through points (quadratic curves via midpoints). */
    closedCurve(points, jitter = this.wobble) {
        const pts = points.map(([x, y]) => [x + this.j(jitter), y + this.j(jitter)]);
        const path = new Path2D();
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const start = mid(pts[pts.length - 1], pts[0]);
        path.moveTo(start[0], start[1]);
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i], m = mid(p, pts[(i + 1) % pts.length]);
            path.quadraticCurveTo(p[0], p[1], m[0], m[1]);
        }
        path.closePath();
        return path;
    }

    /** Closed path with straight (slightly wobbly) edges, for buildings and other hard shapes. */
    polygon(points, jitter = this.wobble) {
        const path = new Path2D();
        points.forEach(([x, y], i) => {
            const px = x + this.j(jitter), py = y + this.j(jitter);
            if (i === 0) path.moveTo(px, py);
            else path.lineTo(px, py);
        });
        path.closePath();
        return path;
    }

    /** Smooth open path through points. */
    openCurve(points, jitter = this.wobble) {
        const pts = points.map(([x, y]) => [x + this.j(jitter), y + this.j(jitter)]);
        const path = new Path2D();
        path.moveTo(pts[0][0], pts[0][1]);
        if (pts.length === 2) { path.lineTo(pts[1][0], pts[1][1]); return path; }
        for (let i = 1; i < pts.length - 1; i++) {
            const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
            path.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
        }
        const last = pts[pts.length - 1];
        path.lineTo(last[0], last[1]);
        return path;
    }

    /** Wobbly ellipse. */
    ellipse(cx, cy, rx, ry, rotation = 0, segments = 12) {
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const pts = [];
        for (let i = 0; i < segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
            pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
        }
        return this.closedCurve(pts);
    }

    /** Points of an ellipse, for building custom outlines. */
    ellipsePoints(cx, cy, rx, ry, rotation = 0, segments = 12, from = 0, to = Math.PI * 2) {
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        const pts = [];
        for (let i = 0; i < segments; i++) {
            const a = from + (i / segments) * (to - from);
            const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
            pts.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
        }
        return pts;
    }

    // ------------------------------------------------------------------ painting

    /**
     * Fill a path with cel shading and an ink outline.
     * shade: darker color revealed on the side away from the light (light comes from top-left).
     */
    fill(ctx, path, color, { shade = null, shadeOffset = [5, 5], highlight = null, outline = true, lineWidth = this.lineWidth } = {}) {
        if (shade && !this.flat) {
            ctx.fillStyle = shade;
            ctx.fill(path);
            ctx.save();
            ctx.clip(path);
            ctx.translate(-shadeOffset[0], -shadeOffset[1]);
            ctx.fillStyle = color;
            ctx.fill(path);
            if (highlight) {
                ctx.translate(-shadeOffset[0] * 1.2, -shadeOffset[1] * 1.2);
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = highlight;
                ctx.fill(path);
            }
            ctx.restore();
        } else {
            ctx.fillStyle = this.color(color);
            ctx.fill(path);
        }
        if (outline) this.outlinePath(ctx, path, lineWidth);
    }

    outlinePath(ctx, path, lineWidth = this.lineWidth) {
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.color(this.outline);
        ctx.stroke(path);
    }

    /** A plain ink line through points. */
    line(ctx, points, { width = this.lineWidth, color = this.outline, jitter = this.wobble * 0.6 } = {}) {
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.color(color);
        ctx.stroke(this.openCurve(points, jitter));
    }

    /** A thick outlined stroke, used for limbs, tails and necks. */
    limb(ctx, points, width, color, { outline = true } = {}) {
        const path = this.openCurve(points, this.wobble * 0.5);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (outline) {
            ctx.lineWidth = width + this.lineWidth * 2;
            ctx.strokeStyle = this.color(this.outline);
            ctx.stroke(path);
        }
        ctx.lineWidth = width;
        ctx.strokeStyle = this.color(color);
        ctx.stroke(path);
    }

    /** Small solid dot (eyes, nostrils). */
    dot(ctx, x, y, r, color = this.outline) {
        ctx.fillStyle = this.color(color);
        ctx.beginPath();
        ctx.arc(x + this.j(0.3), y + this.j(0.3), r, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------------------------------------------------------------------------- kinematics

/**
 * Two-bone inverse kinematics. Returns [joint, end] positions so that a limb
 * rooted at `root` with segment lengths l1, l2 reaches toward `target`.
 * bend = 1 or -1 picks which way the joint (knee/elbow) points.
 */
export function solveLimb(root, target, l1, l2, bend = 1) {
    const dx = target[0] - root[0], dy = target[1] - root[1];
    const dist = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
    const angle = Math.atan2(dy, dx);
    const cos = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const jointAngle = angle + bend * Math.acos(Math.max(-1, Math.min(1, cos)));
    const joint = [root[0] + Math.cos(jointAngle) * l1, root[1] + Math.sin(jointAngle) * l1];
    const end = [root[0] + Math.cos(angle) * dist, root[1] + Math.sin(angle) * dist];
    return [joint, end];
}

/** Rotate a point around the origin. */
export function rotate([x, y], angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [x * c - y * s, x * s + y * c];
}

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

// ============================================================================
// FIGHT CAMERA
// Screen shake, directional kicks, zoom punches and the KO close-up.
//
// The camera is a view window onto the 1280x720 playfield. The 3-D camera
// renders exactly that window (render3d/fight-view.js) and apply() maps it
// onto the 2-D layers, so hit sparks and name tags stay glued to the fighters
// while the picture shakes, rolls and zooms. Because the 3-D world carries on
// past the screen edges, shaking never shows a border.
// ============================================================================
import { SCREEN } from '../config.js';
import { clamp, easeInOutQuad, lerp } from '../core/math.js';

const W = SCREEN.width, H = SCREEN.height;
const SHAKE_DECAY = 0.86;     // per step
const ROLL_PER_PX = 0.0011;   // radians of roll per px of shake
const KICK_STIFFNESS = 0.32;  // spring pulling a kick back to center
const KICK_DAMPING = 0.55;
const PUNCH_DECAY = 0.82;
const FOCUS_IN = 0.2;         // how fast the KO close-up closes in, and lets go
const FOCUS_OUT = 0.05;

export class Camera {
    constructor() { this.reset(); }

    reset() {
        this.time = 0;
        this.shakeAmount = 0;
        this.kickX = 0; this.kickY = 0; this.kickVX = 0; this.kickVY = 0;
        this.punchAmount = 0; this.punchX = W / 2; this.punchY = H / 2;
        this.focus = null;
    }

    /** Rattle the picture by about `amount` px (stronger calls win; it decays on its own). */
    shake(amount) { this.shakeAmount = Math.max(this.shakeAmount, amount); }

    /** Jolt the picture by (dx, dy) px; it springs back. Hits kick along the knockback. */
    kick(dx, dy = 0) { this.kickVX += dx; this.kickVY += dy; }

    /** A quick zoom in (amount 0.05 = 5%) that keeps the point (x, y) where it is on screen. */
    punch(x, y, amount) {
        if (amount < this.punchAmount) return;
        this.punchAmount = amount;
        this.punchX = x;
        this.punchY = y;
    }

    /** Close in on (x, y) at `zoom` and hold there until release(). */
    focusOn(x, y, zoom) { this.focus = { x, y, zoom, k: this.focus?.k ?? 0, target: 1 }; }
    release() { if (this.focus) this.focus.target = 0; }

    update() {
        this.time++;
        this.shakeAmount *= SHAKE_DECAY;
        if (this.shakeAmount < 0.3) this.shakeAmount = 0;
        this.kickVX = (this.kickVX - this.kickX * KICK_STIFFNESS) * KICK_DAMPING;
        this.kickVY = (this.kickVY - this.kickY * KICK_STIFFNESS) * KICK_DAMPING;
        this.kickX += this.kickVX;
        this.kickY += this.kickVY;
        this.punchAmount *= PUNCH_DECAY;
        if (this.punchAmount < 0.002) this.punchAmount = 0;
        const f = this.focus;
        if (f) {
            f.k += (f.target - f.k) * (f.target ? FOCUS_IN : FOCUS_OUT);
            if (!f.target && f.k < 0.003) this.focus = null;
        }
    }

    /** The window of the playfield to show this frame: { x, y, width, height } in screen px, and `roll` in radians. */
    view() {
        const f = this.focus;
        const fk = f ? easeInOutQuad(clamp(f.k, 0, 1)) : 0;
        const punch = 1 + this.punchAmount;
        const zoom = punch * (f ? lerp(1, f.zoom, fk) : 1);
        // A punch zooms about the impact so it stays put; the close-up brings its point toward the middle.
        let cx = this.punchX + (W / 2 - this.punchX) / punch;
        let cy = this.punchY + (H / 2 - this.punchY) / punch;
        if (f) { cx = lerp(cx, f.x, fk); cy = lerp(cy, f.y, fk); }
        const w = W / zoom, h = H / zoom;
        cx = clamp(cx, w / 2, W - w / 2);
        cy = clamp(cy, h / 2, H - h / 2);
        // Smooth pseudo-random shake: a few fast sines per axis rather than white noise.
        const s = this.shakeAmount, t = this.time;
        const sx = s * (Math.sin(t * 2.1) * 0.6 + Math.sin(t * 3.7 + 1.3) * 0.4);
        const sy = s * (Math.sin(t * 2.6 + 0.7) * 0.6 + Math.sin(t * 4.3 + 2.1) * 0.4);
        const roll = s * ROLL_PER_PX * Math.sin(t * 1.7 + 0.4);
        return { x: cx - w / 2 + sx - this.kickX, y: cy - h / 2 + sy - this.kickY, width: w, height: h, roll };
    }

    /** Map the view window onto the canvas, for 2-D drawing in playfield coordinates. */
    apply(ctx, view = this.view()) {
        ctx.scale(W / view.width, H / view.height);
        ctx.translate(-view.x, -view.y);
        if (view.roll) {
            // The 3-D camera rolls about the middle of the full playfield.
            ctx.translate(W / 2, H / 2);
            ctx.rotate(view.roll);
            ctx.translate(-W / 2, -H / 2);
        }
    }
}

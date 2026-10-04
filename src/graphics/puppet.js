// ============================================================================
// PUPPET
// Animates a character rig: picks the pose for the current state, blends
// smoothly between states, feeds secondary motion (ears, tails) from the
// fighter's velocity, and renders into an offscreen canvas.
//
// A rig module provides:
//   canvas: { width, height, originX, originY }  origin = feet on the ground
//   basePose: default values for every pose parameter
//   poses: { stateName: partialPose }            static poses
//   cycles: { stateName: (t) => partialPose }    looping, time-based poses
//   draw(ctx, pose, ink)                          paints a pose at the origin
//   portrait: { x, y, scale }                     where the face is, for HUD icons
//   previewScale (optional)                       scale used on menu cards
// ============================================================================
import { easeOutQuad } from '../core/math.js';
import { createCanvas } from './canvas.js';
import { Ink } from './ink.js';

const BLEND_FRAMES = 6;

/** Interpolate poses: numbers and [x, y] pairs blend; anything else switches halfway. */
export function blendPose(a, b, t) {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const va = a[key] ?? b[key];
        const vb = b[key] ?? a[key];
        if (typeof va === 'number' && typeof vb === 'number') out[key] = va + (vb - va) * t;
        else if (Array.isArray(va) && Array.isArray(vb)) out[key] = va.map((v, i) => v + ((vb[i] ?? v) - v) * t);
        else out[key] = t < 0.5 ? va : vb;
    }
    return out;
}

export class Puppet {
    constructor(rig, { seed = 1 } = {}) {
        this.rig = rig;
        const { width, height } = rig.canvas;
        this.canvas = createCanvas(width, height);
        this.flatCanvas = createCanvas(width, height);
        this.ink = new Ink({ seed, ...(rig.ink || {}) });
        this.state = 'idle';
        this.time = 0;
        this.stateTime = 0;
        this.speed = 1;
        this.from = null;
        this.blend = 1;
        this.motion = [0, 0];
        this.pose = this.poseFor('idle', 0);
    }

    get originX() { return this.rig.canvas.originX; }
    get originY() { return this.rig.canvas.originY; }

    has(name) { return !!(this.rig.cycles?.[name] || this.rig.poses?.[name]); }

    /** Full pose for a state at time t (base pose + state overrides). */
    poseFor(name, t = this.stateTime) {
        const { basePose, cycles = {}, poses = {} } = this.rig;
        if (cycles[name]) return { ...basePose, ...cycles[name](t) };
        return { ...basePose, ...(poses[name] || poses.idle || {}) };
    }

    /** First state in the list the rig knows. */
    poseForFirst(names, t) {
        const name = names.find((n) => n && this.has(n)) || 'idle';
        return this.poseFor(name, t);
    }

    /** Switch to a state's pose. `speed` plays a cycle faster or slower (running reuses the walk cycle). */
    play(state, { speed = 1 } = {}) {
        this.speed = speed;
        if (state === this.state) return;
        this.from = this.pose;
        this.blend = 0;
        this.state = state;
        this.stateTime = 0;
    }

    /** Advance time. `velocity` drives secondary motion (ear flop, tail drag). */
    update(velocity = [0, 0]) {
        this.time++;
        this.stateTime += this.speed;
        if (this.blend < 1) this.blend = Math.min(1, this.blend + 1 / BLEND_FRAMES);
        this.motion = [
            this.motion[0] + (velocity[0] - this.motion[0]) * 0.25,
            this.motion[1] + (velocity[1] - this.motion[1]) * 0.25
        ];
    }

    /** The state's pose, eased in from wherever the previous state left off. */
    currentPose() {
        const pose = this.poseFor(this.state);
        if (!this.from || this.blend >= 1) return pose;
        return blendPose(this.from, pose, easeOutQuad(this.blend));
    }

    drawPose(canvas, pose, flat) {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(this.originX, this.originY);
        this.ink.begin(this.time, { flat });
        this.rig.draw(ctx, { ...pose, motion: this.motion, time: this.time }, this.ink);
        return canvas;
    }

    /** Render a pose in full color. Remembers it so the next state can blend from here. */
    render(pose = this.currentPose()) {
        this.pose = pose;
        return this.drawPose(this.canvas, pose, null);
    }

    /** Render a single-color silhouette (hit flashes, afterimages). */
    renderFlat(pose, color) {
        return this.drawPose(this.flatCanvas, pose, color);
    }

    /** Draw the last rendered frame with its feet at (x, groundY). */
    drawAt(ctx, x, groundY, { scale = 1, flip = false } = {}) {
        ctx.save();
        ctx.translate(x, groundY);
        ctx.scale(flip ? -scale : scale, scale);
        ctx.drawImage(this.canvas, -this.originX, -this.originY);
        ctx.restore();
    }

    /** Draw a close-up of the face into a box (HUD portraits). */
    drawPortrait(ctx, x, y, size, { flip = false } = {}) {
        const { portrait = { x: 0, y: -80, scale: 1 } } = this.rig;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.clip();
        ctx.translate(x + size / 2, y + size / 2);
        ctx.scale(flip ? -portrait.scale : portrait.scale, portrait.scale);
        ctx.drawImage(this.canvas, -this.originX - portrait.x, -this.originY - portrait.y);
        ctx.restore();
    }
}

// ============================================================================
// PUPPET
// Animates a character model's pose: picks the pose for the current state,
// blends smoothly between states and tracks the fighter's velocity for
// secondary motion. It only produces pose values; render3d/ turns a pose into
// bone rotations on the 3D model.
//
// A model file (fighters/<id>/<id>-model.js) provides:
//   basePose: default values for every pose parameter
//   poses: { stateName: partialPose }            static poses
//   cycles: { stateName: (t) => partialPose }    looping, time-based poses (t in frames)
// ============================================================================
import { easeOutQuad } from '../core/math.js';

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
    constructor(model) {
        this.model = model;
        this.state = 'idle';
        this.time = 0;
        this.stateTime = 0;
        this.speed = 1;
        this.from = null;
        this.blend = 1;
        this.motion = [0, 0];
        this.pose = this.poseFor('idle', 0);
    }

    has(name) { return !!(this.model.cycles?.[name] || this.model.poses?.[name]); }

    /** Full pose for a state at time t (base pose + state overrides). */
    poseFor(name, t = this.stateTime) {
        const { basePose, cycles = {}, poses = {} } = this.model;
        if (cycles[name]) return { ...basePose, ...cycles[name](t) };
        if (poses[name]) return { ...basePose, ...poses[name] };
        if (cycles.idle) return { ...basePose, ...cycles.idle(t) };
        return { ...basePose, ...(poses.idle || {}) };
    }

    /** First state in the list the model knows. */
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

    /** Remember the pose that was shown this frame, so the next state can blend from it. */
    show(pose = this.currentPose()) {
        this.pose = pose;
        return pose;
    }
}

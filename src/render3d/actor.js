// ============================================================================
// ACTOR
// A character model posed by its own puppet, for menus and showcases (title
// line-up, character cards, portraits). Fighters use FighterView instead.
// ============================================================================
import * as THREE from 'three';
import { Puppet } from '../graphics/puppet.js';
import { createInstance } from './creature.js';
import { facingYaw } from './fighter-view.js';
import { getTemplate } from './models.js';

export class Actor {
    constructor(def) {
        this.def = def;
        this.template = getTemplate(def);
        this.instance = createInstance(this.template);
        this.puppet = new Puppet(def.model);
        this.holder = new THREE.Group();
        this.holder.add(this.instance.root);
        this.state = 'idle';
    }

    /** Play a state ('idle', 'victory', 'hitstun'...) if the model has it. */
    play(state) {
        const name = this.puppet.has(state) ? state : 'idle';
        if (name !== this.state) { this.state = name; this.puppet.play(name); }
    }

    /** Advance one frame and pose the model. facingRight turns it three-quarters toward the camera. */
    update(facingRight = true, dt = 1 / 60) {
        this.puppet.update();
        const pose = this.puppet.show(this.puppet.currentPose());
        this.instance.root.rotation.y = facingYaw(facingRight);
        this.instance.pose(pose, { time: this.puppet.time, dt, motion: this.puppet.motion, grounded: true });
    }

    get height() { return this.template.bounds.max.y; }
}

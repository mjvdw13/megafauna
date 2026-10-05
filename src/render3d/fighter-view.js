// ============================================================================
// FIGHTER VIEW
// The 3-D body of one Fighter. Each frame it reads the fighter's state (which
// pose the puppet picked, the attack's lunge/squash/spin, hit flashes,
// shields, dodges) and poses a clone of the character's model to match.
// Gameplay never reads anything back from here.
// ============================================================================
import * as THREE from 'three';
import { AttackPhase } from '../combat/attack.js';
import { CharacterStates as S } from '../combat/states.js';
import { DEFENSE } from '../config.js';
import { createInstance } from './creature.js';
import { getTemplate } from './models.js';

const PX = 0.01;          // world units per screen pixel
const TURN = 0.35;        // fighters turn this far toward the camera (a three-quarter view)
const GHOSTS = 3;         // afterimages drawn for fast moves
const GHOST_DEPTH = 0.5;  // afterimages sit this far behind the fighter so they trail it instead of washing over it

export const facingYaw = (right) => (right ? -TURN : -(Math.PI - TURN));

const starGeometry = (() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.05 : 0.022, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
})();

export class FighterView {
    constructor(fighter, world) {
        this.fighter = fighter;
        this.world = world;
        this.template = getTemplate(fighter.def);
        this.instance = createInstance(this.template);
        this.holder = new THREE.Group();     // sits at the body's center, so rolls spin around it
        this.yawNode = new THREE.Group();    // turns to face left or right
        this.holder.add(this.yawNode);
        this.yawNode.add(this.instance.root);
        this.yaw = facingYaw(fighter.facingRight);

        this.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshPhysicalMaterial({
            color: fighter.accentColor, emissive: fighter.accentColor, emissiveIntensity: 0.35, roughness: 0.15, clearcoat: 1,
            transparent: true, opacity: 0.3, depthWrite: false
        }));
        this.shield.renderOrder = 2;
        this.stars = new THREE.Group();
        const starMat = new THREE.MeshBasicMaterial({ color: '#ffe14d' });
        for (let i = 0; i < 3; i++) this.stars.add(new THREE.Mesh(starGeometry, starMat));
        this.ghosts = [];
        world.scene.add(this.holder, this.shield, this.stars);
    }

    dispose() {
        this.world.scene.remove(this.holder, this.shield, this.stars);
        for (const g of this.ghosts) this.world.scene.remove(g.holder);
    }

    /** Place and pose a model for a fighter snapshot (the live fighter or an afterimage). */
    place(instance, holder, yawNode, { x, y, facingRight, pose, transform }, yaw, dt) {
        const f = this.fighter;
        holder.position.set(this.world.toWorldX(x + f.width / 2), this.world.toWorldY(y + f.height / 2), 0);
        holder.rotation.z = -(transform.rotate || 0);
        yawNode.position.y = -f.height * PX / 2;
        yawNode.rotation.y = yaw;
        instance.root.position.set((transform.dx || 0) * PX, -(transform.dy || 0) * PX, 0);
        instance.root.scale.set(transform.scaleX, transform.scaleY, transform.scaleX);
        instance.pose(pose, { time: f.puppet.time, dt, motion: f.puppet.motion, grounded: f.isGrounded && !transform.rotate });
    }

    sync(dt) {
        const f = this.fighter, sm = f.stateMachine;
        const hidden = f.isHidden();
        this.holder.visible = !hidden;
        this.shield.visible = !hidden && sm.isShielding();
        this.stars.visible = !hidden && sm.is(S.DIZZY);
        if (hidden) { for (const g of this.ghosts) g.holder.visible = false; return; }

        const pose = f.puppet.show(f.currentPose());
        const transform = f.poseTransform();
        const k = 1 - Math.exp(-dt * 14);
        this.yaw += (facingYaw(f.facingRight) - this.yaw) * k;
        let yaw = this.yaw;
        const attack = f.currentAttack;
        if (attack?.anim.spin && attack.phaseAt(f.attackFrame) === AttackPhase.ACTIVE) yaw += f.attackFrame * (Math.PI / 4);
        this.place(this.instance, this.holder, this.yawNode, { x: f.x, y: f.y, facingRight: f.facingRight, pose, transform }, yaw, dt);
        if (f.shakeFrames > 0) this.holder.position.x += (Math.random() - 0.5) * 0.06;

        const tint = f.overlayTint();
        this.instance.setTint(tint?.color ?? null, tint ? tint.alpha * 1.2 : 0, tint?.rim);
        const blinking = (f.invincible || f.invulnTimer > 0) && Math.floor(sm.stateTime / 3) % 2 === 0;
        this.instance.setOpacity((transform.alpha ?? 1) * (blinking ? 0.55 : 1));

        if (this.shield.visible) {
            const s = Math.max(0.15, f.shieldHP / DEFENSE.shieldMax);
            const r = Math.max(f.width, f.height) * 0.62 * (0.55 + 0.45 * s) * PX;
            this.shield.position.set(this.world.toWorldX(f.centerX), this.world.toWorldY(f.y + f.height * 0.55), 0);
            this.shield.scale.setScalar(r);
            this.shield.material.opacity = 0.26 + 0.08 * Math.sin(sm.stateTime * 0.3);
        }
        if (this.stars.visible) {
            const t = sm.stateTime * 0.12;
            this.stars.position.set(this.world.toWorldX(f.centerX), this.world.toWorldY(f.y - 12), 0);
            this.stars.children.forEach((star, i) => {
                const a = t + (i * Math.PI * 2) / 3;
                star.position.set(Math.cos(a) * 0.3, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.3);
                star.rotation.y = a * 2;
            });
        }
        this.syncGhosts(dt);
    }

    /** Afterimages for fast moves: faint copies along the fighter's recent path. */
    syncGhosts(dt) {
        const trail = this.fighter.trail;
        const count = Math.min(GHOSTS, Math.max(0, trail.length - 1));
        while (this.ghosts.length < count) this.ghosts.push(this.makeGhost());
        this.ghosts.forEach((g, i) => {
            g.holder.visible = i < count;
            if (!g.holder.visible) return;
            const snap = trail[i];
            g.material.opacity = 0.12 + 0.08 * i;
            this.place(g.instance, g.holder, g.yawNode, snap, facingYaw(snap.facingRight), dt);
            this.pushBack(g.holder, GHOST_DEPTH + 0.05 * (count - 1 - i));
        });
    }

    /** Move a placed model away from the camera, scaled so it still covers the same pixels. */
    pushBack(holder, depth) {
        const cam = this.world.camera.position, k = (cam.z + depth) / cam.z;
        holder.position.set(cam.x + (holder.position.x - cam.x) * k, cam.y + (holder.position.y - cam.y) * k, -depth);
        holder.scale.setScalar(k);
    }

    makeGhost() {
        const instance = createInstance(this.template);
        const material = new THREE.MeshBasicMaterial({ color: this.fighter.accentColor, transparent: true, opacity: 0.15, depthWrite: false });
        for (const m of instance.meshes) { m.material = material; m.castShadow = false; m.receiveShadow = false; }
        const holder = new THREE.Group(), yawNode = new THREE.Group();
        holder.add(yawNode);
        yawNode.add(instance.root);
        this.world.scene.add(holder);
        return { instance, holder, yawNode, material };
    }
}

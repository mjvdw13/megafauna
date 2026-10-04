// ============================================================================
// PHYSICS
// Gravity, friction, platforms and body-to-body separation.
// Configured per stage so maps can feel different (ice, low gravity, ...).
//
// A stage layout has one solid main platform (with a ledge at each end and
// solid ground beneath it) and any number of thin platforms you can jump up
// through and drop down through. Beyond the main platform's edges is a pit.
// ============================================================================
import { PHYSICS_DEFAULTS, SCREEN, STAGE_DEFAULTS } from '../config.js';

const DEFAULT_MAX_FALL = 14;
const FAST_FALL_SPEED = 19;
const AIR_FRICTION = 0.985;
/** A body counts as standing on a platform while its center is this far past the edge. */
const EDGE_GRACE = 6;

/** A default layout: a main platform spanning most of the screen. */
export function defaultLayout(groundY = STAGE_DEFAULTS.groundY) {
    return { main: { left: 200, right: SCREEN.width - 200, y: groundY }, platforms: [] };
}

export class Physics {
    constructor(stage = {}) {
        this.configure(stage);
    }

    configure({ physics = {}, layout = defaultLayout() } = {}) {
        this.gravity = physics.gravity ?? PHYSICS_DEFAULTS.gravity;
        this.friction = physics.friction ?? PHYSICS_DEFAULTS.friction;
        this.main = { ...layout.main, solid: true };
        this.platforms = (layout.platforms || []).map((p) => ({ ...p, solid: false }));
        this.surfaces = [this.main, ...this.platforms];
    }

    /** Is this x over the main platform? */
    overMain(x) { return x >= this.main.left && x <= this.main.right; }

    update(body) {
        if (body.anchored) { body.velocityX = 0; body.velocityY = 0; body.justLanded = false; return; }
        const wasGrounded = body.isGrounded;
        const feetBefore = body.y + body.height;

        if (!body.isGrounded) {
            body.velocityY += this.gravity * (body.gravityScale ?? 1);
            const maxFall = body.fastFalling ? FAST_FALL_SPEED : (body.maxFallSpeed ?? DEFAULT_MAX_FALL);
            if (body.velocityY > maxFall) body.velocityY = maxFall;
            if (!body.keepAirMomentum) body.velocityX *= AIR_FRICTION;
        } else {
            body.velocityX *= this.friction;
            if (Math.abs(body.velocityX) < 0.1) body.velocityX = 0;
        }
        body.x += body.velocityX;
        body.y += body.velocityY;
        if (body.dropTimer > 0) body.dropTimer--;

        const centerX = body.x + body.width / 2;
        const feet = body.y + body.height;
        let landed = null;
        if (body.isGrounded && body.ground && body.velocityY >= 0) {
            // Still on the same surface? Walking or sliding past its end drops you off.
            const g = body.ground;
            if (centerX >= g.left - EDGE_GRACE && centerX <= g.right + EDGE_GRACE) landed = g;
        } else if (body.velocityY >= 0) {
            for (const s of this.surfaces) {
                if (!s.solid && (body.dropTimer > 0 || body.passThrough)) continue;
                if (centerX < s.left - EDGE_GRACE || centerX > s.right + EDGE_GRACE) continue;
                if (feetBefore <= s.y + 1 && feet >= s.y) { landed = s; break; }
            }
        }
        // Liquids some fighters can float on (Quackers on water).
        if (!landed && body.floatSurface && body.velocityY >= 0) {
            const w = body.floatSurface;
            if (!this.overMain(centerX) && feetBefore <= w.y + 1 && feet >= w.y) landed = w;
        }

        if (landed) {
            body.y = landed.y - body.height;
            body.velocityY = 0;
            body.isGrounded = true;
            body.ground = landed;
        } else {
            body.isGrounded = false;
            body.ground = null;
        }
        body.justLanded = body.isGrounded && !wasGrounded;
        if (body.justLanded) body.fastFalling = false;
        this.pushOutOfMain(body);
    }

    /** The main platform is solid all the way down: bodies beside or under it are pushed out sideways. */
    pushOutOfMain(body) {
        const m = this.main;
        if (body.y + body.height <= m.y + 2) return;
        const right = body.x + body.width;
        if (right <= m.left || body.x >= m.right) return;
        const centerX = body.x + body.width / 2;
        if (centerX < (m.left + m.right) / 2) body.x = m.left - body.width;
        else body.x = m.right;
        if (Math.sign(body.velocityX) === (centerX < (m.left + m.right) / 2 ? 1 : -1)) body.velocityX = 0;
    }

    /** Push grounded bodies apart. Airborne bodies may pass over each other (cross-ups). */
    resolveCollision(a, b) {
        if (!a.isGrounded || !b.isGrounded || a.ground !== b.ground) return;
        if (a.anchored || b.anchored) return;
        const aCenter = a.x + a.width / 2;
        const bCenter = b.x + b.width / 2;
        const dist = Math.abs(aCenter - bCenter);
        const minDist = (a.width / 2 + b.width / 2) * 0.8;
        if (dist >= minDist) return;
        const push = (minDist - dist) / 2;
        const [left, right] = aCenter < bCenter ? [a, b] : [b, a];
        left.x -= push;
        right.x += push;
    }
}

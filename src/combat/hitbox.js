// ============================================================================
// HITBOX SYSTEM
// Boxes are authored in a fighter's local space as if facing right, with the
// origin at the top-left of the body. toWorldBox mirrors them when facing left.
// ============================================================================

/** Hurtboxes for an 80x120 body. Characters with other shapes provide their own. */
export const DEFAULT_HURTBOXES = Object.freeze({
    standing: { x: 20, y: 10, width: 60, height: 110 },
    crouching: { x: 20, y: 50, width: 60, height: 70 },
    airborne: { x: 25, y: 15, width: 50, height: 100 }
});

export function toWorldBox(body, box) {
    const x = body.facingRight ? body.x + box.x : body.x + body.width - box.x - box.width;
    return { x, y: body.y + box.y, width: box.width, height: box.height };
}

export function checkBoxCollision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

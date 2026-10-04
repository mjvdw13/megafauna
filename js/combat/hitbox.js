// ============================================================================
// HITBOX SYSTEM
// ============================================================================
const StandardHurtboxes = {
    standing: { x: 20, y: 10, width: 60, height: 110 },
    crouching: { x: 20, y: 50, width: 60, height: 70 },
    jumping: { x: 25, y: 15, width: 50, height: 100 }
};

const AttackHitboxes = {
    lightPunch: { x: 60, y: 30, width: 50, height: 30 },
    heavyPunch: { x: 55, y: 25, width: 70, height: 40 },
    crouchLight: { x: 50, y: 90, width: 55, height: 25 },
    crouchHeavy: { x: 40, y: 85, width: 80, height: 30 },
    airLight: { x: 55, y: 40, width: 45, height: 35 },
    airHeavy: { x: 40, y: 30, width: 60, height: 60 }
};

function checkBoxCollision(box1, box2) {
    return box1.x < box2.x + box2.width &&
           box1.x + box1.width > box2.x &&
           box1.y < box2.y + box2.height &&
           box1.y + box1.height > box2.y;
}

// ============================================================================
// PHYSICS
// ============================================================================
class Physics {
    constructor() {
        this.gravity = 0.8;
        this.groundFriction = 0.85;
        this.stageLeft = 50;
        this.stageRight = 1230;
        this.groundY = 550;
    }

    update(char) {
        if (!char.isGrounded) char.velocityY += this.gravity;
        if (char.isGrounded) { char.velocityX *= this.groundFriction; if (Math.abs(char.velocityX) < 0.1) char.velocityX = 0; }
        char.x += char.velocityX;
        char.y += char.velocityY;
        if (char.y + char.height >= this.groundY) { char.y = this.groundY - char.height; char.velocityY = 0; char.isGrounded = true; }
        else char.isGrounded = false;
        if (char.x < this.stageLeft) { char.x = this.stageLeft; char.velocityX = 0; }
        if (char.x + char.width > this.stageRight) { char.x = this.stageRight - char.width; char.velocityX = 0; }
    }

    resolveCollision(c1, c2) {
        // Only push apart when both are grounded - allow jumping over each other
        if (!c1.isGrounded || !c2.isGrounded) return;

        const c1Center = c1.x + c1.width / 2, c2Center = c2.x + c2.width / 2;
        const dist = Math.abs(c1Center - c2Center);
        const minDist = (c1.width / 2 + c2.width / 2) * 0.8;
        if (dist < minDist) {
            const push = (minDist - dist) / 2;
            if (c1Center < c2Center) { c1.x -= push; c2.x += push; }
            else { c1.x += push; c2.x -= push; }
            if (c1.x < this.stageLeft) c1.x = this.stageLeft;
            if (c2.x < this.stageLeft) c2.x = this.stageLeft;
            if (c1.x + c1.width > this.stageRight) c1.x = this.stageRight - c1.width;
            if (c2.x + c2.width > this.stageRight) c2.x = this.stageRight - c2.width;
        }
    }
}

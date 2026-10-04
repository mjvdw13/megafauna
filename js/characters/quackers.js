// ============================================================================
// QUACKERS (DUCK)
// ============================================================================
class Quackers extends Character {
    constructor(config = {}) {
        super({ name: 'Quackers', walkSpeed: 4, jumpForce: 18, weight: 1.2, color: '#f1c40f', ...config });
        this.canDoubleJump = true;
        if (this.pixelArt) this.animator = new SpriteAnimator('quackers', this.pixelArt);
        this.initSpecialMoves();
    }

    initSpecialMoves() {
        this.attacks.special1 = new Attack({ name: 'Feather Fury', damage: 4, startup: 8, active: 12, recovery: 16, hitstun: 10, blockstun: 6, knockback: 20, hitbox: { x: 50, y: 20, width: 60, height: 70 } });
        this.attacks.special2 = new Attack({ name: 'Aerial Ace', damage: 13, startup: 6, active: 8, recovery: 14, hitstun: 20, blockstun: 14, knockback: 80, hitbox: { x: 40, y: 30, width: 80, height: 50 } });
        this.attacks.special3 = new Attack({ name: 'Quack Attack', damage: 18, startup: 14, active: 4, recovery: 20, hitstun: 28, blockstun: 20, knockback: 120, hitbox: { x: 40, y: 10, width: 50, height: 80 } });
        this.attacks.heavyAir = new Attack({ name: 'Dive Bomb', damage: 14, startup: 5, active: 10, recovery: 6, hitstun: 22, blockstun: 16, knockback: 70, launchHeight: 8, hitbox: { x: 20, y: 30, width: 60, height: 90 } });
    }

    update(input, opponent) {
        if ((this.stateMachine.canAct() || this.stateMachine.stateData.canCancel) && input.specialPressed) {
            let specialKey = 'special1';
            if (input.horizontal > 0 === this.facingRight) specialKey = 'special2';
            else if (input.horizontal !== 0) specialKey = 'special3';
            this.stateMachine.setState(CharacterStates.ATTACKING);
            this.startAttack(specialKey);
            if (specialKey === 'special2' && this.isGrounded) { this.velocityY = -5; this.isGrounded = false; }
        }
        if (this.currentAttack && this.currentAttack.name === 'Aerial Ace') {
            if (this.attackFrame >= this.currentAttack.startup && this.attackFrame < this.currentAttack.startup + this.currentAttack.active) {
                this.velocityX = 10 * (this.facingRight ? 1 : -1);
                this.velocityY = -2;
            }
        }
        super.update(input, opponent);
    }

    render(ctx) {
        if (this.renderSprite(ctx)) {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Quackers', this.x + this.width / 2, this.y - 10);
            return;
        }
        this.renderFallback(ctx);
    }

    renderFallback(ctx) {
        const color = this.getStateColor();
        ctx.fillStyle = color;
        ctx.fillRect(this.x + 5, this.y + 20, this.width - 10, this.height - 20);
        ctx.fillRect(this.x + 15, this.y, this.width - 30, 40);
        ctx.fillStyle = '#e67e22';
        const beakX = this.facingRight ? this.x + 55 : this.x - 5;
        ctx.fillRect(beakX, this.y + 20, 30, 15);
        ctx.fillStyle = '#fff';
        const eyeX = this.facingRight ? this.x + 50 : this.x + 20;
        ctx.beginPath(); ctx.arc(eyeX, this.y + 15, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(eyeX + (this.facingRight ? 2 : -2), this.y + 15, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d4ac0d';
        ctx.fillRect(this.x - 5, this.y + 50, 15, 30);
        ctx.fillRect(this.x + this.width - 10, this.y + 50, 15, 30);
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(this.x + 15, this.y + this.height - 5, 20, 10);
        ctx.fillRect(this.x + 45, this.y + this.height - 5, 20, 10);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Quackers', this.x + this.width / 2, this.y - 10);
    }
}

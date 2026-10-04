// ============================================================================
// RILEY (DOG)
// ============================================================================
class Riley extends Character {
    constructor(config = {}) {
        super({ name: 'Riley', walkSpeed: 5, jumpForce: 20, weight: 1.0, color: '#c0392b', ...config });
        this.canDoubleJump = false;
        if (this.pixelArt) this.animator = new SpriteAnimator('riley', this.pixelArt);
        this.initSpecialMoves();
    }

    initSpecialMoves() {
        this.attacks.special1 = new Attack({ name: 'Bark Blast', damage: 8, startup: 12, active: 1, recovery: 15, hitstun: 15, blockstun: 10, knockback: 40, hitbox: { x: 80, y: 40, width: 40, height: 30 } });
        this.attacks.special2 = new Attack({ name: 'Pounce Strike', damage: 15, startup: 10, active: 6, recovery: 18, hitstun: 24, blockstun: 16, knockback: 100, hitbox: { x: 40, y: 20, width: 80, height: 60 } });
        this.attacks.special3 = new Attack({ name: 'Tail Tornado', damage: 10, startup: 8, active: 10, recovery: 14, hitstun: 18, blockstun: 12, knockback: 60, hitbox: { x: -20, y: 30, width: 120, height: 60 } });
        this.attacks.heavyStand = new Attack({ name: 'Headbutt', damage: 12, startup: 10, active: 4, recovery: 14, hitstun: 22, blockstun: 14, knockback: 90, hitbox: { x: 50, y: 15, width: 60, height: 50 } });
    }

    update(input, opponent) {
        if ((this.stateMachine.canAct() || this.stateMachine.stateData.canCancel) && input.specialPressed) {
            let specialKey = 'special1';
            if (input.horizontal > 0 === this.facingRight) specialKey = 'special2';
            else if (input.horizontal !== 0) specialKey = 'special3';
            this.stateMachine.setState(CharacterStates.ATTACKING);
            this.startAttack(specialKey);
        }
        if (this.currentAttack && this.currentAttack.name === 'Pounce Strike') {
            if (this.attackFrame >= this.currentAttack.startup && this.attackFrame < this.currentAttack.startup + this.currentAttack.active) {
                this.velocityX = 12 * (this.facingRight ? 1 : -1);
            }
        }
        super.update(input, opponent);
    }

    render(ctx) {
        if (this.renderSprite(ctx)) {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Riley', this.x + this.width / 2, this.y - 10);
            return;
        }
        this.renderFallback(ctx);
    }

    renderFallback(ctx) {
        const color = this.getStateColor();
        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        const earX = this.facingRight ? this.x + 50 : this.x + 10;
        ctx.fillRect(earX, this.y - 15, 20, 20);
        ctx.fillRect(earX + 25, this.y - 15, 20, 20);
        ctx.fillStyle = '#a93226';
        const snoutX = this.facingRight ? this.x + 60 : this.x - 10;
        ctx.fillRect(snoutX, this.y + 30, 30, 25);
        ctx.fillStyle = '#fff';
        const eyeX = this.facingRight ? this.x + 55 : this.x + 15;
        ctx.beginPath(); ctx.arc(eyeX, this.y + 20, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(eyeX + (this.facingRight ? 2 : -2), this.y + 20, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Riley', this.x + this.width / 2, this.y - 25);
    }
}

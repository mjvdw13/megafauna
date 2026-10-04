// ============================================================================
// BASE CHARACTER CLASS
// ============================================================================
class Character {
    constructor(config = {}) {
        this.name = config.name || 'Character';
        this.playerNumber = config.playerNumber || 1;
        this.x = config.x || 200;
        this.y = config.y || 430;
        this.width = config.width || 80;
        this.height = config.height || 120;
        this.velocityX = 0;
        this.velocityY = 0;
        this.walkSpeed = config.walkSpeed || 5;
        this.jumpForce = config.jumpForce || 14;
        this.airControl = config.airControl || 0.3;
        this.weight = config.weight || 1.0;
        this.isGrounded = true;
        this.facingRight = config.facingRight !== undefined ? config.facingRight : true;
        this.invincible = false;
        this.canDoubleJump = config.canDoubleJump || false;
        this.hasDoubleJumped = false;
        this.maxHealth = config.maxHealth || 100;
        this.health = this.maxHealth;
        this.stateMachine = new CharacterStateMachine(this);
        this.attacks = { ...StandardAttacks };
        this.currentAttack = null;
        this.attackFrame = 0;
        this.hitThisAttack = false;
        this.color = config.color || '#3498db';
        this.comboHitCount = 0;
        this.pixelArt = config.pixelArt || null;
        this.animator = null;
    }

    update(input, opponent) {
        this.stateMachine.update(input);
        if (this.stateMachine.isAttacking()) this.updateAttack(input, opponent);
        if (this.stateMachine.canAct() && opponent) this.facingRight = this.x < opponent.x;
        if (this.animator) this.animator.update();
    }

    startAttack(attackKey) {
        const attack = this.attacks[attackKey];
        if (!attack) return false;
        this.currentAttack = attack;
        this.attackFrame = 0;
        this.hitThisAttack = false;
        return true;
    }

    updateAttack(input, opponent) {
        if (!this.currentAttack) { this.stateMachine.stateData.attackComplete = true; return; }
        this.attackFrame++;
        if (this.currentAttack.isHitboxActive(this.attackFrame) && !this.hitThisAttack) {
            if (opponent && this.checkHit(opponent)) { this.onHit(opponent); this.hitThisAttack = true; }
        }
        if (this.attackFrame >= this.currentAttack.getTotalFrames()) {
            this.stateMachine.stateData.attackComplete = true;
            this.currentAttack = null;
            this.attackFrame = 0;
        }
    }

    checkHit(opponent) {
        if (!this.currentAttack || opponent.invincible) return false;
        const hitbox = this.getAttackHitbox();
        const hurtbox = opponent.getHurtbox();
        return checkBoxCollision(hitbox, hurtbox);
    }

    onHit(opponent) {
        const attack = this.currentAttack;
        const isBlocking = opponent.stateMachine.isBlocking();
        let blocked = false;
        if (isBlocking) {
            const standBlocking = opponent.stateMachine.stateData.standing;
            if (attack.type === 'low' && standBlocking) blocked = false;
            else if (attack.type === 'high' && !standBlocking) blocked = false;
            else blocked = true;
        }
        // Calculate hit position for effects
        const hitX = (this.x + this.width / 2 + opponent.x + opponent.width / 2) / 2;
        const hitY = opponent.y + opponent.height / 3;
        if (blocked) {
            opponent.takeDamage(attack.chipDamage);
            opponent.stateMachine.stateData.blockstunFrames = attack.blockstun;
            if (window.game) window.game.addHitEffect(hitX, hitY, 'block');
        } else {
            const comboHit = opponent.stateMachine.isInHitstun() ? opponent.comboHitCount + 1 : 1;
            const scaling = Math.max(0.3, 1 - (comboHit - 1) * 0.1);
            opponent.takeDamage(Math.floor(attack.damage * scaling));
            opponent.comboHitCount = comboHit;
            opponent.applyHitstun(attack.hitstun);
            const direction = this.facingRight ? 1 : -1;
            opponent.velocityX = attack.knockback * direction * opponent.weight;
            opponent.velocityY = attack.launchHeight || 0;
            const effectType = attack.damage >= 10 ? 'heavy' : 'hit';
            if (window.game) window.game.addHitEffect(hitX, hitY, effectType);
        }
        return !blocked;
    }

    takeDamage(amount) { this.health = Math.max(0, this.health - amount); }
    applyHitstun(frames) { this.stateMachine.setState(CharacterStates.HITSTUN, { stunFrames: frames }); }

    getHurtbox() {
        let template = StandardHurtboxes.standing;
        if (this.stateMachine.isCrouching()) template = StandardHurtboxes.crouching;
        else if (this.stateMachine.isAirborne()) template = StandardHurtboxes.jumping;
        return { x: this.x + template.x, y: this.y + template.y, width: template.width, height: template.height };
    }

    getAttackHitbox() {
        if (!this.currentAttack) return null;
        const hitbox = this.currentAttack.hitbox;
        let x = this.x + hitbox.x;
        if (!this.facingRight) x = this.x + this.width - hitbox.x - hitbox.width;
        return { x, y: this.y + hitbox.y, width: hitbox.width, height: hitbox.height };
    }

    reset(x, facingRight) {
        this.x = x; this.y = 430; this.velocityX = 0; this.velocityY = 0;
        this.health = this.maxHealth; this.isGrounded = true; this.facingRight = facingRight;
        this.invincible = false; this.hasDoubleJumped = false;
        this.currentAttack = null; this.attackFrame = 0; this.hitThisAttack = false; this.comboHitCount = 0;
        this.stateMachine = new CharacterStateMachine(this);
        if (this.animator) this.animator.setAnimation('idle');
    }

    getStateColor() {
        const state = this.stateMachine.currentState;
        if (state === CharacterStates.BLOCKING) return '#3498db';
        if (state === CharacterStates.ATTACKING) return '#e74c3c';
        if (state === CharacterStates.HITSTUN) return '#f39c12';
        if (state === CharacterStates.KNOCKDOWN || state === CharacterStates.GETUP) return '#9b59b6';
        return this.color;
    }

    renderStateTint(ctx) {
        const state = this.stateMachine.currentState;
        let tint = null;
        if (state === CharacterStates.BLOCKING) tint = 'rgba(52,152,219,0.3)';
        else if (state === CharacterStates.HITSTUN) tint = 'rgba(243,156,18,0.3)';
        else if (state === CharacterStates.KNOCKDOWN || state === CharacterStates.GETUP) tint = 'rgba(155,89,182,0.3)';
        if (this.invincible) tint = 'rgba(255,255,255,0.4)';
        if (tint) { ctx.fillStyle = tint; ctx.fillRect(this.x, this.y, this.width, this.height); }
    }

    renderSprite(ctx) {
        const sprite = this.animator ? this.animator.getCurrentSprite() : null;
        if (!sprite) return false;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (!this.facingRight) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }
        ctx.restore();
        this.renderStateTint(ctx);
        return true;
    }

    isDead() { return this.health <= 0; }
}

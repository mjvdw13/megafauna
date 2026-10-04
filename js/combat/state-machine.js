// ============================================================================
// CHARACTER STATE MACHINE
// ============================================================================
class CharacterStateMachine {
    constructor(character) {
        this.character = character;
        this.currentState = CharacterStates.IDLE;
        this.stateTime = 0;
        this.stateData = {};
    }

    setState(newState, data = {}) {
        if (!this.canTransitionTo(newState)) return false;
        this.currentState = newState;
        this.stateTime = 0;
        this.stateData = data;
        this.onStateEnter(newState);
        if (this.character.animator) this.character.animator.setAnimation(newState);
        return true;
    }

    canTransitionTo(newState) {
        if ([CharacterStates.HITSTUN, CharacterStates.KNOCKDOWN, CharacterStates.VICTORY, CharacterStates.DEFEAT].includes(newState)) return true;
        // Can exit ATTACKING if attack is complete OR if canCancel is set
        if (this.currentState === CharacterStates.ATTACKING && !this.stateData.canCancel && !this.stateData.attackComplete) return false;
        if (this.currentState === CharacterStates.HITSTUN && this.stateTime < this.stateData.stunFrames) return false;
        if (this.currentState === CharacterStates.KNOCKDOWN && this.stateTime < (this.stateData.knockdownFrames || 45)) return false;
        if (this.currentState === CharacterStates.GETUP && this.stateTime < (this.stateData.getupFrames || 30)) return false;
        if ([CharacterStates.VICTORY, CharacterStates.DEFEAT].includes(this.currentState)) return false;
        return true;
    }

    onStateEnter(state) {
        if (state === CharacterStates.JUMPING) {
            this.character.velocityY = -this.character.jumpForce;
            this.character.isGrounded = false;
        } else if (state === CharacterStates.GETUP) {
            this.stateData.getupFrames = 30;
            this.character.invincible = true;
        } else if (state === CharacterStates.KNOCKDOWN) {
            this.stateData.knockdownFrames = 45;
        }
    }

    update(input) {
        this.stateTime++;
        const state = this.currentState;

        if (state === CharacterStates.IDLE) {
            if (input.upPressed) { this.setState(CharacterStates.JUMPING); return; }
            if (input.down) { this.setState(CharacterStates.CROUCHING); return; }
            if (input.horizontal !== 0) { this.setState(CharacterStates.WALKING); return; }
            if (this.isHoldingBack(input)) { this.setState(CharacterStates.BLOCKING, { standing: true }); return; }
        } else if (state === CharacterStates.WALKING) {
            if (input.upPressed) { this.setState(CharacterStates.JUMPING); return; }
            if (input.down) { this.setState(CharacterStates.CROUCHING); return; }
            if (input.horizontal === 0) { this.setState(CharacterStates.IDLE); return; }
            this.character.velocityX = input.horizontal * this.character.walkSpeed;
            if (input.horizontal > 0) this.character.facingRight = true;
            else if (input.horizontal < 0) this.character.facingRight = false;
        } else if (state === CharacterStates.CROUCHING) {
            if (!input.down) { this.setState(CharacterStates.IDLE); return; }
            if (this.isHoldingBack(input)) { this.setState(CharacterStates.BLOCKING, { standing: false }); return; }
        } else if (state === CharacterStates.JUMPING) {
            if (input.horizontal !== 0) this.character.velocityX += input.horizontal * this.character.airControl;
            if (this.character.velocityY >= 0) { this.setState(CharacterStates.FALLING); return; }
            if (input.upPressed && this.character.canDoubleJump && !this.character.hasDoubleJumped) {
                this.character.velocityY = -this.character.jumpForce * 0.85;
                this.character.hasDoubleJumped = true;
            }
        } else if (state === CharacterStates.FALLING) {
            if (input.horizontal !== 0) this.character.velocityX += input.horizontal * this.character.airControl;
            if (input.upPressed && this.character.canDoubleJump && !this.character.hasDoubleJumped) {
                this.character.velocityY = -this.character.jumpForce * 0.85;
                this.character.hasDoubleJumped = true;
                this.setState(CharacterStates.JUMPING);
                return;
            }
            if (this.character.isGrounded) { this.character.hasDoubleJumped = false; this.setState(CharacterStates.IDLE); return; }
        } else if (state === CharacterStates.ATTACKING) {
            if (this.stateData.attackComplete) {
                if (!this.character.isGrounded) this.setState(CharacterStates.FALLING);
                else if (input.down) this.setState(CharacterStates.CROUCHING);
                else this.setState(CharacterStates.IDLE);
            }
        } else if (state === CharacterStates.BLOCKING) {
            if (!this.isHoldingBack(input)) {
                if (input.down) this.setState(CharacterStates.CROUCHING);
                else this.setState(CharacterStates.IDLE);
                return;
            }
            this.stateData.standing = !input.down;
        } else if (state === CharacterStates.HITSTUN) {
            if (this.stateTime >= this.stateData.stunFrames) this.setState(CharacterStates.IDLE);
        } else if (state === CharacterStates.KNOCKDOWN) {
            if (this.stateTime >= this.stateData.knockdownFrames) this.setState(CharacterStates.GETUP);
        } else if (state === CharacterStates.GETUP) {
            if (this.stateTime >= this.stateData.getupFrames) { this.character.invincible = false; this.setState(CharacterStates.IDLE); }
        }
    }

    isHoldingBack(input) {
        return this.character.facingRight ? input.left : input.right;
    }

    isIdle() { return this.currentState === CharacterStates.IDLE; }
    isWalking() { return this.currentState === CharacterStates.WALKING; }
    isCrouching() { return this.currentState === CharacterStates.CROUCHING; }
    isAttacking() { return this.currentState === CharacterStates.ATTACKING; }
    isBlocking() { return this.currentState === CharacterStates.BLOCKING; }
    isInHitstun() { return this.currentState === CharacterStates.HITSTUN; }
    isAirborne() { return this.currentState === CharacterStates.JUMPING || this.currentState === CharacterStates.FALLING; }
    canAct() { return [CharacterStates.IDLE, CharacterStates.WALKING, CharacterStates.CROUCHING].includes(this.currentState); }
}

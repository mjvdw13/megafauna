// ============================================================================
// SPRITE ANIMATOR
// ============================================================================
class SpriteAnimator {
    constructor(charName, pixelArt) {
        this.charName = charName;
        this.pixelArt = pixelArt;
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.animations = {
            idle:{speed:30,loop:true}, walking:{speed:8,loop:true},
            crouching:{speed:1,loop:false}, jumping:{speed:1,loop:false},
            falling:{speed:1,loop:false}, attacking:{speed:6,loop:false},
            blocking:{speed:1,loop:false}, hitstun:{speed:4,loop:true},
            knockdown:{speed:1,loop:false}, getup:{speed:15,loop:false},
            victory:{speed:15,loop:true}, defeat:{speed:1,loop:false}
        };
    }

    setAnimation(stateName) {
        if (this.currentAnimation === stateName) return;
        this.currentAnimation = stateName;
        this.currentFrame = 0;
        this.frameTimer = 0;
    }

    update() {
        const anim = this.animations[this.currentAnimation];
        if (!anim) return;
        const fc = this.pixelArt.getFrameCount(this.charName, this.currentAnimation);
        if (fc <= 1) return;
        this.frameTimer++;
        if (this.frameTimer >= anim.speed) {
            this.frameTimer = 0;
            if (anim.loop) this.currentFrame = (this.currentFrame + 1) % fc;
            else if (this.currentFrame < fc - 1) this.currentFrame++;
        }
    }

    getCurrentSprite() {
        return this.pixelArt.getSprite(this.charName, this.currentAnimation, this.currentFrame);
    }
}

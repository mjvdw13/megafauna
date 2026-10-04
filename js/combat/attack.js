// ============================================================================
// ATTACK DEFINITIONS
// ============================================================================
class Attack {
    constructor(config) {
        this.name = config.name || 'Attack';
        this.damage = config.damage || 5;
        this.chipDamage = config.chipDamage || Math.floor(config.damage * 0.3);
        this.startup = config.startup || 4;
        this.active = config.active || 3;
        this.recovery = config.recovery || 6;
        this.hitstun = config.hitstun || 12;
        this.blockstun = config.blockstun || 8;
        this.knockback = config.knockback || 50;
        this.launchHeight = config.launchHeight || 0;
        this.hitbox = config.hitbox || AttackHitboxes.lightPunch;
        this.type = config.type || 'mid';
        this.animation = config.animation || 'light_stand';
    }
    getTotalFrames() { return this.startup + this.active + this.recovery; }
    isHitboxActive(frame) { return frame >= this.startup && frame < (this.startup + this.active); }
}

const StandardAttacks = {
    lightStand: new Attack({ name: 'Light Punch', damage: 5, startup: 4, active: 3, recovery: 6, hitstun: 12, blockstun: 8, knockback: 30, hitbox: AttackHitboxes.lightPunch }),
    heavyStand: new Attack({ name: 'Heavy Punch', damage: 12, startup: 8, active: 4, recovery: 12, hitstun: 20, blockstun: 14, knockback: 80, hitbox: AttackHitboxes.heavyPunch }),
    lightCrouch: new Attack({ name: 'Low Sweep', damage: 5, startup: 5, active: 3, recovery: 7, hitstun: 12, blockstun: 8, knockback: 25, hitbox: AttackHitboxes.crouchLight, type: 'low' }),
    heavyCrouch: new Attack({ name: 'Sliding Kick', damage: 10, startup: 10, active: 5, recovery: 14, hitstun: 22, blockstun: 16, knockback: 60, hitbox: AttackHitboxes.crouchHeavy, type: 'low' }),
    lightAir: new Attack({ name: 'Air Jab', damage: 5, startup: 4, active: 4, recovery: 8, hitstun: 14, blockstun: 10, knockback: 20, hitbox: AttackHitboxes.airLight }),
    heavyAir: new Attack({ name: 'Diving Strike', damage: 12, startup: 6, active: 5, recovery: 10, hitstun: 18, blockstun: 14, knockback: 50, hitbox: AttackHitboxes.airHeavy })
};

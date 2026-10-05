// ============================================================================
// GARY — the fire-breathing pigeon
// Moves are Smash-style slots (see combat/moveset.js). Damage is before
// Gary's 0.95x power, frame counts before 1.1x attack speed.
//
// Fire moves have `burn`: the opponent keeps taking 1 damage every
// BURN.interval frames for that many ticks, until it burns out or they splash
// into water. Gary is fireproof, so his own flames never burn him.
// ============================================================================
import { garyModel } from './gary-model.js';

export default {
    id: 'gary',
    name: 'Gary',
    species: 'Pigeon',
    tagline: 'Fire breather',
    description: 'Breathes fire. Fire moves set you burning for a few seconds (jump in water to put it out). Fireproof, and he can flap twice in the air.',
    color: '#e8641e',
    accentColor: '#ffb02e',

    stats: {
        maxHealth: 92,
        walkSpeed: 5.0,
        runSpeed: 8.4,
        jumpForce: 16,
        airJumps: 2,        // flap, flap
        airJumpForce: 14,
        airControl: 0.5,
        airSpeed: 5.6,
        fallSpeed: 11,
        weight: 0.9,
        power: 0.95,
        attackSpeed: 1.1
    },
    abilities: { fireproof: true },

    // A plump little bird: shorter than the mammals, a bit longer than Quackers.
    body: {
        width: 84,
        height: 100,
        hurtboxes: {
            standing: { x: 14, y: 8, width: 58, height: 92 },
            crouching: { x: 10, y: 42, width: 66, height: 58 },
            airborne: { x: 16, y: 10, width: 54, height: 80 }
        }
    },
    model: garyModel,
    landSquash: 0.16,

    // Hitboxes are authored for the 100px body. The beak is about 80px in and 20px down.
    moves: {
        // ---- Ground
        jab: { name: 'Pigeon Peck', damage: 3, startup: 3, active: 2, recovery: 6, hitstun: 10, knockback: 14, hitbox: { x: 64, y: 8, width: 46, height: 30 }, chain: 'jab2' },
        jab2: { name: 'Double Peck', damage: 3, startup: 3, active: 2, recovery: 7, hitstun: 11, knockback: 16, hitbox: { x: 64, y: 8, width: 48, height: 32 }, chain: 'jab3', strength: 'light' },
        jab3: {
            name: 'Spark Peck', damage: 5, startup: 5, active: 3, recovery: 14, hitstun: 18, knockback: 62, launch: 4, burn: 1,
            hitbox: { x: 62, y: 4, width: 54, height: 40 }, strength: 'heavy', vfx: 'firepuff', poses: { active: 'breath' }
        },
        ftilt: { name: 'Wing Clap', damage: 8, startup: 7, active: 3, recovery: 12, hitstun: 17, blockstun: 10, knockback: 70, hitbox: { x: 52, y: 20, width: 68, height: 50 }, poses: { active: 'wing_clap' } },
        utilt: { name: 'Head Flick', damage: 6, startup: 5, active: 4, recovery: 9, hitstun: 16, knockback: 12, launch: 10, hitbox: { x: 16, y: -30, width: 64, height: 50 }, vfx: 'uppercut', poses: { active: 'beak_up' } },
        dtilt: { name: 'Toe Tap', damage: 5, startup: 4, active: 3, recovery: 8, hitstun: 14, knockback: 28, launch: 3, hitbox: { x: 44, y: 72, width: 70, height: 28 }, pose: 'crouch', vfx: 'sweep' },
        dashAttack: {
            name: 'Pigeon Rush', damage: 9, startup: 6, active: 10, recovery: 14, hitstun: 18, knockback: 66, launch: 4,
            hitbox: { x: 30, y: 16, width: 76, height: 66 }, movement: { active: { vx: 9 } }, afterimages: true, vfx: 'feathers', poses: { active: 'rush' }
        },

        // ---- Smash attacks (hold to charge)
        fsmash: {
            name: 'Inferno Blast', damage: 14, startup: 14, active: 6, recovery: 22, hitstun: 26, blockstun: 14, knockback: 120, launch: 6, burn: 4,
            hitbox: { x: 66, y: -10, width: 104, height: 72 }, vfx: 'fireblast', sfx: 'fire', hitstop: 12,
            poses: { startup: 'breath_windup', active: 'breath' }, anim: { lean: 9, lunge: 6 }
        },
        usmash: { name: 'Pop-Up Peck', damage: 13, startup: 10, active: 5, recovery: 20, hitstun: 24, knockback: 18, launch: 15, hitbox: { x: 6, y: -50, width: 76, height: 70 }, vfx: 'uppercut', poses: { active: 'beak_up' } },
        dsmash: {
            name: 'Ring of Fire', damage: 12, startup: 11, active: 6, recovery: 22, hitstun: 22, blockstun: 12, knockback: 85, launch: 5, burn: 3,
            hitbox: { x: -72, y: 62, width: 228, height: 38 }, pose: 'crouch', vfx: 'firering', sfx: 'fire', poses: { active: 'puff' }, anim: { lunge: 0 }
        },

        // ---- Aerials
        nair: { name: 'Puff Bump', damage: 8, startup: 4, active: 8, recovery: 10, hitstun: 15, knockback: 45, launch: 4, hitbox: { x: 0, y: 8, width: 84, height: 84 }, vfx: 'feathers', anim: { squash: 0.15, lunge: 4 }, poses: { active: 'puff' } },
        fair: { name: 'Talon Swipe', damage: 10, startup: 7, active: 4, recovery: 12, hitstun: 18, knockback: 72, launch: 3, hitbox: { x: 52, y: 40, width: 56, height: 52 }, poses: { active: 'talons' } },
        bair: { name: 'Tail Fan', damage: 11, startup: 6, active: 4, recovery: 12, hitstun: 18, knockback: 82, launch: 3, hitbox: { x: -40, y: 22, width: 56, height: 46 }, anim: { lunge: -10 }, poses: { active: 'tail_fan' } },
        uair: { name: 'Sky Peck', damage: 8, startup: 5, active: 4, recovery: 10, hitstun: 16, knockback: 16, launch: 11, hitbox: { x: 14, y: -32, width: 58, height: 48 }, vfx: 'uppercut', poses: { active: 'beak_up' } },
        dair: {
            // Goes stiff as a park statue and drops like one.
            name: 'Statue Drop', damage: 12, startup: 8, active: 10, recovery: 10, hitstun: 18, knockback: 30, launch: -11,
            hitbox: { x: 16, y: 50, width: 54, height: 62 }, movement: { active: { vy: 13 } }, landingLag: 14, afterimages: true, poses: { active: 'statue' }
        },

        // ---- Specials
        neutralSpecial: {
            name: 'Fire Breath', damage: 6, startup: 11, active: 1, recovery: 16, hitstun: 16, knockback: 40, launch: 2, burn: 3, hitbox: null,
            projectile: { kind: 'fireball', width: 30, height: 30, speed: 10, life: 48, offset: [40, 22] },
            vfx: 'firepuff', sfx: 'fireball', poses: { startup: 'breath_windup', active: 'breath' }, anim: { lean: 5, lunge: 5 }
        },
        sideSpecial: {
            // Hovers in place and hoses fire forward. Long, so a miss is easy to punish.
            name: 'Flamethrower', damage: 2, rehit: 6, startup: 12, active: 30, recovery: 16, hitstun: 12, blockstun: 6, knockback: 10, burn: 3,
            hitbox: { x: 74, y: -4, width: 150, height: 50 }, movement: { startup: { vy: 0.5 }, active: { vx: 0, vy: 0.5 } },
            endsOnLanding: false, vfx: 'flamethrower', sfx: 'fire', callout: 'FWOOSH!', hitstop: 3, poses: { startup: 'breath_windup', active: 'breath' }, anim: { lean: 6, lunge: 3 }
        },
        upSpecial: {
            name: 'Phoenix Rise', damage: 3, rehit: 5, startup: 4, active: 18, recovery: 12, hitstun: 12, knockback: 6, launch: 8, burn: 2,
            hitbox: { x: -8, y: -24, width: 100, height: 112 }, movement: { start: { vy: -17 }, active: { vy: -6.5 } },
            helpless: true, vfx: 'phoenix', sfx: 'fire', hitstop: 3, poses: { active: 'phoenix' }, anim: { lunge: 0 }
        },
        downSpecial: {
            // Stamps a patch of embers onto the ground in front: whoever steps in gets a hot foot.
            // Only one patch at a time; a new one puts the old one out.
            name: 'Hot Foot', damage: 5, startup: 10, active: 1, recovery: 18, hitstun: 22, knockback: 15, launch: 9, burn: 4, hitbox: null,
            projectile: { kind: 'embers', width: 72, height: 24, speed: 0, gravity: 0.6, rolls: true, life: 300, offset: [56, 88], max: 1 },
            vfx: 'none', sfx: 'fire', poses: { startup: 'stomp_windup', active: 'stomp' }, anim: { lean: 2, lunge: 4 }
        },

        // ---- Grab and throws
        grab: { name: 'Wing Wrap', hitbox: { x: 56, y: 22, width: 44, height: 50 }, poses: { active: 'grab' } },
        pummel: { name: 'Beak Bonk', damage: 2 },
        fthrow: { name: 'Roast', damage: 7, knockback: 85, launch: 6, burn: 3, vfx: 'firepuff', sfx: 'fire' },
        bthrow: { name: 'Flock Off', damage: 10, knockback: 105, launch: 7 },
        uthrow: { name: 'Thermal Lift', damage: 8, knockback: 8, launch: 16, vfx: 'uppercut' },
        dthrow: { name: 'Hot Seat', damage: 7, knockback: 30, launch: 3, knockdown: true, burn: 3, sfx: 'coo', callout: 'COO!' }
    }
};

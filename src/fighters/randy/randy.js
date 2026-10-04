// ============================================================================
// RANDY — the slow, armored triceratops who hits like a landslide
// Moves are Smash-style slots (see combat/moveset.js). Damage is before
// Randy's 1.35x power, frame counts before his 0.8x attack speed.
// ============================================================================
import { randyRig } from './randy-rig.js';

export default {
    id: 'randy',
    name: 'Randy',
    species: 'Triceratops',
    tagline: 'Armored powerhouse',
    description: 'Slow to move and slow to swing, but every hit lands like a landslide. Smash attacks shrug off a hit. Frill Guard counters.',
    color: '#4f8a3c',
    accentColor: '#f2b25c',

    stats: {
        maxHealth: 130,
        walkSpeed: 2.6,
        runSpeed: 5.4,
        jumpForce: 13,
        airJumps: 1,
        airJumpForce: 11,
        airControl: 0.25,
        airSpeed: 3.6,
        fallSpeed: 17,      // drops like a rock
        weight: 1.6,
        power: 1.35,
        attackSpeed: 0.8
    },

    // The biggest body on the roster: hard to miss, hard to move.
    body: {
        width: 150,
        height: 120,
        hurtboxes: {
            standing: { x: 4, y: 6, width: 146, height: 114 },
            crouching: { x: 4, y: 32, width: 148, height: 88 },
            airborne: { x: 8, y: 4, width: 134, height: 106 }
        }
    },
    rig: randyRig,
    landSquash: 0.22,
    heavyFootsteps: true,

    moves: {
        // ---- Ground
        jab: { name: 'Horn Jab', damage: 4, startup: 5, active: 3, recovery: 8, hitstun: 12, knockback: 30, hitbox: { x: 123, y: 8, width: 58, height: 48 }, chain: 'jab2' },
        jab2: { name: 'Horn Hook', damage: 6, startup: 6, active: 3, recovery: 14, hitstun: 18, knockback: 60, launch: 3, hitbox: { x: 118, y: 0, width: 66, height: 56 }, strength: 'heavy' },
        ftilt: { name: 'Frill Slam', damage: 12, startup: 10, active: 4, recovery: 14, hitstun: 22, blockstun: 16, knockback: 105, hitbox: { x: 112, y: -8, width: 82, height: 80 }, hitstop: 12, strength: 'heavy' },
        utilt: { name: 'Horn Lift', damage: 9, startup: 8, active: 5, recovery: 12, hitstun: 18, knockback: 15, launch: 11, hitbox: { x: 90, y: -50, width: 80, height: 80 }, vfx: 'uppercut', poses: { active: 'attack_toss' } },
        dtilt: { name: 'Ground Gouge', damage: 10, startup: 11, active: 5, recovery: 15, hitstun: 22, blockstun: 16, knockback: 70, hitbox: { x: 102, y: 75, width: 96, height: 40 }, knockdown: true, pose: 'crouch', vfx: 'sweep' },
        dashAttack: {
            name: 'Stampede Shoulder', damage: 12, startup: 8, active: 10, recovery: 20, hitstun: 22, knockback: 110, launch: 4,
            hitbox: { x: 100, y: 5, width: 70, height: 90 }, movement: { active: { vx: 8 } }, armor: 1, afterimages: true, vfx: 'charge', poses: { active: 'attack_charge' }
        },

        // ---- Smash attacks (hold to charge; all of them shrug off one hit)
        fsmash: {
            name: 'Triple-Horn Thrust', damage: 16, startup: 15, active: 5, recovery: 24, hitstun: 28, blockstun: 18, knockback: 140, launch: 7,
            hitbox: { x: 110, y: 0, width: 90, height: 70 }, armor: 1, hitstop: 14, poses: { active: 'attack_charge' }
        },
        usmash: {
            name: 'Horn Toss', damage: 13, startup: 10, active: 5, recovery: 22, hitstun: 26, knockback: 30, launch: 15,
            hitbox: { x: 88, y: -48, width: 80, height: 106 }, armor: 1, vfx: 'uppercut', poses: { active: 'attack_toss' }
        },
        dsmash: {
            name: 'Stomp Quake', damage: 11, startup: 16, active: 6, recovery: 18, hitstun: 22, blockstun: 14, knockback: 60, launch: 6,
            hitbox: { x: -75, y: 80, width: 300, height: 40 }, armor: 1, vfx: 'quake', callout: 'STOMP!', hitstop: 12,
            poses: { startup: 'attack_rear', active: 'air_attack' }, anim: { lean: 2, lunge: 0, squash: 0.14 }
        },

        // ---- Aerials
        nair: { name: 'Body Spin', damage: 9, startup: 6, active: 8, recovery: 12, hitstun: 16, knockback: 55, launch: 4, hitbox: { x: -10, y: 10, width: 170, height: 100 }, anim: { spin: true, lunge: 0 } },
        fair: { name: 'Horn Swipe', damage: 12, startup: 9, active: 4, recovery: 14, hitstun: 20, knockback: 90, launch: 4, hitbox: { x: 110, y: 10, width: 80, height: 60 } },
        bair: { name: 'Tail Swat', damage: 13, startup: 8, active: 4, recovery: 14, hitstun: 20, knockback: 100, launch: 4, hitbox: { x: -50, y: 40, width: 70, height: 50 }, anim: { lunge: -10 }, poses: { active: 'tail_swat' } },
        uair: { name: 'Frill Bonk', damage: 10, startup: 7, active: 5, recovery: 12, hitstun: 18, knockback: 20, launch: 11, hitbox: { x: 20, y: -40, width: 100, height: 50 }, vfx: 'uppercut', poses: { active: 'attack_toss' } },
        dair: {
            name: 'Body Slam', damage: 13, startup: 8, active: 6, recovery: 12, hitstun: 20, knockback: 50, launch: -10,
            hitbox: { x: 8, y: 45, width: 146, height: 80 }, movement: { active: { vy: 10 } }, vfx: 'quake', landingLag: 16
        },

        // ---- Specials
        neutralSpecial: {
            name: 'Boulder Kick', damage: 11, startup: 16, active: 1, recovery: 22, hitstun: 22, knockback: 75, launch: 5, hitbox: null,
            projectile: { kind: 'boulder', width: 40, height: 40, speed: 7, vy: -2, gravity: 0.6, rolls: true, life: 110, offset: [100, 70] },
            vfx: 'none', sfx: 'boulder', poses: { startup: 'attack_rear', active: 'attack_strike' }
        },
        sideSpecial: {
            name: 'Horn Charge', damage: 16, startup: 14, active: 14, recovery: 20, hitstun: 26, blockstun: 18, knockback: 140,
            hitbox: { x: 107, y: 5, width: 74, height: 80 }, movement: { active: { vx: 11 } },
            armor: 1, knockdown: true, afterimages: true, vfx: 'charge', endsOnLanding: false,
            poses: { active: 'attack_charge' }, anim: { lean: 10, lunge: 6 }, hitstop: 14
        },
        upSpecial: {
            name: 'Mighty Leap', damage: 10, startup: 8, active: 10, recovery: 12, hitstun: 20, knockback: 70, launch: 9,
            hitbox: { x: 10, y: -30, width: 140, height: 80 }, movement: { start: { vy: -17 }, active: { vy: -5 } },
            armor: 1, helpless: true, vfx: 'uppercut', poses: { startup: 'crouching', active: 'jumping' }
        },
        downSpecial: {
            // Brace behind the frill: a hit during the guard is shrugged off and answered with a big swing.
            name: 'Frill Guard', damage: 0, startup: 4, active: 24, recovery: 16, hitbox: null,
            counter: { into: 'frillCounter' }, vfx: 'none', poses: { active: 'blocking' }, anim: { lean: 2, lunge: 0 }
        },
        frillCounter: {
            name: 'Frill Counter', damage: 15, startup: 2, active: 5, recovery: 20, hitstun: 26, knockback: 130, launch: 8,
            hitbox: { x: 80, y: -20, width: 140, height: 130 }, strength: 'special', vfx: 'slash-large', callout: 'NOPE!', hitstop: 14,
            poses: { active: 'attack_strike' }
        },

        // ---- Grab and throws
        grab: { name: 'Horn Scoop', startup: 7, hitbox: { x: 112, y: 20, width: 60, height: 60 } },
        pummel: { name: 'Horn Poke', damage: 3 },
        fthrow: { name: 'Horn Heave', damage: 10, knockback: 110, launch: 6 },
        bthrow: { name: 'Tail Toss', damage: 11, knockback: 120, launch: 7 },
        uthrow: { name: 'Sky Toss', damage: 9, knockback: 10, launch: 16 },
        dthrow: { name: 'Stomp Down', damage: 8, knockback: 30, launch: 3, knockdown: true, vfx: 'quake' }
    }
};

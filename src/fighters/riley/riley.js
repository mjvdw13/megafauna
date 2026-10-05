// ============================================================================
// RILEY — the balanced dog brawler
// Moves are Smash-style slots (see combat/moveset.js). Damage is before power,
// frame counts before attack speed (both 1.0 for Riley).
// ============================================================================
import { rileyModel } from './riley-model.js';

export default {
    id: 'riley',
    name: 'Riley',
    species: 'Dog',
    tagline: 'Balanced brawler',
    description: 'Good at everything, great at nothing. Fastest runner on the roster. Digs under attacks and pops up swinging.',
    color: '#c0392b',
    accentColor: '#ff7f50',

    stats: {
        maxHealth: 100,
        walkSpeed: 5.5,
        runSpeed: 9.5,     // fastest dash on the roster
        jumpForce: 18,
        airJumps: 1,
        airJumpForce: 16,
        airControl: 0.45,
        airSpeed: 6,
        fallSpeed: 14,
        weight: 1.0,       // knockback resistance (higher = pushed less)
        power: 1.0,        // damage multiplier
        attackSpeed: 1.0   // >1 shortens startup and recovery
    },

    body: { width: 80, height: 120 },
    model: rileyModel,

    moves: {
        // ---- Ground
        jab: { name: 'Paw Jab', damage: 3, startup: 3, active: 2, recovery: 6, hitstun: 10, knockback: 15, hitbox: { x: 60, y: 30, width: 48, height: 28 }, chain: 'jab2' },
        jab2: { name: 'Paw Jab 2', damage: 3, startup: 3, active: 2, recovery: 7, hitstun: 11, knockback: 15, hitbox: { x: 62, y: 28, width: 48, height: 30 }, chain: 'jab3', strength: 'light' },
        jab3: { name: 'Chomp', damage: 5, startup: 5, active: 3, recovery: 14, hitstun: 18, knockback: 60, launch: 4, hitbox: { x: 58, y: 18, width: 52, height: 40 }, strength: 'heavy', sfx: 'chomp', poses: { active: 'bite' } },
        ftilt: { name: 'Headbutt', damage: 9, startup: 9, active: 4, recovery: 13, hitstun: 20, blockstun: 12, knockback: 85, hitbox: { x: 50, y: 15, width: 60, height: 50 }, poses: { active: 'headbutt' } },
        utilt: { name: 'Ear Flick', damage: 6, startup: 5, active: 5, recovery: 9, hitstun: 16, knockback: 15, launch: 10, hitbox: { x: 0, y: -36, width: 80, height: 52 }, vfx: 'uppercut', poses: { active: 'ear_flick' } },
        dtilt: { name: 'Tail Sweep', damage: 6, startup: 5, active: 3, recovery: 9, hitstun: 14, knockback: 30, launch: 3, hitbox: { x: -30, y: 92, width: 140, height: 26 }, pose: 'crouch', vfx: 'sweep' },
        dashAttack: { name: 'Belly Slide', damage: 9, startup: 5, active: 10, recovery: 14, hitstun: 18, knockback: 65, launch: 5, hitbox: { x: 30, y: 70, width: 80, height: 46 }, movement: { active: { vx: 10 } }, afterimages: true, vfx: 'sweep', poses: { active: 'slide' } },

        // ---- Smash attacks (hold to charge)
        fsmash: { name: 'Charging Headbutt', damage: 17, startup: 15, active: 4, recovery: 24, hitstun: 28, blockstun: 16, knockback: 135, launch: 7, hitbox: { x: 50, y: 10, width: 75, height: 55 }, movement: { active: { vx: 5 } }, hitstop: 12, poses: { active: 'headbutt' } },
        usmash: { name: 'Flip Kick', damage: 15, startup: 11, active: 6, recovery: 22, hitstun: 26, knockback: 20, launch: 15, hitbox: { x: -10, y: -55, width: 100, height: 75 }, vfx: 'uppercut', anim: { roll: -1, lunge: 0 }, poses: { active: 'jumping' } },
        dsmash: { name: 'Dirt Spin', damage: 14, startup: 10, active: 6, recovery: 22, hitstun: 24, knockback: 95, launch: 5, hitbox: { x: -55, y: 85, width: 190, height: 35 }, pose: 'crouch', vfx: 'sweep', anim: { spin: true, lunge: 0 }, poses: { active: 'spin' } },

        // ---- Aerials
        nair: { name: 'Spin Paw', damage: 8, startup: 4, active: 10, recovery: 10, hitstun: 15, knockback: 40, launch: 4, hitbox: { x: -5, y: 20, width: 90, height: 80 }, anim: { spin: true, lunge: 0 }, poses: { active: 'spin' } },
        fair: { name: 'Pounce Swipe', damage: 10, startup: 7, active: 4, recovery: 12, hitstun: 18, knockback: 75, launch: 4, hitbox: { x: 50, y: 25, width: 58, height: 55 } },
        bair: { name: 'Tail Whip', damage: 11, startup: 6, active: 4, recovery: 12, hitstun: 18, knockback: 85, launch: 3, hitbox: { x: -45, y: 40, width: 60, height: 40 }, anim: { lunge: -10 }, poses: { active: 'tail_whip' } },
        uair: { name: 'Snap Bite', damage: 9, startup: 5, active: 4, recovery: 10, hitstun: 16, knockback: 20, launch: 11, hitbox: { x: 10, y: -34, width: 64, height: 50 }, vfx: 'uppercut', sfx: 'chomp', poses: { active: 'bark' } },
        dair: { name: 'Paw Stomp', damage: 12, startup: 10, active: 5, recovery: 16, hitstun: 18, knockback: 25, launch: -12, hitbox: { x: 15, y: 92, width: 50, height: 46 }, landingLag: 12, poses: { active: 'stomp' } },

        // ---- Specials
        neutralSpecial: {
            name: 'Bark Blast', damage: 9, startup: 12, active: 1, recovery: 18, hitstun: 18, knockback: 55, launch: 3, hitbox: null,
            projectile: { kind: 'bark', width: 46, height: 60, speed: 9, life: 32, offset: [50, 40], grow: 1.2 },
            vfx: 'none', sfx: 'bark', callout: 'WOOF!', poses: { active: 'bark' }, anim: { lean: 4, lunge: 4 }
        },
        sideSpecial: {
            name: 'Pounce Strike', damage: 14, startup: 9, active: 8, recovery: 18, hitstun: 24, blockstun: 16, knockback: 100, launch: 5,
            hitbox: { x: 40, y: 20, width: 80, height: 60 }, movement: { start: { vy: -4 }, active: { vx: 13, vy: -1 } },
            afterimages: true, vfx: 'slash-large', poses: { active: 'air_attack' }, endsOnLanding: false
        },
        upSpecial: {
            name: 'Tail Tornado', damage: 3, rehit: 4, startup: 4, active: 20, recovery: 10, hitstun: 12, knockback: 6, launch: 7,
            hitbox: { x: -15, y: -10, width: 110, height: 110 }, movement: { start: { vy: -14 }, active: { vy: -6.5 } },
            helpless: true, vfx: 'whirlwind', anim: { spin: true, lunge: 0 }, poses: { active: 'spin' }
        },
        downSpecial: {
            // Burrow (hidden and untouchable while tunnelling forward), then burst out underneath them.
            name: 'Dig', damage: 12, startup: 26, active: 6, recovery: 18, hitstun: 22, knockback: 40, launch: 13,
            hitbox: { x: -10, y: 0, width: 100, height: 120 }, movement: { startup: { vx: 5 } },
            intangible: ['startup'], hidden: ['startup'], vfx: 'quake', sfx: 'dig', callout: 'SURPRISE!',
            poses: { startup: 'crouching', active: 'jumping' }, anim: { lunge: 0, lean: 0 }, endsOnLanding: false
        },

        // ---- Grab and throws
        grab: { name: 'Jaw Grab', hitbox: { x: 55, y: 30, width: 45, height: 55 } },
        pummel: { name: 'Chomp Chomp', damage: 2, sfx: 'chomp' },
        fthrow: { name: 'Shake & Toss', damage: 9, knockback: 95, launch: 6 },
        bthrow: { name: 'Fetch!', damage: 11, knockback: 110, launch: 7, callout: 'FETCH!' },
        uthrow: { name: 'Nose Boop', damage: 7, knockback: 10, launch: 16 },
        dthrow: { name: 'Pin Down', damage: 7, knockback: 30, launch: 3, knockdown: true }
    }
};

// ============================================================================
// DAD — the secret gorilla heavyweight (press up five times on character select)
// Moves are Smash-style slots (see combat/moveset.js). Damage is before Dad's
// 1.2x power, frame counts before his 0.9x attack speed.
// ============================================================================
import { dadRig } from './dad-rig.js';

export default {
    id: 'dad',
    name: 'Dad',
    species: 'Gorilla',
    tagline: 'Secret heavyweight',
    description: 'Big, strong and always a little tired. Long arms, a Tie Whip, and Bad Breath that leaves you dizzy. Wears a tie to every fight.',
    color: '#5b5864',
    accentColor: '#4aa3df',
    secret: true, // hidden on character select until unlocked

    stats: {
        maxHealth: 120,
        walkSpeed: 4.0,
        runSpeed: 7.2,
        jumpForce: 15,
        airJumps: 1,
        airJumpForce: 13,
        airControl: 0.35,
        airSpeed: 4.6,
        fallSpeed: 15,
        weight: 1.4,
        power: 1.2,
        attackSpeed: 0.9
    },

    // Tall and broad, with arms that reach a long way.
    body: {
        width: 120,
        height: 165,
        hurtboxes: {
            standing: { x: 12, y: 6, width: 100, height: 159 },
            crouching: { x: 8, y: 60, width: 110, height: 105 },
            airborne: { x: 14, y: 12, width: 94, height: 136 }
        }
    },
    rig: dadRig,
    landSquash: 0.2,
    heavyFootsteps: true,

    moves: {
        // ---- Ground
        jab: { name: 'Dad Slap', damage: 3, startup: 4, active: 2, recovery: 7, hitstun: 11, knockback: 15, hitbox: { x: 100, y: 50, width: 56, height: 40 }, chain: 'jab2' },
        jab2: { name: 'Backhand', damage: 3, startup: 4, active: 2, recovery: 8, hitstun: 12, knockback: 20, hitbox: { x: 98, y: 46, width: 58, height: 42 }, chain: 'jab3', strength: 'light' },
        jab3: { name: 'Knuckle Sandwich', damage: 6, startup: 6, active: 3, recovery: 16, hitstun: 20, knockback: 70, launch: 4, hitbox: { x: 96, y: 30, width: 64, height: 56 }, strength: 'heavy' },
        ftilt: { name: 'Long Arm Swat', damage: 10, startup: 9, active: 4, recovery: 14, hitstun: 20, blockstun: 12, knockback: 90, hitbox: { x: 96, y: 40, width: 90, height: 44 } },
        utilt: { name: 'High Five', damage: 8, startup: 7, active: 5, recovery: 11, hitstun: 18, knockback: 15, launch: 11, hitbox: { x: 40, y: -60, width: 90, height: 70 }, vfx: 'uppercut', poses: { active: 'arms_up' } },
        dtilt: { name: 'Knuckle Drag', damage: 7, startup: 6, active: 4, recovery: 10, hitstun: 16, knockback: 35, launch: 3, hitbox: { x: 80, y: 130, width: 90, height: 32 }, pose: 'crouch', vfx: 'sweep' },
        dashAttack: {
            name: 'Late for Work!', damage: 11, startup: 7, active: 10, recovery: 18, hitstun: 20, knockback: 100, launch: 4,
            hitbox: { x: 80, y: 30, width: 70, height: 90 }, movement: { active: { vx: 8 } }, afterimages: true, callout: 'LATE!'
        },

        // ---- Smash attacks (hold to charge)
        fsmash: {
            name: 'Gorilla Punch', damage: 17, startup: 16, active: 5, recovery: 24, hitstun: 28, blockstun: 18, knockback: 140, launch: 7,
            hitbox: { x: 100, y: 30, width: 100, height: 60 }, hitstop: 14, vfx: 'slash-large'
        },
        usmash: { name: 'Raise the Roof', damage: 14, startup: 11, active: 6, recovery: 22, hitstun: 26, knockback: 25, launch: 15, hitbox: { x: 10, y: -70, width: 110, height: 90 }, vfx: 'uppercut', poses: { active: 'arms_up' } },
        dsmash: {
            name: 'Ground Pound', damage: 13, startup: 12, active: 6, recovery: 22, hitstun: 24, knockback: 90, launch: 6,
            hitbox: { x: -50, y: 125, width: 220, height: 40 }, pose: 'crouch', vfx: 'quake', hitstop: 12, poses: { active: 'slam' }
        },

        // ---- Aerials
        nair: { name: 'Belly Bump', damage: 9, startup: 5, active: 8, recovery: 12, hitstun: 16, knockback: 60, launch: 4, hitbox: { x: 10, y: 30, width: 110, height: 100 }, anim: { squash: 0.15, lunge: 6 }, poses: { active: 'chest_pound' } },
        fair: { name: 'Haymaker', damage: 12, startup: 9, active: 4, recovery: 14, hitstun: 20, knockback: 95, launch: 4, hitbox: { x: 96, y: 30, width: 80, height: 60 } },
        bair: { name: 'Mule Kick', damage: 12, startup: 7, active: 4, recovery: 13, hitstun: 20, knockback: 100, launch: 3, hitbox: { x: -60, y: 70, width: 70, height: 50 }, anim: { lunge: -10 }, poses: { active: 'kick' } },
        uair: { name: 'Overhead Clap', damage: 10, startup: 7, active: 4, recovery: 12, hitstun: 18, knockback: 20, launch: 12, hitbox: { x: 20, y: -50, width: 90, height: 60 }, vfx: 'uppercut', poses: { active: 'arms_up' } },
        dair: {
            name: 'Cannonball', damage: 13, startup: 9, active: 8, recovery: 14, hitstun: 20, knockback: 30, launch: -11,
            hitbox: { x: 10, y: 90, width: 100, height: 70 }, movement: { active: { vy: 11 } }, landingLag: 16, vfx: 'quake', poses: { active: 'cannonball' }
        },

        // ---- Specials
        neutralSpecial: {
            // A slow green cloud. Anyone standing in it is left dizzy for a moment.
            name: 'Bad Breath', damage: 5, startup: 18, active: 1, recovery: 24, hitstun: 14, knockback: 15, dizzy: 45, hitbox: null,
            projectile: { kind: 'breath', width: 70, height: 60, speed: 3.2, life: 55, offset: [90, 46], grow: 0.9 },
            vfx: 'none', sfx: 'breath', callout: 'HAAAAH!', poses: { startup: 'breath_windup', active: 'breath' }, anim: { lean: 6, lunge: 6 }
        },
        sideSpecial: {
            name: 'Tie Whip', damage: 11, startup: 10, active: 6, recovery: 18, hitstun: 22, knockback: 95, launch: 5,
            hitbox: { x: 110, y: 60, width: 140, height: 40 }, movement: { start: { vy: -3 }, active: { vx: 4 } },
            endsOnLanding: false, vfx: 'slash-large', poses: { active: 'tie_whip' }
        },
        upSpecial: {
            name: 'Jungle Gym', damage: 9, startup: 6, active: 12, recovery: 12, hitstun: 18, knockback: 60, launch: 9,
            hitbox: { x: 0, y: -40, width: 120, height: 90 }, movement: { start: { vy: -18 }, active: { vy: -6 } },
            helpless: true, vfx: 'uppercut', poses: { active: 'arms_up' }
        },
        downSpecial: {
            name: 'Chest Pound', damage: 9, startup: 10, active: 8, recovery: 16, hitstun: 18, knockback: 70, launch: 5,
            hitbox: { x: -30, y: 20, width: 180, height: 110 }, armor: 2, vfx: 'none', sfx: 'chestpound', callout: 'OOH OOH!', hitstop: 10,
            poses: { startup: 'breath_windup', active: 'chest_pound' }, anim: { lunge: 0, squash: 0.08 }
        },

        // ---- Grab and throws
        grab: { name: 'Bear Hug', startup: 7, hitbox: { x: 100, y: 40, width: 60, height: 70 }, poses: { active: 'grab' } },
        pummel: { name: 'Noogie', damage: 3 },
        fthrow: { name: 'Bedtime Toss', damage: 10, knockback: 100, launch: 6 },
        bthrow: { name: 'Over the Shoulder', damage: 11, knockback: 115, launch: 7 },
        uthrow: { name: 'Airplane!', damage: 9, knockback: 10, launch: 16, callout: 'WHEEE!' },
        dthrow: { name: 'Couch Flop', damage: 9, knockback: 30, launch: 3, knockdown: true, vfx: 'quake' }
    }
};

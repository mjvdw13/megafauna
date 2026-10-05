// ============================================================================
// QUACKERS — the fast, fragile aerial duck
// Moves are Smash-style slots (see combat/moveset.js). Damage is before
// Quackers' 0.85x power, frame counts before 1.2x attack speed.
// ============================================================================
import { quackersModel } from './quackers-model.js';

export default {
    id: 'quackers',
    name: 'Quackers',
    species: 'Duck',
    tagline: 'Aerial trickster',
    description: 'Four air flaps, glides by holding jump, and floats on water. Light, so big hits send Quackers flying.',
    color: '#f1c40f',
    accentColor: '#ffe066',

    stats: {
        maxHealth: 85,
        walkSpeed: 4.5,
        runSpeed: 7.5,
        jumpForce: 17,
        airJumps: 4,        // flap, flap, flap, flap
        airJumpForce: 13,
        airControl: 0.6,
        airSpeed: 6.5,
        fallSpeed: 9,       // floaty
        weight: 0.8,
        power: 0.85,
        attackSpeed: 1.2
    },
    abilities: { glide: true, floats: true },

    // A shorter body than the others: the duck is a smaller target.
    body: {
        width: 80,
        height: 96,
        hurtboxes: {
            standing: { x: 14, y: 4, width: 52, height: 92 },
            crouching: { x: 12, y: 40, width: 62, height: 56 },
            airborne: { x: 16, y: 8, width: 50, height: 80 }
        }
    },
    model: quackersModel,
    landSquash: 0.18,

    // Hitboxes are authored for the 96px body.
    moves: {
        // ---- Ground
        jab: { name: 'Peck', damage: 3, startup: 3, active: 2, recovery: 5, hitstun: 10, knockback: 12, hitbox: { x: 58, y: 20, width: 48, height: 28 }, chain: 'jab2' },
        jab2: { name: 'Peck Peck', damage: 2, startup: 2, active: 2, recovery: 5, hitstun: 10, knockback: 10, hitbox: { x: 58, y: 18, width: 50, height: 30 }, chain: 'jab3', strength: 'light' },
        jab3: { name: 'Peck Flurry', damage: 2, rehit: 3, startup: 3, active: 12, recovery: 12, hitstun: 10, knockback: 30, hitbox: { x: 56, y: 14, width: 55, height: 40 }, strength: 'light', vfx: 'feathers', poses: { active: 'flurry' } },
        ftilt: { name: 'Wing Slap', damage: 8, startup: 6, active: 3, recovery: 11, hitstun: 18, knockback: 65, hitbox: { x: 52, y: 26, width: 66, height: 40 } },
        utilt: { name: 'Beak Jab', damage: 6, startup: 5, active: 4, recovery: 9, hitstun: 16, knockback: 10, launch: 10, hitbox: { x: 14, y: -34, width: 60, height: 50 }, vfx: 'uppercut', poses: { active: 'beak_up' } },
        dtilt: { name: 'Webbed Sweep', damage: 6, startup: 5, active: 3, recovery: 8, hitstun: 14, knockback: 30, launch: 3, hitbox: { x: 38, y: 66, width: 80, height: 30 }, pose: 'crouch', vfx: 'sweep' },
        dashAttack: { name: 'Belly Flop', damage: 8, startup: 6, active: 10, recovery: 14, hitstun: 18, knockback: 60, launch: 4, hitbox: { x: 20, y: 40, width: 80, height: 56 }, movement: { active: { vx: 9 } }, poses: { active: 'belly_flop' } },

        // ---- Smash attacks (hold to charge)
        fsmash: { name: 'Wing Buffet', damage: 15, startup: 13, active: 5, recovery: 20, hitstun: 26, knockback: 125, launch: 6, hitbox: { x: 50, y: 10, width: 80, height: 60 }, vfx: 'slash-large' },
        usmash: { name: 'Head Toss', damage: 13, startup: 10, active: 5, recovery: 20, hitstun: 24, knockback: 15, launch: 15, hitbox: { x: 0, y: -50, width: 80, height: 70 }, vfx: 'uppercut', poses: { active: 'beak_up' } },
        dsmash: { name: 'Puddle Splash', damage: 12, startup: 9, active: 5, recovery: 20, hitstun: 22, knockback: 85, launch: 5, hitbox: { x: -50, y: 60, width: 180, height: 36 }, pose: 'crouch', vfx: 'sweep', sfx: 'splash' },

        // ---- Aerials
        nair: { name: 'Feather Spin', damage: 4, rehit: 6, startup: 4, active: 12, recovery: 10, hitstun: 12, knockback: 35, launch: 3, hitbox: { x: -4, y: 6, width: 88, height: 84 }, vfx: 'feathers', anim: { spin: true, lunge: 0 }, poses: { active: 'flurry' } },
        fair: { name: 'Flutter Kick', damage: 9, startup: 6, active: 4, recovery: 10, hitstun: 16, knockback: 65, launch: 3, hitbox: { x: 54, y: 28, width: 50, height: 40 } },
        bair: { name: 'Tail Waggle', damage: 10, startup: 6, active: 4, recovery: 11, hitstun: 16, knockback: 80, launch: 3, hitbox: { x: -38, y: 26, width: 52, height: 44 }, anim: { lunge: -8 }, poses: { active: 'tail_waggle' } },
        uair: { name: 'Beak Spike', damage: 8, startup: 5, active: 4, recovery: 9, hitstun: 16, knockback: 15, launch: 11, hitbox: { x: 16, y: -32, width: 56, height: 48 }, vfx: 'uppercut', poses: { active: 'beak_up' } },
        dair: {
            name: 'Dive Bomb', damage: 13, startup: 5, active: 10, recovery: 6, hitstun: 20, knockback: 40, launch: -10,
            hitbox: { x: 20, y: 24, width: 60, height: 76 }, movement: { active: { vy: 12 } }, landingLag: 14, afterimages: true, poses: { active: 'dive' }
        },

        // ---- Specials
        neutralSpecial: {
            name: 'Egg Toss', damage: 10, startup: 12, active: 1, recovery: 20, hitstun: 20, knockback: 60, launch: 6, hitbox: null,
            projectile: { kind: 'egg', width: 22, height: 28, speed: 6, vy: -9, gravity: 0.55, life: 90, offset: [36, 20] },
            vfx: 'none', sfx: 'whoosh'
        },
        sideSpecial: {
            name: 'Aerial Ace', damage: 13, startup: 6, active: 8, recovery: 14, hitstun: 20, blockstun: 14, knockback: 80, launch: 5,
            hitbox: { x: 40, y: 20, width: 80, height: 50 }, movement: { start: { vy: -5 }, active: { vx: 11, vy: -2 } },
            afterimages: true, vfx: 'slash-large', poses: { active: 'air_attack' }, endsOnLanding: false
        },
        upSpecial: {
            name: 'Updraft', damage: 5, rehit: 5, startup: 3, active: 10, recovery: 12, hitstun: 12, knockback: 6, launch: 9,
            hitbox: { x: 0, y: -30, width: 80, height: 90 }, movement: { start: { vy: -16 }, active: { vy: -8 } },
            helpless: true, vfx: 'feathers', sfx: 'flap', poses: { active: 'jumping' }
        },
        downSpecial: {
            // Too loud to get near: knocks people away and bounces projectiles straight back.
            name: 'QUACK!', damage: 14, startup: 12, active: 5, recovery: 18, hitstun: 28, blockstun: 20, knockback: 110, launch: 4,
            hitbox: { x: 30, y: 0, width: 70, height: 80 }, reflect: true, vfx: 'soundwave', sfx: 'quack', callout: 'QUACK!',
            poses: { active: 'attack_quack' }, anim: { lean: 9, lunge: 6 }
        },

        // ---- Grab and throws
        grab: { name: 'Beak Grab', hitbox: { x: 52, y: 24, width: 44, height: 48 } },
        pummel: { name: 'Nibble', damage: 2 },
        fthrow: { name: 'Wing Fling', damage: 8, knockback: 90, launch: 6 },
        bthrow: { name: 'Duck & Roll', damage: 9, knockback: 100, launch: 6 },
        uthrow: { name: 'Sky Drop', damage: 9, knockback: 5, launch: 17 },
        dthrow: { name: 'Waddle Stomp', damage: 7, knockback: 30, launch: 3, knockdown: true }
    }
};

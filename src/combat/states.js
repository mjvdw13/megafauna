// ============================================================================
// CHARACTER STATES
// ============================================================================
export const CharacterStates = Object.freeze({
    IDLE: 'idle',
    WALKING: 'walking',
    RUNNING: 'running',
    CROUCHING: 'crouching',
    JUMPING: 'jumping',
    FALLING: 'falling',
    LANDING: 'landing',        // landing lag after an aerial or a helpless fall
    ATTACKING: 'attacking',
    SHIELDING: 'shielding',
    ROLLING: 'rolling',
    SPOTDODGE: 'spotdodge',
    AIRDODGE: 'airdodge',
    HELPLESS: 'helpless',      // after an up special: can only drift until landing or grabbing a ledge
    LEDGE: 'ledge',            // hanging from a ledge
    LEDGE_CLIMB: 'ledgeClimb',
    GRABBING: 'grabbing',      // holding an opponent
    GRABBED: 'grabbed',
    DIZZY: 'dizzy',            // shield broke
    HITSTUN: 'hitstun',
    KNOCKDOWN: 'knockdown',
    GETUP: 'getup',
    VICTORY: 'victory',
    DEFEAT: 'defeat'
});

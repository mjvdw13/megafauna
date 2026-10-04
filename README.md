# MegaFauna

A browser fighting game for one player against the CPU, or two players at one keyboard. Smash-style controls and stages (platforms, ledges, pits), with classic health bars: drain your opponent's health to win the round. Plain JavaScript modules, no build step, no dependencies.

## Running

```sh
npm start        # serves the game at http://localhost:8080
npm test         # runs the logic tests (node --test)
node scripts/cpu-report.mjs [stage]   # CPU tuning report (levels vs each other)
```

The game uses ES modules, which browsers refuse to load from `file://`, so open it through `npm start` rather than double-clicking `index.html`.

## Controls

| | Move | Jump | Attack | Smash | Special | Shield |
|---|---|---|---|---|---|---|
| P1 | WASD | W or Space | J | K | L | `;` |
| P2 | Arrows | ↑ or Numpad 5 | Numpad 1 or `,` | Numpad 2 or `.` | Numpad 3 or `/` | Numpad 0 or Right Shift |

**Controllers** (PS5 DualSense, PS4, Xbox and most USB pads, in Chrome or Edge): plug in by USB or pair over Bluetooth, open the game, and press any button. The first controller plays as P1, the second as P2, and the keyboard keeps working alongside.

| ✕ / A | □ / X | △ / Y | ○ / B | R1, R2, L2 | L1 | Left stick / D-pad | Right stick |
|---|---|---|---|---|---|---|---|
| Jump (confirm in menus) | Attack | Smash (hold to charge) | Special (back in menus) | Shield | Grab | Move | Smash attack in that direction |

Controllers rumble on hits, ring-outs and KOs where the browser supports it.

Which move comes out depends on the button plus the direction you hold:

| | Ground | Air |
|---|---|---|
| Attack | jab (press again for a 1-2-3 combo), ← → forward tilt, ↑ up tilt, ↓ down tilt; while running: dash attack | neutral / forward / back / up / down air |
| Smash (hold to charge) | forward / ↑ up / ↓ down smash | same as Attack |
| Special | neutral, ← → side, ↑ up (your recovery move), ↓ down | same |

- **Jump:** up jumps unless you press attack or special right after it (so ↑ + attack is an up tilt). Every fighter has at least one air jump; Quackers has four. Tap ↓ in the air to fall fast; tap ↓ on a floating platform to drop through it.
- **Run:** double-tap left or right.
- **Shield:** hold shield. It shrinks while held and when hit, and breaks (leaving you dizzy) if it runs out. While shielding: ← or → rolls, ↓ spot-dodges. In the air, shield is an air dodge (add a direction to dash).
- **Grab:** shield + attack. Grabs go through shields. While holding: attack to pummel, a direction to throw. Mash buttons to escape a grab.
- **Ledges:** fall near the edge of the main platform to grab it. From the ledge: ↑ or toward the stage climbs, jump jumps, ↓ or away lets go.
- **Pits:** falling off the stage costs 20% of your max health, then you drop back in from above. After an up special you can't act again until you land or grab a ledge.
- Title menu: **1 Player vs CPU** or **2 Players**. Change the CPU level (Easy / Normal / Hard) on the menu's last row with left/right.
- Vs CPU: player 1 picks their fighter, then the CPU's.
- Menus: Enter or Space confirms, Esc goes back.
- Sound on/off: `M` (remembered between visits).
- Rematch from the result screen: special.
- Hitbox debug overlay: press `` ` `` (backtick), or open with `?debug`.

## Project layout

```
index.html            page shell, loads src/main.js
scripts/serve.mjs     zero-dependency dev server
src/
  config.js           screen size, physics defaults, match rules, key bindings
  main.js             entry point
  ai/                 CPU opponent (drives a fighter through the same input object a player uses)
  audio/              synthesized sound: engine + mix, sound effects, music sequencer, announcer
  core/               game loop (fixed 60 Hz), keyboard + controller input, physics, math helpers
  combat/             attacks, move slots, hitboxes, state machine, hit resolution, projectiles,
                      match.js: one frame of fighting, shared by the game, the tests and the CPU report
  fighters/           Fighter runtime class + one folder per character
    roster.js         the character list (order = select-screen order)
    <id>/<id>.js      character definition (stats, abilities, body, moves)
    <id>/<id>-rig.js  hand-drawn puppet: poses, animation cycles, draw()
  stages/             one file per stage + Stage runtime, sketch kit, ambient layers
    index.js          the stage list
  graphics/           ink toolkit, puppets, paper overlay, effects, attack VFX
  scenes/             title, character select, stage select, fight, result
  ui/                 HUD, stat bars, hand-drawn panels, text helpers
tests/                node --test suites for combat, roster, stages, CPU, audio, controllers
```

The rule of thumb: characters and stages are **data**. The engine (`combat/`, `fighters/fighter.js`, `stages/stage.js`) should not need to change to add content.

## Art style

Everything is drawn in code in a hand-drawn cartoon style. Nothing is a bitmap.

- **`graphics/ink.js`:** builds shapes as `Path2D` with a little wobble and inks them with dark outlines and cel shading. The wobble pattern changes every 4 frames, so lines "boil" like hand-drawn animation.
- **`graphics/puppet.js`:** animates a character rig.
  - Each state has a pose. Looping states like idle, walk and victory are time-based *cycles*.
  - Changing state blends smoothly from the previous pose.
  - Ears, tails and tufts swing from the fighter's velocity (secondary motion).
- **Attack animation:** attacks blend neutral → windup → strike → neutral, timed by the attack's own frame data. On top of that, the fighter adds lean, lunge and squash.
- **`stages/sketch-kit.js`:** painterly washes, inked hills, clouds, trees and ferns for stage backgrounds.
- **`graphics/paper.js`:** paper grain and vignette multiplied over every frame.

## Adding a character

1. Create `src/fighters/<id>/<id>-rig.js` exporting a rig. Copy an existing one: the rig's `draw()` paints one pose with the `Ink` toolkit, and `solveLimb()` (2-bone IK) places arms and legs from hand and foot targets.
   - **Required poses** (static `poses` or time-based `cycles`): `idle`, `walking`, `crouching`, `jumping`, `falling`, `blocking`, `hitstun`, `knockdown`, `getup`, `victory`, `defeat`.
   - **Attack poses:** `attack_windup`, `attack_strike`, `crouch_windup`, `crouch_attack`, `air_windup`, `air_attack`.
   - **Moves** can name extra poses via `poses: { startup, active, recovery }`.
   - **Optional state poses** fall back to a core pose when missing (see `STATE_POSES` in `fighters/fighter.js`): `running` (else a sped-up `walking`), `shield` (else `blocking`), `ledge`, `helpless`, `glide`, `dizzy`, and others.
   - A test checks that every required pose exists and that every pose a move names exists.
2. Create `src/fighters/<id>/<id>.js` exporting the definition with `rig: <yourRig>`. The fields are commented in the existing ones.
3. Add it to `ROSTER` in `src/fighters/roster.js`.
4. Run `npm test`. Tests check that the character defines every move slot with its own move names, can recover (an up special that rises), and doesn't share a value with anyone for any displayed stat.

### Stats

| Stat | Effect |
|---|---|
| `maxHealth` | Starting health |
| `walkSpeed` | Ground speed (px per frame) |
| `jumpForce` | Initial jump velocity |
| `airControl` | Steering in the air |
| `weight` | Knockback resistance (knockback is divided by weight) |
| `power` | Damage multiplier for every move |
| `attackSpeed` | Divides startup and recovery frames (>1 is faster) |
| `runSpeed` | Dash speed (default 1.8 × walk) |
| `airJumps` / `airJumpForce` | Extra jumps in the air and how strong they are |
| `airSpeed` | Top horizontal speed in the air |
| `fallSpeed` | Top falling speed (lower is floatier) |

`abilities` turns on special traits: `glide` (hold jump while falling) and `floats` (stand on water, pool and swamp pits).

### Move fields

Moves go in `moves`, keyed by slot: `jab`, `ftilt`, `utilt`, `dtilt`, `dashAttack`, `fsmash`, `usmash`, `dsmash`, `nair`, `fair`, `bair`, `uair`, `dair`, `neutralSpecial`, `sideSpecial`, `upSpecial`, `downSpecial`, `grab`, `pummel`, `fthrow`, `bthrow`, `uthrow`, `dthrow`. Extra keys (like `jab2`) are reachable through `chain` or `counter`. Anything a character leaves out comes from `BASE_MOVES` in `src/combat/moveset.js`. Every field is documented in `src/combat/attack.js`.

- **Frame data:** `damage`, `startup`, `active`, `recovery`, `hitstun`, `blockstun` (shield stun), `knockback`, `launch`, `hitbox` (`null` for projectile and counter moves).
- **Behavior:** `knockdown`, `armor`, `movement` (`{ start, startup, active, recovery }` velocities), `charge` (smash attacks), `chain` (next move in a combo), `rehit` (multi-hit), `intangible` / `hidden` (phases), `helpless`, `landingLag`, `endsOnLanding`, `projectile`, `reflect`, `counter`, `grab`, `throwDir`.
- **Presentation:** `pose`, `vfx`, `sfx`, `afterimages`, `anim` (`lean`, `lunge`, `squash`, `spin`, `roll`), `poses`, `callout`, `hitstop`.

## Adding a stage

1. Create `src/stages/<id>.js` exporting:
   - Display info: `id`, `name`, `description`, `traits` (shown on stage select), `accent`.
   - `paint(kit)`: draws the static background once, using the sketch kit (`kit.sky`, `kit.hills`, `kit.mountain`, `kit.tree`, `kit.floor`, ... plus `kit.ink` and `kit.ctx`). Coordinates are screen pixels (1280x720). Fighters stand at y=550, and the floor starts around y=452.
   - `layout`: `{ main: { left, right }, platforms: [[left, right, y], ...] }`. The main platform is solid with a ledge at each end; platforms are thin (jump up through, drop down through). Everything outside the main platform is pit.
   - `pit`: what's in the pit, one of `PIT_STYLES` in `sketch-kit.js` (`water`, `pool`, `swamp`, `icewater`, `tar`, `lava`, `chasm`). It sets the painted look, the splash, the sound and whether floaters can stand on it. The pit and the cliff edges are painted for you over your background.
   - Optional `platformStyle`: `{ top, front, kind }` colors and look (`stone`, `wood`, `ice`, `bone`, `log`, `turf`).
   - Optional rule changes: `physics: { gravity, friction }`, `groundY`.
   - Optional `music`: a track name from `TRACKS` in `src/audio/music.js` (default `romp`).
   - Optional `createLayers()`: returns animated layers (`{ front?, update(t), render(ctx, t) }`). Ready-made layers are in `ambient.js`.
2. Add it to `STAGES` in `src/stages/index.js`.

## Adding an attack effect

Add an entry to `ATTACK_VFX` in `src/graphics/attack-vfx.js`, then reference it from a move with `vfx: '<name>'`.

## Sound

Every sound is synthesized with Web Audio. There are no audio files. Browsers only allow sound after a key press or click, so the game stays silent until the first input.

- **Sound effects:** recipes in `SFX` in `src/audio/sfx.js`, built from `tone()` and `noise()` voices (`src/audio/voices.js`). Play one with `game.audio.play('<name>', { x })`; `x` pans it toward the side of the screen it came from.
- **Move sounds:** a move plays its `sfx` (e.g. Riley's `bark`). Without one, it plays the sound that matches its `vfx`, or a whoosh.
- **Music:** `TRACKS` in `src/audio/music.js`. Patterns are 16-step strings; the file header explains the notation. A track's `hype` layers join when a fighter drops below 30% health or in the final round.
- **Announcer:** `game.audio.announce('Round 1')` uses the browser's built-in speech voice.

## CPU opponent

`src/ai/cpu-controller.js` drives player 2 by producing the same input object the keyboard does, so it follows the same rules. It sees the opponent after a delay (its reaction time) and rolls once per situation whether to shield or dodge, punish a whiff, anti-air, grab or continue a combo. It recovers to the stage with air jumps and specials, won't walk off edges, and waits at the edge when you're off-stage. `CPU_LEVELS` sets the odds for each difficulty. It picks moves by reading their hitboxes, startup, travel and projectile range, so new characters work without CPU-specific code.

After tuning, run `node scripts/cpu-report.mjs` and `npm test`; the tests check that each level beats the one below it, and that the CPU never falls off by itself and recovers from the pit.

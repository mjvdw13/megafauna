# MegaFauna

A browser fighting game for one player against the CPU, two players at one keyboard, or two friends online. Smash-style controls and stages (platforms, ledges, pits), with classic health bars: drain your opponent's health to win the round. Realistic real-time 3D fighters and stages, all generated in code. Plain JavaScript modules, no build step, nothing to install: the libraries, [three.js](https://threejs.org) and [PeerJS](https://peerjs.com) (for online play), are vendored in `vendor/`.

## Running

```sh
npm start        # serves the game at http://localhost:8080
npm test         # runs the logic tests (node --test)
node scripts/cpu-report.mjs [stage]   # CPU tuning report (levels vs each other)
```

The game uses ES modules, which browsers refuse to load from `file://`, so open it through `npm start` rather than double-clicking `index.html`.

On start the game builds every character model and stage world (a few seconds, with a progress bar) so menus and fights never stall later. It needs WebGL 2. Rendering adapts to the machine: if frames run long, the 3-D picture is drawn at lower resolution and scaled up.

Known gaps and next steps are tracked in [TODO.md](TODO.md).

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

**Phones and tablets** (vs CPU and online): on-screen controls appear on touch screens; turn the phone sideways. Put your left thumb anywhere on the left half for a stick (push up to jump, flick sideways to run); the right side has the face buttons in the controller's diamond (Jump, Attack, Smash, Special) with Shield and Grab above. In menus the stick chooses and the buttons become OK / BACK; host an online game and SHARE LINK opens the phone's share sheet. Add `?touch=1` to the URL to force the controls on (e.g. to try them with a mouse), or `?touch=0` to hide them. The code is `src/core/touch.js`.

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
- **Burning:** Gary's fire moves leave you burning for a few seconds (a point of damage every third of a second). Splash into water to put it out.
- Title menu: **1 Player vs CPU** or **2 Players**. Change the CPU level (Easy / Normal / Hard) on the menu's last row with left/right.
- Vs CPU: player 1 picks their fighter, then the CPU's.
- Menus: Enter or Space confirms, Esc goes back.
- Sound on/off: `M` (remembered between visits).
- Rematch from the result screen: special.
- Hitbox debug overlay: press `` ` `` (backtick), or open with `?debug`.

## Playing online

Pick **Play a friend online** on the title screen. You get an invite link (press `C` to copy it); send it to a friend, and when they open it you're both in a lobby. Each of you picks a fighter, the host picks the stage, and the fight starts once you've both confirmed. Online, each player uses their own keyboard (either set of keys) or controller. After the match, confirm returns you both to the lobby for a rematch; Esc leaves.

How it works (`src/net/`):

- **Connection** (`online.js`): the two browsers connect directly over WebRTC. PeerJS's free public server (0.peerjs.com) only introduces them, so the game needs no server of its own and runs from any static host, such as GitHub Pages. The host plays P1, the guest P2.
- **Netcode** (`lockstep.js`): delay-based lockstep. The fight is deterministic, so only button presses cross the network, one integer per player per frame. Each press is scheduled 3 frames (50 ms) ahead; a frame runs once both players' inputs for it have arrived, otherwise the game holds that frame ("waiting for opponent"). Add `?delay=N` to the URL to try a different delay. Every frame the two copies compare a hash of the fight state, and a mismatch shows "out of sync".
- Some networks (strict or corporate NATs) can't connect directly. Then the traffic goes through a relay (TURN) server; PeerJS's shared public ones are used by default (see [TODO.md](TODO.md)).

## Project layout

```
index.html            page shell, import map for three.js, loads src/main.js
scripts/serve.mjs     zero-dependency dev server
vendor/three/         three.js r170 (MIT) and the four addons the game uses
vendor/peerjs/        PeerJS 1.5.5 (MIT), loaded only when going online
src/
  config.js           screen size, physics defaults, match rules, key bindings
  main.js             entry point
  ai/                 CPU opponent (drives a fighter through the same input object a player uses)
  audio/              synthesized sound: engine + mix, sound effects, music sequencer, announcer
  core/               game loop (fixed 60 Hz), keyboard + controller + touch input, physics, math helpers
  combat/             attacks, move slots, hitboxes, state machine, hit resolution, projectiles,
                      match.js: one frame of fighting, shared by the game, the tests and the CPU report
  fighters/           Fighter runtime class + one folder per character
    roster.js         the character list (order = select-screen order)
    <id>/<id>.js      character definition (stats, abilities, body, moves)
    <id>/<id>-model.js  3-D model: sculpted body, skeleton, colors, poses, apply()
  stages/             one file per stage (layout, rules, 3-D world) + Stage runtime, pit styles
    index.js          the stage list
  render3d/           the 3-D renderer: models, worlds, fighters, projectiles, menus (see below)
  graphics/           puppet (pose animation), 2-D effects and attack VFX, ink toolkit, paper overlay
  net/                online play: PeerJS session (online.js), lockstep netcode + input codec (lockstep.js)
  scenes/             title, character select, stage select, fight, result, online lobby
  ui/                 HUD, stat bars, hand-drawn panels, text helpers
tests/                node --test suites for combat, roster, models, stages, CPU, audio, controllers, lockstep
```

The rule of thumb: characters and stages are **data**. The engine (`combat/`, `fighters/fighter.js`, `stages/stage.js`, `render3d/`) should not need to change to add content. Model and world files never import three.js, so `npm test` loads and checks them in plain Node.

## Graphics

Fighters and stages are realistic real-time 3-D, generated entirely in code: there are no model, texture or image files. Menus, the HUD and the comic callouts stay hand-drawn 2-D.

**How a frame is drawn.** Scenes draw into one 2-D canvas. `render3d/view.js` owns a single WebGL renderer on an offscreen canvas; each 3-D picture (the fight, a menu portrait) is rendered and immediately copied into the 2-D canvas, so scenes layer 3-D, 2-D effects and UI exactly as before. The fight camera is fixed and frames the 1280x720 playfield exactly at the fighters' depth, so a point at screen pixel (x, y) in the game's coordinates lands on the same pixel in 3-D. That keeps hitboxes, effects, name tags and the debug overlay lined up with the 3-D fighters. World units are 100 px; y = 0 is the top of the main platform.

**Characters** (`render3d/creature.js`, `render3d/shapes.js`):
- A model file sculpts the body from capsules and ellipsoids (`cap`, `ell`) blended smoothly as a signed-distance field. Surface nets turn that into one smooth mesh per part (wings are a separate part so they spread without stretching the body).
- Every vertex is skinned to the bones of the pieces near it, so joints bend like flesh. Colors, countershading and ambient occlusion (sampled from the same distance field) are baked into vertex colors.
- Fur, scales, cloth and skin detail come from a small generated noise texture, sampled triplanar from each vertex's rest position so it sticks to the skin as it moves (`render3d/materials.js`). A per-vertex `surf` attribute mixes detail strength and roughness, so one mesh can be fur, skin and shirt.
- Accessories (eyes, horns, glasses, Dad's tie) are rigid meshes on bones.
- Each model is built once at startup (`render3d/models.js`); fighters and menu slots get cheap clones.

**Animation** reuses the original pose system unchanged:
- `graphics/puppet.js` picks the pose for each state and blends between states. Looping states (idle, walk, victory) are time-based *cycles*.
- Attacks blend neutral → windup → strike → neutral, timed by the attack's frame data; the fighter adds lean, lunge, squash, rolls and spins on top (`Fighter.poseTransform()`).
- Poses are plain numbers (joint angles, body offsets) declared by the model. Its `apply()` turns them into bone rotations.
- `render3d/fighter-view.js` poses a fighter's model each frame, keeps the feet planted on the floor, and draws hit flashes, the shield bubble, dizzy stars, dodge fades and afterimages.

**Stages** (`render3d/world-kit.js`, `render3d/stage-world.js`, `render3d/sky.js`):
- Each stage's `world(kit)` builds its scene with the kit: physically based sky (or a painted night sky), light and fog, terrain with ridged mountains, instanced forests, the main platform and floating platforms, the pit surface (water, pool, swamp, ice water, tar, molten lava, or a chasm), props and particles.
- Distant scenery has its lighting baked into vertex colors and is drawn unlit. Only the arena, props and fighters near the camera use real lighting and shadows.
- Worlds are built once and cached (`render3d/worlds.js`), which also renders the stage-select thumbnails.

**Menus** use `render3d/studio.js` (full-body character cards, HUD and roster portraits) and `render3d/actor.js` (the title-screen line-up on the meadow).

**2-D on top:** `graphics/effects.js` and `graphics/attack-vfx.js` draw glowing particles, dust and swing trails over the 3-D picture, and `graphics/impacts.js` the hit effects (impact stars, focus lines, shockwaves, sparks, launch smoke). `graphics/ink.js` and `graphics/paper.js` give the menus their hand-drawn panels and paper grain (the fight, title and stage select skip the paper).

**Fight camera** (`graphics/camera.js`): shake, roll, a kick along each hit's knockback, zoom punches and the KO close-up. It works as a view window onto the playfield: the 3-D camera renders exactly that window (`setViewOffset`) and the 2-D layers get the matching transform, so effects stay on the fighters while the picture moves, and shaking never shows an edge.

## Hit feel

How hard a clean hit lands decides how it's presented. `impactTier()` in `scenes/fight-scene.js` sorts it into light, heavy or smash (by the move's strength and damage), and `HIT_TIERS` there sets, per tier:

- **Hitstop:** the whole fight freezes for a few frames (more for more damage, capped at 20), while the defender shudders and the effects keep playing. A move's own `hitstop` is the minimum.
- **Camera:** shake, a kick along the knockback, and a zoom punch toward the impact on heavy and smash hits.
- **Light:** each world has an impact point light (`render3d/stage-world.js`, built in at startup so no shader recompiles mid-fight) that flashes at the point of contact and lights up both fighters and the floor.
- **Effects:** an impact star and sparks flying along the knockback; smash hits add focus lines, a shockwave and a darkened frame; heavy hits on the ground send a flattened shockwave and debris along it. Fighters launched hard trail smoke; fighters sliding in hitstun kick up dust.
- **Defender:** a white-hot flash then a flickering red glow (timed in real time by `render3d/fighter-view.js`, so it plays during hitstop).
- **Sound:** smash hits add a sub-bass boom and crunch; counter hits ring; launches whoosh.

Hitting a move as it comes out shows **COUNTER HIT!** (with extra hitstop), hitting one while it recovers shows **PUNISH!**. These only change the presentation, not damage.

**Combos:** the HUD counter pops on every hit, heats up from yellow to pink, and totals the combo's damage; when a combo of 3+ hits ends it's rated NICE! / GREAT! / AWESOME! / MEGA! with a sting. Health bars shake when hit, flash the chunk just lost, and throb at low health.

**Knockouts:** the winning hit freezes for 40 frames while the camera closes in on the impact, then lets go into slow motion behind letterbox bars as the K.O. slams down.

**Input buffer:** attack, smash, special and jump pressed while the fighter is busy (recovering, landing, in hitstun, or during hitstop) are remembered for `INPUT_TIMING.buffer` frames and come out on the first frame they can, so combos don't drop inputs. This lives in `Fighter` (`bufferPresses` / `withBuffer`), so the CPU and the tests use it too.

## Adding a character

1. Create `src/fighters/<id>/<id>-model.js` exporting a model. Copy the closest existing one (Riley and Randy walk on four legs, Quackers and Gary have wings, Dad wears accessories). It describes, in world units with the character facing +x and its feet at y = 0:
   - `bones`: `[name, parent, [x, y, z]]` in the rest pose.
   - `parts`: `{ prims, min, max, step }` per mesh. `prims` are `cap(a, b, radiusA, radiusB, bone, blend, color)` and `ell(center, radii, bone, blend, color, tilt)` from `render3d/shapes.js`; `min`/`max` bound the part with a few cells of margin; `step` is the mesh resolution (smaller = finer and slower to build).
   - `colors`: `{ key: hex }` or `{ key: [hex, detailStrength, roughness] }`, plus an optional `shade(color, x, y, z, nx, ny, nz, colors)` for countershading and mottling.
   - `material`: roughness, sheen and `detail: { mode: 'fur' | 'scales' | 'rock', freq, strength, tint, freq2 }`.
   - `accessories(kit)`: eyes, horns, lenses and other rigid pieces (`kit.eye`, `kit.horn`, `kit.ellipsoid`, `kit.torus`, `kit.flat`, `kit.group`, ...).
   - `feet`: bone-local points under each foot, used to keep them on the floor. `portrait`: where the face is, for HUD portraits. `scale`: size on screen. `stepFrames`: frames per footstep.
   - `basePose`, `poses`, `cycles`: pose parameters (joint angles, offsets) per state, and `apply({ bones, extras, state }, pose, info)`, which sets bone rotations from a pose. Add `snap: 0` to poses where the body lies on the ground.
   - **Required poses** (static `poses` or time-based `cycles`): `idle`, `walking`, `crouching`, `jumping`, `falling`, `blocking`, `hitstun`, `knockdown`, `getup`, `victory`, `defeat`.
   - **Attack poses:** `attack_windup`, `attack_strike`, `crouch_windup`, `crouch_attack`, `air_windup`, `air_attack`.
   - **Moves** can name extra poses via `poses: { startup, active, recovery }`.
   - **Optional state poses** fall back to a core pose when missing (see `STATE_POSES` in `fighters/fighter.js`): `running` (else a sped-up `walking`), `shield` (else `blocking`), `ledge`, `helpless`, `glide`, `dizzy`, and others.
2. Create `src/fighters/<id>/<id>.js` exporting the definition with `model: <yourModel>`. The fields are commented in the existing ones.
3. Add it to `ROSTER` in `src/fighters/roster.js`.
   - Add `secret: true` to the definition to hide the character until it's unlocked. The unlock code lives in `SECRET` in `src/scenes/character-select-scene.js`, and an unlock lasts until the page is refreshed or closed (`src/core/unlocks.js`).
4. Run `npm test`. Tests check that the character defines every move slot with its own move names, can recover (an up special that rises), and doesn't share a value with anyone for any displayed stat. For the model, they check that every required pose and every pose a move names exists, that shapes, feet and poses only name bones, colors and parameters that exist, and that every pose drives the skeleton to finite angles.
5. Look at it in the game. Hold a pose in the browser console with `game.scene.view3d.fighters[0].fighter.puppet.play('ledge')` while the round is in its intro, or step through moves with the hitbox overlay on (`` ` ``).

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

`abilities` turns on special traits: `glide` (hold jump while falling), `floats` (stand on water, pool and swamp pits) and `fireproof` (never burns).

### Move fields

Moves go in `moves`, keyed by slot: `jab`, `ftilt`, `utilt`, `dtilt`, `dashAttack`, `fsmash`, `usmash`, `dsmash`, `nair`, `fair`, `bair`, `uair`, `dair`, `neutralSpecial`, `sideSpecial`, `upSpecial`, `downSpecial`, `grab`, `pummel`, `fthrow`, `bthrow`, `uthrow`, `dthrow`. Extra keys (like `jab2`) are reachable through `chain` or `counter`. Anything a character leaves out comes from `BASE_MOVES` in `src/combat/moveset.js`. Every field is documented in `src/combat/attack.js`.

- **Frame data:** `damage`, `startup`, `active`, `recovery`, `hitstun`, `blockstun` (shield stun), `knockback`, `launch`, `hitbox` (`null` for projectile and counter moves).
- **Behavior:** `knockdown`, `armor`, `movement` (`{ start, startup, active, recovery }` velocities), `charge` (smash attacks), `chain` (next move in a combo), `rehit` (multi-hit), `intangible` / `hidden` (phases), `helpless`, `landingLag`, `endsOnLanding`, `projectile` (with `max` to limit how many are out at once), `reflect`, `counter`, `grab`, `throwDir`, `dizzy`, `burn`.
- **Burn:** a move with `burn: n` sets the opponent on fire on a clean hit or throw: 1 damage every `BURN.interval` frames (`src/config.js`), `n` times. A new burn doesn't stack, it keeps the longer one. Splashing into a water, pool, swamp or ice-water pit puts it out (`douses` in `src/stages/pits.js`).
- **Presentation:** `pose`, `vfx`, `sfx`, `afterimages`, `anim` (`lean`, `lunge`, `squash`, `spin`, `roll`), `poses`, `callout`, `hitstop`.

## Adding a stage

1. Create `src/stages/<id>.js` exporting:
   - Display info: `id`, `name`, `description`, `traits` (shown on stage select), `accent`.
   - `layout`: `{ main: { left, right }, platforms: [[left, right, y], ...] }` in screen pixels (1280x720; fighters stand at y = 550). The main platform is solid with a ledge at each end; platforms are thin (jump up through, drop down through). Everything outside the main platform is pit.
   - `pit`: what's in the pit, one of `PIT_STYLES` in `src/stages/pits.js` (`water`, `pool`, `swamp`, `icewater`, `tar`, `lava`, `chasm`). It sets the splash, the sound and whether floaters can stand on it, and the 3-D kit builds its surface for you.
   - Optional `platformStyle: { kind }`: the look of the floating platforms (`turf`, `wood`, `log`, `ice`, `bone`, `stone`).
   - Optional rule changes: `physics: { gravity, friction }`, `groundY`.
   - Optional `music`: a track name from `TRACKS` in `src/audio/music.js` (default `romp`).
   - `world(kit)`: builds the 3-D scene with the world kit (`src/render3d/world-kit.js`, whose header lists every tool). In world units (1 = 100 px, x = 0 mid-screen, y = 0 the top of the main platform, z toward the camera). A typical world: `kit.sky(...)`, `kit.light(...)`, `kit.fog(...)`, `kit.terrain(...)`, `kit.forest(...)`, `kit.ground({ top, body })` for the main platform, then props and particles. The floating platforms and the pit are added automatically. Copy the closest existing stage. The fight camera looks straight ahead from 1.9 units up, so keep mountains low and far (they shouldn't cover the sky) and big trees well behind the arena.
2. Add it to `STAGES` in `src/stages/index.js`.

## Adding an attack effect

Add an entry to `ATTACK_VFX` in `src/graphics/attack-vfx.js`, then reference it from a move with `vfx: '<name>'`. Fire effects (`firepuff`, `fireblast`, `flamethrower`, `firering`, `phoenix`) are built from the flame particles in `src/graphics/fire.js`.

## Sound

Every sound is synthesized with Web Audio. There are no audio files. Browsers only allow sound after a key press or click, so the game stays silent until the first input.

- **Sound effects:** recipes in `SFX` in `src/audio/sfx.js`, built from `tone()` and `noise()` voices (`src/audio/voices.js`). Play one with `game.audio.play('<name>', { x })`; `x` pans it toward the side of the screen it came from.
- **Move sounds:** a move plays its `sfx` (e.g. Riley's `bark`). Without one, it plays the sound that matches its `vfx`, or a whoosh.
- **Music:** `TRACKS` in `src/audio/music.js`. Patterns are 16-step strings; the file header explains the notation. A track's `hype` layers join when a fighter drops below 30% health or in the final round.
- **Announcer:** `game.audio.announce('Round 1')` uses the browser's built-in speech voice.

## CPU opponent

`src/ai/cpu-controller.js` drives player 2 by producing the same input object the keyboard does, so it follows the same rules. It sees the opponent after a delay (its reaction time) and rolls once per situation whether to shield or dodge, punish a whiff, anti-air, grab or continue a combo. It recovers to the stage with air jumps and specials, won't walk off edges, and waits at the edge when you're off-stage. `CPU_LEVELS` sets the odds for each difficulty. It picks moves by reading their hitboxes, startup, travel and projectile range, so new characters work without CPU-specific code.

After tuning, run `node scripts/cpu-report.mjs` and `npm test`; the tests check that each level beats the one below it, and that the CPU never falls off by itself and recovers from the pit.

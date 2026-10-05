# TODO

Open work after the move from 2-D hand-drawn art to realistic 3-D (October 2026).

## Verify

What was checked: `npm test` passes; in Chrome on Intel UHD integrated graphics, every screen loads with no console errors, and fights run on all seven stages with every character. GPU time for the 3-D scene is 2–5 ms per frame on every stage. Watched in motion: idle, walking, running, jumping, a few attacks, Riley's bark, Randy's boulder.

- [ ] **Real frame rate.** The GPU timing above leaves out CPU work (posing, skinning uploads, the per-frame copy of the 3-D picture into the 2-D canvas, HUD portraits). Play for a few minutes in a visible tab with a frame counter on each stage. If it's slow, check `game.view.scale` (the adaptive resolution) first.
- [ ] **Poses not yet seen in motion.** Every pose was set by hand without a visual pass: shield, roll, spot dodge, air dodge, ledge hang and climb, knockdown, get-up, defeat, victory, dizzy, grab and grabbed, helpless, Quackers' glide and flapping air jumps, Riley's dig, every character's smash attacks, aerials, specials and throws. Expect some to need adjusting (limbs through the body, feet sliding, the wrong lead leg).
- [ ] **Untested paths:** 2-player versus, the result screen, a mirror match (same character twice), unlocking Dad on character select, rematch from the result screen.
- [x] **Effects** checked frame by frame (Dad vs Quackers, Sunny Meadow) and fixed: afterimages now trail behind the fighter instead of washing over it; faded bodies (dodges, invincibility blink) no longer show their far side through themselves; the charge glow is a gold rim, visible on white Quackers without bleaching dark Dad; the Tie Whip flings the tie forward during the hit (it swung backward, behind his body, and too late); Bad Breath is a visible cloud of puffs. The hit flash, armor flash and egg looked right. Still open: the white hit flash barely changes all-white Quackers.
- [ ] **Gary (new).** Checked in the browser: select card and portrait, Flamethrower, Fire Breath, Ring of Fire, Hot Foot's ember patch, Phoenix Rise, the burn glow and BURN! callout. Not yet seen: his aerials, throws, Statue Drop, the douse in water, ledge and knockdown poses, and a full match against the CPU in a visible tab.
- [ ] **Tar pits:** the last change (lower specular) to stop the tar reading as grey water hasn't been looked at.

## Improve

- [ ] **Riley's moveset vs. Riley's body.** Riley is now a four-legged dog; some move names still assume paws as fists ("Paw Jab"). Rename moves or rework poses so every move reads as something a dog does.
- [ ] **Dad's silhouette.** The big pale shirt dominates; a darker or patterned shirt, or a larger head, would read better at game size.
- [ ] **Background trees** are still visibly low-poly up close (conifer cones, broadleaf blobs). Push them further back or give them more detail.
- [ ] **Startup time.** Models and worlds build on the main thread at launch (a few seconds). Building in a Web Worker, or caching the built meshes, would shorten it.
- [ ] **GPU memory.** All seven worlds stay loaded (each sky is a cube map plus an environment map). Fine on the test machine; unload worlds not in use if memory becomes a problem.
- [ ] **UI style.** Menus, HUD and callouts are still the hand-drawn ink style, which now sits next to realistic 3-D. Decide whether to restyle them.
- [ ] **Quality ceiling.** Code-built models top out below sculpted, textured ones. If higher fidelity is wanted, the next step is characters modeled in Blender and loaded as glTF (`render3d/creature.js` would gain a loader; the pose system and `apply()` can stay).
- [ ] **No WebGL fallback.** Without WebGL 2 the game can't start. Show a message instead of a blank canvas.

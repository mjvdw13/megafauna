# TODO

Open work after the move from 2-D hand-drawn art to realistic 3-D (October 2026).

## Verify

What was checked: `npm test` passes; in Chrome on Intel UHD integrated graphics, every screen loads with no console errors, and fights run on all seven stages with every character. GPU time for the 3-D scene is 2–5 ms per frame on every stage. Watched in motion: idle, walking, running, jumping, a few attacks, Riley's bark, Randy's boulder.

- [ ] **Real frame rate.** The GPU timing above leaves out CPU work (posing, skinning uploads, the per-frame copy of the 3-D picture into the 2-D canvas, HUD portraits). Play for a few minutes in a visible tab with a frame counter on each stage. If it's slow, check `game.view.scale` (the adaptive resolution) first.
- [ ] **Poses not yet seen in motion.** Every pose was set by hand without a visual pass: shield, roll, spot dodge, air dodge, ledge hang and climb, knockdown, get-up, defeat, victory, dizzy, grab and grabbed, helpless, Quackers' glide and flapping air jumps, Riley's dig, every character's smash attacks, aerials, specials and throws. Expect some to need adjusting (limbs through the body, feet sliding, the wrong lead leg).
- [ ] **Untested paths:** 2-player versus, the result screen, a mirror match (same character twice), unlocking Dad on character select, rematch from the result screen.
- [x] **Effects** checked frame by frame (Dad vs Quackers, Sunny Meadow) and fixed: afterimages now trail behind the fighter instead of washing over it; faded bodies (dodges, invincibility blink) no longer show their far side through themselves; the charge glow is a gold rim, visible on white Quackers without bleaching dark Dad; the Tie Whip flings the tie forward during the hit (it swung backward, behind his body, and too late); Bad Breath is a visible cloud of puffs. The hit flash, armor flash and egg looked right. The hit flash now ends in a flickering red-orange glow, which should read on all-white Quackers (not yet looked at).
- [ ] **Gary (new).** Checked in the browser: select card and portrait, Flamethrower, Fire Breath, Ring of Fire, Hot Foot's ember patch, Phoenix Rise, the burn glow and BURN! callout. Not yet seen: his aerials, throws, Statue Drop, the douse in water, ledge and knockdown poses, and a full match against the CPU in a visible tab.
- [ ] **Hit feel (new).** Checked frame by frame in Chrome (Riley vs Dad): a smash hit, a jab-jab-chomp combo through real key presses (buffered), a block on the volcano, and a KO; and a full CPU-vs-CPU match through to the result screen with no console errors. The camera's 3-D and 2-D transforms were checked numerically to line up under zoom and roll. Not yet felt at full speed with a person playing: tune `HIT_TIERS` (hitstop, shake, punch) and the impact light (`LIGHT_PEAK` in `render3d/fight-view.js`) by hand. Also check that multi-hit fire moves (Flamethrower) don't stutter from repeated hitstop, and the frame rate during a busy KO on Intel UHD.
- [ ] **Tar pits:** the last change (lower specular) to stop the tar reading as grey water hasn't been looked at.

## Online play (v1, October 2026)

What was checked: `npm test` (two simulated computers over a laggy network stay identical frame by frame). In Chrome on this machine, two copies of the game in one page (host and guest, real PeerJS + WebRTC): invite, join, lobby picks and stage, a full match to the result screen with every frame's state hash matching (1,500+ frames compared, 0 mismatches), rematch through the lobby, the stall notice and recovery when one side pauses, the guest closing their page mid-fight, and an expired invite link.

Not yet tried: two different computers on different networks (latency, NAT), the `C` copy-link key (needs a real key press), controllers online, Firefox / Safari, and the GitHub Pages deploy itself.

Corners cut for v1:

- [ ] **Relay (TURN) server is PeerJS's shared public one.** Most pairs connect directly, but roughly 1 in 10 (strict or corporate NATs, some mobile hotspots) need a relay. PeerJS's defaults include free shared TURN servers (eu-0/us-0.turn.peerjs.com) with no guarantees on capacity or latency. If friends see "Couldn't reach your friend's game" or high ping, add our own TURN service (Cloudflare Calls TURN, or Metered's free tier) to the `Peer` config in `net/online.js`.
- [ ] **Delay-based, not rollback.** Every press shows up 3 frames late, and a link slower than ~50 ms one way stalls. Rollback (predict the remote input, rewind and resimulate) needs save/restore of the whole fight state, plus effects and sounds that tolerate replays.
- [ ] **Desyncs are only reported.** If the two copies drift apart (most likely between different browsers: `Math.sin`, `Math.pow`, `Math.hypot` aren't guaranteed identical, and a few are used in `fighter.js` and `state-machine.js`), the game says "out of sync" but plays on. Fix options: replace those calls with deterministic versions, or have the host send a state snapshot to resync.
- [ ] **A hidden tab freezes the game for both.** The browser stops drawing a tab that's in the background, so if either player switches tabs, both stall until they come back. Could keep simulating on a timer while hidden, or pause with a notice.
- [ ] **Depends on the free PeerJS servers** (0.peerjs.com) for introductions. If it's down, nobody can start a game. Self-hosting PeerServer, or a different signaling path, would remove the dependency.
- [ ] **No stage preview or random stage in the online lobby**, no CPU-level or secret-character code there, and no way to cancel the 'ready' of the other player. The secret character can be picked online only if you unlocked it on your own page first.
- [ ] **The invite link can't be selected with the mouse** (it's drawn on the canvas). `C` copies it; if clipboard access is refused the player has to type it.
- [ ] **One-off black 3-D picture.** In the two-copies-in-one-page test, the first guest's fight once rendered nearby objects black (sky and far trees fine). A fresh guest rendered correctly and it didn't come back. Likely a test artifact (two WebGL games in one hidden tab), but watch for it when a guest arrives straight from an invite link.

## Improve

- [ ] **Riley's moveset vs. Riley's body.** Riley is now a four-legged dog; some move names still assume paws as fists ("Paw Jab"). Rename moves or rework poses so every move reads as something a dog does.
- [ ] **Dad's silhouette.** The big pale shirt dominates; a darker or patterned shirt, or a larger head, would read better at game size.
- [ ] **Background trees** are still visibly low-poly up close (conifer cones, broadleaf blobs). Push them further back or give them more detail.
- [ ] **Startup time.** Models and worlds build on the main thread at launch (a few seconds). Building in a Web Worker, or caching the built meshes, would shorten it.
- [ ] **GPU memory.** All seven worlds stay loaded (each sky is a cube map plus an environment map). Fine on the test machine; unload worlds not in use if memory becomes a problem.
- [ ] **UI style.** Menus, HUD and callouts are still the hand-drawn ink style, which now sits next to realistic 3-D. Decide whether to restyle them.
- [ ] **Quality ceiling.** Code-built models top out below sculpted, textured ones. If higher fidelity is wanted, the next step is characters modeled in Blender and loaded as glTF (`render3d/creature.js` would gain a loader; the pose system and `apply()` can stay).
- [ ] **No WebGL fallback.** Without WebGL 2 the game can't start. Show a message instead of a blank canvas.

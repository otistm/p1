# Architecture Decision Records

One line per decision: context → decision → why. Newest at top.

- **2026-07-01 — Three distinct circuits + location × real-time-of-day environments.** Context: the
  three cups were one loop under three time-of-day tints, which read as the same track recoloured.
  Decision: authored three distinct layouts (Verdant Loop / Coral Coast / Summit Pass — different
  shapes, directions and lengths) and split the environment into two orthogonal axes — *location*
  (biome, fixed per track: ground + `SceneryStyle`) and *time of day* (sky/fog/lights, from the
  player's real local clock via `timeOfDayNow`, re-checked each minute). `RoundDef.theme` was deleted;
  the track owns its location. Why: separating "where" from "when" gives each cup an unmistakable
  sense of place while letting any circuit be seen at dawn/noon/dusk/night as real time passes — far
  more variety than a fixed per-cup mood, for the same instanced draw-call budget. Layouts are guarded
  by geometry (distinct lengths, no self-overlap, on-ground) + drivability tests so hand-authored loops
  can't silently ship broken.

- **2026-07-01 — Title-screen Dev Notes changelist.** Context: testers running a build had no way to
  see what changed in it. Decision: a `DevNotes` tag on the title screen opens a changelist from a
  hand-maintained `packages/ui/src/devNotes.ts` (newest-first `DEV_NOTES`, `DEV_BUILD` = latest
  date), and an alwaysApply rule (`.cursor/rules/dev-notes.mdc`) requires updating it on every commit
  + push. Why: a data file + rule is controllable and player-facing, vs auto-scraping git log (noisy,
  dev-facing); keeps the visible build changelog honest without a build step.
- **2026-07-01 — Vitals data folded into the post-race analysis.** Context: the live vitals gauges
  (speed/stamina/corner) vanished at the flag, so the results breakdown couldn't show how those
  played out over the race. Decision: the sim banks per-lap aggregates for *every* racer
  (`Racer.lapStats`: peak/avg speed, avg corner load, end-of-lap stamina) in lockstep with
  `lapSplits` — banked on the fixed step that crosses the line, so it's deterministic and
  frame-batching-invariant, render/result-only — exposed on `RaceResultRow.lapStats`; `RaceAnalysis`
  adds a Position/Speed/Stamina/Corner metric switch that re-renders the lap columns through each
  lens. Why: makes the analysis a true replay of the vitals HUD for the whole field, at zero
  determinism cost (pure recorded data). Corner load is computed for all karts now (was player-only).
- **2026-07-01 — Live performance vitals + lap-by-lap race analysis.** Context: the telemetry work
  showed *which* effects were armed and *why* they triggered, but not the live *magnitude*, and the
  results screen only listed final times — the player couldn't watch their stats move or dissect how
  the   race was won. Decision: (1) the sim exports a render-only `Racer.live` (player only): the true
  per-tick physics `speedFrac` + `gripLoad` **plus** the tuning bag mults + fade. The consolidated
  `RaceVitals` panel (absorbs the old stamina bar + `RaceTuningPanel`) renders STAMINA/SPEED/CORNER
  as 0..1 gauges that move every tick, and pops signed-% magnitude chips for the live tuning bag.
  (Corrected from a first pass that rendered only the tuning multipliers as baseline-×1 gauges —
  those stay flat unless an effect fires, so they looked frozen; the live speed/corner readouts are
  the "moves like stamina" the request asked for.) (2) the
  sim records `Racer.lapSplits` (cumulative crossing time per lap — mid-track laps via the seam
  counter, the final lap at the finish line, guarded to exactly `laps` per finisher) surfaced on
  `RaceResultRow.{lapSplits,laps}`; a new `RaceAnalysis` tab derives per-lap positions, lap times,
  place-change arrows, and the fastest lap. Why: both are pure recorded/derived data (no sim
  behaviour change, determinism intact) that turn the auto-race from a black box into something the
  player can read live and review afterwards.
- **2026-07-01 — In-race TUNING readout + situation telemetry.** Context: staged tuning effects
  fired invisibly and the proc pop (item 12) is transient — the player couldn't see what was armed
  or *why* it did/didn't trigger, unlike the always-on stamina bar. Decision: the sim maintains a
  render-only `Racer.telemetry` (drafting/draftDist/cleanAir/traffic/beingDrafted/inCorner) for the
  *player only*, reusing the `EffectContext` already built when a kart carries effects (zero extra
  cost, no determinism impact); the HUD poll (~30Hz) reads it plus `activeEffects` into
  `HudData.{tuning,situation}`, and a new `RaceTuningPanel` (twin to the stamina bar) lists each
  staged effect with a live ON state and a chip strip of the gating facts. Effect labels/tints live
  in a shared `ui/effectMeta.ts` (also used by `RaceProcFx`) so the two never drift. Why: turns
  opaque card outcomes into readable, teachable feedback without leaking presentation into the sim.
- **2026-07-01 — Phase 3 (item 13) theme-per-cup + cosmetic trails.** Context: the review
  ([game-review.md](game-review.md) §6) wanted cups to feel distinct and cosmetics to matter, but
  every round rendered the same bright meadow and the only cosmetic was livery colour. Decision:
  (1) `TrackMeta.theme` (`meadow`/`sunset`/`night`) now resolves a full `ThemePreset`
  (`render/src/world/theme.ts`: sky gradient, fog, 3-light rig, ground/foliage tints) threaded
  through `GameCanvas`/`SceneEnvironment`/`TrackWorld`, and each `RoundDef` carries a theme so the
  season escalates day → dusk → night on the *same* geometry (cheap, high-impact). (2) A `trail`
  cosmetic kind + `PlayerSave.trailId` (default, migrated at save **v5**), picked on the title
  screen, tints the player's in-race wake; the shared trail `InstancedMesh` uses per-instance
  colour so the leader keeps their own tint at no extra draw call. Why: differentiates cups without
  new tracks and gives cosmetics an at-speed payoff. Trail unlock/shop-gating deferred.
- **2026-07-01 — Phase 3 (item 12) race-time tuning FX; motion blur skipped.** Context: staged
  tuning effects fire mid-race but were invisible, and the review wanted feedback anchored to the
  kart; motion blur was de-scoped by direction. Decision: the sim exposes which effects applied
  each tick via a render-only `Racer.activeEffects` (an optional `fired` sink pushed inside each
  active branch of `evaluateEffects` — no determinism impact); `RaceField` edge-detects the
  *player's* procs with a per-kind cooldown, projects the kart world→screen, and calls `onProc`;
  the app pops a labelled `RaceProcFx` chip that floats up (reduced-motion disables it). Why: keeps
  presentation entirely out of the sim, reuses the one per-frame loop, and needs no new state on
  the hot path.
- **2026-07-01 — Phase 3 (item 11) in-world race VFX: instanced scuffs + leader wake.** Context:
  the screen-space speed cue landed the "speed doesn't read" fix, but the review
  ([game-review.md](game-review.md) §6) also asked for ground skid marks and a leader trail, and
  the in-race draw-call budget is thin (`rendering-budget.md`). Decision: `packages/render/src/raceFx.ts`
  provides both as **one `InstancedMesh` each** (2 draw calls for the whole field) — dark flat
  **square** scuffs recycled through a ring buffer (squares need no yaw, so overlapping rear-wheel
  drops read as a continuous smear), gated on |roll|+speed and distance-spaced; a **leader wake**
  of additive quads tinted to the leader's colour that fades by scaling toward zero. Driven from
  `RaceField`'s existing per-frame loop (no new frame loop, zero per-frame allocation); rebuilt per
  race so scuffs clear. Why: delivers the requested feel without per-particle meshes, stays far
  under the budget, and `prefers-reduced-motion` simply omits the animated wake (and its call)
  while keeping the informative static scuffs.
- **2026-07-01 — Phase 3 (item 14) race agency: 1×/2× + skip, determinism-preserving.** Context:
  the review ([game-review.md](game-review.md) §1) flagged the race as fully passive — no way to
  speed it up or skip ahead, which stings on repeated seasons. Decision: add top-right race
  controls — a 1×/2× playback toggle and a Skip→result button — both driving the *same*
  deterministic engine. 2× scales the frame `dt` handed to `engine.step` (new `RaceField.speed`
  prop); Skip mirrors `RaceEngine.resolve` (fast-forwards fixed sub-steps to the finish, reports
  once, guarded against double-fire). State lives in `RaceSession` (`raceSpeed`/`skipRace`),
  rendered by `RaceHud` when `running && !countdown`. Why: agency without risk — the fixed
  timestep means neither control changes the outcome, only the wait. Ghost identity was already
  surfaced (board/results label `Dragon (ghost N)` vs `(you)`), so no extra work there.
- **2026-07-01 — Phase 3 (item 11) race speed VFX: screen-space first.** Context: the review's
  headline experiential gap ([game-review.md](game-review.md) §6) is that speed doesn't read in
  the passive race, and the draw-call budget is thin (`rendering-budget.md`). Decision: start with
  a **screen-space** `SpeedFx` overlay (speed-reactive vignette + radial speed lines) in the DOM
  HUD, fed by a new `HudData.speedFrac` (player speed ÷ top speed), rather than 3D particles. Why:
  it adds **zero draw calls**, is trivially `prefers-reduced-motion`-guarded (vignette-only
  fallback), and directly targets "speed doesn't read" without touching the render budget. Tuned
  subtle on the single corner-heavy track (peaks near top speed). Skid decals + leader trail
  (instanced 3D) and motion blur deferred within Phase 3.
- **2026-07-01 — Phase 2b (item 9) onboarding + mid-season garage hatch implemented.** Context:
  the review ([game-review.md](game-review.md) §1) flagged no first-time onboarding and a
  one-way training funnel (no way to re-equip parts mid-season without finishing it). Decisions:
  (1) a `<CoachMarks>` overlay shows once-only contextual tips on the first garage + training
  visits, backed by a standalone `localStorage` key (no save-version bump); (2) a mid-season
  **re-equip hatch** — a new `garageReturn` phase + `editBuild`/`closeGarage` store actions let
  training open the garage and return without the `startSeason` reset; the garage swaps its
  primary CTA to `Back to Training →` when `garageReturn === 'training'`. Why: lower the genre's
  core retention risk (everything-at-once) and un-trap mis-builds, while keeping the season state
  machine safe (no accidental reset) and avoiding a save migration. The e2e now dismisses the
  coach marks so first-run is exercised.
- **2026-07-01 — Game-review Phase 2 (accessibility + UX consolidation) implemented.** Context:
  the review ([game-review.md](game-review.md) §5–7) flagged no shared type scale (7 heading
  sizes; the most-used CTA was the smallest), 9–11px `--muted` text below WCAG small-text
  guidance, two parallel tuning-card components, duplicated `SLOT_LABEL`, inconsistent copy, no
  fixed wallet, and stale draft/motion-blur doc claims. Decisions: (1) put a **rem-based type
  scale** + one primary-CTA size + `.btn.sm` in `global.css` and drop per-call font overrides;
  (2) **lighten `--muted` `#8b93a3`→`#a6afc0`** (~7:1 on panels), raise all label text to a 12px
  floor, and add the missing `--amber` var; (3) one **`--disabled-opacity`** token; (4) collapse
  `CardView` + `TuningCardFace` into **one `<TuningCard size>`** and move `SLOT_LABEL`/`SLOT_ORDER`
  to `theme.ts`; (5) copy sweep (one "Shop" verb, honest shop/staging description, off-podium
  consolation on results); (6) a single persistent top-left **`<Wallet>`**; (7) doc/comment sweep
  (removed card-draft references, corrected the motion-blur claim to Phase 3). Deferred item 9
  (onboarding coach marks + mid-season garage hatch) to a **Phase 2b** — it's net-new UI +
  navigation with balance implications, out of scope for a pure a11y/consolidation pass. Why:
  ship the low-risk correctness/legibility wins now; keep tokens as the single source of truth so
  future screens inherit accessible defaults. Verified green (typecheck/lint/49 tests/build/e2e +
  in-browser visual check).
- **2026-07-01 — Game-review Phase 1 (correctness + balance) implemented.** Context: the review
  ([game-review.md](game-review.md)) flagged a P0 (loadout `mass` never reached the sim), a
  free-Rest over-training loop, a punishing tuning economy, and a skewed archetype spread +
  steep difficulty ramp. Decisions: (1) thread `mass` end-to-end (`Entrant.mass` →
  `derive(stats, mass)`, default `REF_MASS = 170`) and make the sim *use* it — mass-weighted
  collisions (reduces to the old 0.5/0.5 split at equal mass) + `accel × REF_MASS/mass`; (2)
  cap stat-training at `MAX_TRAINING_SESSIONS_PER_ROUND = 6`/round (`SeasonState.sessionsThisRound`),
  Rest only refills energy to spend on capped sessions; (3) keep single-use tuning consumption
  but add off-podium consolation (`FINISH_PAYOUT = [120,70,35,22,14,9]`) so losses aren't a
  wipe; (4) retune `derive` (de-weight endurance, trim Wit, lift Speed/Power) + nudge two
  outlier archetype stat lines. Why: correctness first, validated with data — archetype
  head-to-head went 57/34/7/1/0.5 → 36/32/18/13/0.4 and the fix *also* healed the ramp
  (developed win% 88→40→12 became 86→93→56), so `rivalScale` was left untouched. Consequences:
  `tools/diag/season.ts` gained a money/shop/consume model; regression tests lock the mass path;
  Blitz (pure Speed) stays ~0% on the single corner-limited track — a track-variety follow-up,
  not a coefficient hack. Verified: typecheck, lint, 49 unit tests, build, and the e2e smoke all
  green.
- **2026-07-01 — Full game review authored (`docs/game-review.md`).** Context: a studio-wide,
  role-lensed audit was requested to find inconsistencies, balance/correctness issues, UX/VFX
  gaps, and genre-competitive deltas, evidence-backed and correctness-first. Decision: capture
  it as one review artifact with `file:line` citations + external sources and a phased roadmap
  (Phase 1 correctness+balance, Phase 2 a11y/UX, Phase 3 VFX); no code changed this pass. Why:
  a single evidence trail lets the team schedule fixes by severity. Top finding is a **P0**:
  loadout `mass` never reaches the sim (`snapshots.ts` drops it; `engine.ts` calls
  `derive(e.stats)` with no override → default 170), so ballast is physics-inert. Other leads:
  full-burn tuning economy runs ~220 credits/race in the red; free `train.rest` enables
  unbounded pre-race over-training; all-rounder still over-wins vs the 10–30% target. Follow-up:
  extend `tools/diag/season.ts` to model money/shop/consume before any live economy tuning.
- **2026-07-01 — Unified card DB + consumable 4-card tuning hand + drag-to-kart + reroll shop
  (implemented).** Context: the design below shipped as code (`packages/content/src/cards.ts`
  + `schema.ts`, `packages/game/src/{types,economy,season,store,snapshots}.ts`,
  `packages/ui/src/{components/KartDropZone,components/KartInspector,screens/TrainingScreen,
  screens/ShopScreen}.tsx`). Decision: keep the design's shape exactly (see
  [training-tuning-cards.md](training-tuning-cards.md) §6-7 for the final state model), with
  two implementation calls the design left open — (1) the kart drop target is a screen-space
  DOM overlay (`KartDropZone`), not real 3D raycasting into the R3F canvas, to avoid an
  `ui → render` DOM/React dependency; (2) clicking a card (not just dragging) also plays it,
  and clicking a staged card un-stages it, as accessibility/undo affordances on top of the
  drag verb. `SAVE_VERSION` 3→4 shipped with an `ownedCardIds`-clamp-to-4 migration (no
  `SeasonState` migration was needed — it was never persisted). Why: matches spec while
  respecting the `ui`/`render` package boundary from `coding-standards.mdc`. Follow-up: the
  burn-rate/reroll-affordability/energy-pacing risks in training-tuning-cards.md §8 are still
  unresolved — run `tools/diag/season.ts` before any live balance pass.
- **2026-07-01 — Unified card DB + consumable 4-card tuning hand + drag-to-kart + reroll shop
  (design).** Context: the equip-up-to-3 (`EQUIP_SLOTS`) persistent model surfaced the
  collection but gave no reason to keep buying (cards were a one-time purchase), and training
  vs tuning lived in two separate types (`Training` + `Card`). Decision (documented in
  [training-tuning-cards.md](training-tuning-cards.md), not yet coded): merge both into one
  `CardSchema` with a `kind: 'training' | 'tuning'` discriminant; players **own ≤4 tuning
  cards**, **play** them by dragging onto the kart (staged for one race), and those cards are
  **consumed** when the race resolves; training cards stay permanently in hand and are gated by
  **energy only** (retire `turnsLeft`); the kart can be **selected** to inspect its build +
  staged tuning; the shop shows **4 rotating slots** with **up to 2 paid rerolls** (cost 20,
  doubling to 40). Why: consumption keeps the shop relevant every race, a single database
  makes content one-stop, and drag-to-play reads clearer than a click-toggle. Follow-up: a
  `SAVE_VERSION` 3→4 migration and a season-harness burn-rate pass when implemented.
- **2026-06-30 — Shop + card hand replace the in-run draft; podium-only currency.** Context:
  the per-round draft (pick 1 of 3 random owned cards) hid the collection and gave no reason
  to keep racing. Decision: remove the `draft` phase entirely; add persistent `money`
  (`PlayerSave`, `SAVE_VERSION` 2→3 + migration) earned **only** on the podium
  (`racePayout(rank, round)`, ranks 1/2/3, scaled by round); a full-catalog `ShopScreen`
  sells live tuning cards priced by rarity (`cardPrice`); and the Training screen presents a
  fanned TCG-style hand (`CardHand`) of always-available training cards + owned tuning cards,
  which the player equips directly up to `EQUIP_SLOTS` (3, replacing `season.draftedCardIds`
  → `equippedCardIds`). Starter pool trimmed to 4 cards so the shop has stock; Phase-2 cards
  stay out of the shop via `LIVE_CARD_IDS`. Why: buying → equipping → racing is a legible
  progression loop that surfaces the whole collection and rewards finishing well, with no sim
  changes (effects still assembled from the equipped ids). Verified in-browser end to end
  (earn 1st = +120 → buy epic → equip cap → carry across rounds).
- **2026-06-30 — Rank by re-projected track position, not dead-reckoned distance.** Bug: the
  live board showed karts in different places than the track and didn't update as karts
  passed. Root cause (measured, not guessed, via `tools/diag/standings.ts`): `prog`/`cp`
  accumulated the along-track component of each step's *movement* (dead reckoning), so it
  missed collision shoves (`resolveCollisions` edits `x,z` after the step), wall slides, and
  lane changes — drifting up to ~85 m from the real position and disagreeing with the track
  on ~96 % of ticks (player mis-placed up to ~60 %). Decision: every fixed step, re-project
  the kart's actual `(x,z)` onto the centerline and accumulate a **seam-corrected delta**
  into `cp` (`prog = lap*length + raw`), the industry-standard measure (verified vs Facepunch
  `s&box` `RaceStandings.cs`, Unreal/Godot refs). Why: the board is now derived from the same
  position the renderer draws, so it matches the track — residual disagreement is the ≤1-tick
  (16 ms) projection-phase latency, below the HUD poll period. Guarded by a new
  `engine.test.ts` case; HUD poll bumped 15→30 Hz for snappier updates.
- **2026-06-30 — Disambiguate ghost names + mark the player on the leaderboard.** Bug: the
  HUD board and results showed several identical "Comet" rows because async ghosts are the
  player's own past builds (same name), so it looked like the player was P1/P2 when those
  were ghosts and the real player was last — the ranking was correct, the labels weren't.
  Decision: `makeOpponents` suffixes ghosts ` (ghost)` / ` (ghost N)`, and the HUD/results
  render the player's row as `name (you)` in bold cyan. Why: the leaderboard now reads
  unambiguously with zero sim changes; verified in-browser (player win + last-place cases
  both read correctly).
- **2026-06-30 — Cards carry deterministic triggered effects, applied to all entrants.**
  Context: flat-only `mods` made identical decks play identically and ignored the rich
  spatial state the sim already tracks. Decision: add an optional `CardEffect` (`@grid/sim`
  `effects.ts`) — pure handlers turn a per-tick `EffectContext` (proximity bubble, draft
  column, clean air, apex/corner side, rank/last-lap) into a modifier bag layered onto
  `derive()` output; effects are attached to player, ghosts, and rivals. Phase-1 ships 7
  proximity/position cards; Phase-2 (heat/tyre/drift-KERS/rubber/kerb/hazard) is scaffolded
  but gated off (`isPhase2Kind`). Why: situational depth and "identical decks diverge"
  without touching the kinematic model. Determinism guards: effects are optional
  (absent → existing seeds unchanged), rank is recomputed every fixed sub-step (rank-effects
  stay frame-batching invariant), and all effect rolls use a **per-racer seeded RNG**
  (`hashSeed(seed, index, 0xeffec7)`) drawn only on fixed sub-steps. Save: `BuildSnapshot`
  gained `cardIds` (ghosts replay their effects); `SAVE_VERSION` 1→2 with a migration.
  Balance: the season harness shows effects are net-neutral on win/podium while adding
  overtakes.
- **2026-06-30 — Finish order uses sub-step crossing time + progress tie-break, never array
  index.** Bug: the player was shown winning races they hadn't. `finishTime` was the fixed
  step's end time, so every kart crossing in the same 1/60 s tick tied, and the rank sort fell
  back to entrant array order — the player is always entrant 0, so they won all photo finishes.
  Decision: record `finishTime = ctx.time - (overshoot/alongThisStep)*dt` (the real moment the
  line was crossed) and tie-break equal times by `prog`. Why: ordering now reflects who was
  actually ahead, with zero determinism cost (pure per-step arithmetic; the engine always
  sub-steps `FIXED_DT`, so it's frame-batching invariant).
- **2026-06-30 — Garage is a leader-line blueprint over the live kart, not a stats panel.**
  The old garage stacked a parts list + stat card on top of the showroom kart, hiding the
  thing being built. Decision: the `GarageScreen` overlay pins per-slot callouts around the
  3D `ShowroomKart` with SVG leader lines to the actual part on the kart, each opening an
  in-place popover of owned options showing signed stat-delta chips (the trade-off). To keep
  the line anchors stable, the showroom holds a fixed 3/4 azimuth in the garage phase
  (`ShowroomKart` gained `angle`/`radius`/`height` props; `orbit=false` in `garage`). Anchor
  targets are a single `LAYOUT` table of viewport-% points tuned to that fixed camera, so the
  diagram is re-tunable without touching 3D projection. Trade-off: anchors are camera-coupled
  (must retune if the garage framing changes) in exchange for staying entirely in the UI layer
  and respecting the `render`-can't-import-`ui` boundary.
- **2026-06-29 — Renderer interpolates fixed-step state via `engine.alpha`.** Raw sim reads
  vibrated the whole scene on high-Hz displays; decision: snapshot `prev*` per racer + expose
  the accumulator fraction, render `lerp(prev,cur,alpha)`, and use `1-exp(-k*dt)` smoothing.
  Decouples the fixed 60 Hz sim from display refresh without touching determinism.
- **2026-06-29 — Synthesized audio, no sound assets (Phase 5).** Engine note is a filtered
  sawtooth whose pitch/volume track the sim's speed each frame; countdown/finish are short
  oscillator blips. Zero binary assets, tiny code, and a single user-gesture resume keeps
  it browser-policy compliant. See `packages/audio/src/AudioBus.ts`.
- **2026-06-29 — Playwright smoke gates the runtime (Phase 5).** Unit tests cover the sim;
  the e2e boots the production bundle with a real WebGL canvas and walks title→race HUD,
  asserting zero page errors. Tests inject `animation/transition:none` for click-stability
  (decorative-only motion), so it doubles as a reduced-motion check.
- **2026-06-29 — three.js kept as its own long-cached chunk.** Core three is inherently
  >500kB; rather than trim features we split `three` / `r3f` vendor chunks and raised the
  size-warning threshold. gzip: three 176kB, r3f 105kB, app 32kB.
- **2026-06-29 — Custom analytical sim over a rigid-body engine.** Cross-machine
  determinism is required for async snapshot racing & server re-sim; a general physics
  engine makes that hard. Decision: kinematic free-body karts on a racing line; physics
  lib reserved for cosmetic debris only.
- **2026-06-29 — npm workspaces instead of pnpm.** pnpm wasn't installed; npm 10
  workspaces deliver the same monorepo with zero extra global tooling. Packages are
  consumed as TS source via Vite/Vitest aliases (no per-package build in dev).
- **2026-06-29 — Async snapshot racing.** (See `multiplayer-async.md`.) No live netcode;
  opponents are builds re-simulated locally and verified server-side later. Scales
  infinitely, no latency coupling.
- **2026-06-29 — Hybrid economy.** Persistent collection + in-run draft. Long-term
  progression plus per-run build variety. Cosmetic-only monetization to stay non-P2W.
- **2026-06-29 — React + R3F + Three.js (WebGPU primary, WebGL2 fallback).** Largest
  ecosystem, fits the React app, near zero-config WebGPU. (See `rendering-budget.md`.)
- **2026-06-29 — Keep the five legible ratings (speed/stamina/power/guts/wit).** Proven
  in the prototype's `derive()`; maps cleanly from kart parts and reads clearly to
  players. Parts → ratings → physics is the layered model.

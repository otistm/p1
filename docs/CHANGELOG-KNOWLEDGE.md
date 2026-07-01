# Knowledge Base Changelog

Relay log — what changed in `docs/`, so the team stays in sync. Newest at top.

- **2026-07-01 (Dev Notes accumulate + scroll)** — Dev Notes now **prepend** a new entry on every push
  (never merge into the previous one). Each `DevNote` has a unique `id`; the panel keeps a pinned
  header ("N updates · scroll for older builds") and a scrollable body with dividers + a "Latest"
  badge on the top entry. Rule `.cursor/rules/dev-notes.mdc` updated to match.

- **2026-07-01 (Summit Pass → switchback route)** — Reshaped Summit Pass into a portrait switchback
  cascade (per a reference layout): six vertical passes linked by five 180° hairpins, closed by a
  bottom sweep. Authored with a new `Turtle` path-builder in `packages/content/src/tracks.ts`
  (straights + fixed-radius arcs → dense points) because tight hairpins as single control points make
  Catmull-Rom cusp/fold the road; every hairpin is now a real 9m-radius semicircle. Road narrowed to
  `width: 6` so there's green between the passes; passes are 18m apart (no ribbon overlap). The lap is
  long (~738m), so the Grand Derby drops to **2 laps** (`ROUNDS[2].laps`). Guards (fold / self-overlap
  / drivability / distinct lengths) all hold; Summit Pass is now the longest lap, Verdant the shortest.

- **2026-07-01 (Fix: Summit Pass road-ribbon fold)** — Summit Pass's hand-authored points had a 1.86m
  tightest corner while the road/curb ribbon offsets each centerline sample by `width/2 + curb band`
  (~5.53m). Below that radius the inner edge inverts → distorted curves + z-fighting red/white curbs.
  Fix: regenerated Summit Pass from the smooth harmonic `loop()` (bounded curvature), lifting the min
  radius to ~9.7m while keeping it the shortest, busiest lap. Added a guard in
  `packages/content/src/tracks.test.ts` requiring every circuit's tightest radius to clear the ribbon
  offset with margin, so no future layout can ship a fold. (`buildTrack` builds the ribbon by parallel
  offset — a good reminder that min corner radius must exceed half the road width + curb band.)

- **2026-07-01 (Three distinct circuits + location × real-time-of-day environments)** — The season now
  races three genuinely different, hand-authored layouts (`packages/content/src/tracks.ts`): `SUNSET_DERBY`
  "Verdant Loop" (flowing, medium, anticlockwise), new `CORAL_COAST` (longest — long straights, a left
  hairpin + top chicane, clockwise) and new `SUMMIT_PASS` (shortest but most technical — esses, inner
  hairpin, valley chicane). `SEASON_TRACKS`/`trackForRound(round)` map cup → circuit. **Environment split
  into two orthogonal axes**: (1) **location/biome** — `TrackMeta.location` (`meadow`/`coast`/`alpine`)
  selects a `LocationPreset` (ground colour + `SceneryStyle`: tree count/shape/tiers, rock density, spread)
  in `packages/render/src/world/theme.ts`; (2) **time of day** — `timeOfDayNow()` reads the player's real
  local clock into a `TimePreset` (`dawn`/`day`/`dusk`/`night`: sky/fog/light rig), re-checked each minute
  in `App.tsx` (with a `?time=` override for testing). `RoundDef.theme` removed. `buildScenery` now takes a
  `SceneryStyle` (stacked-cone conifers, tall palms, rounded broadleaf); `buildGround` flat-radius widened
  to fit the bigger circuits. Guarded by new tests: geometry (distinct lengths, no ribbon self-overlap,
  on-ground) in `packages/content/src/tracks.test.ts`, drivability (full field finishes) in
  `packages/game/src/logic.test.ts`, and the clock→mood mapping in `packages/render/src/world/theme.test.ts`.

- **2026-07-01 (Title-screen Dev Notes changelist)** — Added a **Dev Notes** tag (top-right of the
  title screen) that opens a changelist panel, backed by `packages/ui/src/devNotes.ts` (`DEV_NOTES`
  newest-first + `DEV_BUILD` stamp). New rule `.cursor/rules/dev-notes.mdc` (alwaysApply): on every
  commit + push, prepend/extend today's `DevNote` with short player-facing bullets so testers see
  what changed in their build. Separate from this knowledge relay (team-facing).
- **2026-07-01 (Vitals data in the post-race analysis)** — The Analysis tab now echoes the in-race
  vitals HUD for the whole field. The sim records per-lap aggregates for *every* racer alongside
  `lapSplits` — `Racer.lapStats` (`topSpeed`/`avgSpeed`/`avgCorner`/`stamina`, banked in lockstep at
  each lap crossing, batching-invariant, render/result-only) surfaced on `RaceResultRow.lapStats`.
  `RaceAnalysis` gained a metric switch — **Position · Speed · Stamina · Corner** — so each lap
  column can be re-read through the same lens as the live gauges (peak km/h + avg, end-of-lap
  stamina %, avg corner-load %), each with a mini-bar and standout highlights (★ fastest lap / top
  speed). Engine test extended to assert one sane `lapStat` per lap per finisher. See `DECISIONS.md`
  + `game-review.md` §12.
- **2026-07-01 (Live vitals + lap-by-lap analysis — extends telemetry)** — Two additions so the
  player can *see the race, not just its result*. (1) **Live performance gauges**: the sim mirrors
  live physics to a render-only `Racer.live` (player only, zero determinism impact) — `speedFrac`
  and `gripLoad` are true per-tick values (climb on straights, spike into corners), plus the active
  tuning bag mults + stamina `fade`. A new `RaceVitals` panel (bottom-left, replaces the standalone
  stamina bar + `RaceTuningPanel`) shows **STAMINA / SPEED / CORNER** as 0..1 gauges that all move
  every tick like the stamina bar, and — when tuning is staged — the ON/idle effect list, signed-%
  **magnitude chips** that pop for whichever modifier is applying this instant (green boost / red
  penalty), and the situation chips. (Note: an earlier take showed the tuning multipliers as
  baseline-×1 gauges, but those sit flat unless an effect is actively firing, so they read as
  "stuck" — replaced with genuinely live speed/corner physics.) (2) **Race Analysis tab**
  in the results panel: `Racer.lapSplits` (cumulative crossing time per lap, recorded
  deterministically — final lap logged at the finish line) rides on `RaceResultRow.{lapSplits,laps}`;
  `RaceAnalysis` derives each racer's per-lap position + lap time, marks place swings (▲/▼) and the
  field's ★ fastest lap. Engine test guards exactly `laps` monotonic splits per finisher. See
  `DECISIONS.md` + `game-review.md` §12.
- **2026-07-01 (In-race tuning telemetry — extends item 12)** — The race HUD now shows *how the
  player's drafting choices behave*, like the stamina bar shows energy. New render-only
  `Racer.telemetry` (drafting/clean-air/traffic/defending/corner — player only, reuses the effect
  context, no determinism impact) plus `activeEffects` feed `HudData.{tuning,situation}` (~30Hz
  poll). A new `RaceTuningPanel` (by the stamina bar) lists each staged effect and lights it ON the
  instant it applies, with a live situation chip strip (Slipstream/Clean air/Traffic/Defending)
  explaining the triggers. Shared `ui/effectMeta.ts` keeps proc-pop + panel labels/tints in sync.
  See `DECISIONS.md` + `game-review.md` §12.
- **2026-07-01 (Cups & cosmetics: game-review Phase 3, item 13 done)** — Cups now look distinct
  and cosmetics pay off at speed. `TrackMeta.theme` (`meadow`/`sunset`/`night`) drives a full
  `ThemePreset` (`packages/render/src/world/theme.ts`: sky gradient, fog, 3-light rig,
  ground/foliage tints), threaded through `GameCanvas`/`SceneEnvironment`/`TrackWorld`; each
  `RoundDef` carries a theme so the season escalates **day → dusk → night** on the same track.
  New `trail` cosmetic kind (`content/cosmetics.ts`, 5 tints) + `PlayerSave.trailId` (default,
  **save v5** migration) picked on the title screen colours the player's in-race wake (shared
  trail mesh uses per-instance colour so the leader keeps their tint — still 1 draw call). Open:
  trails aren't yet unlockable/shop-gated. See `DECISIONS.md` + `game-review.md` §13.
- **2026-07-01 (Tuning FX: game-review Phase 3, item 12 done; motion blur skipped)** — Staged
  tuning effects are now visible mid-race. The sim exposes which effects applied each tick via a
  render-only `Racer.activeEffects` (optional `fired` sink in `evaluateEffects` — determinism
  untouched, unit-tested); `RaceField` edge-detects the *player's* procs (per-kind cooldown),
  projects the kart world→screen, and calls `onProc`; the app pops a labelled `⚡`
  `RaceProcFx` chip that floats off the kart and fades. `prefers-reduced-motion` disables it.
  Motion blur was intentionally de-scoped. See `DECISIONS.md` + `game-review.md` §12.
- **2026-07-01 (VFX: game-review Phase 3, item 11 done)** — In-world race VFX to match the
  screen-space speed cue. New `packages/render/src/raceFx.ts`: **tire scuffs** (dark flat squares
  laid at both rear wheels on hard corners — gated on |roll| > 0.14 and speed > 12, distance-spaced,
  recycled through a 512-slot ring buffer) and a **leader wake** (additive quads behind whoever
  holds P1, tinted their kart colour, fading by scaling toward zero). Each is a single
  `InstancedMesh` → **2 draw calls total** for the whole field (well under the ~150 in-race
  ceiling); driven from `RaceField`'s existing per-frame loop with zero per-frame allocation and
  rebuilt per race so scuffs clear. `prefers-reduced-motion` keeps the static scuffs but drops the
  animated wake. `rendering-budget.md` documents the instancing pattern; see `DECISIONS.md` +
  `game-review.md` §11. Phase 3 remaining: motion blur + race-time card/tuning FX (item 12),
  cosmetic trails/track theming (item 13).
- **2026-07-01 (Agency: game-review Phase 3, item 14 done)** — The auto-race is no longer fully
  passive. New top-right controls (clickable HUD cluster): a **1×/2× playback toggle** and a
  **Skip → result** button. Both drive the *same* deterministic engine — 2× scales the frame `dt`
  fed to `engine.step` (new `RaceField.speed` prop), Skip mirrors `RaceEngine.resolve`
  (fast-forwards fixed sub-steps to the finish, then reports once) — so neither changes who wins,
  only how long you watch. Wiring: `RaceSession` owns `raceSpeed`/`setRaceSpeed`/`skipRace`;
  `RaceHud` renders the controls when `running && !countdown`. Ghost/past-build identity was
  already surfaced (board + results read `Dragon (ghost 1/2)` vs `Dragon (you)`). See
  `DECISIONS.md` + `game-review.md` §14. Remaining Phase 3: in-world skid decals + leader trail
  (item 11), motion blur (item 12), cosmetic trails/track theming (item 13).
- **2026-07-01 (VFX: game-review Phase 3, item 11 started)** — First race speed cue that reads
  without touching the draw-call budget. New `packages/ui/src/components/SpeedFx.tsx`: a
  **screen-space** overlay (speed-reactive vignette that tightens toward top speed + radial speed
  lines that rush outward, masked to the edges) driven by a new `HudData.speedFrac` (player speed
  ÷ top speed) threaded `RaceSession → RaceHud`. Composited DOM → **zero extra draw calls**;
  `prefers-reduced-motion` gets the static vignette only (streaks disabled). Deliberately subtle
  on the current single corner-heavy track (peaks near top speed). `rendering-budget.md` updated.
  Remaining Phase 3: skid decals + leader trail (instanced 3D), motion blur (item 12), cosmetic
  trails/track theme (item 13), race agency/framing (item 14). Verified: typecheck, lint, 49
  tests, build, e2e — all green.
- **2026-07-01 (onboarding+UX: game-review Phase 2b, item 9)** — Closed the last Phase 2 item.
  New `packages/ui/src/components/CoachMarks.tsx`: once-only, contextual first-run tips on the
  first **garage** ("build your kart") and **training** ("drag cards onto your kart") visits,
  backed by a standalone `localStorage` key (`p1-coach-v1`, no save migration). New **mid-season
  garage hatch**: store gained `garageReturn` + `editBuild`/`closeGarage`; training's `Edit Build`
  opens the garage as a re-equip surface ("Edit build · re-equip owned parts") with `Back to
  Training →` instead of the season-resetting `Start Season`, so a mis-build can be fixed between
  rounds without finishing the season. The e2e smoke test now dismisses the coach marks so the
  real first-run path is exercised. Verified green (typecheck/lint/49 tests/build/e2e) + in-browser
  walkthrough (garage coach → training coach → Edit Build → Back to Training).
- **2026-07-01 (a11y+UX: game-review Phase 2)** — Shipped the review's accessibility +
  consolidation phase (§5/§7/§6 doc items). **Type system:** `global.css` now owns a rem-based
  type scale (`--fs-label`…`--fs-hero`, ~1.25 ratio on a 16px base) so text honours browser
  zoom, plus one primary-CTA size — the training "Head to Race Day →" is no longer the smallest
  primary button (it now uses the shared `.btn`), and a `.btn.sm` token replaced the ad-hoc
  ghost-button sizes. **Contrast:** `--muted` lightened `#8b93a3` → `#a6afc0` (~4.9:1 → ~7:1 on
  panels), sub-12px label text raised to the 12px floor across garage/training/shop/inspector,
  and the never-defined `--amber` var (silently breaking `MoneyBadge`) was added. **One disabled
  token:** `--disabled-opacity: 0.45` now drives `.btn:disabled` and card dimming (was 0.35–0.45
  ad hoc). **Card unification:** `CardView` + the inline `TuningCardFace` collapsed into one
  `<TuningCard size="hand|shop">` (deleted the duplicate); `SLOT_LABEL`/`SLOT_ORDER` moved to
  `theme.ts` and shared by the garage + inspector. **Copy:** one verb ("Shop" everywhere, was
  "Visit Shop" on results), the misleading shop line now describes *buying* (collection) vs
  *staging* (training), and results shows the new off-podium consolation instead of "no
  winnings." **Persistent wallet:** a single top-left `<Wallet>` (mounted in the app shell)
  replaced the four differently-placed balance badges. **Doc/comment sweep:** stale *card-draft*
  references removed from `README.md`/`docs/README.md`/`economy-cards.md`/`content-schema.md`/
  `umamusume-loop.md`/`prototype/README.md`; `rendering-budget.md` corrected to "bloom only,
  motion blur is Phase 3." **Deferred to a Phase 2b** (noted in `game-review.md` §9-10):
  first-run onboarding coach marks and the mid-season garage/re-equip hatch (larger new UI +
  navigation with balance implications). Verified: typecheck, lint, 49 unit tests, production
  build, e2e smoke — all green; garage/training/shop visually confirmed in-browser.
- **2026-07-01 (fix+balance: game-review Phase 1)** — Shipped the review's correctness+balance
  phase. **P0 fixed:** loadout `mass` now reaches the sim (`Entrant.mass` → `derive(stats, mass)`,
  default `REF_MASS = 170`), collisions are mass-weighted (heavier shoves, lighter gets shoved;
  identical to the old 0.5/0.5 split at equal mass), and accel scales `× REF_MASS/mass` — ballast
  was previously physics-inert. **Over-training fixed:** `MAX_TRAINING_SESSIONS_PER_ROUND = 6`
  caps stat plays/round (`SeasonState.sessionsThisRound`); Rest only refills energy for those
  capped sessions; the training UI shows the counter + disables spent cards. **Economy:** kept
  single-use tuning consumption but added off-podium consolation (`FINISH_PAYOUT =
  [120,70,35,22,14,9]`) so a loss isn't a wipe — the new harness money model shows full-burn ≈
  break-even (~+48/season) for a podium finisher, thrifty ~+200, hoarding ~+400. **Balance:**
  `derive` retuned (endurance de-emphasised, Wit trimmed, Speed/Power lifted) + two outlier
  archetype stat lines nudged → head-to-head 57/34/7/1/0.5 (Atlas/Vortex/Oracle/Crusher/Blitz)
  became **36/32/18/13/0.4** (Oracle/Vortex/Atlas/Crusher/Blitz); this *also* healed the
  difficulty ramp (developed win% 88→40→12 → **86→93→56**), so `rivalScale` was left unchanged.
  Blitz (pure Speed) stays ~0% — a single-corner-track structural limit that needs track variety
  (documented in `sim-physics.md`). `tools/diag/season.ts` now simulates money/shop/buy/consume/
  reroll and threads mass. Docs updated: `sim-physics.md` (`derive`/mass/collisions),
  `training-tuning-cards.md` §8 (burn-rate + rest resolved), `game-review.md` (Phase 1 status).
  Verified: typecheck, lint, 49 unit tests, production build, e2e smoke — all green.
- **2026-07-01 (review: full game review)** — New reference `docs/game-review.md`: a
  studio-wide, role-lensed audit (Creative Director, Systems/Economy, Sim/Balance, Gameplay
  Engineer, UI/UX, Technical Artist/VFX, QA, Competitive) with `file:line` evidence, external
  sources (Umamusume, Balatro, auto-battler sentiment, WCAG), and a phased roadmap. Headline
  **P0**: loadout `mass` is computed (`economy.ts`) but never threaded to the sim
  (`snapshots.ts` → `engine.ts` → `derive` default 170), so ballast is physics-inert. Other
  leads: tuning full-burn economy ~220 credits/race deficit; free `train.rest` over-training
  loop; all-rounder win-rate skew + difficulty ramp outrunning one playthrough. Supporting:
  no shared type scale (7 heading sizes; smallest primary CTA is the most-used one),
  9–11px + `--muted` text below WCAG small-text guidance, duplicate card components, bloom-only
  VFX with promised motion blur absent and no race speed cues, stale draft references in docs.
  Roadmap: Phase 1 correctness+balance, Phase 2 a11y/UX, Phase 3 VFX; prerequisite is
  extending `tools/diag/season.ts` to simulate money/shop/consume. No code changed. Added to
  `knowledge-base.mdc` reference map + `DECISIONS.md`.
- **2026-07-01 (polish: card-play FX — kart pulse + particle burst)** — Playing a card now has
  a visible payoff: the store gained a monotonic `cardPlayPulse` counter (bumped on every
  *successful* `playTrainingCard`/`playTuningCard`), `ShowroomKart` gained a `pulseKey` prop
  that plays a ~0.42s scale up/down bounce when it changes, and a new UI overlay `CardPlayFx`
  sprays a short-lived particle burst at the kart's on-screen anchor. Both effects respect
  `prefers-reduced-motion`, and the game layer stays effect-agnostic (it only increments the
  counter — render/UI own the visuals, keeping the `game → sim + content` / `ui → game`
  boundaries intact). `training-tuning-cards.md` §3 documents the feedback. Verified: lint,
  typecheck, 44 unit tests, and production build all green.
- **2026-07-01 (polish: card feedback, empty starting hand, cleaner drop target)** — Follow-up
  on the implementation below, from playtest feedback: (1) `applyTraining` now always returns
  a toast (e.g. "Speed Sprints: +11 Speed, +3 Power") instead of only on flavor events/fails,
  so every training play gives explicit confirmation; (2) `PlayerSave.ownedCardIds` starts
  **empty** — players buy every tuning card, none are granted at season start
  (`STARTER_CARD_IDS` renamed `SAMPLE_TUNING_CARD_IDS`, now just a tooling fixture for
  `tools/diag/season.ts`); (3) a played tuning card is no longer rendered as a "staged" tile
  in the hand — it disappears the instant it's played (only the kart inspector shows what's
  staged), so `TrainingScreen` dropped its unstage-from-hand affordance; (4) `KartDropZone`
  lost its dashed-border/background box — it's now a fully invisible hit area with only a
  soft glow while actively dragging over it, since the kart itself (not a drawn container) is
  the drop target; (5) "Head to Race Day →" moved from a center CTA to a fixed top-right
  corner button. `training-tuning-cards.md` updated to match; verified with lint, typecheck,
  unit tests, build, and the Playwright smoke test.
- **2026-07-01 (feat: training & tuning cards implemented)** — Shipped the design below as
  code: `@grid/content`'s `CardSchema` unified `Training`/`Card` into one schema with a
  `kind: 'training' | 'tuning'` discriminant (mods/rarity now optional, energyCost/mainStat
  etc. added, `RoundDef.turns` dropped as dead data); `TRAINING_CARDS`/`TUNING_CARDS` split
  `CARDS`. `@grid/game`: `PlayerSave.ownedCardIds` is now a ≤4 duplicate-allowed bag,
  `SeasonState.equippedCardIds`→`stagedTuningCardIds` (and `turnsLeft` removed — energy is
  the only gate), `economy.ts` gained `MAX_OWNED_TUNING`/`SHOP_SLOTS`/`SHOP_MAX_REROLLS`/
  `rerollCost`/`sampleShopSlots` (weighted-by-rarity, no-repeat), `store.ts` gained
  `buyShopSlot`/`rerollShop`/`playTrainingCard`/`playTuningCard`/`unstageTuningCard` and
  `finishRace` now strikes staged tuning ids from the owned bag; `SAVE_VERSION` 3→4 clamps
  returning saves' `ownedCardIds` to the 4 most recent. `@grid/ui`: new `KartDropZone` (a
  screen-space DOM overlay standing in for real 3D-canvas raycasting — kept `render` free of
  a `ui`/DOM dependency) and `KartInspector` (opened via a new `ShowroomKart.onSelect` click
  callback prop, or a "Select Kart / View Build" button); `TrainingScreen` and `ShopScreen`
  rewritten for drag-to-play and the 4-slot reroll stall. Updated `logic.test.ts`,
  `content.test.ts`, `tools/diag/season.ts` (dropped the removed `rollDraft`/`turnsLeft`
  APIs), and `e2e/smoke.spec.ts` (no more draft step) for the new model. Verified: typecheck,
  lint, all 44 unit tests, production build, and the Playwright smoke test all green.
  `training-tuning-cards.md` marked implemented; new ADR entry recorded.
- **2026-07-01 (design: training & tuning cards)** — New reference
  `training-tuning-cards.md` specifies the next card model (design only, no code yet): a
  **unified card database** (`Training` + `Card` → one `CardSchema` with `kind`), a **hand**
  of the 6 permanent training cards + up to **4 consumable tuning cards** (own ≤4, spent when
  the race resolves), **drag-a-card-onto-the-kart** as the play verb, **energy** as the sole
  training gate (retire `turnsLeft`), a **kart inspector** (select the kart to see build +
  staged tuning), and a **4-slot shop with up to 2 paid rerolls** (20, doubling to 40).
  Recorded a state-model + `SAVE_VERSION` 3→4 migration plan and flagged burn-rate/reroll
  balance risks. `economy-cards.md` hand/shop bullets now point here; ADR + Reference map
  updated.
- **2026-06-30 (feat: shop + card hand + podium currency)** — Replaced the in-run draft with a
  buy-and-equip loop. New persistent `money` (`SAVE_VERSION` 3) is earned **only** on the
  podium (`racePayout`, 1st/2nd/3rd, scaled by round). A full-catalog `ShopScreen` sells tuning
  cards by rarity (`cardPrice`); the Training screen is now a fanned TCG hand (`CardHand`) of
  always-in-hand training cards + owned tuning cards, equipped directly up to `EQUIP_SLOTS`
  (`draftedCardIds`→`equippedCardIds`). Starter pool trimmed to 4 so the shop has stock; Phase-2
  cards excluded via `LIVE_CARD_IDS`. No sim changes. `economy-cards.md` rewritten for the new
  model; ADR + this line added. Verified in-browser (earn→buy→equip→race).
- **2026-06-30 (fix: live standings track the karts)** — "Board shows karts in different
  places than the track / doesn't update as they pass." Data-driven, not a guess: built
  `tools/diag/standings.ts` to compare the engine's `prog` ordering against the actual
  projected position over 60 seeds/round — the old dead-reckoned `cp` (accumulated movement,
  blind to collision shoves & wall slides) drifted ~85 m and disagreed with the track ~96 %
  of ticks (player mis-placed up to ~60 %). Fix: `racer.ts` now re-projects actual `(x,z)`
  onto the centerline each fixed step and accumulates a seam-corrected, lap-aware delta
  (`prog = lap*length + raw`), the standard racing-game measure (s&box/Unreal/Godot). After:
  ~11 % of ticks / ~1 % player, residual = ≤1-tick latency below the HUD poll. Regression
  test added (`engine.test.ts`); HUD poll 15→30 Hz. `sim-physics.md` gained a "Race progress
  + live standings" section; ADR recorded.
- **2026-06-30 (fix: leaderboard readability)** — The "race placement looks wrong" report was
  a naming collision, not a ranking bug: async ghosts are the player's past builds and shared
  the player's name, so the board showed multiple identical "Comet" rows. Fix: ghosts get a
  ` (ghost N)` suffix (`packages/game/src/snapshots.ts`) and the HUD/results mark the player
  as `name (you)` in cyan (`RaceHud.tsx`, `ResultsScreen.tsx`). Added a `logic.test.ts` case
  asserting unique entrant names with ghosts present. ADR recorded.
- **2026-06-30 (feature: conditional racing cards)** — Cards can now carry deterministic
  **triggered effects** evaluated in-sim against spatial/positional context. New
  `@grid/sim/effects.ts` (kinds, `EffectContext`, spatial `ZONE`s, pure `evaluateEffects`
  → modifier bag); `racer.ts`/`engine.ts` apply the bag (speed/steer/lateral line/collision)
  with a per-racer seeded effect RNG and per-sub-step ranking; `CardSchema` gained
  `effect`/`trigger`/`effectText`/`archetype`; 7 Phase-1 cards authored (+6 inert Phase-2
  scaffolds); effects attached to player/ghosts/rivals (`effectsFromCardIds`), `BuildSnapshot`
  gained `cardIds`, `SAVE_VERSION` 1→2 + migration; draft UI renders Trigger→Effect. Docs:
  new `cards-proximity-conditional.md` (design + TD review), updated `sim-physics.md`
  ("Card effects + spatial zones"), `economy-cards.md`, `content-schema.md`; ADR added.
  Tests: `effects.test.ts` (14) + determinism/absent-effects cases in `engine.test.ts`; the
  season harness gained an effects on/off balance pass (net-neutral win%, +overtakes).
- **2026-06-30 (balance finding: season difficulty curve)** — New experience harness
  `tools/diag/season.ts` ran ~2,250 races (player vs scaled rival field across the 3 cups).
  Findings: (1) the AI field is fun — ~0.3–0.5s winning margins, photo finishes in ~24–41% of
  races, ~18 overtakes each; (2) parts alone never compete — a starter build (OVR 193) finishes
  **last in 100%** of parts-only races; tuning parts only narrows the gap, never the place;
  (3) training + cards is the real lever — a developed player climbs 193→241→290→351 OVR and
  wins 70% of Rookie Cups; (4) **the season outruns one playthrough** — developed win% collapses
  70%→6%→0% as rivalScale ramps (×1→×1.28→×1.6), so the championship reads as multi-season meta
  progression. Vortex (all-rounder) still over-wins, matching the prior balance note. Summary
  canvas: `canvases/race-experience.canvas.tsx`.
- **2026-06-30 (sim fix: player won races they didn't)** — Race results/leaderboard showed the
  player winning when they were actually behind. Root cause: `finishTime` was the fixed step's
  end time, so all karts crossing the line within the same 1/60 s tick recorded an *identical*
  finish time, and `rank()`'s tie-break fell through to the racers' array order — the player is
  always entrant index 0, so they won every photo finish. Fix: record a sub-step crossing time
  (`ctx.time - (overshoot/alongThisStep)*dt`) so finishers are ordered by when they truly crossed,
  and tie-break equal times by `prog`. Deterministic + frame-batching invariant (engine always
  sub-steps `FIXED_DT`). Added a regression test (identical-kart packs across seeds: order must
  follow time-then-progress, never index). See `sim-physics.md` → "Finish ordering".
- **2026-06-30 (render fix: wheels spun backward)** — Kart wheels rolled the wrong way in
  both the showroom and races. Wheel geometry rolls about local +x, and with the nose at -z a
  *positive* x-roll drives the tops backward (+z). Both render sites used positive spin
  (`ShowroomKart` `+= dt*0.4`, `RaceField` `s.rotation.x = spin` from the sim's
  forward-growing `wheelSpin`). Fix: negate the applied x-roll at both sites (sim semantics
  unchanged — `wheelSpin` still tracks forward distance).
- **2026-06-30 (UX redesign: garage build screen)** — Replaced the garage's stacked parts-list
  + stat-card panel with a "blueprint" over the live showroom kart: per-slot callouts pinned
  around the kart with SVG leader lines pointing at the actual part, each opening an in-place
  popover of owned options with signed stat-delta chips (downsides in red) so every trade-off
  reads at a glance. `ShowroomKart` now takes `angle`/`radius`/`height` and holds a fixed 3/4
  view when `orbit=false`; `App` passes `orbit=false` + closer framing in the `garage` phase so
  the leader-line anchors (a single tunable `LAYOUT` table of viewport-% targets) stay pinned.
  Verified in-browser end-to-end (open/equip/stat-update). See `DECISIONS.md` 2026-06-30.
- **2026-06-29 (render fix: karts jump f/b — ROOT CAUSE)** — The real cause of the "karts
  jump forward/back" report: the ~15 Hz HUD state shared a React context with the engine, so
  every HUD tick re-rendered the 3D `RaceField`, whose parent passed a fresh `visualsById`
  object literal → `useMemo` **rebuilt all kart meshes 15x/sec**, and new groups render at the
  origin for a frame before `useFrame` repositions them = jumping. Fix: split `useRaceHud()`
  from `useRaceSession()` and memoize `visualsById`. The offline `jitter.ts` harness showed
  the sim/interpolation were already smooth — the bug was React, not the math. See
  `rendering-budget.md` → "Gotcha: React re-renders rebuilding 3D objects".
- **2026-06-29 (render fix: kart vibration)** — "Karts vibrate as they go by." First proved
  the motion is smooth with a new deterministic harness (`tools/diag/jitter.ts`): zero
  high-frequency wobble in interpolated kart/camera across 60/144/165 Hz with frame jitter.
  Root cause was **intra-model z-fighting** — kart parts (side pods, engine cover, air-box)
  shared exact face planes with the body and flickered with view angle. Fix: parts now
  interpenetrate a few cm (no coplanar faces). Also tightened the shadow-camera frustum
  (±98u→±66u) so kart shadows stop swimming. See `rendering-budget.md` → "Gotcha: kart
  'vibration'…". (Headless Chromium throttles rAF, so Playwright pacing numbers are moot.)
- **2026-06-29 (render fix: curb shimmer)** — Thin red/white curbs sparkled in the distance
  (geometric aliasing of sub-pixel solid-color boxes; MSAA can't fix it). Replaced the
  instanced curb boxes with one mipmapped + anisotropic striped-texture ribbon per side
  (seamless arc-length UVs); mipmapping averages the stripes to smooth grey far away, and
  draw calls drop to 2. Also made `TrackWorld` dispose `material.map`. See
  `rendering-budget.md` → "Gotcha: shimmer on thin high-contrast patterns".
- **2026-06-29 (render fix: track-edge z-fighting)** — Track edges shimmered as the camera
  moved (depth-buffer fighting, not motion). Causes: tight `near` plane (0.6/420 ≈ 700:1) +
  road sitting 0.02 above the big ground plane, plus the start line level with the curb
  tops. Fix: camera `near` 0.6→1.5, complementary `polygonOffset` on road (toward camera)
  and ground (away), and raised the start line to y=0.2. See `rendering-budget.md` →
  "Gotcha: z-fighting at the track edges".
- **2026-06-29 (render fix: race vibration)** — Karts/screen/environment vibrated during
  races. Root cause: `RaceField` read raw fixed-step sim transforms without interpolation,
  so on >60 Hz displays the 60 Hz accumulator stuttered and the chase camera amplified it
  scene-wide. Fix: added `Racer.prev*` snapshots + `RaceEngine.alpha`, and the renderer now
  interpolates all transforms and follows the interpolated player with frame-rate-independent
  camera smoothing. Determinism unaffected (prev fields are render-only). See
  `rendering-budget.md` → "Gotcha: always interpolate fixed-step state".
- **2026-06-29 (Phase 5 ship)** — Slice is polished and gated. Added `@grid/audio`
  (synth engine note + SFX wired to the race), reduced-motion support (showroom orbit +
  CSS), a Playwright e2e smoke that boots the real WebGL build through the full loop with
  zero page errors, vendor chunk-splitting, and an `e2e` CI job. All gates green:
  typecheck, 21 unit tests, lint (0 warnings), build, e2e.
- **2026-06-29 (balance pass)** — Rebalanced `derive()` to de-weight Wit (Phase 5). New
  2000-race spread: Vortex 60.1 / Atlas 20.7 / Blitz 14.6 / Oracle 4.3 / Crusher 0.3.
  Wit no longer dominates cornering (Power now leads `latGrip`). Known follow-up: the
  all-rounder (Vortex) still over-wins and pure-Power (Crusher) under-performs; tune in a
  future pass. Note this only affects AI rival flavor — players build their own karts.

- **2026-06-29 (impl)** — Phases 1-3 landed. `@grid/sim` (deterministic engine, 8 tests),
  `@grid/content` (parts/cards/cosmetics + Zod, loadout math, 8 tests), `@grid/game`
  (economy/draft/season/snapshots + Zustand store, 5 tests), `@grid/render` (R3F canvas,
  modular kart, instanced track/scenery). Layered stat model implemented exactly as
  documented: parts (baseline 30 + deltas) -> training deltas -> card mods -> clamp.
  Async opponents assembled via `assembleRaceConfig` (player + recent ghost builds +
  scaled archetypes), fully reproducible from a seed.

- **2026-06-29 (balance finding)** — First headless balance run (`npm run balance`, 2000
  races): Vortex 58.9% / Oracle 26.8% / Atlas 11.6% / Blitz 2.8% / Crusher 0.0%. Takeaway:
  **Wit is over-weighted** in `derive()` (it feeds accel, latGrip, yawGrip, drainEff, and
  judge), and pure-Power builds with low Wit are non-viable. Action: rebalance the `derive`
  coefficients in the Phase 5 tuning pass (target: every archetype 10-30% win share). The
  sim is unchanged for now to keep the build stable.
- **2026-06-29** — Seeded the knowledge base: `umamusume-loop`, `kart-anatomy`,
  `sim-physics`, `multiplayer-async`, `rendering-budget`, `economy-cards`,
  `content-schema`. Authored project rules (knowledge-base, determinism, perf-budget,
  coding-standards). Recorded six founding ADRs.

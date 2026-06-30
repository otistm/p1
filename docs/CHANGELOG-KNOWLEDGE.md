# Knowledge Base Changelog

Relay log — what changed in `docs/`, so the team stays in sync. Newest at top.

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

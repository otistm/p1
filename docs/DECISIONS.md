# Architecture Decision Records

One line per decision: context → decision → why. Newest at top.

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

# Architecture Decision Records

One line per decision: context → decision → why. Newest at top.

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

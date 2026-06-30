# Reference: the deterministic vehicle model

Lives in `@grid/sim`. Ported and hardened from the concept prototype. Pure, headless,
seeded, fixed-timestep. See `.cursor/rules/determinism.mdc`.

## Why a custom analytical model (not a rigid-body engine)

Cross-machine determinism with a general 3D physics engine is hard (float drift,
solver iteration order). Our karts are **kinematic free-bodies** following a racing
line — cheaper, fully controllable, and trivially deterministic. A general physics lib
is reserved for *cosmetic* debris in `@grid/render` only.

## Track

Catmull-Rom spline through control points → dense centerline. Precompute per sample:
heading `ang`, cumulative arc-length `cum`, segment length `seg`, signed + smoothed
curvature `curvS`. Helpers:

- `posAt(s)` — position/heading/curvature at wrapped arc-length `s`.
- `linePoint(s)` — the single shared racing line, biased toward corner apexes.
- `project(x,z,hint)` — world point → nearest sample, arc-length, signed lateral offset.
- `maxCurvAhead(idx,dist)` — corner lookahead for speed planning.

## Stats → physics (`derive`)

Five ratings → physics quantities (tunable constants):

- `topSpeed`  = f(speed, stamina) — straight-line cap.
- `accel`     = f(power, wit, guts) — corner-exit drive.
- `brake`     = f(power) — deceleration.
- `latGrip`   = f(power, wit, guts) — corner speed.
- `yawGrip`   = f(wit) — steering authority.
- `energyMax` = f(stamina); `drainEff` = f(wit) — economy.
- `fadeFloor` = f(guts) — speed kept when empty; `surge` = f(guts) — last-lap kick.
- `judge`     = f(wit) — corner-read accuracy.
- `mass`      = f(parts) — collision impulse & accel feel.

## Per-tick kart update (`FIXED_DT = 1/60`)

1. Project onto centerline (cached `hint`).
2. **Overtake intent**: if a kart is just ahead in my path, ease laterally to the open
   side (smoothed lane change).
3. **Pure-pursuit** steering toward `linePoint(s + lookahead) + overtakeOffset`; clamp
   yaw rate by `yawGrip/speed`.
4. **Speed target** = min(corner speed from `maxCurvAhead` & `latGrip` & `judge`,
   `topSpeed × fade × form × (surge if last lap)`); approach via `accel`/`brake`.
5. Drain energy ∝ effort²×`drainEff`; integrate position; clamp to road via an edge wall.
6. Advance along-track progress; detect lap/finish.
7. Smooth visual roll/pitch/steer/wheelSpin (render-only fields).

`resolveCollisions` does positional separation + equal-mass restitution impulses so
karts bounce instead of overlapping.

## Determinism checklist

- Seeded `mulberry32` only; seed derived from `RaceConfig` via `hashSeed`.
- Fixed-step accumulator; render interpolates but never advances logic.
- Index-based iteration; stable sort for rankings (progress, then finish time).

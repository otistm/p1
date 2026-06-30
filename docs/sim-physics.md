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
karts bounce instead of overlapping. Contact distance is the **sum of the two karts'
collision radii** and the impulse (and its cap) scale by the harder hitter's
`impactScale`, so effects can widen a hit box or shove harder (see below).

## Card effects + spatial zones (`effects.ts`)

Cards can carry a **triggered effect** evaluated inside the sim. They are optional on
`Entrant` (`effects?: CardEffect[]`); absent effects reproduce existing seeds bit-for-bit.

- **Spatial zones** (sizes in `ZONE`): proximity *bubble* (3 m), draft *column*
  (half-width 1.2 m, length 6 m), *clean air* (15 m ahead), and *corner* / *apex* state
  from the track's signed curvature `curvS` (inside sign) and `curv` (corner threshold).
- **`EffectContext`** is the per-kart, per-tick fact sheet (rank, lap/last-lap, proximity
  counts, side neighbour, draft target + distance, clean air, being-drafted, apex
  occupancy, open side) that `Racer.buildEffectContext` derives from the field + track.
  It also carries inert **Phase-2 stubs** (engine heat, tyre wear, drift streak, rubber
  line, hazards).
- **Pure handlers** (`evaluateEffects`) turn the context into a **modifier bag**:
  multipliers on `topSpeed`/`accel`/`latGrip`, a steering-authority multiplier, a lateral
  bias / centre-pull on the racing-line target, and collision radius / impact scales. The
  bag is layered onto `derive()` output each step — the kinematic model is untouched.
- **Determinism**: rank is recomputed every fixed sub-step (so rank-triggered effects are
  frame-batching invariant); each racer owns a **seeded effect RNG**
  (`makeRng(hashSeed(seed, index, 0xeffec7))`) drawn only on fixed sub-steps. Effects apply
  to **all entrants** (player, ghosts, rivals).

Phase-1 kinds (live): `slingshotSiphon`, `cornerPocket`, `claustrophobia`, `paintScraper`,
`cleanAirSupercharger`, `desperationDraft`, `vanguardShield`. Phase-2 kinds
(`redlineGambler`, `driftChainReaction`, `conservationist`, `grooveLock`, `gutterHook`,
`debrisDodger`) are scaffolded and gated off via `isPhase2Kind` until their subsystems land.
See `effects.test.ts` (per-handler) and `engine.test.ts` (determinism with effects).

## Finish ordering (photo finishes)

`finishTime` is recorded as a **sub-step** crossing time, not the step's end time: when
`cp` passes the finish line we back out the fraction of the step already beyond the line
(`overshoot / alongThisStep`) and subtract it from `ctx.time`. Several karts routinely
cross within one 1/60 s step; without this they'd share an identical `finishTime` and the
sort would fall back to **entrant array order** — and since the player is always entrant
index 0, the player won every photo finish for free. `rank()` also tie-breaks equal finish
times by `prog` (further-along crosses first) as a safety net. See
`engine.test.ts` → "settles the order by crossing time then progress".

## Determinism checklist

- Seeded `mulberry32` only; seed derived from `RaceConfig` via `hashSeed`.
- Fixed-step accumulator; render interpolates but never advances logic.
- Index-based iteration; rankings sort by (finish time, then progress) — never by array
  position, so no entrant (esp. the index-0 player) gets a tie-break advantage.

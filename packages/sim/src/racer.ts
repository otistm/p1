import type { DerivedAttributes, Entrant, LapStat, RacerState, Rng } from './contracts';
import { REF_MASS } from './derive';
import {
  type CardEffect,
  type CardEffectKind,
  type EffectContext,
  type EffectState,
  type ModifierBag,
  ZONE,
  defaultBag,
  evaluateEffects,
  newEffectState,
} from './effects';
import { clamp, lerp, wrapAngle } from './math';
import { makeRng } from './rng';
import type { Track } from './track';

/** Kart collision radius (m). */
export const RAD = 1.0;

/**
 * Render-only, per-tick race telemetry for the HUD — the situational facts that drive tuning
 * effects, so the player can *see* why a staged card is (or isn't) firing. Never read back by
 * the sim (no determinism impact); only maintained for the player kart.
 */
export interface RacerTelemetry {
  /** Tucked in a rival's slipstream (a draft target sits ahead within the draft column). */
  drafting: boolean;
  /** Metres to that draft target (Infinity when not drafting). */
  draftDist: number;
  /** Clear lane ahead (the leader's clean-air condition). */
  cleanAir: boolean;
  /** Rivals inside the proximity bubble. */
  traffic: number;
  /** A rival is tucked directly behind (the defensive trigger). */
  beingDrafted: boolean;
  /** Currently in a corner. */
  inCorner: boolean;
}

export interface StepContext {
  track: Track;
  laps: number;
  time: number;
  lastLap: boolean;
  racers: Racer[];
}

/**
 * A free-body kart: pure-pursuit steering toward one shared racing line, corner-speed
 * planning, stamina fade, lane-change overtaking, and an edge wall that keeps it on
 * the road. Fully deterministic — all randomness arrives via `place(..., rng)`.
 */
export class Racer {
  readonly id: string;
  readonly name: string;
  readonly colorHex: number;
  readonly isPlayer: boolean;
  readonly stats: Entrant['stats'];
  readonly d: DerivedAttributes;
  /** Triggered card effects evaluated each fixed step (empty = legacy kart). */
  readonly effects: CardEffect[];
  /** Per-racer seeded RNG for effect rolls — drawn only on fixed sub-steps. */
  private readonly effectRng: Rng;
  private effState: EffectState = newEffectState();
  /** Updated each step from the effect bag; read by `resolveCollisions`. */
  collisionRadius = RAD;
  impactScale = 1;
  /**
   * Render-only: the kinds of effects that actually applied on the most recent step (reused
   * array, cleared each step). The renderer reads this to pop "tuning procced" feedback; the
   * sim never reads it back, so determinism is unaffected.
   */
  readonly activeEffects: CardEffectKind[] = [];
  /** Render-only live telemetry for the HUD (maintained for the player only — see `step`). */
  readonly telemetry: RacerTelemetry = {
    drafting: false,
    draftDist: Infinity,
    cleanAir: false,
    traffic: 0,
    beingDrafted: false,
    inCorner: false,
  };
  /**
   * Render-only live performance readout for the HUD (player only). Two kinds of field:
   *   • genuinely per-tick physics — `speedFrac` (speed ÷ top speed) and `gripLoad` (how much of
   *     the lateral grip the current corner is using, 0..1) — which move constantly like stamina;
   *   • the active tuning bag `topMult`/`accelMult`/`gripMult`/`steerMult` + stamina `fade`, which
   *     sit at 1 until an effect fires (shown as pop-in magnitude chips).
   * Never read back by the sim, so determinism is unaffected.
   */
  readonly live = {
    speedFrac: 0,
    gripLoad: 0,
    topMult: 1,
    accelMult: 1,
    gripMult: 1,
    steerMult: 1,
    fade: 1,
  };
  /**
   * Cumulative sim-time (s) at each completed lap — index 0 = end of lap 1. Deterministic
   * (recorded on the fixed step that crosses the line). Powers the results lap-by-lap analysis.
   */
  readonly lapSplits: number[] = [];
  /**
   * Per-lap speed/corner/stamina aggregates, kept in lockstep with `lapSplits`. Recorded for
   * every racer (cheap, batching-invariant) so the results analysis can echo the vitals HUD for
   * the whole field. Render/result-only — never read back into the sim.
   */
  readonly lapStats: LapStat[] = [];
  private lapSpeedSum = 0;
  private lapSpeedPeak = 0;
  private lapCornerSum = 0;
  private lapTickCount = 0;

  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  heading = 0;
  vheading = 0;
  energy = 0;
  idx = 0;
  lap = 0;
  prog = 0;
  cp = 0;
  /** Last projected arc-length in [0,length), for seam-corrected lap accumulation. */
  private lastRaw = 0;
  finished = false;
  finishTime = 0;
  rank = 0;
  hint = 0;
  over = 0;
  roll = 0;
  pitch = 0;
  steerVis = 0;
  wheelSpin = 0;
  form = 1;
  private pv = 0;

  // Previous fixed-step render transform, captured at the top of each step/coast. The
  // renderer interpolates between these and the current values using the engine's leftover
  // accumulator fraction, so motion stays smooth on any display refresh rate. Render-only:
  // never read back into the sim, so determinism is unaffected.
  prevX = 0;
  prevZ = 0;
  prevVheading = 0;
  prevRoll = 0;
  prevPitch = 0;
  prevSteer = 0;
  prevWheelSpin = 0;

  constructor(entrant: Entrant, derived: DerivedAttributes, effectRng?: Rng) {
    this.id = entrant.id;
    this.name = entrant.name;
    this.colorHex = entrant.colorHex;
    this.isPlayer = !!entrant.isPlayer;
    this.stats = entrant.stats;
    this.d = derived;
    this.energy = derived.energyMax;
    this.effects = entrant.effects ?? [];
    this.effectRng = effectRng ?? makeRng(0);
  }

  /** Place at a world pose with starting progress `cp0` (negative = behind the line). */
  place(x: number, z: number, ang: number, cp0: number, track: Track, rng: Rng): void {
    this.x = x;
    this.z = z;
    this.heading = ang;
    this.vheading = ang;
    this.vx = 0;
    this.vz = 0;
    this.cp = cp0;
    this.prog = cp0;
    const pr0 = track.project(x, z, 0);
    this.hint = pr0.idx;
    // Anchor seam-corrected progress to the grid pose: the grid sits behind the start/finish
    // line, so cp0 is a small negative number and the raw arc-length is near the end of the
    // lap. lap0 = round((cp0 - raw)/length) recovers the matching lap index (-1 on the grid),
    // keeping prog == lap*length + raw consistent with cp0 from the very first tick.
    const len = track.length;
    this.lastRaw = ((pr0.s % len) + len) % len;
    this.lap = Math.round((cp0 - this.lastRaw) / len);
    this.energy = this.d.energyMax;
    this.finished = false;
    this.finishTime = 0;
    this.rank = 0;
    this.over = 0;
    this.roll = 0;
    this.pitch = 0;
    this.steerVis = 0;
    this.wheelSpin = 0;
    this.form = 0.97 + rng() * 0.06;
    this.pv = 0;
    this.effState = newEffectState();
    this.collisionRadius = RAD;
    this.impactScale = 1;
    this.activeEffects.length = 0;
    this.resetTelemetry();
    this.resetLive();
    this.lapSplits.length = 0;
    this.lapStats.length = 0;
    this.lapSpeedSum = 0;
    this.lapSpeedPeak = 0;
    this.lapCornerSum = 0;
    this.lapTickCount = 0;
    this.syncPrev();
  }

  /** Clear HUD telemetry to its neutral "nothing happening" state. */
  private resetTelemetry(): void {
    const t = this.telemetry;
    t.drafting = false;
    t.draftDist = Infinity;
    t.cleanAir = false;
    t.traffic = 0;
    t.beingDrafted = false;
    t.inCorner = false;
  }

  /** Bank the accumulated speed/corner/stamina for the lap just completed and reset the tallies. */
  private snapLapStat(): void {
    const n = Math.max(1, this.lapTickCount);
    this.lapStats.push({
      topSpeed: this.lapSpeedPeak,
      avgSpeed: this.lapSpeedSum / n,
      avgCorner: this.lapCornerSum / n,
      stamina: clamp(this.energy / this.d.energyMax, 0, 1),
    });
    this.lapSpeedSum = 0;
    this.lapSpeedPeak = 0;
    this.lapCornerSum = 0;
    this.lapTickCount = 0;
  }

  /** Reset the live performance readout to a neutral resting state. */
  private resetLive(): void {
    this.live.speedFrac = 0;
    this.live.gripLoad = 0;
    this.live.topMult = 1;
    this.live.accelMult = 1;
    this.live.gripMult = 1;
    this.live.steerMult = 1;
    this.live.fade = 1;
  }

  /** Snapshot the current render transform as the interpolation start point. */
  private syncPrev(): void {
    this.prevX = this.x;
    this.prevZ = this.z;
    this.prevVheading = this.vheading;
    this.prevRoll = this.roll;
    this.prevPitch = this.pitch;
    this.prevSteer = this.steerVis;
    this.prevWheelSpin = this.wheelSpin;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /**
   * Derive this kart's per-tick spatial/positional facts (proximity bubble, draft column,
   * clean air, apex occupancy, corner side) from the field + track. Pure scan over the
   * other racers; O(n) with n≈6. Used only when this kart carries effects.
   */
  private buildEffectContext(ctx: StepContext, idx: number): EffectContext {
    const { track } = ctx;
    const cs = Math.cos(this.heading);
    const sn = Math.sin(this.heading);
    let proxLeft = 0;
    let proxRight = 0;
    let proxAhead = 0;
    let proxBehind = 0;
    let proxTotal = 0;
    let sideNeighborSign = 0;
    let sideNeighborDist = Infinity;
    let draftTargetId: string | null = null;
    let draftDistance = Infinity;
    let nearestAhead = Infinity;
    let beingDrafted = false;
    let apexOccupiedAhead = false;

    const inCorner = track.curv[idx] > ZONE.cornerCurv;
    const cornerInsideSign = Math.sign(track.curvS[idx]);

    for (const o of ctx.racers) {
      if (o === this || o.finished) continue;
      const dx = o.x - this.x;
      const dz = o.z - this.z;
      const ahead = dx * cs + dz * sn;
      const side = -sn * dx + cs * dz;
      const dist = Math.hypot(dx, dz);

      if (dist < ZONE.bubble) {
        proxTotal++;
        if (side >= 0) proxRight++;
        else proxLeft++;
        if (ahead > 0.3) proxAhead++;
        else if (ahead < -0.3) proxBehind++;
        if (Math.abs(ahead) < 1.2 && dist < sideNeighborDist) {
          sideNeighborDist = dist;
          sideNeighborSign = side >= 0 ? 1 : -1;
        }
      }
      // Draft column directly ahead (who I am drafting).
      if (ahead > 0 && Math.abs(side) < ZONE.draftHalfWidth && dist < draftDistance) {
        draftDistance = dist;
        draftTargetId = o.id;
      }
      // Drafted from directly behind (defensive trigger).
      if (ahead < 0 && -ahead <= ZONE.draftLen && Math.abs(side) < ZONE.draftHalfWidth) {
        beingDrafted = true;
      }
      // Clean-air lane scan.
      if (ahead > 0 && Math.abs(side) < 2 && ahead < nearestAhead) nearestAhead = ahead;
      // Apex occupancy: a rival just ahead on the inside line in a corner.
      if (
        inCorner &&
        ahead > 0.5 &&
        ahead < 12 &&
        Math.abs(side) < 2.5 &&
        cornerInsideSign !== 0 &&
        Math.sign(side) === cornerInsideSign
      ) {
        apexOccupiedAhead = true;
      }
    }

    let openSide: number;
    if (proxLeft < proxRight) openSide = -1;
    else if (proxRight < proxLeft) openSide = 1;
    else openSide = this.over > 0 ? -1 : 1; // tie: steer back toward centre

    return {
      rank: this.rank,
      lap: this.lap,
      laps: ctx.laps,
      lastLap: ctx.lastLap,
      inCorner,
      cornerInsideSign,
      proxTotal,
      proxLeft,
      proxRight,
      proxAhead,
      proxBehind,
      openSide,
      sideNeighborSign,
      draftTargetId,
      draftDistance,
      cleanAirAhead: nearestAhead > ZONE.cleanAir,
      beingDrafted,
      apexOccupiedAhead,
      engineHeat: 0,
      tireWear: 0,
      driftStreak: 0,
      onRubberLine: false,
      hazardAhead: false,
      hazardDistance: Infinity,
    };
  }

  step(dt: number, ctx: StepContext): void {
    if (this.finished) return;
    this.syncPrev();
    const d = this.d;
    const { track } = ctx;
    const HALF = track.width / 2;
    const EDGE = HALF - 1.1;

    let speed = Math.hypot(this.vx, this.vz);
    if (speed > 1e-3) this.heading = Math.atan2(this.vz, this.vx);
    const pr = track.project(this.x, this.z, this.hint);
    this.hint = pr.idx;

    // Triggered card effects → a per-tick modifier bag layered onto derived attributes.
    this.activeEffects.length = 0;
    let bag: ModifierBag = defaultBag();
    if (this.effects.length > 0) {
      const ectx = this.buildEffectContext(ctx, pr.idx);
      bag = evaluateEffects(this.effects, ectx, this.effState, dt, this.effectRng, this.activeEffects);
      // Mirror the facts that gate those effects to the HUD (player only).
      if (this.isPlayer) {
        const t = this.telemetry;
        t.drafting = ectx.draftTargetId !== null && ectx.draftDistance <= ZONE.draftLen;
        t.draftDist = ectx.draftDistance;
        t.cleanAir = ectx.cleanAirAhead;
        t.traffic = ectx.proxTotal;
        t.beingDrafted = ectx.beingDrafted;
        t.inCorner = ectx.inCorner;
      }
    }
    const effTopSpeed = d.topSpeed * bag.topSpeedMult;
    // Weight strategy reaches throttle response: a = F/m, so a heavier kart (heavy ballast)
    // accelerates a touch slower and a lighter one (feather) quicker. Neutral at REF_MASS.
    const effAccel = d.accel * bag.accelMult * (REF_MASS / d.mass);
    const effLatGrip = d.latGrip * bag.latGripMult;
    this.collisionRadius = RAD * bag.collisionRadiusMult;
    this.impactScale = bag.impactForceMult;

    // Overtake intent: pull to the open side if a kart is just ahead in my path.
    let blockerSide = 0;
    let blocked = false;
    for (const o of ctx.racers) {
      if (o === this || o.finished) continue;
      const dx = o.x - this.x;
      const dz = o.z - this.z;
      const ahead = dx * Math.cos(this.heading) + dz * Math.sin(this.heading);
      const side = -Math.sin(this.heading) * dx + Math.cos(this.heading) * dz;
      if (ahead > 0.5 && ahead < 9 && Math.abs(side) < 2.2) {
        blocked = true;
        blockerSide += side >= 0 ? 1 : -1;
      }
    }
    let overTarget = 0;
    if (blocked) {
      const dirAway = blockerSide >= 0 ? -1 : 1;
      overTarget = clamp(pr.lateral + dirAway * 3.2, -EDGE + 1, EDGE - 1);
    }
    // Effect pathing: defensive centre-pull, then situational lateral bias (outer line,
    // panic-steer to open space, lean into a neighbour). Clamped to stay on the road.
    if (bag.centerPull > 0) overTarget = lerp(overTarget, 0, bag.centerPull);
    if (bag.lateralBias !== 0) overTarget = clamp(overTarget + bag.lateralBias, -EDGE + 1, EDGE - 1);
    this.over += (overTarget - this.over) * clamp(4 * dt, 0, 1);

    // Pure-pursuit aim at the racing line (+ overtake offset).
    const lookDist = clamp(6 + speed * 0.75, 8, 22);
    const lp = track.linePoint(pr.s + lookDist);
    const nax = -Math.sin(lp.ang);
    const naz = Math.cos(lp.ang);
    const aimx = lp.x + nax * this.over;
    const aimz = lp.z + naz * this.over;
    const dir = Math.atan2(aimz - this.z, aimx - this.x);
    const Ld = Math.max(Math.hypot(aimx - this.x, aimz - this.z), 4);
    const alpha = wrapAngle(dir - this.heading);
    let omega = (2 * speed * Math.sin(alpha)) / Ld;
    const omegaMax = ((effLatGrip / Math.max(speed, 3)) * 1.1) * bag.steerAuthorityMult;
    omega = clamp(omega, -omegaMax, omegaMax);
    this.heading += omega * dt;

    // Speed control from the upcoming corner + stamina fade.
    const cAhead = track.maxCurvAhead(pr.idx, 8 + speed * speed * 0.06);
    let cornerV = cAhead > 0.0008 ? Math.sqrt(effLatGrip / cAhead) : effTopSpeed;
    cornerV *= lerp(0.8, 1.06, d.judge);
    const eFrac = this.energy / d.energyMax;
    const fade = eFrac > 0.3 ? 1 : lerp(d.fadeFloor, 1, eFrac / 0.3);
    let topNow = effTopSpeed * fade * this.form;
    if (ctx.lastLap) topNow *= d.surge;
    const target = Math.min(cornerV, topNow);
    if (speed < target) speed = Math.min(target, speed + effAccel * dt);
    else speed = Math.max(target, speed - d.brake * dt);
    speed = clamp(speed, 0, topNow);
    this.vx = Math.cos(this.heading) * speed;
    this.vz = Math.sin(this.heading) * speed;

    // Corner load: omega·speed is the lateral acceleration the corner is demanding; over the
    // available grip it reads as "how hard we're leaning on the tyres" (0..1). Computed for every
    // racer so the results analysis can aggregate it per lap.
    const gripLoad = clamp((Math.abs(omega) * speed) / Math.max(effLatGrip, 1e-3), 0, 1);
    // Per-lap accumulators for the analysis (all racers). Reset when a lap is banked below.
    this.lapSpeedSum += speed;
    this.lapCornerSum += gripLoad;
    this.lapTickCount++;
    if (speed > this.lapSpeedPeak) this.lapSpeedPeak = speed;
    // Mirror the live performance readout to the HUD (player only). speedFrac + gripLoad are
    // real per-tick physics (they move every corner and straight); the bag mults + fade capture
    // how tuning/tiring reshape the kart.
    if (this.isPlayer) {
      this.live.speedFrac = clamp(speed / d.topSpeed, 0, 1.5);
      this.live.gripLoad = gripLoad;
      this.live.topMult = bag.topSpeedMult;
      this.live.accelMult = bag.accelMult;
      this.live.gripMult = bag.latGripMult;
      this.live.steerMult = bag.steerAuthorityMult;
      this.live.fade = fade;
    }

    // Energy.
    const effort = speed / d.topSpeed;
    let drain = 2.4 * effort * effort * d.drainEff;
    if (ctx.lastLap) drain *= 1.3;
    this.energy = Math.max(0, this.energy - drain * dt);

    // Integrate.
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Edge wall: keep on the road, kill outward velocity (slide along).
    const pr2 = track.project(this.x, this.z, this.hint);
    if (Math.abs(pr2.lateral) > EDGE) {
      const a = pr2.ang;
      const nx = -Math.sin(a);
      const nz = Math.cos(a);
      const corr = (Math.abs(pr2.lateral) - EDGE) * Math.sign(pr2.lateral);
      this.x -= nx * corr;
      this.z -= nz * corr;
      const vn = this.vx * nx + this.vz * nz;
      if (Math.sign(vn) === Math.sign(pr2.lateral)) {
        this.vx -= vn * nx;
        this.vz -= vn * nz;
      }
    }

    // Race progress = the kart's ACTUAL position projected onto the centerline, lap-aware.
    // Re-derived from (x,z) every fixed step (the industry-standard measure used by Mario-
    // Kart-likes and sims alike: progress = laps*length + distanceAlongCenterline, sorted
    // desc — see docs/sim-physics.md). Accumulating the along-track component of movement
    // instead silently mis-counts every displacement the velocity integrator didn't author:
    // collision shoves (resolveCollisions edits x,z after the step), wall slides, lane
    // changes. That dead-reckoning drifted up to ~85m from the real position and put the
    // board out of order vs the track on ~96% of ticks. Projecting the rendered position
    // each tick keeps the standings glued to what the player sees.
    const len = track.length;
    const prog = track.project(this.x, this.z, this.hint);
    this.hint = prog.idx;
    this.idx = prog.idx;
    const raw = ((prog.s % len) + len) % len;
    let delta = raw - this.lastRaw;
    if (delta < -len * 0.5) {
      delta += len; // crossed the start/finish seam forward → completed a lap
      this.lap++;
      // Record the split for each *racing* lap completed. The first seam cross (grid → start
      // line, lap -1 → 0) begins lap 1 and isn't a completion, so only log once lap ≥ 1.
      if (this.lap >= 1) {
        this.lapSplits.push(ctx.time);
        this.snapLapStat();
      }
    } else if (delta > len * 0.5) {
      delta -= len; // tiny backward wobble across the seam → undo the phantom lap
      this.lap--;
      if (this.lapSplits.length > 0) {
        this.lapSplits.pop();
        this.lapStats.pop();
      }
    }
    this.lastRaw = raw;
    this.cp += delta;
    this.prog = this.cp;
    const finishLine = ctx.laps * len;
    if (this.cp >= finishLine && !this.finished) {
      this.finished = true;
      // Record a sub-step crossing time, not just the step's end time. Many karts can
      // cross the line within the same 1/60s step; backing out how far into the step each
      // one actually passed the line lets a photo finish resolve by who was truly ahead
      // instead of by entrant array order (which always favoured the player at index 0).
      const overshoot = this.cp - finishLine;
      const frac = delta > 1e-6 ? clamp(overshoot / delta, 0, 1) : 0;
      this.finishTime = ctx.time - frac * dt;
      // The final lap completes by crossing the finish line, not a mid-track seam, so record its
      // split here (using the precise crossing time). Guarded so a finisher ends with exactly
      // `laps` splits even if the seam logic already logged this lap.
      if (this.lapSplits.length < ctx.laps) {
        this.lapSplits.push(this.finishTime);
        this.snapLapStat();
      }
    }

    // Visuals (smoothed, render-only).
    this.vheading += wrapAngle(this.heading - this.vheading) * clamp(12 * dt, 0, 1);
    const targetSteer = clamp(alpha * 1.4 + this.over * 0.04, -0.5, 0.5);
    this.steerVis += (targetSteer - this.steerVis) * 0.18;
    const targetRoll = clamp(-omega * speed * 0.05, -0.26, 0.26);
    this.roll += (targetRoll - this.roll) * 0.12;
    const accelNow = (speed - this.pv) / dt;
    this.pitch += (clamp(-accelNow * 0.01, -0.06, 0.06) - this.pitch) * 0.12;
    this.pv = speed;
    this.wheelSpin += speed * dt * 3.2;
  }

  /** After finishing: coast to a stop while staying spaced. */
  coast(dt: number): void {
    this.syncPrev();
    this.collisionRadius = RAD;
    this.impactScale = 1;
    this.activeEffects.length = 0;
    this.resetTelemetry();
    this.resetLive();
    const speed = Math.max(0, Math.hypot(this.vx, this.vz) - 6 * dt);
    if (speed > 1e-3) this.heading = Math.atan2(this.vz, this.vx);
    this.vx = Math.cos(this.heading) * speed;
    this.vz = Math.sin(this.heading) * speed;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.vheading += wrapAngle(this.heading - this.vheading) * clamp(10 * dt, 0, 1);
    this.steerVis += (0 - this.steerVis) * 0.1;
    this.roll += (0 - this.roll) * 0.1;
    this.pitch += (0 - this.pitch) * 0.1;
    this.wheelSpin += speed * dt * 3.2;
  }

  toState(): RacerState {
    return {
      id: this.id,
      x: this.x,
      z: this.z,
      heading: this.heading,
      vheading: this.vheading,
      speed: this.speed,
      roll: this.roll,
      pitch: this.pitch,
      steer: this.steerVis,
      wheelSpin: this.wheelSpin,
      lap: this.lap,
      prog: this.prog,
      energyFrac: clamp(this.energy / this.d.energyMax, 0, 1),
      rank: this.rank,
      finished: this.finished,
      finishTime: this.finishTime,
    };
  }
}

/**
 * Positional separation + mass-weighted restitution impulses so karts bounce off each
 * other instead of overlapping. The heavier kart moves less and its velocity changes less
 * on contact (weight strategy: heavy ballast bullies, feather gets shoved). Reduces exactly
 * to the old equal-split behaviour when masses match — the common case. Deterministic:
 * iterates by index, no randomness.
 */
export function resolveCollisions(racers: Racer[]): void {
  const e = 0.3;
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];
      // Effect-aware contact distance (Vanguard Shield widens its hit box).
      const D = a.collisionRadius + b.collisionRadius;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist < D && dist > 1e-4) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = D - dist;
        // Split correction/impulse inversely to mass: each kart takes the *other's* mass
        // fraction, so the heavier one barely moves. Equal masses → 0.5/0.5 (legacy).
        const ma = a.d.mass;
        const mb = b.d.mass;
        const mt = ma + mb;
        const aShare = mb / mt;
        const bShare = ma / mt;
        a.x += nx * overlap * aShare;
        a.z += nz * overlap * aShare;
        b.x -= nx * overlap * bShare;
        b.z -= nz * overlap * bShare;
        const rvx = a.vx - b.vx;
        const rvz = a.vz - b.vz;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
          // Paint-Scraper-style shove: the harder hitter scales the impulse (and its cap).
          const scale = Math.max(a.impactScale, b.impactScale);
          const dv = -(1 + e) * vn * scale;
          let dvA = dv * aShare;
          let dvB = dv * bShare;
          // Cap the larger of the two velocity changes (preserves the old 6*scale ceiling).
          const cap = 6 * scale;
          const mx = Math.max(dvA, dvB);
          if (mx > cap) {
            const k = cap / mx;
            dvA *= k;
            dvB *= k;
          }
          a.vx += dvA * nx;
          a.vz += dvA * nz;
          b.vx -= dvB * nx;
          b.vz -= dvB * nz;
        }
      }
    }
  }
}

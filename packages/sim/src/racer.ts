import type { DerivedAttributes, Entrant, RacerState, Rng } from './contracts';
import { clamp, lerp, wrapAngle } from './math';
import type { Track } from './track';

/** Kart collision radius (m). */
export const RAD = 1.0;

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

  constructor(entrant: Entrant, derived: DerivedAttributes) {
    this.id = entrant.id;
    this.name = entrant.name;
    this.colorHex = entrant.colorHex;
    this.isPlayer = !!entrant.isPlayer;
    this.stats = entrant.stats;
    this.d = derived;
    this.energy = derived.energyMax;
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
    this.hint = track.project(x, z, 0).idx;
    this.energy = this.d.energyMax;
    this.finished = false;
    this.finishTime = 0;
    this.rank = 0;
    this.lap = 0;
    this.over = 0;
    this.roll = 0;
    this.pitch = 0;
    this.steerVis = 0;
    this.wheelSpin = 0;
    this.form = 0.97 + rng() * 0.06;
    this.pv = 0;
    this.syncPrev();
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
    const omegaMax = (d.latGrip / Math.max(speed, 3)) * 1.1;
    omega = clamp(omega, -omegaMax, omegaMax);
    this.heading += omega * dt;

    // Speed control from the upcoming corner + stamina fade.
    const cAhead = track.maxCurvAhead(pr.idx, 8 + speed * speed * 0.06);
    let cornerV = cAhead > 0.0008 ? Math.sqrt(d.latGrip / cAhead) : d.topSpeed;
    cornerV *= lerp(0.8, 1.06, d.judge);
    const eFrac = this.energy / d.energyMax;
    const fade = eFrac > 0.3 ? 1 : lerp(d.fadeFloor, 1, eFrac / 0.3);
    let topNow = d.topSpeed * fade * this.form;
    if (ctx.lastLap) topNow *= d.surge;
    const target = Math.min(cornerV, topNow);
    if (speed < target) speed = Math.min(target, speed + d.accel * dt);
    else speed = Math.max(target, speed - d.brake * dt);
    speed = clamp(speed, 0, topNow);
    this.vx = Math.cos(this.heading) * speed;
    this.vz = Math.sin(this.heading) * speed;

    // Energy.
    const effort = speed / d.topSpeed;
    let drain = 2.4 * effort * effort * d.drainEff;
    if (ctx.lastLap) drain *= 1.3;
    this.energy = Math.max(0, this.energy - drain * dt);

    // Integrate.
    const px = this.x;
    const pz = this.z;
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

    // Progress = along-track component of movement (robust to bumps & lane changes).
    this.cp += (this.x - px) * Math.cos(pr.ang) + (this.z - pz) * Math.sin(pr.ang);
    this.prog = this.cp;
    this.idx = pr.idx;
    this.lap = Math.max(0, Math.floor(this.cp / track.length));
    if (this.cp >= ctx.laps * track.length && !this.finished) {
      this.finished = true;
      this.finishTime = ctx.time;
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
 * Positional separation + equal-mass restitution impulses so karts bounce off each
 * other instead of overlapping. Deterministic: iterates by index, no randomness.
 */
export function resolveCollisions(racers: Racer[]): void {
  const D = 2 * RAD;
  const e = 0.3;
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist < D && dist > 1e-4) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = D - dist;
        const corr = overlap * 0.5;
        a.x += nx * corr;
        a.z += nz * corr;
        b.x -= nx * corr;
        b.z -= nz * corr;
        const rvx = a.vx - b.vx;
        const rvz = a.vz - b.vz;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
          let j2 = -(1 + e) * vn * 0.5;
          if (j2 > 6) j2 = 6;
          a.vx += j2 * nx;
          a.vz += j2 * nz;
          b.vx -= j2 * nx;
          b.vz -= j2 * nz;
        }
      }
    }
  }
}

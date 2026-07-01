/**
 * P1 — cross-package engine contracts (owned by the Technical Director).
 *
 * These types are the stable boundary between the deterministic simulation and
 * everything else (content, game, render, audio). The sim package is PURE: it
 * imports no DOM and no three.js, and it never reads the wall clock or calls
 * Math.random. All randomness flows through a seeded Rng; all time is passed in.
 *
 * Layered stat model:
 *   Parts  ->  KartStats (5 legible ratings)  ->  DerivedAttributes (physics)
 */
import type { CardEffect } from './effects';

/** The five legible, trainable/draftable ratings (Umamusume-inspired, kart-tuned). */
export const STAT_KEYS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** A kart's high-level ratings. Typically 0..120 (soft cap, can be exceeded by cards). */
export type KartStats = Record<StatKey, number>;

/** Physics quantities the simulation actually integrates, computed from KartStats. */
export interface DerivedAttributes {
  /** Straight-line speed cap (m/s). */
  topSpeed: number;
  /** Corner-exit / throttle drive (m/s^2). */
  accel: number;
  /** Braking deceleration (m/s^2). */
  brake: number;
  /** Lateral grip — sets achievable corner speed. */
  latGrip: number;
  /** Steering authority (yaw rate ceiling). */
  yawGrip: number;
  /** Stamina pool. */
  energyMax: number;
  /** Energy drain multiplier (<1 is more economical). */
  drainEff: number;
  /** Fraction of top speed retained when fully spent. */
  fadeFloor: number;
  /** Corner-read accuracy (0..1-ish); higher carries more corner speed. */
  judge: number;
  /** Final-lap surge multiplier. */
  surge: number;
  /** Kart mass (kg-ish); affects collision impulses and accel feel. */
  mass: number;
}

/** Seeded PRNG: deterministic float in [0, 1). */
export type Rng = () => number;

/** A drivable circuit defined by Catmull-Rom control points. */
export interface TrackDef {
  id: string;
  name: string;
  /** Closed loop control points in the XZ plane: [x, z]. */
  points: ReadonlyArray<readonly [number, number]>;
  /** Full road width (m). */
  width: number;
  /** Number of laps for a race. */
  laps: number;
  /** Centerline samples generated per control segment (default 22). */
  samplesPerSegment?: number;
}

/** One competitor in a race. */
export interface Entrant {
  id: string;
  name: string;
  /** 0xRRGGBB livery color. */
  colorHex: number;
  stats: KartStats;
  /**
   * Kart mass (kg) from the chassis/ballast loadout. Fed to `derive` so weight strategy
   * (feather/heavy ballast) actually reaches the physics. Absent = the reference mass
   * (see REF_MASS / derive's default), i.e. legacy behaviour for stat-only entrants.
   */
  mass?: number;
  isPlayer?: boolean;
  /** Optional triggered card effects evaluated inside the sim. Absent = legacy behaviour. */
  effects?: CardEffect[];
}

/** Everything needed to deterministically resolve a race. */
export interface RaceConfig {
  track: TrackDef;
  entrants: Entrant[];
  /** Master seed — same config + seed always yields the same result. */
  seed: number;
}

/** Per-tick render-facing state for a single kart. */
export interface RacerState {
  id: string;
  x: number;
  z: number;
  /** True physics heading (rad). */
  heading: number;
  /** Smoothed visual heading (rad) for jitter-free meshes. */
  vheading: number;
  /** Speed magnitude (m/s). */
  speed: number;
  roll: number;
  pitch: number;
  steer: number;
  wheelSpin: number;
  lap: number;
  /** Total along-track progress (m). */
  prog: number;
  energyFrac: number;
  rank: number;
  finished: boolean;
  finishTime: number;
}

/** A snapshot of the whole field at a moment in race time. */
export interface RaceFrame {
  time: number;
  racers: RacerState[];
}

/** Per-lap performance aggregates for one racer — the post-race echo of the live vitals HUD. */
export interface LapStat {
  /** Peak speed reached during the lap (m/s). */
  topSpeed: number;
  /** Mean speed over the lap (m/s). */
  avgSpeed: number;
  /** Mean lateral-grip usage over the lap (0..1) — the "corner load" gauge, averaged. */
  avgCorner: number;
  /** Stamina fraction at the end of the lap (0..1). */
  stamina: number;
}

export interface RaceResultRow {
  id: string;
  name: string;
  rank: number;
  finishTime: number;
  finished: boolean;
  /** Cumulative time (s) at each completed lap; index 0 = end of lap 1. Drives lap analysis. */
  lapSplits: number[];
  /** Per-lap speed/corner/stamina aggregates, parallel to `lapSplits`. Powers the analysis tab. */
  lapStats: LapStat[];
  /** Total laps in the race (so the analysis knows how many lap columns to render). */
  laps: number;
}

export interface RaceResult {
  order: RaceResultRow[];
  seed: number;
}

/** The deterministic race engine the renderer drives each frame. */
export interface IRaceEngine {
  readonly config: RaceConfig;
  readonly time: number;
  readonly started: boolean;
  readonly over: boolean;
  /** Begin the race clock (after countdown). */
  start(): void;
  /** Advance by wall-frame dt; internally steps fixed 1/60 ticks. */
  step(dt: number): void;
  /** Current field state for rendering/HUD. */
  snapshot(): RaceFrame;
  /** Final classification once over, else null. */
  result(): RaceResult | null;
}

/** Fixed simulation timestep (seconds). The determinism contract depends on this. */
export const FIXED_DT = 1 / 60;

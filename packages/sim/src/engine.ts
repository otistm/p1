import {
  FIXED_DT,
  type IRaceEngine,
  type RaceConfig,
  type RaceFrame,
  type RaceResult,
  type RaceResultRow,
} from './contracts';
import { derive } from './derive';
import { hashSeed, makeRng } from './rng';
import { Racer, resolveCollisions } from './racer';
import { Track } from './track';

/** Safety cap so a pathological build can never loop forever (sim-seconds). */
const MAX_RACE_TIME = 600;

/**
 * The deterministic race engine. Construct with a RaceConfig, call start() after the
 * countdown, then step(dt) every frame. Given the same config + seed it always yields
 * the same result — the foundation of async snapshot racing.
 */
export class RaceEngine implements IRaceEngine {
  readonly config: RaceConfig;
  readonly track: Track;
  readonly racers: Racer[];
  private readonly laps: number;
  private acc = 0;
  time = 0;
  started = false;
  over = false;
  private finishedOrder: Racer[] = [];

  constructor(config: RaceConfig) {
    this.config = config;
    this.track = new Track(config.track);
    this.laps = config.track.laps;
    const rng = makeRng(hashSeed(config.seed, config.entrants.length, config.track.points.length));
    this.racers = config.entrants.map((e) => new Racer(e, derive(e.stats)));

    // Grid: staggered rows of two behind the line, small lateral spread.
    const len = this.track.length;
    this.racers.forEach((rc, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const cp0 = -(4 + row * 5);
      const p = this.track.posAt(((cp0 % len) + len) % len);
      const nx = -Math.sin(p.ang);
      const nz = Math.cos(p.ang);
      const lat = (col === 0 ? -1 : 1) * 2.2;
      rc.place(p.x + nx * lat, p.z + nz * lat, p.ang, cp0, this.track, rng);
    });
    this.rank();
  }

  start(): void {
    this.started = true;
  }

  /**
   * Fraction in [0,1] of the next fixed step already accumulated. The renderer uses this
   * to interpolate between each racer's previous and current transform, decoupling the
   * fixed 60 Hz sim from the display refresh rate so motion never stutters/vibrates.
   */
  get alpha(): number {
    if (!this.started || this.over) return 1;
    const a = this.acc / FIXED_DT;
    return a < 0 ? 0 : a > 1 ? 1 : a;
  }

  step(dt: number): void {
    if (!this.started || this.over) return;
    this.acc += dt;
    while (this.acc >= FIXED_DT) {
      this.acc -= FIXED_DT;
      this.time += FIXED_DT;
      let allDone = true;
      for (const rc of this.racers) {
        if (!rc.finished) {
          const lastLap = rc.lap >= this.laps - 1;
          rc.step(FIXED_DT, {
            track: this.track,
            laps: this.laps,
            time: this.time,
            lastLap,
            racers: this.racers,
          });
          allDone = false;
        } else {
          rc.coast(FIXED_DT);
        }
        if (rc.finished && !this.finishedOrder.includes(rc)) this.finishedOrder.push(rc);
      }
      resolveCollisions(this.racers);
      if (allDone || this.time >= MAX_RACE_TIME) {
        this.finalize();
        break;
      }
    }
    this.rank();
  }

  /** Rank by finish time (finished first), then by progress. Stable, index-based. */
  private rank(): void {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.prog - a.prog;
    });
    sorted.forEach((rc, i) => (rc.rank = i + 1));
  }

  private finalize(): void {
    this.over = true;
    this.rank();
  }

  snapshot(): RaceFrame {
    return { time: this.time, racers: this.racers.map((r) => r.toState()) };
  }

  result(): RaceResult | null {
    if (!this.over) return null;
    const order: RaceResultRow[] = [...this.racers]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => ({
        id: r.id,
        name: r.name,
        rank: r.rank,
        finishTime: r.finishTime,
        finished: r.finished,
      }));
    return { order, seed: this.config.seed };
  }

  /**
   * Resolve a race to completion without rendering — used by the balance tool and by
   * (future) server-side verification. Deterministic and fast.
   */
  static resolve(config: RaceConfig): RaceResult {
    const eng = new RaceEngine(config);
    eng.start();
    while (!eng.over) eng.step(FIXED_DT * 8);
    return eng.result()!;
  }
}

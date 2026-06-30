import { describe, it, expect } from 'vitest';
import { RaceEngine } from './engine';
import { FIXED_DT, type Entrant, type RaceConfig, type TrackDef } from './contracts';
import { makeRng } from './rng';

const TRACK: TrackDef = {
  id: 'test-oval',
  name: 'Test Oval',
  width: 11.5,
  laps: 3,
  points: [
    [46, 0],
    [43.8, 25.3],
    [23, 39.8],
    [0, 41.4],
    [-23, 39.8],
    [-43.8, 25.3],
    [-46, 0],
    [-35.9, -20.7],
    [-23, -39.8],
    [0, -50.6],
    [23, -39.8],
    [35.9, -20.7],
  ],
};

function entrant(id: string, base: number): Entrant {
  return {
    id,
    name: id,
    colorHex: 0xffffff,
    stats: { speed: base, stamina: base, power: base, guts: base, wit: base },
  };
}

function config(seed: number): RaceConfig {
  return {
    track: TRACK,
    seed,
    entrants: [entrant('a', 40), entrant('b', 45), entrant('c', 50), entrant('d', 55)],
  };
}

describe('RaceEngine determinism', () => {
  it('produces identical results for the same config + seed', () => {
    const r1 = RaceEngine.resolve(config(1234));
    const r2 = RaceEngine.resolve(config(1234));
    expect(r2).toEqual(r1);
  });

  it('is independent of frame batching (fixed-timestep invariance)', () => {
    // Reference: resolve in big chunks.
    const ref = RaceEngine.resolve(config(99));

    // Compare against per-frame stepping with an uneven dt schedule.
    const eng = new RaceEngine(config(99));
    eng.start();
    const rng = makeRng(7);
    let guard = 0;
    while (!eng.over && guard++ < 200_000) {
      // Jittered frame times, but always a multiple-ish of real frames.
      eng.step(FIXED_DT * (1 + Math.floor(rng() * 3)));
    }
    expect(eng.result()).toEqual(ref);
  });

  it('different seeds can change the outcome but never crash', () => {
    const a = RaceEngine.resolve(config(1));
    const b = RaceEngine.resolve(config(2));
    expect(a.order).toHaveLength(4);
    expect(b.order).toHaveLength(4);
    for (const row of a.order) expect(row.finished).toBe(true);
  });

  it('stronger karts win on average across seeds', () => {
    let strongWins = 0;
    const N = 40;
    for (let s = 0; s < N; s++) {
      const res = RaceEngine.resolve(config(1000 + s));
      // 'd' has the highest base stats.
      if (res.order[0].id === 'd') strongWins++;
    }
    // Not guaranteed every race, but should dominate.
    expect(strongWins).toBeGreaterThan(N * 0.6);
  });

  it('ranks are 1..N with no gaps', () => {
    const res = RaceEngine.resolve(config(42));
    const ranks = res.order.map((r) => r.rank).sort((x, y) => x - y);
    expect(ranks).toEqual([1, 2, 3, 4]);
  });
});

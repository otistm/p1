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

  it('stays deterministic and frame-batching invariant with effect-bearing entrants', () => {
    // Mixed field: each kart carries a different triggered effect. The result must be
    // reproducible and identical whether stepped in big chunks or jittered per frame.
    const withEffects: RaceConfig = {
      track: TRACK,
      seed: 555,
      entrants: [
        { ...entrant('p', 48), effects: [{ kind: 'claustrophobia' }] },
        { ...entrant('a', 50), effects: [{ kind: 'slingshotSiphon' }, { kind: 'desperationDraft' }] },
        { ...entrant('b', 50), effects: [{ kind: 'vanguardShield' }] },
        { ...entrant('c', 52), effects: [{ kind: 'cleanAirSupercharger' }, { kind: 'paintScraper' }] },
      ],
    };

    const ref = RaceEngine.resolve(withEffects);
    const again = RaceEngine.resolve(withEffects);
    expect(again).toEqual(ref);

    const eng = new RaceEngine(withEffects);
    eng.start();
    const rng = makeRng(13);
    let guard = 0;
    while (!eng.over && guard++ < 200_000) eng.step(FIXED_DT * (1 + Math.floor(rng() * 3)));
    expect(eng.result()).toEqual(ref);
  });

  it('absent effects reproduce the legacy result bit-for-bit', () => {
    // The same seed/config with no effects must match a run where entrants carry empty
    // effect arrays — the default-absent guarantee that protects existing saves.
    const plain = RaceEngine.resolve(config(2024));
    const emptyEffects: RaceConfig = {
      ...config(2024),
      entrants: config(2024).entrants.map((e) => ({ ...e, effects: [] })),
    };
    expect(RaceEngine.resolve(emptyEffects)).toEqual(plain);
  });

  it('settles the order by crossing time then progress, never by entrant index', () => {
    // Identical karts finish in a tight pack with same-step crossings. The player-style
    // entrant sits at index 0; the old tie-break handed it those photo finishes for free.
    // The order must instead follow (finishTime asc, progress desc) for every seed.
    const equal = (id: string): Entrant => entrant(id, 50);
    for (let s = 0; s < 25; s++) {
      const eng = new RaceEngine({
        track: TRACK,
        seed: 8000 + s,
        entrants: [equal('p'), equal('a'), equal('b'), equal('c')],
      });
      eng.start();
      let guard = 0;
      while (!eng.over && guard++ < 200_000) eng.step(FIXED_DT * 4);

      const expected = [...eng.racers]
        .sort((a, b) => (a.finishTime !== b.finishTime ? a.finishTime - b.finishTime : b.prog - a.prog))
        .map((r) => r.id);
      const byRank = [...eng.racers].sort((a, b) => a.rank - b.rank).map((r) => r.id);
      expect(byRank).toEqual(expected);

      // Finish times are non-decreasing down the rankings (no later crosser placed higher).
      const fin = [...eng.racers].filter((r) => r.finished).sort((a, b) => a.rank - b.rank);
      for (let i = 1; i < fin.length; i++) {
        expect(fin[i].finishTime).toBeGreaterThanOrEqual(fin[i - 1].finishTime - 1e-9);
      }
    }
  });
});

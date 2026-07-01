import { describe, it, expect } from 'vitest';
import { RaceEngine } from './engine';
import { Track } from './track';
import { FIXED_DT, type Entrant, type RaceConfig, type TrackDef } from './contracts';
import { makeRng } from './rng';
import { derive } from './derive';
import { Racer, resolveCollisions } from './racer';

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
    // Not guaranteed every race, but should clearly dominate. (The 2026-07-01 balance pass
    // de-emphasised endurance snowballing for closer racing, so a +5-all edge over a tight
    // field now wins ~55%+ rather than 60%+ — still well above the 25% a coin-toss would give.)
    expect(strongWins).toBeGreaterThan(N * 0.5);
  });

  it('records one cumulative, monotonic lap split per lap for finishers (powers lap analysis)', () => {
    const res = RaceEngine.resolve(config(42));
    for (const row of res.order) {
      expect(row.laps).toBe(TRACK.laps);
      if (!row.finished) continue;
      // A finisher completed every lap → exactly `laps` splits, strictly increasing, with the
      // last one at the finish line (≈ finishTime, within the coarse resolve step).
      expect(row.lapSplits).toHaveLength(TRACK.laps);
      for (let i = 1; i < row.lapSplits.length; i++) {
        expect(row.lapSplits[i]).toBeGreaterThan(row.lapSplits[i - 1]);
      }
      const lastSplit = row.lapSplits[row.lapSplits.length - 1];
      expect(Math.abs(lastSplit - row.finishTime)).toBeLessThan(FIXED_DT * 8 + 1e-6);
      // Per-lap stats ride alongside the splits, one per lap, with sane physical ranges.
      expect(row.lapStats).toHaveLength(row.lapSplits.length);
      for (const st of row.lapStats) {
        expect(st.topSpeed).toBeGreaterThan(0);
        expect(st.topSpeed).toBeGreaterThanOrEqual(st.avgSpeed);
        expect(st.avgCorner).toBeGreaterThanOrEqual(0);
        expect(st.avgCorner).toBeLessThanOrEqual(1);
        expect(st.stamina).toBeGreaterThanOrEqual(0);
        expect(st.stamina).toBeLessThanOrEqual(1);
      }
    }
  });

  it('ranks are 1..N with no gaps', () => {
    const res = RaceEngine.resolve(config(42));
    const ranks = res.order.map((r) => r.rank).sort((x, y) => x - y);
    expect(ranks).toEqual([1, 2, 3, 4]);
  });

  it('applies loadout mass to physics: a lighter kart time-trials faster (a = F/m)', () => {
    // Regression guard for the "ballast never reaches the sim" bug. Solo time-trials isolate
    // the drive from collision noise: two stat-identical karts, one feather (145 kg) and one
    // heavy (195 kg). Higher accel (lighter) must yield lower finish times, consistently
    // across seeds. If mass were dropped both would default to REF_MASS and finish in
    // *identical* time — exactly the bug this guards.
    const base = { speed: 48, stamina: 48, power: 48, guts: 48, wit: 48 };
    let lighterFaster = 0;
    let everDifferent = false;
    const N = 20;
    for (let s = 0; s < N; s++) {
      const light = RaceEngine.resolve({
        track: TRACK,
        seed: 5000 + s,
        entrants: [{ id: 'solo', name: 'solo', colorHex: 0xffffff, stats: base, mass: 145 }],
      }).order[0].finishTime;
      const heavy = RaceEngine.resolve({
        track: TRACK,
        seed: 5000 + s,
        entrants: [{ id: 'solo', name: 'solo', colorHex: 0xffffff, stats: base, mass: 195 }],
      }).order[0].finishTime;
      if (light !== heavy) everDifferent = true;
      if (light < heavy) lighterFaster++;
    }
    expect(everDifferent).toBe(true);
    expect(lighterFaster).toBeGreaterThan(N * 0.7);
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

  it('keeps the live standings glued to the karts actual track positions', () => {
    // Regression guard for the "board shows karts in different places than the track" bug.
    // The leaderboard ranks by `prog`; `prog` must track each kart's actual (x,z) position
    // projected onto the centerline, lap-aware (industry-standard). We re-derive that
    // projection independently every fixed step and count how often the engine's order
    // disagrees with it. Dead-reckoned accumulation (the old bug) scored ~3.7 inverted
    // pairs/tick here; the projection metric must stay near zero. The small residual is the
    // <=1-tick latency between the engine's mid-step projection and this post-step one.
    const cfg = config(31337);
    const track = new Track(cfg.track);
    const eng = new RaceEngine(cfg);
    eng.start();
    const len = track.length;
    const hint = new Map<string, number>();
    const proj = new Map<string, { p: number; last: number; on: boolean }>();
    for (const r of eng.racers) {
      hint.set(r.id, r.idx);
      proj.set(r.id, { p: 0, last: 0, on: false });
    }

    let ticks = 0;
    let inversions = 0;
    let guard = 0;
    while (!eng.over && guard++ < 200_000) {
      eng.step(FIXED_DT);
      for (const r of eng.racers) {
        const pr = track.project(r.x, r.z, hint.get(r.id)!);
        hint.set(r.id, pr.idx);
        const raw = ((pr.s % len) + len) % len;
        const t = proj.get(r.id)!;
        if (!t.on) {
          t.p = raw;
          t.last = raw;
          t.on = true;
        } else {
          let d = raw - t.last;
          if (d < -len * 0.5) d += len;
          else if (d > len * 0.5) d -= len;
          t.p += d;
          t.last = raw;
        }
      }
      const byRank = [...eng.racers].sort((a, b) => a.rank - b.rank).map((r) => r.id);
      const byProj = [...eng.racers].sort((a, b) => proj.get(b.id)!.p - proj.get(a.id)!.p).map((r) => r.id);
      const posProj = new Map(byProj.map((id, i) => [id, i]));
      for (let i = 0; i < byRank.length; i++)
        for (let j = i + 1; j < byRank.length; j++)
          if (posProj.get(byRank[i])! > posProj.get(byRank[j])!) inversions++;
      ticks++;
    }
    const perTick = inversions / Math.max(ticks, 1);
    expect(perTick).toBeLessThan(1); // dead-reckoning scored ~3.7 here
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

describe('mass-weighted collisions', () => {
  it('shoves the lighter kart more than the heavier one, and matches legacy split at equal mass', () => {
    const stats = { speed: 50, stamina: 50, power: 50, guts: 50, wit: 50 };
    // Build a kart at a world pose with a head-on closing velocity along x.
    const make = (id: string, x: number, vx: number, mass: number): Racer => {
      const r = new Racer({ id, name: id, colorHex: 0, stats, mass }, derive(stats, mass));
      r.x = x;
      r.z = 0;
      r.vx = vx;
      r.vz = 0;
      return r;
    };

    // Unequal mass: light (145) vs heavy (195), overlapping (|dx| < 2*RAD) and closing.
    const light = make('light', -0.5, 4, 145);
    const heavy = make('heavy', 0.5, -4, 195);
    resolveCollisions([light, heavy]);
    // The lighter kart's speed change must exceed the heavier kart's.
    expect(Math.abs(light.vx - 4)).toBeGreaterThan(Math.abs(heavy.vx + 4));

    // Equal mass reduces to the old symmetric 0.5/0.5 split.
    const a = make('a', -0.5, 4, 170);
    const b = make('b', 0.5, -4, 170);
    resolveCollisions([a, b]);
    expect(Math.abs(a.vx - 4)).toBeCloseTo(Math.abs(b.vx + 4), 6);
  });
});

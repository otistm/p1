/**
 * Standings-accuracy diagnostic. Quantifies whether the live leaderboard (ranked by the
 * engine's dead-reckoned `prog`/`cp`) agrees with where the karts ACTUALLY are on track —
 * i.e. what the player sees. "On track" = each kart's actual world position (x,z) projected
 * onto the centerline, lap-aware (the industry-standard measure; see
 * docs/cards-proximity-conditional.md research notes / sim-physics.md).
 *
 * For every fixed step it computes, per kart:
 *   - cpProg     : the current ranking metric (Racer.prog, accumulated along-track movement).
 *   - projProg   : lap*length + projected arc-length, re-derived from (x,z) each tick with
 *                  seam correction (the s&box RaceStandings approach).
 * Then it compares the orderings and reports how often they disagree, the worst pairwise
 * inversions, and the maximum drift between cpProg and projProg (which collisions cause,
 * since resolveCollisions moves x,z without crediting cp).
 *
 *   npx tsx tools/diag/standings.ts
 */
import {
  RaceEngine,
  FIXED_DT,
  Track,
  hashSeed,
  makeRng,
  clamp,
  STAT_KEYS,
  type Entrant,
  type KartStats,
  type RaceConfig,
} from '@grid/sim';
import { SUNSET_DERBY, ROUNDS, RIVAL_ARCHETYPES, STARTER_LOADOUT } from '@grid/content';
import { loadoutToStats } from '@grid/content';

/** Mirror of the game's opponent assembly (scaled rival archetypes, no ghosts). */
function opponents(roundIdx: number, seed: number): Entrant[] {
  const rng = makeRng(hashSeed(seed, roundIdx, 7));
  const scale = ROUNDS[roundIdx].rivalScale;
  return RIVAL_ARCHETYPES.map((a) => {
    const st = {} as KartStats;
    for (const k of STAT_KEYS) st[k] = clamp(a.stats[k] * (1 + scale) + (rng() * 6 - 3), 5, 120);
    return { id: `rival-${a.id}`, name: a.name, colorHex: 0xffffff, stats: st };
  });
}

function config(roundIdx: number, seed: number): RaceConfig {
  const { stats } = loadoutToStats(STARTER_LOADOUT);
  const player: Entrant = { id: 'player', name: 'You', colorHex: 0x2bd9ff, stats, isPlayer: true };
  const track = { ...SUNSET_DERBY, laps: ROUNDS[roundIdx].laps };
  return { track, seed, entrants: [player, ...opponents(roundIdx, seed)] };
}

interface Tracker {
  id: string;
  hint: number;
  projProg: number;
  lastRaw: number;
  started: boolean;
  /** (cp - projProg) captured on the first tick, so we can report genuine accumulated drift
   *  rather than the constant origin offset (the grid starts behind the start/finish seam). */
  offset0: number;
}

/** Spearman-style: count pairwise inversions between two id-orderings. */
function inversions(a: string[], b: string[]): number {
  const posB = new Map(b.map((id, i) => [id, i]));
  let inv = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      // a says i before j; if b disagrees, that's an inversion.
      if ((posB.get(a[i]) ?? 0) > (posB.get(a[j]) ?? 0)) inv++;
    }
  return inv;
}

interface Summary {
  round: string;
  seeds: number;
  ticks: number;
  disagreeTicks: number;
  disagreePct: number;
  avgInversionsPerTick: number;
  maxInversionsInAnyTick: number;
  maxDriftMeters: number;
  ticksWithPlayerMisplaced: number;
  playerMisplacedPct: number;
}

function runRound(roundIdx: number, seeds: number): Summary {
  const rdef = ROUNDS[roundIdx];
  let ticks = 0;
  let disagreeTicks = 0;
  let totalInversions = 0;
  let maxInversions = 0;
  let maxDrift = 0;
  let playerMisplaced = 0;

  for (let s = 0; s < seeds; s++) {
    const seed = 4000 + s * 17;
    const cfg = config(roundIdx, seed);
    const track = new Track(cfg.track);
    const eng = new RaceEngine(cfg);
    eng.start();

    const trackers = new Map<string, Tracker>();
    for (const r of eng.racers)
      trackers.set(r.id, {
        id: r.id,
        hint: r.idx,
        projProg: 0,
        lastRaw: 0,
        started: false,
        offset0: NaN,
      });

    let guard = 0;
    while (!eng.over && guard++ < 500_000) {
      eng.step(FIXED_DT);

      // Re-derive each kart's projected, lap-aware progress from its actual (x,z).
      for (const r of eng.racers) {
        const tk = trackers.get(r.id)!;
        const pr = track.project(r.x, r.z, tk.hint);
        tk.hint = pr.idx;
        const raw = ((pr.s % track.length) + track.length) % track.length;
        if (!tk.started) {
          tk.projProg = raw;
          tk.lastRaw = raw;
          tk.started = true;
        } else {
          let delta = raw - tk.lastRaw;
          if (delta < -track.length * 0.5) delta += track.length; // crossed seam forward
          else if (delta > track.length * 0.5) delta -= track.length; // backward wobble
          tk.projProg += delta;
          tk.lastRaw = raw;
        }
        if (Number.isNaN(tk.offset0)) tk.offset0 = r.prog - tk.projProg;
      }

      // Orderings: current engine rank (by cp) vs projection-derived progress.
      const byCp = [...eng.racers].sort((a, b) => a.rank - b.rank).map((r) => r.id);
      const byProj = [...eng.racers]
        .sort((a, b) => trackers.get(b.id)!.projProg - trackers.get(a.id)!.projProg)
        .map((r) => r.id);

      ticks++;
      const inv = inversions(byCp, byProj);
      if (inv > 0) disagreeTicks++;
      totalInversions += inv;
      if (inv > maxInversions) maxInversions = inv;

      // Player placement mismatch (what the chart shows vs the on-track truth).
      const playerCpRank = byCp.indexOf('player');
      const playerProjRank = byProj.indexOf('player');
      if (playerCpRank !== playerProjRank) playerMisplaced++;

      // Genuine accumulated drift: how far cp has wandered from the actual on-track
      // position beyond the constant origin offset (collisions are the main driver).
      for (const r of eng.racers) {
        const tk = trackers.get(r.id)!;
        const drift = Math.abs(r.prog - tk.projProg - tk.offset0);
        if (drift > maxDrift) maxDrift = drift;
      }
    }
  }

  return {
    round: rdef.name,
    seeds,
    ticks,
    disagreeTicks,
    disagreePct: Math.round((disagreeTicks / Math.max(ticks, 1)) * 1000) / 10,
    avgInversionsPerTick: Math.round((totalInversions / Math.max(ticks, 1)) * 100) / 100,
    maxInversionsInAnyTick: maxInversions,
    maxDriftMeters: Math.round(maxDrift * 100) / 100,
    ticksWithPlayerMisplaced: playerMisplaced,
    playerMisplacedPct: Math.round((playerMisplaced / Math.max(ticks, 1)) * 1000) / 10,
  };
}

const SEEDS = 60;
const rows = ROUNDS.map((_, ri) => runRound(ri, SEEDS));
console.log(
  JSON.stringify(
    {
      note: 'cpProg = current ranking metric (dead-reckoned). projProg = actual (x,z) projected onto centerline, lap-aware (what the player sees). Disagreements => the leaderboard shows karts in different positions than the track.',
      seedsPerRound: SEEDS,
      rounds: rows,
    },
    null,
    2,
  ),
);

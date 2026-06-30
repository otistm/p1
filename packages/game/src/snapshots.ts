import {
  clamp,
  hashSeed,
  makeRng,
  STAT_KEYS,
  type Entrant,
  type KartStats,
  type RaceConfig,
} from '@grid/sim';
import { LIVERIES, RIVAL_ARCHETYPES, ROUNDS, SUNSET_DERBY } from '@grid/content';
import { computeSeasonStats, overallRating } from './economy';
import type { BuildSnapshot, PlayerSave, SeasonState } from './types';

const FIELD_OPPONENTS = 5;

function opponentColors(playerLivery: number): number[] {
  return LIVERIES.map((l) => l.value as number).filter((h) => h !== playerLivery);
}

/**
 * Build the opponent field for a round. Mixes the player's recent saved builds (true
 * async "ghosts") with scaled rival archetypes, all seeded for reproducibility.
 */
export function makeOpponents(save: PlayerSave, roundIdx: number, seed: number): Entrant[] {
  const rng = makeRng(hashSeed(seed, roundIdx, 7));
  const scale = ROUNDS[roundIdx].rivalScale;
  const colors = opponentColors(save.liveryHex);
  const out: Entrant[] = [];

  const ghosts = save.pastBuilds.slice(-2);
  ghosts.forEach((g, i) => {
    out.push({ id: `ghost-${g.id}`, name: g.name, colorHex: colors[i % colors.length], stats: { ...g.stats } });
  });

  let ci = ghosts.length;
  for (const a of RIVAL_ARCHETYPES) {
    if (out.length >= FIELD_OPPONENTS) break;
    const st = {} as KartStats;
    for (const k of STAT_KEYS) st[k] = clamp(a.stats[k] * (1 + scale) + (rng() * 6 - 3), 5, 120);
    out.push({ id: `rival-${a.id}`, name: a.name, colorHex: colors[ci % colors.length], stats: st });
    ci++;
  }
  return out;
}

/** Assemble a full, reproducible RaceConfig for the current season round. */
export function assembleRaceConfig(save: PlayerSave, season: SeasonState, seed: number): RaceConfig {
  const { stats } = computeSeasonStats(save, season);
  const player: Entrant = {
    id: 'player',
    name: save.name,
    colorHex: save.liveryHex,
    stats,
    isPlayer: true,
  };
  const opponents = makeOpponents(save, season.round, seed);
  const track = { ...SUNSET_DERBY, laps: ROUNDS[season.round].laps };
  return { track, seed, entrants: [player, ...opponents] };
}

/** Capture the player's current build as a shareable, race-able snapshot. */
export function buildSnapshot(save: PlayerSave, season: SeasonState): BuildSnapshot {
  const { stats } = computeSeasonStats(save, season);
  const ts = Date.now();
  return {
    v: 1,
    id: `${save.name}-${ts.toString(36)}`,
    name: save.name,
    colorHex: save.liveryHex,
    stats,
    rating: overallRating(stats),
    ts,
  };
}

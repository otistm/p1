import {
  clamp,
  hashSeed,
  isPhase2Kind,
  makeRng,
  STAT_KEYS,
  type Entrant,
  type KartStats,
  type RaceConfig,
} from '@grid/sim';
import { CARDS, LIVERIES, RIVAL_ARCHETYPES, ROUNDS, trackForRound } from '@grid/content';
import { computeSeasonStats, effectsFromCardIds, overallRating } from './economy';
import type { BuildSnapshot, PlayerSave, SeasonState } from './types';

const FIELD_OPPONENTS = 5;

/** Phase-1 effect cards rivals can be seeded with, so the AI field also plays the meta. */
const EFFECT_CARD_IDS: string[] = CARDS.filter(
  (c) => c.effect && !isPhase2Kind(c.effect.kind),
).map((c) => c.id);

function opponentColors(playerLivery: number): number[] {
  return LIVERIES.map((l) => l.value as number).filter((h) => h !== playerLivery);
}

/**
 * Build the opponent field for a round. Mixes the player's recent saved builds (true
 * async "ghosts") with scaled rival archetypes, all seeded for reproducibility.
 */
export function makeOpponents(save: PlayerSave, roundIdx: number, seed: number): Entrant[] {
  const rng = makeRng(hashSeed(seed, roundIdx, 7));
  // Separate stream for effect assignment so the existing stat RNG (and thus prior seeds)
  // is unchanged; effects are layered on deterministically.
  const effRng = makeRng(hashSeed(seed, roundIdx, 0xeffec7));
  const scale = ROUNDS[roundIdx].rivalScale;
  const colors = opponentColors(save.liveryHex);
  const out: Entrant[] = [];

  const ghosts = save.pastBuilds.slice(-2);
  ghosts.forEach((g, i) => {
    // Ghosts are the player's own past builds, so they share the player's name. Disambiguate
    // them (and from each other) so the leaderboard never shows several identical "Comet"
    // rows — which made it look like the player was winning when a ghost actually led.
    const suffix = ghosts.length > 1 ? ` (ghost ${i + 1})` : ' (ghost)';
    // Ghosts replay with the cards they raced (older snapshots default to none).
    const effects = effectsFromCardIds(g.cardIds ?? []);
    out.push({
      id: `ghost-${g.id}`,
      name: `${g.name}${suffix}`,
      colorHex: colors[i % colors.length],
      stats: { ...g.stats },
      mass: g.mass,
      effects,
    });
  });

  let ci = ghosts.length;
  for (const a of RIVAL_ARCHETYPES) {
    if (out.length >= FIELD_OPPONENTS) break;
    const st = {} as KartStats;
    for (const k of STAT_KEYS) st[k] = clamp(a.stats[k] * (1 + scale) + (rng() * 6 - 3), 5, 120);
    // Each rival draws one effect card from the pool (deterministic, off the effect stream).
    const eff =
      EFFECT_CARD_IDS.length > 0
        ? effectsFromCardIds([EFFECT_CARD_IDS[Math.floor(effRng() * EFFECT_CARD_IDS.length)]])
        : [];
    out.push({
      id: `rival-${a.id}`,
      name: a.name,
      colorHex: colors[ci % colors.length],
      stats: st,
      effects: eff,
    });
    ci++;
  }
  return out;
}

/** Assemble a full, reproducible RaceConfig for the current season round. */
export function assembleRaceConfig(save: PlayerSave, season: SeasonState, seed: number): RaceConfig {
  const { stats, mass } = computeSeasonStats(save, season);
  const player: Entrant = {
    id: 'player',
    name: save.name,
    colorHex: save.liveryHex,
    stats,
    mass,
    isPlayer: true,
    effects: effectsFromCardIds(season.stagedTuningCardIds),
  };
  const opponents = makeOpponents(save, season.round, seed);
  const track = { ...trackForRound(season.round), laps: ROUNDS[season.round].laps };
  return { track, seed, entrants: [player, ...opponents] };
}

/** Capture the player's current build as a shareable, race-able snapshot. */
export function buildSnapshot(save: PlayerSave, season: SeasonState): BuildSnapshot {
  const { stats, mass } = computeSeasonStats(save, season);
  const ts = Date.now();
  return {
    v: 2,
    id: `${save.name}-${ts.toString(36)}`,
    name: save.name,
    colorHex: save.liveryHex,
    stats,
    mass,
    rating: overallRating(stats),
    cardIds: [...season.stagedTuningCardIds],
    ts,
  };
}

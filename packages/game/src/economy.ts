import { STAT_KEYS, type KartStats } from '@grid/sim';
import {
  addStats,
  CARDS_BY_ID,
  loadoutToStats,
  loadoutToVisual,
  type KartVisualSpec,
  type Loadout,
} from '@grid/content';
import type { PlayerSave, SeasonState } from './types';

const zero = (): KartStats => ({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 });

/** Sum of a set of drafted cards' modifiers. */
export function cardMods(cardIds: string[]): KartStats {
  let acc = zero();
  for (const id of cardIds) {
    const card = CARDS_BY_ID[id];
    if (card) acc = addStats(acc, card.mods);
  }
  return acc;
}

/**
 * The kart's final race stats = part base + training deltas + drafted card mods.
 * Pure and deterministic — the same inputs always feed the sim the same numbers.
 */
export function computeRaceStats(
  loadout: Loadout,
  trainedStats: KartStats,
  draftedCardIds: string[],
): { stats: KartStats; mass: number } {
  const { stats: base, mass } = loadoutToStats(loadout);
  const withTraining = addStats(base, trainedStats);
  const withCards = addStats(withTraining, cardMods(draftedCardIds));
  return { stats: withCards, mass };
}

export function computeSeasonStats(save: PlayerSave, season: SeasonState): { stats: KartStats; mass: number } {
  return computeRaceStats(save.loadout, season.trainedStats, season.draftedCardIds);
}

/** A single overall number for matchmaking / display (sum of ratings). */
export function overallRating(stats: KartStats): number {
  let sum = 0;
  for (const k of STAT_KEYS) sum += stats[k];
  return Math.round(sum);
}

export function visualFor(save: PlayerSave): KartVisualSpec {
  return loadoutToVisual(save.loadout, save.liveryHex);
}

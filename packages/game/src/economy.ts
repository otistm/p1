import { isPhase2Kind, STAT_KEYS, type CardEffect, type KartStats } from '@grid/sim';
import {
  addStats,
  CARDS_BY_ID,
  loadoutToStats,
  loadoutToVisual,
  TUNING_CARDS,
  type KartVisualSpec,
  type Loadout,
  type Rarity,
} from '@grid/content';
import type { PlayerSave, SeasonState } from './types';

const zero = (): KartStats => ({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 });

/**
 * How many tuning cards the player can own at once — and therefore the max tuning-card
 * hand size, since every owned copy is always in hand (see docs/training-tuning-cards.md).
 * Tuning cards are consumable: playing one stages it for the next race, and it's struck
 * from the collection when that race resolves.
 */
export const MAX_OWNED_TUNING = 4;

/** How many tuning-card slots the shop shows at once. */
export const SHOP_SLOTS = 4;

/** How many paid rerolls the shop allows per visit. */
export const SHOP_MAX_REROLLS = 2;

/** Base reroll price; doubles on each subsequent reroll this visit. */
export const SHOP_REROLL_BASE_COST = 20;

/** Reroll price for the Nth reroll this visit (0-indexed: 0 -> base, 1 -> base*2, ...). */
export function rerollCost(rerollsSoFar: number): number {
  return SHOP_REROLL_BASE_COST * 2 ** rerollsSoFar;
}

/**
 * Money awarded per finishing rank (6-kart field). The podium still pays the most by a wide
 * margin, but 4th–6th now earn a small consolation so a player who's behind isn't zeroed out
 * — consuming staged tuning cards on a loss with no income was a punishing spiral that
 * discouraged experimentation (see docs/game-review.md §2). Restraint still wins: hoarding
 * beats full-burn, full-burn is roughly break-even for a podium finisher.
 */
const FINISH_PAYOUT = [120, 70, 35, 22, 14, 9];

/** Race winnings by finishing rank, scaled up in the tougher later rounds. */
export function racePayout(rank: number, round: number): number {
  if (rank < 1 || rank > FINISH_PAYOUT.length) return 0;
  return Math.round(FINISH_PAYOUT[rank - 1] * (1 + round * 0.4));
}

/** Shop price of a tuning card, by rarity. */
const RARITY_PRICE: Record<Rarity, number> = {
  common: 40,
  rare: 90,
  epic: 160,
  legendary: 280,
};
export function cardPrice(cardId: string): number {
  const card = CARDS_BY_ID[cardId];
  return card?.rarity ? RARITY_PRICE[card.rarity] : 0;
}

/** How often each rarity shows up when the shop rolls its 4 slots — rarer shows up less. */
const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 40,
  rare: 28,
  epic: 14,
  legendary: 6,
};

/**
 * Cards that actually do something today: flat-mod cards plus Phase-1 triggered effects.
 * Phase-2 effect cards are inert (their sim subsystems haven't shipped), so they are kept
 * out of the shop until they work.
 */
export const LIVE_CARD_IDS: string[] = TUNING_CARDS.filter(
  (c) => !c.effect || !isPhase2Kind(c.effect.kind),
).map((c) => c.id);
const LIVE_CARD_SET = new Set(LIVE_CARD_IDS);
export const isLiveCard = (cardId: string): boolean => LIVE_CARD_SET.has(cardId);

/**
 * Roll a fresh set of `SHOP_SLOTS` tuning-card offers, weighted by rarity, without
 * repeats within the same roll. `rng` is a `() => number` in `[0, 1)` — pass `Math.random`
 * for a fresh visit/reroll (the shop's offer isn't part of race/replay determinism).
 */
export function sampleShopSlots(rng: () => number): string[] {
  const pool = LIVE_CARD_IDS.map((id) => ({
    id,
    weight: RARITY_WEIGHT[CARDS_BY_ID[id].rarity ?? 'common'],
  }));
  const picked: string[] = [];
  const n = Math.min(SHOP_SLOTS, pool.length);
  for (let i = 0; i < n; i++) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let r = rng() * total;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picked;
}

/** Sum of a set of tuning cards' flat modifiers (training cards carry no `mods`). */
export function cardMods(cardIds: string[]): KartStats {
  let acc = zero();
  for (const id of cardIds) {
    const card = CARDS_BY_ID[id];
    if (card?.mods) acc = addStats(acc, card.mods);
  }
  return acc;
}

/** The triggered in-sim effects carried by a set of cards (cards without one skip). */
export function effectsFromCardIds(cardIds: string[]): CardEffect[] {
  const out: CardEffect[] = [];
  for (const id of cardIds) {
    const card = CARDS_BY_ID[id];
    if (card?.effect) out.push(card.effect);
  }
  return out;
}

/**
 * The kart's final race stats = part base + training deltas + staged tuning-card mods.
 * Pure and deterministic — the same inputs always feed the sim the same numbers.
 */
export function computeRaceStats(
  loadout: Loadout,
  trainedStats: KartStats,
  stagedTuningCardIds: string[],
): { stats: KartStats; mass: number } {
  const { stats: base, mass } = loadoutToStats(loadout);
  const withTraining = addStats(base, trainedStats);
  const withCards = addStats(withTraining, cardMods(stagedTuningCardIds));
  return { stats: withCards, mass };
}

export function computeSeasonStats(save: PlayerSave, season: SeasonState): { stats: KartStats; mass: number } {
  return computeRaceStats(save.loadout, season.trainedStats, season.stagedTuningCardIds);
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

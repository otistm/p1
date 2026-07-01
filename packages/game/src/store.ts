import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { makeRng, type RaceConfig, type RaceResult } from '@grid/sim';
import {
  CARDS_BY_ID,
  DEFAULT_TRAIL_ID,
  ROUNDS,
  STARTER_LOADOUT,
  STARTER_PART_IDS,
  type Loadout,
  type Slot,
} from '@grid/content';
import type { BuildSnapshot, GamePhase, PlayerSave, SeasonState } from './types';
import { SAVE_VERSION } from './types';
import { applyTraining } from './season';
import { initialSeason, beginRound } from './season';
import { assembleRaceConfig, buildSnapshot } from './snapshots';
import {
  cardPrice,
  computeSeasonStats,
  MAX_OWNED_TUNING,
  overallRating,
  racePayout,
  rerollCost,
  sampleShopSlots,
  SHOP_MAX_REROLLS,
} from './economy';

const DEFAULT_LIVERY = 0x2bd9ff;
/** Seed money so a new player can afford a card or two before their first podium. */
const STARTING_MONEY = 150;

function freshSave(name = 'Comet', liveryHex = DEFAULT_LIVERY): PlayerSave {
  return {
    version: SAVE_VERSION,
    name,
    liveryHex,
    trailId: DEFAULT_TRAIL_ID,
    ownedPartIds: [...STARTER_PART_IDS],
    // Players start with an empty tuning collection — every tuning card is bought in the
    // shop (see docs/training-tuning-cards.md). Training cards are catalog-defined and
    // always in hand, so they don't need a starting allotment here.
    ownedCardIds: [],
    money: STARTING_MONEY,
    loadout: { ...STARTER_LOADOUT },
    rating: 0,
    pastBuilds: [],
  };
}

const rngFor = (seed: number) => makeRng(seed >>> 0);

/** Remove one occurrence of each id in `toRemove` from `bag` (a multiset of card ids). */
function removeOneEach(bag: string[], toRemove: string[]): string[] {
  const out = [...bag];
  for (const id of toRemove) {
    const idx = out.indexOf(id);
    if (idx >= 0) out.splice(idx, 1);
  }
  return out;
}

export interface GameStore {
  phase: GamePhase;
  save: PlayerSave;
  season: SeasonState;
  runSeed: number;
  toast: string | null;
  raceConfig: RaceConfig | null;
  raceSeed: number;
  lastResult: RaceResult | null;
  /** Phase to return to when the shop is closed. */
  shopReturn: GamePhase;
  /** Phase to return to when the garage is closed — `title` on a fresh entry, `training`
   * when the player popped into the garage mid-season to re-equip (see `editBuild`). */
  garageReturn: GamePhase;
  /** The shop's current 4 offers; `null` marks a slot bought/empty until reroll or revisit. */
  shopSlotCardIds: (string | null)[];
  /** How many of the (max `SHOP_MAX_REROLLS`) paid rerolls have been used this visit. */
  shopRerollCount: number;
  /** Whether the kart build/tuning inspector overlay is open. */
  kartInspectorOpen: boolean;
  /**
   * Monotonic counter bumped on every *successful* card play. UI/render layers watch it to
   * fire one-shot play feedback (the kart scale pulse + a particle burst) without the game
   * layer knowing anything about the effects themselves.
   */
  cardPlayPulse: number;

  // navigation
  goTitle: () => void;
  goGarage: () => void;
  /** Pop into the garage mid-season to re-equip owned parts, then return to training. */
  editBuild: () => void;
  closeGarage: () => void;
  goShop: () => void;
  closeShop: () => void;
  openKartInspector: () => void;
  closeKartInspector: () => void;

  // profile / customization
  setName: (name: string) => void;
  setLivery: (hex: number) => void;
  setTrail: (trailId: string) => void;
  equipPart: (slot: Slot, partId: string) => void;
  resetProfile: () => void;

  // shop
  buyShopSlot: (slot: number) => void;
  rerollShop: () => void;

  // hand — playing cards onto the kart
  playTrainingCard: (cardId: string) => void;
  playTuningCard: (cardId: string) => void;
  unstageTuningCard: (cardId: string) => void;

  // season flow
  startSeason: () => void;
  headToRace: () => void;
  finishRace: (result: RaceResult) => void;
  nextRound: () => void;
  clearToast: () => void;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      phase: 'title',
      save: freshSave(),
      season: initialSeason(),
      runSeed: 1,
      toast: null,
      raceConfig: null,
      raceSeed: 0,
      lastResult: null,
      shopReturn: 'garage',
      garageReturn: 'title',
      shopSlotCardIds: [],
      shopRerollCount: 0,
      kartInspectorOpen: false,
      cardPlayPulse: 0,

      goTitle: () => set({ phase: 'title' }),
      goGarage: () => set({ phase: 'garage', garageReturn: 'title' }),
      editBuild: () => set({ phase: 'garage', garageReturn: 'training' }),
      closeGarage: () => set((s) => ({ phase: s.garageReturn })),
      goShop: () =>
        set((s) => ({
          shopReturn: s.phase,
          phase: 'shop',
          shopSlotCardIds: sampleShopSlots(Math.random),
          shopRerollCount: 0,
        })),
      closeShop: () => set((s) => ({ phase: s.shopReturn })),
      openKartInspector: () => set({ kartInspectorOpen: true }),
      closeKartInspector: () => set({ kartInspectorOpen: false }),

      setName: (name) => set((s) => ({ save: { ...s.save, name: name.slice(0, 14) || 'Comet' } })),
      setLivery: (hex) => set((s) => ({ save: { ...s.save, liveryHex: hex } })),
      setTrail: (trailId) => set((s) => ({ save: { ...s.save, trailId } })),
      equipPart: (slot, partId) =>
        set((s) => {
          if (!s.save.ownedPartIds.includes(partId)) return {};
          const loadout: Loadout = { ...s.save.loadout, [slot]: partId };
          return { save: { ...s.save, loadout } };
        }),
      resetProfile: () => set({ save: freshSave(), season: initialSeason(), phase: 'title' }),

      buyShopSlot: (slot) =>
        set((s) => {
          const cardId = s.shopSlotCardIds[slot];
          if (!cardId) return {};
          if (s.save.ownedCardIds.length >= MAX_OWNED_TUNING) {
            return { toast: `Collection full (${MAX_OWNED_TUNING}/${MAX_OWNED_TUNING}) — play a tuning card first.` };
          }
          const price = cardPrice(cardId);
          if (s.save.money < price) return { toast: 'Not enough credits for that card.' };
          const nextSlots = [...s.shopSlotCardIds];
          nextSlots[slot] = null;
          return {
            save: {
              ...s.save,
              money: s.save.money - price,
              ownedCardIds: [...s.save.ownedCardIds, cardId],
            },
            shopSlotCardIds: nextSlots,
            toast: `Bought ${CARDS_BY_ID[cardId]?.name ?? cardId}.`,
          };
        }),

      rerollShop: () =>
        set((s) => {
          if (s.shopRerollCount >= SHOP_MAX_REROLLS) return { toast: 'No rerolls left this visit.' };
          const cost = rerollCost(s.shopRerollCount);
          if (s.save.money < cost) return { toast: `Need ${cost} credits to reroll.` };
          return {
            save: { ...s.save, money: s.save.money - cost },
            shopSlotCardIds: sampleShopSlots(Math.random),
            shopRerollCount: s.shopRerollCount + 1,
          };
        }),

      playTrainingCard: (cardId) =>
        set((s) => {
          const seed = (s.runSeed + s.season.round * 131 + s.season.history.length * 17 + s.season.energy) >>> 0;
          const out = applyTraining(s.season, cardId, rngFor(seed));
          // `applyTraining` returns the same season reference when the play was refused
          // (not enough energy); a new object means the card actually resolved.
          const played = out.season !== s.season;
          return {
            season: out.season,
            toast: out.toast ?? null,
            cardPlayPulse: played ? s.cardPlayPulse + 1 : s.cardPlayPulse,
          };
        }),

      playTuningCard: (cardId) =>
        set((s) => {
          const ownedCount = s.save.ownedCardIds.filter((id) => id === cardId).length;
          const stagedCount = s.season.stagedTuningCardIds.filter((id) => id === cardId).length;
          if (stagedCount >= ownedCount) return { toast: 'No more copies of that card to play.' };
          return {
            season: { ...s.season, stagedTuningCardIds: [...s.season.stagedTuningCardIds, cardId] },
            toast: `Staged ${CARDS_BY_ID[cardId]?.name ?? cardId} on the kart.`,
            cardPlayPulse: s.cardPlayPulse + 1,
          };
        }),

      unstageTuningCard: (cardId) =>
        set((s) => {
          const idx = s.season.stagedTuningCardIds.indexOf(cardId);
          if (idx < 0) return {};
          const next = [...s.season.stagedTuningCardIds];
          next.splice(idx, 1);
          return { season: { ...s.season, stagedTuningCardIds: next } };
        }),

      startSeason: () => {
        const seed = (Math.floor(Math.random() * 0x7fffffff) || 12345) >>> 0;
        let season = initialSeason();
        season = beginRound(season, 0);
        set({ runSeed: seed, season, phase: 'training' });
      },

      headToRace: () => {
        const { save, season, runSeed } = get();
        const raceSeed = (runSeed + season.round * 977 + 101) >>> 0;
        const raceConfig = assembleRaceConfig(save, season, raceSeed);
        set({ raceConfig, raceSeed, phase: 'race' });
      },

      finishRace: (result) =>
        set((s) => {
          const player = result.order.find((r) => r.id === 'player');
          const rank = player?.rank ?? result.order.length;
          const field = result.order.length;
          const round = ROUNDS[s.season.round];

          const history = [
            ...s.season.history,
            { round: s.season.round, name: round.name, rank, field },
          ];
          const ratingDelta = Math.round((Math.ceil(field / 2) - rank) * 6);
          const rating = Math.max(0, s.save.rating + ratingDelta);
          // Winnings: the podium pays most, with a small off-podium consolation (economy.ts).
          const money = s.save.money + racePayout(rank, s.season.round);

          // Record this build as a future async opponent (cap the pool).
          const snap = buildSnapshot(s.save, s.season);
          const pastBuilds = [...s.save.pastBuilds, snap].slice(-12);

          // Every staged tuning card is consumed — spent whether the race was won or lost.
          const ownedCardIds = removeOneEach(s.save.ownedCardIds, s.season.stagedTuningCardIds);

          return {
            season: { ...s.season, history, stagedTuningCardIds: [] },
            save: { ...s.save, rating, money, pastBuilds, ownedCardIds },
            lastResult: result,
            phase: 'results',
          };
        }),

      nextRound: () =>
        set((s) => {
          const next = s.season.round + 1;
          if (next >= ROUNDS.length) {
            // Season complete — keep the meta profile, return to the garage as a fresh entry.
            return {
              phase: 'garage',
              garageReturn: 'title',
              season: initialSeason(),
              raceConfig: null,
              lastResult: null,
            };
          }
          // Carry trained stats forward; refresh the round's energy and clear staging
          // (tuning cards used last round are already gone; unused ones stay owned).
          const season = beginRound(s.season, next);
          return { season, phase: 'training', raceConfig: null, lastResult: null };
        }),

      clearToast: () => set({ toast: null }),
    }),
    {
      name: 'p1-save',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Only the durable profile is persisted; runs are fresh each load.
      partialize: (s) => ({ save: s.save }),
      // v1 -> v2: snapshots gained `cardIds` (so ghosts replay their triggered effects).
      // v2 -> v3: profile gained `money` (podium winnings spent in the card shop).
      // v3 -> v4: tuning cards became consumable; `ownedCardIds` is now a bag of ≤4 copies
      // (older saves may have accumulated more than 4 under the old unlimited-collection
      // model, so trim to the 4 most recently acquired).
      // v4 -> v5: profile gained `trailId` (equipped wake cosmetic) — default it if absent.
      migrate: (persisted, _version) => {
        const state = (persisted ?? {}) as { save?: PlayerSave };
        if (state.save) {
          if (Array.isArray(state.save.pastBuilds)) {
            state.save.pastBuilds = state.save.pastBuilds.map((b) => {
              const old = b as Omit<BuildSnapshot, 'cardIds' | 'v'> & { v?: number; cardIds?: string[] };
              return { ...old, v: 2, cardIds: old.cardIds ?? [] };
            });
          }
          if (typeof state.save.money !== 'number') state.save.money = STARTING_MONEY;
          if (Array.isArray(state.save.ownedCardIds) && state.save.ownedCardIds.length > MAX_OWNED_TUNING) {
            state.save.ownedCardIds = state.save.ownedCardIds.slice(-MAX_OWNED_TUNING);
          }
          if (typeof state.save.trailId !== 'string') state.save.trailId = DEFAULT_TRAIL_ID;
          state.save.version = SAVE_VERSION;
        }
        return state;
      },
    },
  ),
);

/** Convenience selector: the player's current computed stats + overall rating. */
export function selectPlayerStats(s: GameStore): { stats: ReturnType<typeof computeSeasonStats>['stats']; overall: number } {
  const { stats } = computeSeasonStats(s.save, s.season);
  return { stats, overall: overallRating(stats) };
}

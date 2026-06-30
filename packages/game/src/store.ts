import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { makeRng, type RaceConfig, type RaceResult } from '@grid/sim';
import {
  ROUNDS,
  STARTER_CARD_IDS,
  STARTER_LOADOUT,
  STARTER_PART_IDS,
  type Loadout,
  type Slot,
} from '@grid/content';
import type { BuildSnapshot, GamePhase, PlayerSave, SeasonState } from './types';
import { SAVE_VERSION } from './types';
import { applyTraining } from './season';
import { initialSeason, beginRound } from './season';
import { rollDraft } from './draft';
import { assembleRaceConfig, buildSnapshot } from './snapshots';
import { computeSeasonStats, overallRating } from './economy';

const DEFAULT_LIVERY = 0x2bd9ff;

function freshSave(name = 'Comet', liveryHex = DEFAULT_LIVERY): PlayerSave {
  return {
    version: SAVE_VERSION,
    name,
    liveryHex,
    ownedPartIds: [...STARTER_PART_IDS],
    ownedCardIds: [...STARTER_CARD_IDS],
    loadout: { ...STARTER_LOADOUT },
    rating: 0,
    pastBuilds: [],
  };
}

const rngFor = (seed: number) => makeRng(seed >>> 0);

export interface GameStore {
  phase: GamePhase;
  save: PlayerSave;
  season: SeasonState;
  runSeed: number;
  toast: string | null;
  raceConfig: RaceConfig | null;
  raceSeed: number;
  lastResult: RaceResult | null;

  // navigation
  goTitle: () => void;
  goGarage: () => void;

  // profile / customization
  setName: (name: string) => void;
  setLivery: (hex: number) => void;
  equipPart: (slot: Slot, partId: string) => void;
  resetProfile: () => void;

  // season flow
  startSeason: () => void;
  pickDraftCard: (cardId: string) => void;
  train: (trainingId: string) => void;
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

      goTitle: () => set({ phase: 'title' }),
      goGarage: () => set({ phase: 'garage' }),

      setName: (name) => set((s) => ({ save: { ...s.save, name: name.slice(0, 14) || 'Comet' } })),
      setLivery: (hex) => set((s) => ({ save: { ...s.save, liveryHex: hex } })),
      equipPart: (slot, partId) =>
        set((s) => {
          if (!s.save.ownedPartIds.includes(partId)) return {};
          const loadout: Loadout = { ...s.save.loadout, [slot]: partId };
          return { save: { ...s.save, loadout } };
        }),
      resetProfile: () => set({ save: freshSave(), season: initialSeason(), phase: 'title' }),

      startSeason: () => {
        const seed = (Math.floor(Math.random() * 0x7fffffff) || 12345) >>> 0;
        let season = initialSeason();
        season = beginRound(season, 0);
        season.draftPicksRemaining = 1;
        season.pendingDraft = rollDraft(seed, get().save.ownedCardIds, 3);
        set({ runSeed: seed, season, phase: 'draft' });
      },

      pickDraftCard: (cardId) =>
        set((s) => {
          const season: SeasonState = {
            ...s.season,
            draftedCardIds: [...s.season.draftedCardIds, cardId],
            draftPicksRemaining: s.season.draftPicksRemaining - 1,
            pendingDraft: null,
          };
          const done = season.draftPicksRemaining <= 0;
          return { season, phase: done ? 'training' : 'draft' };
        }),

      train: (trainingId) =>
        set((s) => {
          const seed = (s.runSeed + s.season.round * 131 + (s.season.turnsLeft + 1) * 17) >>> 0;
          const out = applyTraining(s.season, trainingId, rngFor(seed));
          return { season: out.season, toast: out.toast ?? null };
        }),

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

          // Record this build as a future async opponent (cap the pool).
          const snap = buildSnapshot(s.save, s.season);
          const pastBuilds = [...s.save.pastBuilds, snap].slice(-12);

          return {
            season: { ...s.season, history },
            save: { ...s.save, rating, pastBuilds },
            lastResult: result,
            phase: 'results',
          };
        }),

      nextRound: () =>
        set((s) => {
          const next = s.season.round + 1;
          if (next >= ROUNDS.length) {
            // Season complete — keep the meta profile, return to the garage.
            return { phase: 'garage', season: initialSeason(), raceConfig: null, lastResult: null };
          }
          const season = beginRound(s.season, next);
          season.draftPicksRemaining = 1;
          season.pendingDraft = rollDraft((s.runSeed + next * 53) >>> 0, s.save.ownedCardIds, 3);
          return { season, phase: 'draft', raceConfig: null, lastResult: null };
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
      migrate: (persisted, _version) => {
        const state = (persisted ?? {}) as { save?: PlayerSave };
        if (state.save && Array.isArray(state.save.pastBuilds)) {
          state.save.pastBuilds = state.save.pastBuilds.map((b) => {
            const old = b as Omit<BuildSnapshot, 'cardIds' | 'v'> & { v?: number; cardIds?: string[] };
            return { ...old, v: 2, cardIds: old.cardIds ?? [] };
          });
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

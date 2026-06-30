import type { KartStats } from '@grid/sim';
import type { Loadout } from '@grid/content';

export type GamePhase = 'title' | 'garage' | 'draft' | 'training' | 'race' | 'results';

export const SAVE_VERSION = 2;

/** Durable, persisted player profile (the meta progression). */
export interface PlayerSave {
  version: number;
  name: string;
  liveryHex: number;
  ownedPartIds: string[];
  ownedCardIds: string[];
  loadout: Loadout;
  rating: number;
  /** Past kart builds, used as async race opponents (snapshot racing). */
  pastBuilds: BuildSnapshot[];
}

/** A stored kart build — the unit of async "snapshot" racing. Versioned + stable. */
export interface BuildSnapshot {
  v: number;
  id: string;
  name: string;
  colorHex: number;
  stats: KartStats;
  rating: number;
  /** Drafted card ids this build raced with, so ghosts replay their triggered effects. */
  cardIds: string[];
  ts: number;
}

export interface SeasonRaceRecord {
  round: number;
  name: string;
  rank: number;
  field: number;
}

/** Transient state for the current season run. */
export interface SeasonState {
  round: number;
  turnsLeft: number;
  energy: number;
  /** Stat deltas accumulated from training (added on top of the loadout base). */
  trainedStats: KartStats;
  draftedCardIds: string[];
  history: SeasonRaceRecord[];
  /** Current draft offer (card ids) awaiting a pick, or null. */
  pendingDraft: string[] | null;
  draftPicksRemaining: number;
}

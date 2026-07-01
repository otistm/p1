import type { KartStats } from '@grid/sim';
import type { Loadout } from '@grid/content';

export type GamePhase = 'title' | 'garage' | 'training' | 'shop' | 'race' | 'results';

export const SAVE_VERSION = 5;

/** Durable, persisted player profile (the meta progression). */
export interface PlayerSave {
  version: number;
  name: string;
  liveryHex: number;
  /** Equipped trail cosmetic id (the wake colour in a race). Purely visual. */
  trailId: string;
  ownedPartIds: string[];
  /**
   * Owned tuning-card copies (a bag, not a set — duplicate ids are allowed since tuning
   * cards are consumable). Capped at `MAX_OWNED_TUNING` (4, see economy.ts). This bag *is*
   * the tuning portion of the hand: every owned copy is always available to play.
   */
  ownedCardIds: string[];
  /** Soft currency earned by finishing on the podium; spent on tuning cards in the shop. */
  money: number;
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
  /** Kart mass (kg) this build raced at, so ghosts replay their weight. Absent = neutral. */
  mass?: number;
  rating: number;
  /** Staged tuning-card ids this build raced with, so ghosts replay their triggered effects. */
  cardIds: string[];
  ts: number;
}

export interface SeasonRaceRecord {
  round: number;
  name: string;
  rank: number;
  field: number;
}

/**
 * Transient state for the current season run. Not persisted (`store.ts` only saves
 * `PlayerSave`) — a fresh game load always starts a fresh season.
 */
export interface SeasonState {
  round: number;
  /** The sole gate on training: playing a training card is only possible while affordable. */
  energy: number;
  /**
   * Stat-building training plays used this round. Capped at `MAX_TRAINING_SESSIONS_PER_ROUND`
   * so the free Rest card can't fuel an unbounded over-training loop (see season.ts). Rest
   * plays don't count — they only refill energy to spend on the capped stat sessions.
   */
  sessionsThisRound: number;
  /** Stat deltas accumulated from training (added on top of the loadout base). */
  trainedStats: KartStats;
  /**
   * Tuning cards dragged onto the kart, staged for the next race. A staged card is a
   * multiset of ids (duplicates possible); every id here is struck from
   * `PlayerSave.ownedCardIds` once the race resolves (see `finishRace` in store.ts).
   */
  stagedTuningCardIds: string[];
  history: SeasonRaceRecord[];
}

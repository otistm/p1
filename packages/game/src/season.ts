import { clamp, type KartStats, type Rng, type StatKey } from '@grid/sim';
import { TRAINING_CARDS, type Card } from '@grid/content';
import type { SeasonState } from './types';

export const TRAININGS_BY_ID: Record<string, Card> = Object.fromEntries(
  TRAINING_CARDS.map((t) => [t.id, t]),
);

/**
 * How many stat-building training plays a player may make per round. This is the hard cap
 * that stops the free `Rest & Tune` card (0 energy, +48) from fuelling an unbounded
 * over-training loop: Rest only refills energy to spend on these capped sessions, so career
 * growth per round is bounded regardless of how often the player rests. Sized so a full
 * energy bar (~3 sessions) plus a couple of rests reaches the cap — the intended arc.
 */
export const MAX_TRAINING_SESSIONS_PER_ROUND = 6;

/** Whether the player still has stat-training sessions left this round. */
export function trainingSessionsLeft(season: SeasonState): number {
  return Math.max(0, MAX_TRAINING_SESSIONS_PER_ROUND - season.sessionsThisRound);
}

const EVENTS: { t: string; apply: (s: SeasonState) => void }[] = [
  { t: 'A tailwind on the back straight — the team logs a setup tweak. +3 Speed', apply: (s) => bump(s, 'speed', 3) },
  { t: 'Mechanic finds a lighter brake disc. +3 Power', apply: (s) => bump(s, 'power', 3) },
  { t: 'A long debrief sharpens the racing line. +3 Wit', apply: (s) => bump(s, 'wit', 3) },
  { t: "Good night's rest in the paddock. +12 Condition", apply: (s) => (s.energy = clamp(s.energy + 12, 0, 100)) },
  { t: 'Stubborn through a tough run — grit pays off. +3 Guts', apply: (s) => bump(s, 'guts', 3) },
];

function bump(s: SeasonState, k: StatKey, amt: number): void {
  s.trainedStats[k] += amt;
}

const STAT_NAME: Record<StatKey, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  power: 'Power',
  guts: 'Guts',
  wit: 'Wit',
};

const zeroStats = (): KartStats => ({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 });

export function initialSeason(): SeasonState {
  return {
    round: 0,
    energy: 100,
    sessionsThisRound: 0,
    trainedStats: zeroStats(),
    stagedTuningCardIds: [],
    history: [],
  };
}

/** Configure the season for a given round (keeps career stats, refreshes condition + budget). */
export function beginRound(season: SeasonState, roundIdx: number): SeasonState {
  return { ...season, round: roundIdx, energy: 100, sessionsThisRound: 0, stagedTuningCardIds: [] };
}

/** Preview the main-stat gain for a training card given current condition. */
export function projectedGain(t: Card, energy: number): number {
  if (!t.mainStat || !t.mainAmt) return 0;
  return Math.round(t.mainAmt * (0.5 + (0.5 * energy) / 100));
}

/** Whether the player currently has enough energy to play this training card. */
export function canAffordTraining(t: Card, energy: number): boolean {
  return energy >= (t.energyCost ?? 0);
}

export interface TrainingOutcome {
  season: SeasonState;
  gains: Partial<KartStats>;
  toast?: string;
}

/**
 * Apply a training action. Energy is the only gate — a card that costs more than the
 * player's current energy simply can't be played (see docs/training-tuning-cards.md).
 * Pure given `rng`; returns a new season + UI feedback.
 */
export function applyTraining(season: SeasonState, trainingId: string, rng: Rng): TrainingOutcome {
  const t = TRAININGS_BY_ID[trainingId];
  if (!t) return { season, gains: {} };
  if (!canAffordTraining(t, season.energy)) {
    return { season, gains: {}, toast: 'Not enough energy for that.' };
  }
  // A stat-building session (anything that isn't a pure energy restore) is capped per round.
  const isStatSession = !t.restoreEnergy;
  if (isStatSession && season.sessionsThisRound >= MAX_TRAINING_SESSIONS_PER_ROUND) {
    return { season, gains: {}, toast: 'Training done for this round — head to the race.' };
  }

  const s: SeasonState = {
    ...season,
    trainedStats: { ...season.trainedStats },
    history: season.history,
  };
  if (isStatSession) s.sessionsThisRound += 1;
  const gains: Partial<KartStats> = {};
  // Always tell the player what just happened — every successful play gives feedback.
  let toast = `Played ${t.name}.`;

  if (t.restoreEnergy) {
    const before = s.energy;
    s.energy = clamp(s.energy + t.restoreEnergy, 0, 100);
    toast = `${t.name}: +${Math.round(s.energy - before)} Energy`;
  } else if (t.mainStat) {
    const fail = s.energy < 20 && rng() < 0.4;
    const scale = 0.5 + (0.5 * s.energy) / 100;
    let amt = (t.mainAmt ?? 0) * scale;
    if (fail) {
      amt *= 0.4;
      s.energy = clamp(s.energy - 10, 0, 100);
    }
    s.trainedStats[t.mainStat] += amt;
    gains[t.mainStat] = amt;
    let gainText = `+${Math.round(amt)} ${STAT_NAME[t.mainStat]}`;
    if (t.splashStat && t.splashAmt) {
      s.trainedStats[t.splashStat] += t.splashAmt;
      gains[t.splashStat] = t.splashAmt;
      gainText += `, +${t.splashAmt} ${STAT_NAME[t.splashStat]}`;
    }
    s.energy = clamp(s.energy - (t.energyCost ?? 0), 0, 100);
    toast = fail ? `${t.name}: rough session, only ${gainText} (too tired)` : `${t.name}: ${gainText}`;

    // Occasional flavor event, layered onto the base feedback.
    if (rng() < 0.22) {
      const e = EVENTS[Math.floor(rng() * EVENTS.length)];
      e.apply(s);
      toast += ` — ${e.t}`;
    }
  }

  return { season: s, gains, toast };
}

import { clamp, type KartStats, type Rng, type StatKey } from '@grid/sim';
import { ROUNDS } from '@grid/content';
import type { SeasonState } from './types';

export interface Training {
  id: string;
  icon: string;
  name: string;
  main: StatKey | null;
  mainAmt: number;
  splash?: StatKey;
  splashAmt?: number;
  restore?: number;
  cost: number;
}

/** The training menu — mirrors the prototype, mapped to the five ratings. */
export const TRAININGS: Training[] = [
  { id: 'speed', icon: '🏁', name: 'Speed Sprints', main: 'speed', mainAmt: 11, splash: 'power', splashAmt: 3, cost: 30 },
  { id: 'power', icon: '💪', name: 'Power Drills', main: 'power', mainAmt: 11, splash: 'guts', splashAmt: 3, cost: 30 },
  { id: 'corner', icon: '🌀', name: 'Slalom Lab', main: 'wit', mainAmt: 11, splash: 'speed', splashAmt: 3, cost: 28 },
  { id: 'endure', icon: '🫀', name: 'Endurance Laps', main: 'stamina', mainAmt: 11, splash: 'guts', splashAmt: 3, cost: 32 },
  { id: 'grit', icon: '🔥', name: 'Grit Session', main: 'guts', mainAmt: 11, splash: 'stamina', splashAmt: 3, cost: 30 },
  { id: 'rest', icon: '😴', name: 'Rest & Tune', main: null, mainAmt: 0, restore: 48, cost: 0 },
];

export const TRAININGS_BY_ID: Record<string, Training> = Object.fromEntries(TRAININGS.map((t) => [t.id, t]));

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

const zeroStats = (): KartStats => ({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 });

export function initialSeason(): SeasonState {
  return {
    round: 0,
    turnsLeft: ROUNDS[0].turns,
    energy: 100,
    trainedStats: zeroStats(),
    draftedCardIds: [],
    history: [],
    pendingDraft: null,
    draftPicksRemaining: 0,
  };
}

/** Configure the season for a given round (keeps career stats, refreshes condition). */
export function beginRound(season: SeasonState, roundIdx: number): SeasonState {
  const round = ROUNDS[roundIdx];
  return { ...season, round: roundIdx, turnsLeft: round.turns, energy: 100 };
}

/** Preview the main-stat gain for a training given current condition. */
export function projectedGain(t: Training, energy: number): number {
  if (!t.main) return 0;
  return Math.round(t.mainAmt * (0.5 + (0.5 * energy) / 100));
}

export interface TrainingOutcome {
  season: SeasonState;
  gains: Partial<KartStats>;
  toast?: string;
}

/** Apply a training action. Pure given `rng`; returns a new season + UI feedback. */
export function applyTraining(season: SeasonState, trainingId: string, rng: Rng): TrainingOutcome {
  if (season.turnsLeft <= 0) return { season, gains: {} };
  const t = TRAININGS_BY_ID[trainingId];
  if (!t) return { season, gains: {} };

  const s: SeasonState = {
    ...season,
    trainedStats: { ...season.trainedStats },
    history: season.history,
  };
  const gains: Partial<KartStats> = {};
  let toast: string | undefined;

  if (t.id === 'rest') {
    s.energy = clamp(s.energy + (t.restore ?? 0), 0, 100);
  } else if (t.main) {
    const fail = s.energy < 20 && rng() < 0.4;
    const scale = 0.5 + (0.5 * s.energy) / 100;
    let amt = t.mainAmt * scale;
    if (fail) {
      amt *= 0.4;
      s.energy = clamp(s.energy - 10, 0, 100);
      toast = 'Rough session — pushed too hard while spent.';
    }
    s.trainedStats[t.main] += amt;
    gains[t.main] = amt;
    if (t.splash && t.splashAmt) {
      s.trainedStats[t.splash] += t.splashAmt;
      gains[t.splash] = t.splashAmt;
    }
    s.energy = clamp(s.energy - t.cost, 0, 100);

    // Occasional flavor event.
    if (rng() < 0.22) {
      const e = EVENTS[Math.floor(rng() * EVENTS.length)];
      e.apply(s);
      toast = e.t;
    }
  }

  s.turnsLeft -= 1;
  return { season: s, gains, toast };
}

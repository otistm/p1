import type { KartStats } from '@grid/sim';

/** A rival "driver profile" — a recognizable build identity. */
export interface Archetype {
  id: string;
  name: string;
  /** Base ratings at rivalScale 0. */
  stats: KartStats;
  /** Flavor for UI / future driver-style behavior. */
  blurb: string;
}

export const RIVAL_ARCHETYPES: Archetype[] = [
  {
    id: 'blitz',
    name: 'Blitz',
    stats: { speed: 62, stamina: 42, power: 50, guts: 44, wit: 36 },
    blurb: 'Front-runner. Blazing pace, fades late.',
  },
  {
    id: 'atlas',
    name: 'Atlas',
    stats: { speed: 40, stamina: 64, power: 42, guts: 58, wit: 40 },
    blurb: 'Closer. Relentless, never quits.',
  },
  {
    id: 'vortex',
    name: 'Vortex',
    stats: { speed: 48, stamina: 48, power: 48, guts: 48, wit: 48 },
    blurb: 'All-rounder. No weaknesses.',
  },
  {
    id: 'crusher',
    name: 'Crusher',
    stats: { speed: 46, stamina: 48, power: 64, guts: 48, wit: 42 },
    blurb: 'Bruiser. Wins the corners and the contact.',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    stats: { speed: 44, stamina: 46, power: 44, guts: 40, wit: 66 },
    blurb: 'Technician. Reads the line perfectly.',
  },
];

/**
 * A season is a sequence of escalating cups. Training within a round is gated purely by
 * energy (see docs/training-tuning-cards.md) rather than a fixed turn count.
 */
export interface RoundDef {
  name: string;
  /** Rival stat multiplier — the field gets tougher each round. */
  rivalScale: number;
  laps: number;
}

/**
 * The season's cups, in order. Each maps 1:1 (by index) to a circuit in `SEASON_TRACKS`, which
 * owns its location/biome. The environment's *time of day* is separate — it comes from the
 * player's real local clock (see `timeOfDayNow`) rather than the cup.
 */
export const ROUNDS: RoundDef[] = [
  { name: 'Rookie Cup', rivalScale: 0.0, laps: 3 },
  { name: 'Open Series', rivalScale: 0.28, laps: 3 },
  // The Grand Derby's Summit Pass has a very long switchback lap, so it runs fewer of them.
  { name: 'Grand Derby', rivalScale: 0.6, laps: 2 },
];

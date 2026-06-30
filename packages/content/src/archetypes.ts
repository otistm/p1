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
    stats: { speed: 62, stamina: 30, power: 50, guts: 38, wit: 34 },
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
    stats: { speed: 46, stamina: 42, power: 64, guts: 46, wit: 36 },
    blurb: 'Bruiser. Wins the corners and the contact.',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    stats: { speed: 44, stamina: 46, power: 44, guts: 40, wit: 66 },
    blurb: 'Technician. Reads the line perfectly.',
  },
];

/** A season is a sequence of escalating cups. */
export interface RoundDef {
  name: string;
  turns: number;
  /** Rival stat multiplier — the field gets tougher each round. */
  rivalScale: number;
  laps: number;
}

export const ROUNDS: RoundDef[] = [
  { name: 'Rookie Cup', turns: 4, rivalScale: 0.0, laps: 3 },
  { name: 'Open Series', turns: 4, rivalScale: 0.28, laps: 3 },
  { name: 'Grand Derby', turns: 5, rivalScale: 0.6, laps: 3 },
];

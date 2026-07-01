/** P1 design tokens — the single source of truth for the visual system. */

import type { Slot } from '@grid/content';

export const COLORS = {
  bg: '#14171f',
  panel: '#1e232e',
  panel2: '#252b38',
  line: '#333b4a',
  ink: '#eef1f6',
  muted: '#a6afc0',
  orange: '#ff6a2b',
  cyan: '#2bd9ff',
  green: '#4ee08a',
  red: '#ff4d6d',
  purple: '#b07bff',
  amber: '#ffb648',
} as const;

/** Per-stat accent colors (legible mapping reused across HUD, garage, draft). */
export const STAT_COLOR: Record<string, string> = {
  speed: COLORS.cyan,
  stamina: COLORS.green,
  power: COLORS.orange,
  guts: COLORS.red,
  wit: COLORS.purple,
};

export const STAT_LABEL: Record<string, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  power: 'Power',
  guts: 'Guts',
  wit: 'Wit',
};

/** One-line explanation of what each rating does in the sim (shown on hover). */
export const STAT_DESC: Record<string, string> = {
  speed: 'Straight-line top speed — your cap on the long flat-out sections.',
  stamina: 'Energy reserve — sustains your pace; run dry and you fade late in the race.',
  power: 'Corner-exit punch — acceleration, braking force, and grip out of the bends.',
  guts: 'Heart — a final-lap surge, and speed held even when stamina runs low.',
  wit: 'Racecraft — corner-reading accuracy, steering finesse, and fuel economy.',
};

/** Livery palette offered in the garage. */
export const LIVERY = [
  { hex: 0xe74c3c, name: 'Crimson' },
  { hex: 0x2bd9ff, name: 'Cyan' },
  { hex: 0x4ee08a, name: 'Lime' },
  { hex: 0xb07bff, name: 'Violet' },
  { hex: 0xff9f1c, name: 'Amber' },
  { hex: 0xff5d8f, name: 'Rose' },
  { hex: 0xf4d03f, name: 'Gold' },
  { hex: 0x5dade2, name: 'Sky' },
] as const;

export const hexToCss = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');

/** Human labels + canonical display order for kart part slots. Shared by the garage
 * blueprint and the kart inspector so the two never drift (was duplicated in both). */
export const SLOT_LABEL: Record<Slot, string> = {
  chassis: 'Chassis',
  engine: 'Engine',
  tires: 'Tires',
  brakes: 'Brakes',
  gearing: 'Gearing',
  aero: 'Aero',
  ballast: 'Ballast',
};

export const SLOT_ORDER: Slot[] = ['chassis', 'engine', 'tires', 'brakes', 'gearing', 'aero', 'ballast'];

/** Rarity colors for parts and cards. */
export const RARITY_COLOR: Record<string, string> = {
  common: '#8b93a3',
  rare: '#2bd9ff',
  epic: '#b07bff',
  legendary: '#ffb648',
};

import type { TrackLocation } from '@grid/content';
import type { SceneryStyle } from './buildScenery';

/**
 * The scene's look is the product of two independent things:
 *   • the **location** (a real-world biome) — ground colour, foliage and scenery. Fixed per track.
 *   • the **time of day** — sky, fog and the light rig. Driven by the *player's real local clock*,
 *     so the same circuit is seen at dawn, noon, dusk or night depending on when they play.
 * Keeping them orthogonal means one track can be shown in four moods, and each cup still has its
 * own unmistakable place (see App.tsx, which combines `timeOfDayNow()` with the track's location).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Location (place) — ground + scenery, independent of lighting.
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationPreset {
  /** Flat ground-plane colour (lit by the time-of-day rig, so it darkens at night for free). */
  ground: number;
  /** Foliage/rock palette + how the trees are shaped and scattered. */
  scenery: SceneryStyle;
}

export const LOCATION_PRESETS: Record<TrackLocation, LocationPreset> = {
  // Rolling green countryside: rounded broadleaf trees, occasional grey boulders.
  meadow: {
    ground: 0x67b23f,
    scenery: {
      leaf: 0x37953b,
      trunk: 0x6f4d37,
      rock: 0x8a9295,
      trees: 68,
      rockRatio: 0.34,
      trunkH: 2,
      trunkTopR: 0.3,
      trunkBotR: 0.5,
      leafR: 2,
      leafH: 4,
      tiers: 1,
      spreadMin: 96,
      spreadMax: 210,
    },
  },
  // Sandy seaside: pale dunes, sparse tall palms, bleached driftwood-grey rocks.
  coast: {
    ground: 0xcdb98a,
    scenery: {
      leaf: 0x5aa06a,
      trunk: 0xa9865a,
      rock: 0xc9c2ad,
      trees: 34,
      rockRatio: 0.6,
      trunkH: 5.2,
      trunkTopR: 0.16,
      trunkBotR: 0.34,
      leafR: 2.6,
      leafH: 2.4,
      tiers: 1,
      spreadMin: 100,
      spreadMax: 220,
    },
  },
  // High alpine: cool grey-green turf, dense stacked-cone conifers, plenty of scree.
  alpine: {
    ground: 0x7f8f79,
    scenery: {
      leaf: 0x2f5d3a,
      trunk: 0x4a3627,
      rock: 0x8b929a,
      trees: 96,
      rockRatio: 0.72,
      trunkH: 2.4,
      trunkTopR: 0.22,
      trunkBotR: 0.5,
      leafR: 2.3,
      leafH: 2.7,
      tiers: 3,
      spreadMin: 92,
      spreadMax: 220,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Time of day — sky, fog and the light rig, chosen from the player's real clock.
// ─────────────────────────────────────────────────────────────────────────────

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface TimePreset {
  /** Four vertical sky-gradient stops (top → horizon), CSS colour strings. */
  sky: [string, string, string, string];
  /** Soft sun/moon glow colour baked into the IBL sky (CSS rgba). */
  sunGlow: string;
  fog: { color: number; near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number };
  fill: { color: number; intensity: number };
}

export const TIME_PRESETS: Record<TimeOfDay, TimePreset> = {
  // Cool pink-blue first light, long soft warm sun.
  dawn: {
    sky: ['#213a5e', '#6f6f9e', '#e59a7e', '#ffd7b0'],
    sunGlow: 'rgba(255,214,178,0.92)',
    fog: { color: 0xd8b9ac, near: 95, far: 350 },
    hemi: { sky: 0xd9c3d0, ground: 0x4a3a2c, intensity: 0.48 },
    sun: { color: 0xffc99a, intensity: 1.25 },
    fill: { color: 0x8f9ac8, intensity: 0.3 },
  },
  // Bright midday — the baseline look.
  day: {
    sky: ['#2f73b8', '#7db4e3', '#cfe2f0', '#e9eff3'],
    sunGlow: 'rgba(255,248,228,0.95)',
    fog: { color: 0xc4dcec, near: 110, far: 380 },
    hemi: { sky: 0xcfe3f5, ground: 0x5d4a30, intensity: 0.45 },
    sun: { color: 0xfff3df, intensity: 1.55 },
    fill: { color: 0x9ab8d8, intensity: 0.25 },
  },
  // Warm low sun. Amber sky, hazy warm fog, gold key light.
  dusk: {
    sky: ['#3a2a63', '#b5567a', '#ff9e57', '#ffd9a0'],
    sunGlow: 'rgba(255,196,120,0.98)',
    fog: { color: 0xe7a86a, near: 90, far: 340 },
    hemi: { sky: 0xffd0a0, ground: 0x3a2418, intensity: 0.5 },
    sun: { color: 0xffb066, intensity: 1.45 },
    fill: { color: 0xd8785a, intensity: 0.32 },
  },
  // Floodlit night. Deep blue sky, dark cool fog, cool-white key (the "stadium lights").
  night: {
    sky: ['#070c1c', '#132145', '#243a63', '#3d5a86'],
    sunGlow: 'rgba(180,205,255,0.55)',
    fog: { color: 0x101a2e, near: 80, far: 320 },
    hemi: { sky: 0x2a3550, ground: 0x080b14, intensity: 0.42 },
    sun: { color: 0xdfe9ff, intensity: 1.1 },
    fill: { color: 0x3a4a6a, intensity: 0.24 },
  },
};

/**
 * Map the player's local wall-clock hour to a time-of-day mood. Purely presentational — never
 * touches the deterministic sim. Defaults to `new Date()` but takes an argument for testability.
 */
export function timeOfDayNow(now: Date = new Date()): TimeOfDay {
  const h = now.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

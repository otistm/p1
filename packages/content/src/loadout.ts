import { clamp, STAT_KEYS, type KartStats } from '@grid/sim';
import { type Slot, SLOTS } from './schema';
import { PARTS_BY_ID } from './parts';

export type Loadout = Record<Slot, string>;

/** Bare-chassis baseline before any parts are added. */
export const BASELINE_STAT = 30;
export const BASE_MASS = 170;

const zeroStats = (): KartStats => ({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 });

/** Pure: the rating + mass contribution of an equipped part loadout. */
export function loadoutToStats(loadout: Loadout): { stats: KartStats; mass: number } {
  const stats: KartStats = { speed: BASELINE_STAT, stamina: BASELINE_STAT, power: BASELINE_STAT, guts: BASELINE_STAT, wit: BASELINE_STAT };
  let mass = BASE_MASS;
  for (const slot of SLOTS) {
    const part = PARTS_BY_ID[loadout[slot]];
    if (!part) continue;
    for (const k of STAT_KEYS) {
      const d = part.stats[k];
      if (d) stats[k] += d;
    }
    if (part.mass) mass += part.mass;
  }
  for (const k of STAT_KEYS) stats[k] = clamp(stats[k], 0, 120);
  return { stats, mass };
}

/** Add two stat sets and clamp — used to fold training and card mods onto a base. */
export function addStats(a: KartStats, b: Partial<KartStats>): KartStats {
  const out = { ...a };
  for (const k of STAT_KEYS) out[k] = clamp(out[k] + (b[k] ?? 0), 0, 120);
  return out;
}

export { zeroStats };

export interface KartVisualSpec {
  colorHex: number;
  wing: 'low' | 'mid' | 'high';
  wheelScale: number;
  noseScale: number;
  exhausts: 1 | 2;
}

/** Pure: derive the kart's visual descriptor from its parts + livery color. */
export function loadoutToVisual(loadout: Loadout, liveryHex: number): KartVisualSpec {
  const aero = loadout.aero;
  const tires = loadout.tires;
  const chassis = loadout.chassis;
  const engine = loadout.engine;
  const wing = aero === 'aero.downforce' ? 'high' : aero === 'aero.lowdrag' ? 'low' : 'mid';
  const wheelScale = tires === 'tires.hard' ? 1.1 : tires === 'tires.soft' ? 1.06 : 1.0;
  const noseScale = chassis === 'chassis.stiff' ? 0.9 : chassis === 'chassis.flex' ? 1.12 : 1.0;
  const exhausts: 1 | 2 = engine === 'engine.eco' ? 1 : 2;
  return { colorHex: liveryHex, wing, wheelScale, noseScale, exhausts };
}

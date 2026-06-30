import { z } from 'zod';
import { STAT_KEYS, type KartStats } from '@grid/sim';

/** Kart part slots. A loadout has exactly one part per slot. */
export const SLOTS = ['chassis', 'engine', 'tires', 'brakes', 'gearing', 'aero', 'ballast'] as const;
export type Slot = (typeof SLOTS)[number];

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

/** A sparse set of rating deltas (only the stats a part/card touches). */
export const PartialStatsSchema = z
  .object(Object.fromEntries(STAT_KEYS.map((k) => [k, z.number()])) as Record<keyof KartStats, z.ZodNumber>)
  .partial();
export type PartialStats = Partial<KartStats>;

export const PartSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slot: z.enum(SLOTS),
  rarity: z.enum(RARITIES),
  stats: PartialStatsSchema,
  /** Mass delta in kg (chassis/ballast). Affects collision feel & accel. */
  mass: z.number().optional(),
  blurb: z.string(),
});
export type Part = z.infer<typeof PartSchema>;

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: z.enum(RARITIES),
  theme: z.enum(STAT_KEYS),
  mods: PartialStatsSchema,
  /** Optional descriptive special (future: conditional in-sim effects). */
  special: z.string().optional(),
  flavor: z.string(),
});
export type Card = z.infer<typeof CardSchema>;

export const CosmeticSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['livery', 'wheels', 'decal', 'trail']),
  rarity: z.enum(RARITIES),
  /** Livery uses a numeric hex; others use a string token. Never affects stats. */
  value: z.union([z.number(), z.string()]).optional(),
});
export type Cosmetic = z.infer<typeof CosmeticSchema>;

/** Validate a registry, throwing a readable error if any item is malformed. */
export function parseAll<T>(schema: z.ZodType<T>, items: unknown[], label: string): T[] {
  return items.map((item, i) => {
    const r = schema.safeParse(item);
    if (!r.success) {
      throw new Error(`Invalid ${label} at index ${i}: ${r.error.message}`);
    }
    return r.data;
  });
}

export const CONTENT_VERSION = 1;

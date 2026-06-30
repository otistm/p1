import { z } from 'zod';
import { CARD_EFFECT_KINDS, STAT_KEYS, type CardEffectKind, type KartStats } from '@grid/sim';

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

/**
 * Zod mirror of the sim's `CardEffect`. A card may carry a triggered in-sim effect (proximity/
 * position driven) in addition to (or instead of) a small flat `mods` bump. Params are a flat
 * numeric record so tuning a card is a data change; only a new `kind` needs an engine handler.
 */
export const CardEffectSchema = z.object({
  kind: z.enum(CARD_EFFECT_KINDS as unknown as [CardEffectKind, ...CardEffectKind[]]),
  params: z.record(z.number()).optional(),
});
export type CardEffect = z.infer<typeof CardEffectSchema>;

export const CardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: z.enum(RARITIES),
  theme: z.enum(STAT_KEYS),
  mods: PartialStatsSchema,
  /** Optional triggered in-sim effect (see docs/cards-proximity-conditional.md). */
  effect: CardEffectSchema.optional(),
  /** Human-readable trigger condition shown in the draft UI. */
  trigger: z.string().optional(),
  /** Human-readable effect description shown in the draft UI. */
  effectText: z.string().optional(),
  /** Short archetype tag (e.g. "Traffic", "Leader") for the draft UI. */
  archetype: z.string().optional(),
  /** Optional legacy descriptive special. */
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

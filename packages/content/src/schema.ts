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

/**
 * The two kinds of card in the one unified database (see docs/training-tuning-cards.md).
 * `training` cards are permanent, always-in-hand, energy-gated stat-growth actions.
 * `tuning` cards are bought in the shop, dragged onto the kart to stage for one race, and
 * consumed when that race resolves.
 */
export const CARD_KINDS = ['training', 'tuning'] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const CardSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(CARD_KINDS),
    name: z.string().min(1),
    flavor: z.string(),
    /** Emoji shown on a training card's face. */
    icon: z.string().optional(),

    // --- tuning-only fields ---
    rarity: z.enum(RARITIES).optional(),
    theme: z.enum(STAT_KEYS).optional(),
    /** Flat stat modifiers applied while a tuning card is staged for a race. */
    mods: PartialStatsSchema.optional(),
    /** Optional triggered in-sim effect (see docs/cards-proximity-conditional.md). */
    effect: CardEffectSchema.optional(),
    /** Human-readable trigger condition shown in the shop/hand UI. */
    trigger: z.string().optional(),
    /** Human-readable effect description shown in the shop/hand UI. */
    effectText: z.string().optional(),
    /** Short archetype tag (e.g. "Traffic", "Leader") for the shop/hand UI. */
    archetype: z.string().optional(),
    /** Optional legacy descriptive special. */
    special: z.string().optional(),

    // --- training-only fields ---
    /** Energy spent to play this training card (0 for the free `rest` card). */
    energyCost: z.number().optional(),
    mainStat: z.enum(STAT_KEYS).nullable().optional(),
    mainAmt: z.number().optional(),
    splashStat: z.enum(STAT_KEYS).optional(),
    splashAmt: z.number().optional(),
    /** Energy restored (rest cards only). */
    restoreEnergy: z.number().optional(),
  })
  .superRefine((card, ctx) => {
    if (card.kind === 'tuning') {
      if (!card.rarity) {
        ctx.addIssue({ code: 'custom', message: 'tuning cards require a rarity' });
      }
      if (!card.mods && !card.effect) {
        ctx.addIssue({ code: 'custom', message: 'tuning cards require mods and/or an effect' });
      }
    } else if (card.energyCost === undefined) {
      ctx.addIssue({ code: 'custom', message: 'training cards require energyCost' });
    }
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

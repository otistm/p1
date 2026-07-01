/**
 * Presentation metadata for triggered tuning effects — the UI-layer mirror of the sim's
 * `CardEffectKind`. Kept here (not in the sim) so the engine stays presentation-free, and shared
 * by the proc popups (`RaceProcFx`) and the in-race tuning readout (`RaceHud`) so labels/tints
 * never drift between the two.
 */
export interface EffectMeta {
  /** Short display name. */
  label: string;
  /** CSS colour token for the accent. */
  tint: string;
  /** One-line, plain-language trigger condition (teaches the player what makes it fire). */
  hint: string;
}

export const EFFECT_META: Record<string, EffectMeta> = {
  slingshotSiphon: { label: 'Slingshot', tint: 'var(--cyan)', hint: 'Sustained draft on a straight' },
  cornerPocket: { label: 'Corner Pocket', tint: 'var(--cyan)', hint: 'Apex blocked mid-corner' },
  claustrophobia: { label: 'Claustrophobia', tint: 'var(--amber)', hint: '3+ rivals crowding you' },
  paintScraper: { label: 'Paint Scraper', tint: 'var(--amber)', hint: 'Side-by-side in a corner' },
  cleanAirSupercharger: { label: 'Clean Air', tint: 'var(--cyan)', hint: 'Leading in a clear lane' },
  desperationDraft: { label: 'Desperation Draft', tint: 'var(--amber)', hint: 'Last lap, from the back' },
  vanguardShield: { label: 'Vanguard Shield', tint: 'var(--cyan)', hint: 'Top-3, defended from behind' },
};

/** Safe lookup with a readable fallback for unknown/Phase-2 kinds. */
export function effectMeta(kind: string): EffectMeta {
  return EFFECT_META[kind] ?? { label: kind, tint: 'var(--cyan)', hint: '' };
}

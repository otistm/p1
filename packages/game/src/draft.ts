import { makeRng } from '@grid/sim';

/**
 * Deterministically offer `count` distinct cards drawn from the player's collection.
 * Seeded so a draft can be reproduced (and later shared / verified).
 */
export function rollDraft(seed: number, ownedCardIds: string[], count = 3): string[] {
  const pool = [...ownedCardIds];
  const rng = makeRng(seed >>> 0);
  // Fisher-Yates with the seeded rng.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

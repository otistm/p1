import type { Rng } from './contracts';

/**
 * mulberry32 — a tiny, fast, deterministic PRNG. Given the same seed it always
 * produces the same stream, which is the backbone of reproducible races.
 */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash arbitrary integers into a single 32-bit seed (order-sensitive). */
export function hashSeed(...nums: number[]): number {
  let h = 0x811c9dc5;
  for (const n of nums) {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

import { describe, it, expect } from 'vitest';
import { derive } from './derive';
import { makeRng, hashSeed } from './rng';

describe('derive', () => {
  it('is monotonic in the obvious places', () => {
    const low = derive({ speed: 20, stamina: 20, power: 20, guts: 20, wit: 20 });
    const high = derive({ speed: 80, stamina: 20, power: 20, guts: 20, wit: 20 });
    expect(high.topSpeed).toBeGreaterThan(low.topSpeed);

    const guts = derive({ speed: 20, stamina: 20, power: 20, guts: 80, wit: 20 });
    expect(guts.fadeFloor).toBeGreaterThan(low.fadeFloor);
    expect(guts.surge).toBeGreaterThan(low.surge);

    const wit = derive({ speed: 20, stamina: 20, power: 20, guts: 20, wit: 80 });
    expect(wit.drainEff).toBeLessThan(low.drainEff);
    expect(wit.judge).toBeGreaterThan(low.judge);
  });
});

describe('rng', () => {
  it('is reproducible for a given seed', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('hashSeed is order-sensitive and stable', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1));
  });
});

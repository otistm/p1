import { describe, it, expect } from 'vitest';
import { makeRng, RaceEngine } from '@grid/sim';
import { STARTER_LOADOUT } from '@grid/content';
import { computeRaceStats } from './economy';
import { applyTraining, initialSeason } from './season';
import { rollDraft } from './draft';
import { assembleRaceConfig } from './snapshots';
import type { PlayerSave, SeasonState } from './types';

function save(): PlayerSave {
  return {
    version: 1,
    name: 'Test',
    liveryHex: 0x2bd9ff,
    ownedPartIds: Object.values(STARTER_LOADOUT),
    ownedCardIds: ['card.balanced', 'card.racecraft', 'card.nitromap', 'card.sticky', 'card.longhaul'],
    loadout: STARTER_LOADOUT,
    rating: 0,
    pastBuilds: [],
  };
}

describe('economy', () => {
  it('cards add to base stats deterministically', () => {
    const a = computeRaceStats(STARTER_LOADOUT, initialSeason().trainedStats, ['card.nitromap']);
    const b = computeRaceStats(STARTER_LOADOUT, initialSeason().trainedStats, []);
    expect(a.stats.speed).toBeGreaterThan(b.stats.speed);
    expect(a).toEqual(computeRaceStats(STARTER_LOADOUT, initialSeason().trainedStats, ['card.nitromap']));
  });
});

describe('season training', () => {
  it('spends a turn and raises the trained stat', () => {
    const s0 = initialSeason();
    const { season } = applyTraining(s0, 'speed', makeRng(1));
    expect(season.turnsLeft).toBe(s0.turnsLeft - 1);
    expect(season.trainedStats.speed).toBeGreaterThan(0);
  });

  it('is reproducible for a given rng seed', () => {
    const a = applyTraining(initialSeason(), 'power', makeRng(42));
    const b = applyTraining(initialSeason(), 'power', makeRng(42));
    expect(a.season.trainedStats).toEqual(b.season.trainedStats);
  });
});

describe('draft', () => {
  it('returns distinct, seeded offers', () => {
    const owned = ['a', 'b', 'c', 'd', 'e'];
    const o1 = rollDraft(7, owned, 3);
    const o2 = rollDraft(7, owned, 3);
    expect(o1).toEqual(o2);
    expect(new Set(o1).size).toBe(o1.length);
  });
});

describe('race assembly', () => {
  it('produces a reproducible, resolvable field', () => {
    const season: SeasonState = initialSeason();
    const cfg = assembleRaceConfig(save(), season, 555);
    expect(cfg.entrants[0].id).toBe('player');
    expect(cfg.entrants.length).toBe(6);
    const r1 = RaceEngine.resolve(cfg);
    const r2 = RaceEngine.resolve(assembleRaceConfig(save(), season, 555));
    expect(r1).toEqual(r2);
  });
});

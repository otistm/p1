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

  it('gives every entrant a unique display name, even with player ghosts', () => {
    // Ghosts are the player's own past builds (same name); they must not collide with the
    // live player on the leaderboard, or it looks like the player is winning when a ghost is.
    const s = save();
    s.pastBuilds = [
      { v: 2, id: 'b1', name: s.name, colorHex: s.liveryHex, stats: { speed: 50, stamina: 50, power: 50, guts: 50, wit: 50 }, rating: 250, cardIds: [], ts: 1 },
      { v: 2, id: 'b2', name: s.name, colorHex: s.liveryHex, stats: { speed: 55, stamina: 45, power: 52, guts: 48, wit: 51 }, rating: 251, cardIds: [], ts: 2 },
    ];
    const cfg = assembleRaceConfig(s, initialSeason(), 999);
    const names = cfg.entrants.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    // The lone un-suffixed name is the live player.
    expect(names.filter((n) => n === s.name)).toEqual([s.name]);
  });
});

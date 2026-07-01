import { describe, it, expect } from 'vitest';
import { makeRng, RaceEngine, type Entrant, type RaceConfig } from '@grid/sim';
import { RIVAL_ARCHETYPES, SEASON_TRACKS, STARTER_LOADOUT } from '@grid/content';
import { cardPrice, computeRaceStats, racePayout } from './economy';
import { applyTraining, beginRound, initialSeason, MAX_TRAINING_SESSIONS_PER_ROUND } from './season';
import { assembleRaceConfig } from './snapshots';
import type { PlayerSave, SeasonState } from './types';

function save(): PlayerSave {
  return {
    version: 3,
    name: 'Test',
    liveryHex: 0x2bd9ff,
    ownedPartIds: Object.values(STARTER_LOADOUT),
    ownedCardIds: ['card.balanced', 'card.racecraft', 'card.nitromap', 'card.sticky', 'card.longhaul'],
    money: 150,
    loadout: STARTER_LOADOUT,
    rating: 0,
    pastBuilds: [],
  };
}

describe('season tracks', () => {
  it('every cup circuit is drivable: a full field finishes with clean, ordered results', () => {
    // Guards the three hand-authored layouts — a bad loop (too tight / crossing itself) would
    // strand the AI and surface here as DNFs or NaN finish times, across several seeds.
    const field: Entrant[] = RIVAL_ARCHETYPES.map((a) => ({
      id: a.id,
      name: a.name,
      colorHex: 0xffffff,
      stats: { ...a.stats },
    }));
    for (const track of SEASON_TRACKS) {
      for (let s = 0; s < 6; s++) {
        const cfg: RaceConfig = { track, seed: 1000 + s, entrants: field };
        const res = RaceEngine.resolve(cfg);
        expect(res.order).toHaveLength(field.length);
        for (const row of res.order) {
          expect(row.finished).toBe(true);
          expect(Number.isFinite(row.finishTime)).toBe(true);
        }
        const ranks = res.order.map((r) => r.rank).sort((x, y) => x - y);
        expect(ranks).toEqual(field.map((_, i) => i + 1));
      }
    }
  });
});

describe('economy', () => {
  it('cards add to base stats deterministically', () => {
    const a = computeRaceStats(STARTER_LOADOUT, initialSeason().trainedStats, ['card.nitromap']);
    const b = computeRaceStats(STARTER_LOADOUT, initialSeason().trainedStats, []);
    expect(a.stats.speed).toBeGreaterThan(b.stats.speed);
    expect(a).toEqual(computeRaceStats(STARTER_LOADOUT, initialSeason().trainedStats, ['card.nitromap']));
  });
});

describe('season training', () => {
  it('spends energy and raises the trained stat', () => {
    const s0 = initialSeason();
    const { season } = applyTraining(s0, 'train.speed', makeRng(1));
    expect(season.energy).toBeLessThan(s0.energy);
    expect(season.trainedStats.speed).toBeGreaterThan(0);
  });

  it('is reproducible for a given rng seed', () => {
    const a = applyTraining(initialSeason(), 'train.power', makeRng(42));
    const b = applyTraining(initialSeason(), 'train.power', makeRng(42));
    expect(a.season.trainedStats).toEqual(b.season.trainedStats);
  });

  it('refuses to play a training card without enough energy', () => {
    const spent: SeasonState = { ...initialSeason(), energy: 5 };
    const { season } = applyTraining(spent, 'train.speed', makeRng(7));
    expect(season.energy).toBe(5);
    expect(season.trainedStats.speed).toBe(0);
  });

  it('rest is always playable and restores energy', () => {
    const spent: SeasonState = { ...initialSeason(), energy: 5 };
    const { season } = applyTraining(spent, 'train.rest', makeRng(3));
    expect(season.energy).toBeGreaterThan(5);
  });

  it('caps stat-training sessions per round so the free Rest loop can\'t over-train', () => {
    // Rest refills energy for free, so without a cap a player could train indefinitely. Drive
    // a full round: alternate stat-training and resting; stat gains must stop at the cap.
    let season = initialSeason();
    let statPlays = 0;
    for (let i = 0; i < 40; i++) {
      const before = season;
      season = applyTraining(season, 'train.speed', makeRng(100 + i)).season;
      if (season.sessionsThisRound > before.sessionsThisRound) statPlays++;
      // Always keep energy topped up so only the session cap can stop training.
      season = applyTraining(season, 'train.rest', makeRng(200 + i)).season;
    }
    expect(statPlays).toBe(MAX_TRAINING_SESSIONS_PER_ROUND);
    expect(season.sessionsThisRound).toBe(MAX_TRAINING_SESSIONS_PER_ROUND);
    // A fresh round resets the budget.
    const next = beginRound(season, 1);
    expect(next.sessionsThisRound).toBe(0);
  });
});

describe('economy: shop + winnings', () => {
  it('rewards the podium most but gives a small off-podium consolation', () => {
    // Podium (1/2/3) pays real money; 4th-6th earn a cushion so a loss isn't a total wipe
    // (see docs/game-review.md §2). Nothing pays below a 6-kart field.
    expect(racePayout(1, 0)).toBeGreaterThan(0);
    expect(racePayout(4, 0)).toBeGreaterThan(0);
    expect(racePayout(6, 0)).toBeGreaterThan(0);
    expect(racePayout(7, 0)).toBe(0);
    // Consolation is far smaller than the podium, and monotonic: earlier finishes pay more.
    expect(racePayout(3, 0)).toBeGreaterThan(racePayout(4, 0));
    expect(racePayout(4, 0)).toBeGreaterThan(racePayout(6, 0));
    expect(racePayout(1, 0)).toBeGreaterThan(racePayout(3, 0));
    // Later rounds pay more for the same finish.
    expect(racePayout(1, 2)).toBeGreaterThan(racePayout(1, 0));
  });

  it('prices cards by rarity (higher rarity costs more)', () => {
    expect(cardPrice('card.balanced')).toBeGreaterThan(0); // common
    expect(cardPrice('card.feather')).toBeGreaterThan(cardPrice('card.balanced')); // legendary > common
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

  it('threads the loadout mass onto the player entrant (feather < heavy)', () => {
    // Regression guard for the "ballast never reaches the sim" bug: the assembled player
    // must carry a real mass that changes with the ballast slot.
    const feather = save();
    feather.loadout = { ...feather.loadout, ballast: 'ballast.feather' };
    const heavy = save();
    heavy.loadout = { ...heavy.loadout, ballast: 'ballast.heavy' };
    const mf = assembleRaceConfig(feather, initialSeason(), 1).entrants[0].mass;
    const mh = assembleRaceConfig(heavy, initialSeason(), 1).entrants[0].mass;
    expect(mf).toBeDefined();
    expect(mh).toBeDefined();
    expect(mf!).toBeLessThan(mh!);
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

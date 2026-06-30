import { describe, it, expect } from 'vitest';
import { PARTS, PARTS_BY_SLOT } from './parts';
import { CARDS } from './cards';
import { COSMETICS } from './cosmetics';
import { SLOTS } from './schema';
import { loadoutToStats, loadoutToVisual, BASELINE_STAT } from './loadout';
import { STARTER_LOADOUT } from './parts';
import { STAT_KEYS } from '@grid/sim';

describe('content registries', () => {
  it('parses all parts, cards, cosmetics (schema valid)', () => {
    expect(PARTS.length).toBeGreaterThan(0);
    expect(CARDS.length).toBeGreaterThan(0);
    expect(COSMETICS.length).toBeGreaterThan(0);
  });

  it('every slot has at least one part', () => {
    for (const s of SLOTS) expect(PARTS_BY_SLOT[s].length).toBeGreaterThan(0);
  });

  it('part and card ids are unique', () => {
    const ids = [...PARTS.map((p) => p.id), ...CARDS.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cosmetics never carry stat data', () => {
    for (const c of COSMETICS) {
      expect(Object.keys(c)).not.toContain('stats');
      expect(Object.keys(c)).not.toContain('mods');
    }
  });
});

describe('loadout math', () => {
  it('starter loadout produces sensible, clamped stats', () => {
    const { stats, mass } = loadoutToStats(STARTER_LOADOUT);
    for (const k of STAT_KEYS) {
      expect(stats[k]).toBeGreaterThanOrEqual(BASELINE_STAT - 10);
      expect(stats[k]).toBeLessThanOrEqual(120);
    }
    expect(mass).toBeGreaterThan(0);
  });

  it('is pure and deterministic', () => {
    expect(loadoutToStats(STARTER_LOADOUT)).toEqual(loadoutToStats(STARTER_LOADOUT));
  });

  it('featherweight ballast reduces mass and boosts speed', () => {
    const base = loadoutToStats(STARTER_LOADOUT);
    const feather = loadoutToStats({ ...STARTER_LOADOUT, ballast: 'ballast.feather' });
    expect(feather.mass).toBeLessThan(base.mass);
    expect(feather.stats.speed).toBeGreaterThan(base.stats.speed);
  });

  it('derives a visual descriptor from parts', () => {
    const v = loadoutToVisual({ ...STARTER_LOADOUT, aero: 'aero.downforce' }, 0x2bd9ff);
    expect(v.wing).toBe('high');
    expect(v.colorHex).toBe(0x2bd9ff);
  });
});

import { describe, it, expect } from 'vitest';
import { LOCATION_PRESETS, TIME_PRESETS, timeOfDayNow } from './theme';

const at = (h: number) => new Date(2026, 0, 1, h, 0, 0);

describe('time-of-day from the local clock', () => {
  it('maps wall-clock hours to the four moods', () => {
    expect(timeOfDayNow(at(6))).toBe('dawn');
    expect(timeOfDayNow(at(12))).toBe('day');
    expect(timeOfDayNow(at(18))).toBe('dusk');
    expect(timeOfDayNow(at(23))).toBe('night');
    expect(timeOfDayNow(at(3))).toBe('night');
  });

  it('has a preset for every time and every location', () => {
    for (const t of ['dawn', 'day', 'dusk', 'night'] as const) {
      expect(TIME_PRESETS[t].sky).toHaveLength(4);
    }
    for (const l of ['meadow', 'coast', 'alpine'] as const) {
      expect(LOCATION_PRESETS[l].scenery.trees).toBeGreaterThan(0);
      expect(LOCATION_PRESETS[l].scenery.tiers).toBeGreaterThanOrEqual(1);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { Track } from '@grid/sim';
import { SEASON_TRACKS, SUNSET_DERBY, SUMMIT_PASS } from './tracks';

describe('season circuits', () => {
  it('are three distinct layouts of different lengths', () => {
    expect(SEASON_TRACKS).toHaveLength(3);
    const ids = SEASON_TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
    const lens = SEASON_TRACKS.map((t) => new Track(t).length);
    // Distinct lengths (no two within 8m) so they read as genuinely different circuits.
    for (let i = 0; i < lens.length; i++)
      for (let j = i + 1; j < lens.length; j++)
        expect(Math.abs(lens[i] - lens[j])).toBeGreaterThan(8);
    // Intent: the Summit Pass switchback cascade is by far the longest lap; the Verdant Loop the
    // shortest. (Its lap is long enough that the Grand Derby runs fewer laps — see ROUNDS.)
    const byId = Object.fromEntries(SEASON_TRACKS.map((t) => [t.id, new Track(t).length]));
    expect(byId[SUMMIT_PASS.id]).toBeGreaterThan(byId[SUNSET_DERBY.id]);
    expect(byId[SUNSET_DERBY.id]).toBeLessThan(byId[SUMMIT_PASS.id]);
  });

  it('never overlap themselves: the road ribbon stays clear of far-away sections', () => {
    // A hand-authored loop that crosses (or runs too close to) itself would look broken even if the
    // AI can still follow the centerline. Two ribbon sections that are far apart along the lap must
    // stay farther apart in space than the full road width, or they'd visually merge.
    for (const def of SEASON_TRACKS) {
      const t = new Track(def);
      const N = t.N;
      const arcGap = def.width * 3;
      let worst = Infinity;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const fwd = t.cum[j] - t.cum[i];
          const along = Math.min(fwd, t.length - fwd);
          if (along <= arcGap) continue; // genuinely adjacent — expected to be close
          const dx = t.center[i][0] - t.center[j][0];
          const dz = t.center[i][1] - t.center[j][1];
          worst = Math.min(worst, Math.hypot(dx, dz));
        }
      }
      expect(worst, `${def.name} ribbon self-clearance`).toBeGreaterThan(def.width);
    }
  });

  it('have no corner tight enough to fold the road/curb ribbon', () => {
    // The road + curb ribbon is built by offsetting each centerline sample by ±(width/2 + curb
    // band). Where a corner's radius drops below that offset, the inner edge inverts and the curbs
    // z-fight / distort (the Summit Pass bug). Require every corner to clear the offset with margin.
    const CURB_BAND = 0.28;
    for (const def of SEASON_TRACKS) {
      const t = new Track(def);
      let maxCurv = 0;
      for (let i = 0; i < t.N; i++) maxCurv = Math.max(maxCurv, t.curv[i]);
      const minRadius = maxCurv > 0 ? 1 / maxCurv : Infinity;
      const edgeOffset = def.width / 2 + CURB_BAND;
      expect(minRadius, `${def.name} tightest corner radius`).toBeGreaterThan(edgeOffset + 0.3);
    }
  });

  it('fit on the playable ground (within ~90m of the origin)', () => {
    for (const def of SEASON_TRACKS) {
      const t = new Track(def);
      for (const [x, z] of t.center) expect(Math.hypot(x, z)).toBeLessThan(90);
    }
  });
});

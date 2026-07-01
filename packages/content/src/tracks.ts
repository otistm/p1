import type { TrackDef } from '@grid/sim';

/**
 * The *place* a circuit sits in — a real-world biome that drives the ground, foliage and scenery.
 * This is independent of the time of day (that comes from the player's real local clock), so one
 * location can be seen at dawn, noon, dusk or night.
 */
export type TrackLocation = 'meadow' | 'coast' | 'alpine';

/** Presentation metadata layered on top of the engine's TrackDef. */
export interface TrackMeta {
  /** Which biome this circuit is set in — selects ground/foliage/scenery, not the lighting. */
  location: TrackLocation;
  scenerySeed: number;
}

export interface TrackContent extends TrackDef {
  meta: TrackMeta;
}

/**
 * A "turtle" that walks a path from straights and fixed-radius arcs, emitting a dense trail of
 * points (~`step` metres apart). Tight hairpins authored as single apex points make Catmull-Rom
 * cusp/overshoot (folding the road ribbon); building each hairpin as a real semicircular arc keeps
 * curvature bounded to the chosen radius, so switchbacks render cleanly. Used for Summit Pass.
 */
class Turtle {
  readonly pts: Array<[number, number]> = [];
  constructor(
    private x: number,
    private z: number,
    private h: number,
    private readonly step = 3,
  ) {
    this.emit();
  }
  private emit(): void {
    this.pts.push([Math.round(this.x * 10) / 10, Math.round(this.z * 10) / 10]);
  }
  /** Travel straight `d` metres along the current heading. */
  forward(d: number): this {
    const n = Math.max(1, Math.round(d / this.step));
    const dx = Math.cos(this.h);
    const dz = Math.sin(this.h);
    const s = d / n;
    for (let i = 0; i < n; i++) {
      this.x += dx * s;
      this.z += dz * s;
      this.emit();
    }
    return this;
  }
  /** Turn `deg` degrees (positive = left/CCW) along an arc of radius `r`. */
  turn(deg: number, r: number): this {
    const a = (deg * Math.PI) / 180;
    const sign = Math.sign(a) || 1;
    const nx = -Math.sin(this.h);
    const nz = Math.cos(this.h);
    const cx = this.x + r * sign * nx;
    const cz = this.z + r * sign * nz;
    const start = Math.atan2(this.z - cz, this.x - cx);
    const n = Math.max(1, Math.round((Math.abs(a) * r) / this.step));
    for (let i = 1; i <= n; i++) {
      const ang = start + a * (i / n);
      this.x = cx + Math.cos(ang) * r;
      this.z = cz + Math.sin(ang) * r;
      this.emit();
    }
    this.h += a;
    return this;
  }
  /** Drop the final point so a closed loop doesn't duplicate its start when it returns to it. */
  close(): Array<[number, number]> {
    this.pts.pop();
    return this.pts;
  }
}

/**
 * A tall (portrait) switchback: `cols` vertical straights of length `len`, 16m apart, linked by
 * 180° hairpins of radius `R` at alternating ends (a serpentine cascade), then a return sweep along
 * the bottom that closes the loop. Even `cols` so the cascade ends bottom-right, under the return.
 */
function switchback(cols: number, len: number, R: number): Array<[number, number]> {
  const spacing = 2 * R;
  const x0 = -((cols - 1) * spacing) / 2; // centre the columns on the origin
  const halfLen = len / 2;
  const UP = Math.PI / 2;
  const t = new Turtle(x0, -halfLen, UP);
  for (let c = 0; c < cols - 1; c++) {
    t.forward(len);
    // Odd columns started going up (top hairpin), even ones going down (bottom hairpin). Turn the
    // way that advances +x to the next column: right (−180°) from a top, left (+180°) from a bottom.
    t.turn(c % 2 === 0 ? -180 : 180, R);
  }
  t.forward(len); // last column (going down, ends bottom-right)
  // Return sweep: drop below the cascade and arc back across the bottom to the first column.
  const xEnd = x0 + (cols - 1) * spacing;
  const drop = R + 5;
  t.forward(drop);
  t.turn(-90, R); // now heading −x, along the bottom
  t.forward(xEnd - x0 - 2 * R);
  t.turn(-90, R); // now heading +z (up), back at the first column
  t.forward(drop);
  return t.close();
}

/**
 * Cup 1 — Verdant Loop. A wide, flowing countryside circuit of long sweepers and one gentle kink:
 * the place to learn to build a kart. Runs anticlockwise. Medium length. Set in rolling meadows.
 */
export const SUNSET_DERBY: TrackContent = {
  id: 'sunset-derby',
  name: 'Verdant Loop',
  width: 11.5,
  laps: 3,
  samplesPerSegment: 22,
  // A rounded, egg-shaped loop — smooth and forgiving.
  points: [
    [46, 0],
    [43.8, 25.3],
    [23, 39.8],
    [0, 41.4],
    [-23, 39.8],
    [-43.8, 25.3],
    [-46, 0],
    [-35.9, -20.7],
    [-23, -39.8],
    [0, -50.6],
    [23, -39.8],
    [35.9, -20.7],
  ],
  meta: { location: 'meadow', scenerySeed: 1337 },
};

/**
 * Cup 2 — Coral Coast. A long seaside circuit: two long straights to stretch top speed, a big
 * left-hand hairpin at the west end, and a quick chicane on the top straight. Runs clockwise (the
 * opposite way round to the Verdant Loop). The longest lap of the three. Sandy dunes & palms.
 */
export const CORAL_COAST: TrackContent = {
  id: 'coral-coast',
  name: 'Coral Coast',
  width: 11,
  laps: 3,
  samplesPerSegment: 22,
  // Elongated loop pinched into a hairpin on the left; a shallow inward kink up top is the chicane.
  // Listed clockwise (bottom edge travelled left→right) so travel opposes the Verdant Loop.
  points: [
    [68, -10],
    [70, 12],
    [52, 30],
    [26, 27],
    [10, 20],
    [-20, 24],
    [-50, 18],
    [-66, -2],
    [-48, -24],
    [-16, -31],
    [24, -31],
    [62, -24],
  ],
  meta: { location: 'coast', scenerySeed: 2024 },
};

/**
 * Cup 3 — Summit Pass. The season decider: a short but relentlessly technical mountain circuit —
 * linked esses, a tight inner hairpin, and a valley chicane, on the narrowest road. Fewest metres
 * per lap but the most corners; punishes a spent stamina bar. Alpine rock & pines.
 */
export const SUMMIT_PASS: TrackContent = {
  id: 'summit-pass',
  name: 'Summit Pass',
  // Narrow mountain road — the switchback cascade only reads if there's green between the passes,
  // so the ribbon is slimmer than the other two (a real single-track alpine pass).
  width: 6,
  // Far longer lap than the others (a full switchback cascade), so the finale runs fewer laps.
  laps: 2,
  // Points are already ~3m apart (generated), so little extra Catmull-Rom smoothing is needed.
  samplesPerSegment: 4,
  // A tall (portrait) switchback after the reference layout: six vertical passes linked by five
  // 180° hairpins that snake side-to-side, closed by a sweep along the bottom. Every hairpin is a
  // real 9m-radius semicircle so the road never folds; passes are 18m apart for green in between.
  points: switchback(6, 78, 9),
  meta: { location: 'alpine', scenerySeed: 4090 },
};

/** The season's circuits, in order — one per round. Grow in technicality and change location. */
export const SEASON_TRACKS: readonly TrackContent[] = [SUNSET_DERBY, CORAL_COAST, SUMMIT_PASS];

/** The circuit (with its location) raced in a given season round, clamped to the known cups. */
export function trackForRound(round: number): TrackContent {
  return SEASON_TRACKS[Math.max(0, Math.min(SEASON_TRACKS.length - 1, round))];
}

export const TRACKS: Record<string, TrackContent> = {
  [SUNSET_DERBY.id]: SUNSET_DERBY,
  [CORAL_COAST.id]: CORAL_COAST,
  [SUMMIT_PASS.id]: SUMMIT_PASS,
};

export const DEFAULT_TRACK_ID = SUNSET_DERBY.id;

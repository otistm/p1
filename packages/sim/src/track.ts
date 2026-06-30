import type { TrackDef } from './contracts';
import { clamp, wrapAngle } from './math';

function catmull(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  t: number,
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

export interface TrackSample {
  x: number;
  z: number;
  ang: number;
  curvS: number;
  idx: number;
}

export interface TrackProjection {
  idx: number;
  s: number;
  lateral: number;
  ang: number;
}

/**
 * A closed Catmull-Rom circuit, resampled to a dense centerline with precomputed
 * heading, arc-length, and signed/smoothed curvature. All race geometry queries go
 * through here. Construction is deterministic; queries are pure.
 */
export class Track {
  readonly def: TrackDef;
  readonly center: [number, number][] = [];
  readonly ang: number[] = [];
  readonly cum: number[] = [];
  readonly seg: number[] = [];
  readonly curv: number[] = [];
  readonly curvS: number[] = [];
  readonly N: number;
  readonly length: number;
  readonly width: number;

  constructor(def: TrackDef) {
    this.def = def;
    this.width = def.width;
    const pts = def.points;
    const n = pts.length;
    const per = def.samplesPerSegment ?? 22;

    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      for (let s = 0; s < per; s++) this.center.push(catmull(p0, p1, p2, p3, s / per));
    }
    const N = this.center.length;
    this.N = N;

    let total = 0;
    for (let i = 0; i < N; i++) {
      const a = this.center[i];
      const b = this.center[(i + 1) % N];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      this.ang[i] = Math.atan2(dz, dx);
      this.seg[i] = Math.hypot(dx, dz);
      this.cum[i] = total;
      total += this.seg[i];
    }
    this.length = total;

    const signed: number[] = [];
    for (let i = 0; i < N; i++) {
      const da = wrapAngle(this.ang[i] - this.ang[(i - 1 + N) % N]);
      this.curv[i] = Math.abs(da) / Math.max(this.seg[i], 0.01);
      signed[i] = da / Math.max(this.seg[i], 0.01);
    }
    // Smooth the signed curvature so steer/body-roll visuals never step.
    for (let i = 0; i < N; i++) {
      this.curvS[i] = (signed[(i - 1 + N) % N] + 2 * signed[i] + signed[(i + 1) % N]) / 4;
    }
  }

  private idxAtS(s: number): number {
    let lo = 0;
    let hi = this.N - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Position, heading, and signed curvature at wrapped arc-length `s`. */
  posAt(s: number): TrackSample {
    const total = this.length;
    const sm = ((s % total) + total) % total;
    const i = this.idxAtS(sm);
    const j = (i + 1) % this.N;
    const t = (sm - this.cum[i]) / Math.max(this.seg[i], 1e-4);
    const x = this.center[i][0] + (this.center[j][0] - this.center[i][0]) * t;
    const z = this.center[i][1] + (this.center[j][1] - this.center[i][1]) * t;
    const a = this.ang[i] + wrapAngle(this.ang[j] - this.ang[i]) * t;
    const cS = this.curvS[i] + (this.curvS[j] - this.curvS[i]) * t;
    return { x, z, ang: a, curvS: cS, idx: i };
  }

  /** The single shared racing line: cut toward the inside of corners. */
  linePoint(s: number): { x: number; z: number; ang: number } {
    const p = this.posAt(s);
    const o = clamp(p.curvS * 22, -2.4, 2.4);
    return { x: p.x - Math.sin(p.ang) * o, z: p.z + Math.cos(p.ang) * o, ang: p.ang };
  }

  /** Project a world point onto the centerline near `hint`: arc-length + signed lateral. */
  project(x: number, z: number, hint: number): TrackProjection {
    let best = 1e9;
    let bi = hint;
    const N = this.N;
    for (let k = -8; k <= 40; k++) {
      const i = (((hint + k) % N) + N) % N;
      const dx = x - this.center[i][0];
      const dz = z - this.center[i][1];
      const d = dx * dx + dz * dz;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    const a = this.ang[bi];
    const dx = x - this.center[bi][0];
    const dz = z - this.center[bi][1];
    const along = dx * Math.cos(a) + dz * Math.sin(a);
    const lateral = -Math.sin(a) * dx + Math.cos(a) * dz;
    return { idx: bi, s: this.cum[bi] + along, lateral, ang: a };
  }

  /** Largest curvature magnitude within `dist` ahead of `idx` (corner planning). */
  maxCurvAhead(idx: number, dist: number): number {
    let i = idx;
    let d = 0;
    let m = 0;
    while (d < dist) {
      if (this.curv[i] > m) m = this.curv[i];
      d += this.seg[i];
      i = (i + 1) % this.N;
    }
    return m;
  }
}

/**
 * Render-loop jitter diagnostic. Replays exactly what RaceField does each frame
 * (engine.step(dt) -> interpolate prev/current by engine.alpha -> chase camera) but with
 * realistic high-refresh + jittery frame timings, then measures stutter: frame-to-frame
 * reversals and high-frequency wobble in the player's screen position and the camera yaw.
 *
 *   npx tsx tools/diag/jitter.ts
 */
import { RaceEngine, lerp, wrapAngle, type Entrant, type RaceConfig } from '@grid/sim';
import { RIVAL_ARCHETYPES, SUNSET_DERBY } from '@grid/content';

const lerpAngle = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

function makeField(): Entrant[] {
  return RIVAL_ARCHETYPES.map((a, i) => ({
    id: i === 0 ? 'player' : a.id,
    name: a.name,
    colorHex: 0xffffff + i,
    isPlayer: i === 0,
    stats: { ...a.stats },
  }));
}

interface Sample {
  px: number;
  pz: number;
  camX: number;
  camZ: number;
  camYaw: number;
}

/** Count sign flips in the first difference whose magnitude exceeds `eps` (high-freq wobble). */
function reversals(series: number[], eps: number): number {
  let flips = 0;
  let prevDir = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i] - series[i - 1];
    if (Math.abs(d) < eps) continue;
    const dir = Math.sign(d);
    if (prevDir !== 0 && dir !== prevDir) flips++;
    prevDir = dir;
  }
  return flips;
}

function maxStep(series: number[]): number {
  let m = 0;
  for (let i = 1; i < series.length; i++) m = Math.max(m, Math.abs(series[i] - series[i - 1]));
  return m;
}

/** Simulate `seconds` of the render loop at `hz` with ±`jitter` frame-time variance. */
function runLoop(hz: number, jitter: number, seconds: number, interpolate: boolean): Sample[] {
  const config: RaceConfig = { track: SUNSET_DERBY, seed: 7, entrants: makeField() };
  const engine = new RaceEngine(config);
  engine.start();
  const p = engine.racers.find((r) => r.isPlayer)!;

  const base = 1 / hz;
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const samples: Sample[] = [];
  let camX = p.x;
  let camZ = p.z;
  let camInit = false;
  let t = 0;
  while (t < seconds && !engine.over) {
    const dtRaw = base * (1 + (rand() * 2 - 1) * jitter);
    const dt = Math.min(dtRaw, 0.05);
    t += dt;
    engine.step(dt);

    const a = interpolate ? engine.alpha : 1;
    const px = interpolate ? lerp(p.prevX, p.x, a) : p.x;
    const pz = interpolate ? lerp(p.prevZ, p.z, a) : p.z;
    const pvh = interpolate ? lerpAngle(p.prevVheading, p.vheading, a) : p.vheading;

    const dist = 8.5;
    const tx = px - Math.cos(pvh) * dist;
    const tz = pz - Math.sin(pvh) * dist;
    if (!camInit) {
      camX = tx;
      camZ = tz;
      camInit = true;
    } else {
      const k = 1 - Math.exp(-6 * dt);
      camX += (tx - camX) * k;
      camZ += (tz - camZ) * k;
    }
    const lookX = px + Math.cos(pvh) * 5;
    const lookZ = pz + Math.sin(pvh) * 5;
    const camYaw = Math.atan2(lookZ - camZ, lookX - camX);
    samples.push({ px, pz, camX, camZ, camYaw });
  }
  return samples;
}

function report(label: string, s: Sample[]): void {
  // Player motion projected: per-frame displacement direction reversals (should be ~0 for
  // a kart driving forward). Camera yaw wobble: high-frequency sign flips in yaw rate.
  const dxs: number[] = [];
  for (let i = 1; i < s.length; i++) {
    const dx = s[i].px - s[i - 1].px;
    const dz = s[i].pz - s[i - 1].pz;
    dxs.push(Math.hypot(dx, dz));
  }
  const yaw = s.map((x) => x.camYaw);
  const yawUnwrapped: number[] = [yaw[0]];
  for (let i = 1; i < yaw.length; i++) {
    yawUnwrapped.push(yawUnwrapped[i - 1] + wrapAngle(yaw[i] - yaw[i - 1]));
  }
  const yawFlips = reversals(yawUnwrapped, 0.0008);
  const speedFlips = reversals(
    s.map((x) => x.px),
    0.002,
  );
  const speedZFlips = reversals(
    s.map((x) => x.pz),
    0.002,
  );
  console.log(
    `  ${label.padEnd(28)} frames=${String(s.length).padStart(4)}  ` +
      `posXflips=${String(speedFlips).padStart(4)} posZflips=${String(speedZFlips).padStart(4)}  ` +
      `camYawWobble=${String(yawFlips).padStart(4)}  maxYawStep=${maxStep(yawUnwrapped).toFixed(4)}`,
  );
}

console.log('\nP1 — render-loop jitter diagnostic (3s of racing)\n');
for (const hz of [60, 144, 165]) {
  console.log(`@ ${hz}Hz, ±25% frame jitter:`);
  report('raw (no interpolation)', runLoop(hz, 0.25, 3, false));
  report('interpolated', runLoop(hz, 0.25, 3, true));
  console.log('');
}

// Full race, every kart: where does wobble actually appear (corners, collisions, pack)?
function runFullRace(hz: number, jitter: number): void {
  const config: RaceConfig = { track: SUNSET_DERBY, seed: 7, entrants: makeField() };
  const engine = new RaceEngine(config);
  engine.start();
  const base = 1 / hz;
  let seed = 999;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const trails = engine.racers.map(() => ({ x: [] as number[], z: [] as number[] }));
  let frames = 0;
  while (!engine.over && frames < 20000) {
    const dt = Math.min(base * (1 + (rand() * 2 - 1) * jitter), 0.05);
    engine.step(dt);
    const a = engine.alpha;
    engine.racers.forEach((r, i) => {
      trails[i].x.push(lerp(r.prevX, r.x, a));
      trails[i].z.push(lerp(r.prevZ, r.z, a));
    });
    frames++;
  }
  console.log(`Full race @ ${hz}Hz (${frames} frames), per-kart interpolated-position wobble:`);
  engine.racers.forEach((r, i) => {
    const fx = reversals(trails[i].x, 0.003);
    const fz = reversals(trails[i].z, 0.003);
    console.log(
      `  ${r.name.padEnd(10)} posXflips=${String(fx).padStart(4)} posZflips=${String(fz).padStart(4)}`,
    );
  });
  console.log('');
}
runFullRace(144, 0.25);

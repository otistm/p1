import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type RaceEngine, type Racer, lerp, wrapAngle } from '@grid/sim';
import { buildKart, type KartObject, type KartVisual } from './kart/buildKart';
import { createRaceFx } from './raceFx';

/** Shortest-path angular interpolation (avoids the wrap-around spin at ±π). */
const lerpAngle = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

/** World height of the road surface (see buildTrack: road verts at y=0.02). */
const ROAD_Y = 0.02;

/** Corner-lean (|roll|) and speed above which a kart lays down tire scuffs. */
const SKID_ROLL = 0.14;
const SKID_SPEED = 12;
/** Min world distance between successive scuff / trail drops (density control). */
const SKID_SPACING = 0.5;
const TRAIL_SPACING = 0.45;
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Re-pop the same tuning proc at most this often (ms) so a held condition doesn't spam. */
const PROC_COOLDOWN_MS = 2600;
/** Scratch vector for world→screen projection (module-scoped: single-threaded, no alloc). */
const projScratch = new THREE.Vector3();

interface RaceFieldProps {
  engine: RaceEngine;
  visualsById: Record<string, KartVisual>;
  /** When true, the deterministic clock advances (set after the countdown). */
  running: boolean;
  /** Playback multiplier for the sim clock (1× or 2×). Same result, just faster. */
  speed?: number;
  /** Colour (hex) of the player's cosmetic trail wake. `null` = disabled; omit = livery tint. */
  playerTrailHex?: number | null;
  /**
   * Fired when one of the *player's* tuning effects newly procs, with the effect kind and the
   * kart's projected screen position (px). Omit to disable the popups (e.g. reduced motion).
   */
  onProc?: (kind: string, screenX: number, screenY: number) => void;
}

/**
 * Renders and animates the whole field. Builds one kart object per entrant once, then
 * each frame advances the deterministic clock (when running) and copies sim state onto
 * the meshes. Reuses all scratch state — zero per-frame allocation. The camera chases
 * the player's kart.
 */
export function RaceField({
  engine,
  visualsById,
  running,
  speed = 1,
  playerTrailHex,
  onProc,
}: RaceFieldProps) {
  const { camera, size } = useThree();

  const karts = useMemo<KartObject[]>(
    () => engine.racers.map((r) => buildKart(visualsById[r.id] ?? { colorHex: r.colorHex })),
    [engine, visualsById],
  );

  const playerIndex = useMemo(
    () =>
      Math.max(
        0,
        engine.racers.findIndex((r) => r.isPlayer),
      ),
    [engine],
  );

  const camInit = useRef(false);

  // Instanced race VFX (skid scuffs + leader wake). Rebuilt per race so scuffs clear between
  // rounds. Per-kart "last drop" positions throttle scuff density; one shared position throttles
  // the leader trail. All scratch state lives here — the useFrame loop allocates nothing.
  // `engine` is the rebuild key here (a new race must start with a clean set of scuffs), even
  // though the factory itself doesn't read it — so the dep is intentional, not a mistake.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fx = useMemo(() => createRaceFx(prefersReducedMotion()), [engine]);
  const lastSkid = useMemo(() => engine.racers.map(() => ({ x: NaN, z: NaN })), [engine]);
  const lastPlayerTrail = useRef({ x: NaN, z: NaN });
  const lastLeaderTrail = useRef({ x: NaN, z: NaN });
  const procCooldown = useRef<Record<string, number>>({});

  useEffect(() => {
    camInit.current = false;
    procCooldown.current = {};
    return () => {
      for (const k of karts) k.dispose();
      fx.dispose();
    };
  }, [karts, fx]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * speed;
    if (running) engine.step(dt);

    // Interpolate every transform between the last two fixed steps so rendering is smooth
    // regardless of display refresh rate (no stutter/vibration from the 60 Hz sim clock).
    const a = engine.alpha;
    const racers = engine.racers;
    let leaderIdx = -1;
    for (let i = 0; i < racers.length; i++) {
      const rc: Racer = racers[i];
      const k = karts[i];
      const rx = lerp(rc.prevX, rc.x, a);
      const rz = lerp(rc.prevZ, rc.z, a);
      const vh = lerpAngle(rc.prevVheading, rc.vheading, a);
      const roll = lerp(rc.prevRoll, rc.roll, a);
      // Rest the wheels on the road: origin sits one wheel-radius above the surface.
      k.group.position.set(rx, ROAD_Y + k.groundOffset, rz);
      k.group.rotation.y = -vh - Math.PI / 2;
      k.tilt.rotation.z = roll;
      k.tilt.rotation.x = lerp(rc.prevPitch, rc.pitch, a);
      // Negate to match the body group's yaw, which flips the sim heading (line above:
      // `-vheading`). steerVis is authored in sim-heading space (alpha = dir - heading), so
      // without this flip the front wheels point the opposite way to the kart's actual turn.
      const steer = -lerp(rc.prevSteer, rc.steerVis, a);
      k.fl.rotation.y = steer;
      k.fr.rotation.y = steer;
      const spin = lerp(rc.prevWheelSpin, rc.wheelSpin, a);
      // Sim wheelSpin grows with forward distance; negate so the tops roll toward the
      // nose (-z) instead of backward.
      for (const s of k.spinners) s.rotation.x = -spin;

      if (rc.rank === 1) leaderIdx = i;

      // Tire scuffs: a hard-leaning, quick kart drops two rear-wheel marks, spaced by distance
      // so density is speed-independent. Forward/right come straight from the travel heading.
      if (running && Math.abs(roll) > SKID_ROLL && rc.speed > SKID_SPEED) {
        const ld = lastSkid[i];
        const moved = Number.isNaN(ld.x) ? Infinity : Math.hypot(rx - ld.x, rz - ld.z);
        if (moved > SKID_SPACING) {
          const fwx = Math.cos(vh);
          const fwz = Math.sin(vh);
          const rgx = -Math.sin(vh);
          const rgz = Math.cos(vh);
          const bx = rx - fwx * 0.5;
          const bz = rz - fwz * 0.5;
          fx.dropSkid(bx + rgx * 0.6, bz + rgz * 0.6);
          fx.dropSkid(bx - rgx * 0.6, bz - rgz * 0.6);
          ld.x = rx;
          ld.z = rz;
        }
      }
    }

    if (running && playerTrailHex !== null) {
      // Player wake: the player's cosmetic-trail colour follows them wherever they run (kart
      // identity). Distance-spaced like the scuffs. Skipped when the player chose no trail.
      const pk = karts[playerIndex];
      const pt = lastPlayerTrail.current;
      const pmoved = Number.isNaN(pt.x) ? Infinity : Math.hypot(pk.group.position.x - pt.x, pk.group.position.z - pt.z);
      if (pmoved > TRAIL_SPACING) {
        fx.dropTrail(pk.group.position.x, pk.group.position.z, playerTrailHex ?? racers[playerIndex].colorHex);
        pt.x = pk.group.position.x;
        pt.z = pk.group.position.z;
      }
    }

    if (running) {
      // Leader wake: a second trail behind whoever holds P1 (tinted their colour) so you can read
      // the lead at a glance — skipped when the player *is* the leader (their wake already shows).
      if (leaderIdx >= 0 && leaderIdx !== playerIndex) {
        const lk = karts[leaderIdx];
        const lt = lastLeaderTrail.current;
        const lmoved = Number.isNaN(lt.x) ? Infinity : Math.hypot(lk.group.position.x - lt.x, lk.group.position.z - lt.z);
        if (lmoved > TRAIL_SPACING) {
          fx.dropTrail(lk.group.position.x, lk.group.position.z, racers[leaderIdx].colorHex);
          lt.x = lk.group.position.x;
          lt.z = lk.group.position.z;
        }
      }

      // Tuning procs: pop feedback anchored to the player's kart when one of *their* staged
      // effects applies this tick (cooldowned per kind so a held condition doesn't spam).
      if (onProc) {
        const active = racers[playerIndex].activeEffects;
        const now = performance.now();
        for (let e = 0; e < active.length; e++) {
          const kind = active[e];
          if (now - (procCooldown.current[kind] ?? 0) < PROC_COOLDOWN_MS) continue;
          procCooldown.current[kind] = now;
          const pg = karts[playerIndex].group.position;
          projScratch.set(pg.x, pg.y + 1.5, pg.z).project(camera);
          const sx = (projScratch.x * 0.5 + 0.5) * size.width;
          const sy = (-projScratch.y * 0.5 + 0.5) * size.height;
          // Only when the kart is in front of the camera and within the viewport.
          if (projScratch.z < 1 && sx >= 0 && sx <= size.width && sy >= 0 && sy <= size.height) {
            onProc(kind, sx, sy);
          }
        }
      }
    }
    fx.update(dt);

    const p = racers[playerIndex];
    const px = lerp(p.prevX, p.x, a);
    const pz = lerp(p.prevZ, p.z, a);
    const pvh = lerpAngle(p.prevVheading, p.vheading, a);
    const dist = 8.5;
    const height = 4.2;
    const tx = px - Math.cos(pvh) * dist;
    const tz = pz - Math.sin(pvh) * dist;
    if (!camInit.current) {
      camera.position.set(tx, 0.5 + height, tz);
      camInit.current = true;
    } else {
      // Frame-rate-independent smoothing: equivalent to ~0.09/frame at 60fps but stable
      // at any refresh rate (a fixed per-frame lerp would over-snap on high-Hz displays).
      const k = 1 - Math.exp(-6 * dt);
      camera.position.x += (tx - camera.position.x) * k;
      camera.position.y += (0.5 + height - camera.position.y) * k;
      camera.position.z += (tz - camera.position.z) * k;
    }
    camera.lookAt(px + Math.cos(pvh) * 5, 0.8, pz + Math.sin(pvh) * 5);
  });

  return (
    <>
      {karts.map((k, i) => (
        <primitive key={engine.racers[i].id} object={k.group} />
      ))}
      {fx.meshes.map((m, i) => (
        <primitive key={`fx-${i}`} object={m} />
      ))}
    </>
  );
}

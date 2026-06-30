import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { type RaceEngine, type Racer, lerp, wrapAngle } from '@grid/sim';
import { buildKart, type KartObject, type KartVisual } from './kart/buildKart';

/** Shortest-path angular interpolation (avoids the wrap-around spin at ±π). */
const lerpAngle = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

interface RaceFieldProps {
  engine: RaceEngine;
  visualsById: Record<string, KartVisual>;
  /** When true, the deterministic clock advances (set after the countdown). */
  running: boolean;
}

/**
 * Renders and animates the whole field. Builds one kart object per entrant once, then
 * each frame advances the deterministic clock (when running) and copies sim state onto
 * the meshes. Reuses all scratch state — zero per-frame allocation. The camera chases
 * the player's kart.
 */
export function RaceField({ engine, visualsById, running }: RaceFieldProps) {
  const { camera } = useThree();

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

  useEffect(() => {
    camInit.current = false;
    return () => {
      for (const k of karts) k.dispose();
    };
  }, [karts]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (running) engine.step(dt);

    // Interpolate every transform between the last two fixed steps so rendering is smooth
    // regardless of display refresh rate (no stutter/vibration from the 60 Hz sim clock).
    const a = engine.alpha;
    const racers = engine.racers;
    for (let i = 0; i < racers.length; i++) {
      const rc: Racer = racers[i];
      const k = karts[i];
      k.group.position.set(lerp(rc.prevX, rc.x, a), 0.5, lerp(rc.prevZ, rc.z, a));
      k.group.rotation.y = -lerpAngle(rc.prevVheading, rc.vheading, a) - Math.PI / 2;
      k.tilt.rotation.z = lerp(rc.prevRoll, rc.roll, a);
      k.tilt.rotation.x = lerp(rc.prevPitch, rc.pitch, a);
      const steer = lerp(rc.prevSteer, rc.steerVis, a);
      k.fl.rotation.y = steer;
      k.fr.rotation.y = steer;
      const spin = lerp(rc.prevWheelSpin, rc.wheelSpin, a);
      for (const s of k.spinners) s.rotation.x = spin;
    }

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
    </>
  );
}

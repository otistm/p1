import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Track, type TrackDef } from '@grid/sim';
import { buildKart, type KartVisual } from './kart/buildKart';

interface ShowroomKartProps {
  track: TrackDef;
  visual: KartVisual;
  /** Disable the slow camera orbit (reduced motion / when an overlay needs a still). */
  orbit?: boolean;
  /** Fixed camera azimuth (radians) used when orbit is disabled — frames the build view. */
  angle?: number;
  /** Camera distance from the kart. */
  radius?: number;
  /** Camera height above the kart. */
  height?: number;
  /** Called when the kart is clicked — lets the UI layer open a build/tuning inspector. */
  onSelect?: () => void;
  /**
   * A monotonic counter; whenever it changes the kart plays a quick scale up/down pulse to
   * signal "you just affected me" (e.g. a card was played). Drive it from a store signal.
   */
  pulseKey?: number;
}

/** Duration (s) and peak extra-scale of the card-play pulse. */
const PULSE_DURATION = 0.42;
const PULSE_AMPLITUDE = 0.16;

/**
 * A single kart on the start line. By default the camera slowly orbits (title showcase).
 * When `orbit` is false it holds a fixed azimuth so the garage build view can pin leader
 * lines to known on-screen part positions.
 */
export function ShowroomKart({
  track,
  visual,
  orbit = true,
  angle: fixedAngle = -0.92,
  radius = 9,
  height = 4.2,
  onSelect,
  pulseKey,
}: ShowroomKartProps) {
  const { camera } = useThree();
  const angle = useRef(fixedAngle);
  // Remaining pulse time (s); >0 while the kart is mid-bounce.
  const pulse = useRef(0);
  const seenPulse = useRef<number | undefined>(undefined);

  // Kick off a pulse when `pulseKey` changes — but never on first mount (so entering the
  // screen doesn't bounce the kart unprompted).
  useEffect(() => {
    if (pulseKey === undefined) return;
    if (seenPulse.current === undefined) {
      seenPulse.current = pulseKey;
      return;
    }
    if (pulseKey !== seenPulse.current) {
      seenPulse.current = pulseKey;
      pulse.current = PULSE_DURATION;
    }
  }, [pulseKey]);

  const { kart, pose } = useMemo(() => {
    const t = new Track(track);
    const k = buildKart(visual);
    // Rest the wheels on the road (origin one wheel-radius above the y=0.02 surface)
    // instead of hovering at a fixed height.
    const y = 0.02 + k.groundOffset;
    k.group.position.set(t.center[0][0], y, t.center[0][1]);
    k.group.rotation.y = -t.ang[0] - Math.PI / 2;
    return { kart: k, pose: { x: t.center[0][0], y, z: t.center[0][1] } };
  }, [track, visual]);

  useEffect(() => () => kart.dispose(), [kart]);

  useFrame((_, dt) => {
    if (orbit) angle.current += dt * 0.3;
    else angle.current = fixedAngle;
    camera.position.set(
      pose.x + Math.cos(angle.current) * radius,
      pose.y + height,
      pose.z + Math.sin(angle.current) * radius,
    );
    camera.lookAt(pose.x, pose.y + 0.6, pose.z);
    // Negative x-roll spins the wheel tops toward the nose (-z) = rolling forward.
    for (const s of kart.spinners) s.rotation.x -= dt * 0.4;

    // Card-play pulse: one smooth hump (up then back to 1) over PULSE_DURATION.
    if (pulse.current > 0) {
      pulse.current = Math.max(0, pulse.current - dt);
      const progress = 1 - pulse.current / PULSE_DURATION; // 0 -> 1
      const scale = 1 + PULSE_AMPLITUDE * Math.sin(Math.PI * progress);
      kart.group.scale.setScalar(scale);
    } else if (kart.group.scale.x !== 1) {
      kart.group.scale.setScalar(1);
    }
  });

  const handleClick = onSelect
    ? (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect();
      }
    : undefined;

  return (
    <primitive
      object={kart.group}
      onClick={handleClick}
      onPointerOver={onSelect ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onSelect ? () => (document.body.style.cursor = 'auto') : undefined}
    />
  );
}

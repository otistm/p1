import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
}

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
}: ShowroomKartProps) {
  const { camera } = useThree();
  const angle = useRef(fixedAngle);

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
  });

  return <primitive object={kart.group} />;
}

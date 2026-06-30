import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Track, type TrackDef } from '@grid/sim';
import { buildKart, type KartVisual } from './kart/buildKart';

interface ShowroomKartProps {
  track: TrackDef;
  visual: KartVisual;
  /** Disable the slow camera orbit (reduced motion / when an overlay needs a still). */
  orbit?: boolean;
}

/** A single kart on the start line under a slow orbiting camera — the garage view. */
export function ShowroomKart({ track, visual, orbit = true }: ShowroomKartProps) {
  const { camera } = useThree();
  const angle = useRef(0);

  const { kart, pose } = useMemo(() => {
    const t = new Track(track);
    const k = buildKart(visual);
    k.group.position.set(t.center[0][0], 0.5, t.center[0][1]);
    k.group.rotation.y = -t.ang[0] - Math.PI / 2;
    return { kart: k, pose: { x: t.center[0][0], y: 0.5, z: t.center[0][1] } };
  }, [track, visual]);

  useEffect(() => () => kart.dispose(), [kart]);

  useFrame((_, dt) => {
    if (orbit) angle.current += dt * 0.3;
    const r = 9;
    camera.position.set(
      pose.x + Math.cos(angle.current) * r,
      pose.y + 4.2,
      pose.z + Math.sin(angle.current) * r,
    );
    camera.lookAt(pose.x, pose.y + 0.6, pose.z);
    for (const s of kart.spinners) s.rotation.x += dt * 0.4;
  });

  return <primitive object={kart.group} />;
}

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Track, type TrackDef } from '@grid/sim';
import { buildTrack } from './world/buildTrack';
import { buildGround, buildScenery } from './world/buildScenery';

interface TrackWorldProps {
  track: TrackDef;
  scenerySeed?: number;
}

/** Ground + road + curbs + instanced scenery, generated once per track. */
export function TrackWorld({ track, scenerySeed = 1337 }: TrackWorldProps) {
  const objects = useMemo(() => {
    const t = new Track(track);
    return { road: buildTrack(t), ground: buildGround(), scenery: buildScenery(scenerySeed) };
  }, [track, scenerySeed]);

  useEffect(() => {
    const { road, ground, scenery } = objects;
    return () => {
      const disposeMat = (m: THREE.Material) => {
        const map = (m as THREE.MeshStandardMaterial).map;
        if (map) map.dispose();
        m.dispose();
      };
      for (const root of [road, ground, scenery]) {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const mat = o.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach(disposeMat);
            else disposeMat(mat);
          }
        });
      }
    };
  }, [objects]);

  return (
    <>
      <primitive object={objects.ground} />
      <primitive object={objects.road} />
      <primitive object={objects.scenery} />
    </>
  );
}

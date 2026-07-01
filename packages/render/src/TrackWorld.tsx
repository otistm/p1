import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Track, type TrackDef } from '@grid/sim';
import type { TrackLocation } from '@grid/content';
import { buildTrack } from './world/buildTrack';
import { buildGround, buildScenery } from './world/buildScenery';
import { LOCATION_PRESETS } from './world/theme';

interface TrackWorldProps {
  track: TrackDef;
  scenerySeed?: number;
  /** The biome this circuit sits in — picks ground colour, foliage and scenery. Defaults meadow. */
  location?: TrackLocation;
}

/** Ground + road + curbs + instanced scenery, generated once per track + location. */
export function TrackWorld({ track, scenerySeed = 1337, location = 'meadow' }: TrackWorldProps) {
  const objects = useMemo(() => {
    const t = new Track(track);
    const p = LOCATION_PRESETS[location];
    return {
      road: buildTrack(t),
      ground: buildGround(p.ground),
      scenery: buildScenery(scenerySeed, p.scenery),
    };
  }, [track, scenerySeed, location]);

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

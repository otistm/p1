import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeSkyTexture } from './world/sky';
import type { TimePreset } from './world/theme';

/**
 * Sets the gradient sky background, distance fog, and image-based lighting (so metals
 * and rims pick up sky reflections). Re-runs when the time-of-day changes; disposes its textures.
 */
export function SceneEnvironment({ preset }: { preset: TimePreset }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = makeSkyTexture(false, preset.sky, preset.sunGlow);
    scene.fog = new THREE.Fog(preset.fog.color, preset.fog.near, preset.fog.far);
    let envTexture: THREE.Texture | null = null;
    try {
      const pmrem = new THREE.PMREMGenerator(gl);
      const envTex = makeSkyTexture(true, preset.sky, preset.sunGlow);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTexture = pmrem.fromEquirectangular(envTex).texture;
      scene.environment = envTexture;
      envTex.dispose();
      pmrem.dispose();
    } catch {
      // IBL is optional; flat lighting still looks fine.
    }
    return () => {
      scene.environment = null;
      scene.background = null;
      scene.fog = null;
      envTexture?.dispose();
    };
  }, [scene, gl, preset]);
  return null;
}

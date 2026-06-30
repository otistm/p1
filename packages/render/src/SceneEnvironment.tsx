import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeSkyTexture } from './world/sky';

/**
 * Sets the gradient sky background, distance fog, and image-based lighting (so metals
 * and rims pick up sky reflections). Runs once; disposes its generated textures.
 */
export function SceneEnvironment() {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = makeSkyTexture(false);
    scene.fog = new THREE.Fog(0xc4dcec, 110, 380);
    let envTexture: THREE.Texture | null = null;
    try {
      const pmrem = new THREE.PMREMGenerator(gl);
      const envTex = makeSkyTexture(true);
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
  }, [scene, gl]);
  return null;
}

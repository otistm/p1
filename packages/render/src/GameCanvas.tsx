import { type ReactNode, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { SceneEnvironment } from './SceneEnvironment';
import { detectTier } from './detectTier';

interface GameCanvasProps {
  children: ReactNode;
}

/**
 * The single persistent <Canvas>. Owns the renderer, lighting rig, environment, and a
 * cheap post-FX stack. Children switch between the showroom and the race without ever
 * tearing down the renderer (keeps 60fps and avoids context churn).
 */
export function GameCanvas({ children }: GameCanvasProps) {
  const tier = useMemo(detectTier, []);
  return (
    <Canvas
      id="scene"
      shadows
      dpr={[1, tier.quality === 'high' ? 2 : 1.25]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // near is pushed out to 1.5 (cameras are always ~9+ units from the subject) to give
      // the depth buffer enough precision in the distance — a tight near plane made the
      // near-coplanar road/ground flicker (z-fight) at the far track edges.
      camera={{ fov: 58, near: 1.5, far: 420, position: [0, 6, 12] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
    >
      <SceneEnvironment />
      <hemisphereLight args={[0xcfe3f5, 0x5d4a30, 0.45]} />
      <directionalLight
        position={[72, 128, 52]}
        intensity={1.55}
        color={0xfff3df}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.03}
        shadow-camera-near={0.5}
        shadow-camera-far={340}
        // Frustum tightened to fit the track (~±60u): denser shadow texels => stable kart
        // shadows instead of edges that "swim"/shimmer as the karts move.
        shadow-camera-top={66}
        shadow-camera-bottom={-66}
        shadow-camera-left={-66}
        shadow-camera-right={66}
      />
      <directionalLight position={[-60, 40, -30]} intensity={0.25} color={0x9ab8d8} />
      {children}
      {tier.quality === 'high' && !tier.reducedMotion && (
        <EffectComposer>
          <Bloom intensity={0.42} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}

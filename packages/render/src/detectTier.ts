export type Quality = 'low' | 'high';

export interface RenderTier {
  /** WebGPU available in this browser (informational — slice renders on WebGL2). */
  webgpu: boolean;
  quality: Quality;
  reducedMotion: boolean;
}

/**
 * Capability probe. The vertical slice renders on the rock-solid WebGL2 path; we detect
 * WebGPU so the renderer can be upgraded behind a flag once we move to R3F v9 (see
 * docs/rendering-budget.md). Quality drops on low-DPI / small screens.
 */
export function detectTier(): RenderTier {
  const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 560;
  return { webgpu, quality: small ? 'low' : 'high', reducedMotion };
}

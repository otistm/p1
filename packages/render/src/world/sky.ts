import * as THREE from 'three';

/** A vertical-gradient sky texture, optionally with a soft sun glow (for IBL). */
export function makeSkyTexture(sun: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2f73b8');
  grad.addColorStop(0.42, '#7db4e3');
  grad.addColorStop(0.68, '#cfe2f0');
  grad.addColorStop(1.0, '#e9eff3');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 256);
  if (sun) {
    const rg = g.createRadialGradient(16, 54, 0, 16, 54, 70);
    rg.addColorStop(0, 'rgba(255,250,234,0.95)');
    rg.addColorStop(0.4, 'rgba(255,248,228,0.35)');
    rg.addColorStop(1, 'rgba(255,248,228,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 32, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

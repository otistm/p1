import * as THREE from 'three';

/** Default day gradient (top → horizon) + sun glow — used when no theme stops are supplied. */
const DEFAULT_STOPS: [string, string, string, string] = ['#2f73b8', '#7db4e3', '#cfe2f0', '#e9eff3'];
const DEFAULT_GLOW = 'rgba(255,250,234,0.95)';

/**
 * A vertical-gradient sky texture, optionally with a soft sun glow (for IBL). `stops` are the
 * four gradient colours (top, upper-mid, lower-mid, horizon) and `glow` the sun/moon colour, so
 * a theme can restyle the sky without touching this generator.
 */
export function makeSkyTexture(
  sun: boolean,
  stops: [string, string, string, string] = DEFAULT_STOPS,
  glow: string = DEFAULT_GLOW,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, stops[0]);
  grad.addColorStop(0.42, stops[1]);
  grad.addColorStop(0.68, stops[2]);
  grad.addColorStop(1.0, stops[3]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 256);
  if (sun) {
    const rg = g.createRadialGradient(16, 54, 0, 16, 54, 70);
    rg.addColorStop(0, glow);
    rg.addColorStop(0.4, glow.replace(/[\d.]+\)$/, '0.3)'));
    rg.addColorStop(1, glow.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = rg;
    g.fillRect(0, 0, 32, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

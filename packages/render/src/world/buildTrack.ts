import * as THREE from 'three';
import { Track } from '@grid/sim';

/**
 * Build the road surface, alternating red/white curbs, and the start/finish line as a
 * single Group from a Track. Geometry is generated once and never per frame.
 */
export function buildTrack(track: Track): THREE.Group {
  const group = new THREE.Group();
  const C = track.center;
  const N = track.N;
  const hw = track.width / 2;

  // Road ribbon.
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = track.ang[i];
    const nx = -Math.sin(a);
    const nz = Math.cos(a);
    verts.push(C[i][0] + nx * hw, 0.02, C[i][1] + nz * hw);
    verts.push(C[i][0] - nx * hw, 0.02, C[i][1] - nz * hw);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % N) * 2;
    const d = ((i + 1) % N) * 2 + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const road = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x383d46,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.25,
    }),
  );
  road.receiveShadow = true;
  group.add(road);

  // Curbs — one textured ribbon per side. A repeating red/white stripe texture with
  // mipmaps + anisotropy replaces the old field of tiny solid boxes: mipmapping averages
  // the high-frequency stripes toward a smooth grey in the distance, so they never shimmer
  // the way sub-pixel flat-colored geometry does (which MSAA alone can't fix). Two draw
  // calls total.
  const stripeTex = makeCurbStripeTexture();
  const curbMat = new THREE.MeshStandardMaterial({
    map: stripeTex,
    roughness: 0.85,
    metalness: 0.0,
    envMapIntensity: 0.1,
    side: THREE.DoubleSide,
    // Bias toward the camera (beyond the road's -2) so the ribbon never z-fights the road.
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });

  const bw = 0.28; // half-width of the curb band, straddling the road edge
  const curbY = 0.04;
  // Snap the stripe period to the lap length so the pattern tiles seamlessly across the seam.
  const repeats = Math.max(1, Math.round(track.length / 1.4));
  const period = track.length / repeats;

  for (const sideSign of [1, -1]) {
    const cverts: number[] = [];
    const cuvs: number[] = [];
    const cnormals: number[] = [];
    const cidx: number[] = [];
    for (let k = 0; k <= N; k++) {
      const i = k % N;
      const a = track.ang[i];
      const nx = -Math.sin(a);
      const nz = Math.cos(a);
      const innerOff = (hw - bw) * sideSign;
      const outerOff = (hw + bw) * sideSign;
      const v = (k < N ? track.cum[i] : track.length) / period;
      cverts.push(C[i][0] + nx * innerOff, curbY, C[i][1] + nz * innerOff);
      cuvs.push(0, v);
      cnormals.push(0, 1, 0);
      cverts.push(C[i][0] + nx * outerOff, curbY, C[i][1] + nz * outerOff);
      cuvs.push(1, v);
      cnormals.push(0, 1, 0);
    }
    for (let k = 0; k < N; k++) {
      const a = k * 2;
      const b = k * 2 + 1;
      const c = (k + 1) * 2;
      const d = (k + 1) * 2 + 1;
      cidx.push(a, b, c, b, d, c);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cverts, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(cuvs, 2));
    cg.setAttribute('normal', new THREE.Float32BufferAttribute(cnormals, 3));
    cg.setIndex(cidx);
    const curb = new THREE.Mesh(cg, curbMat);
    curb.receiveShadow = true;
    group.add(curb);
  }

  // Start/finish line — flat on the road, biased hard toward the camera so it never fights
  // the road or curb ribbons.
  const a0 = track.ang[0];
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(track.width, 0.02, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
  );
  line.position.set(C[0][0], 0.05, C[0][1]);
  line.rotation.y = -a0 + Math.PI / 2;
  group.add(line);

  return group;
}

/** A small, tileable red/white stripe texture with mipmaps + anisotropy for the curbs. */
function makeCurbStripeTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e23b3b';
  g.fillRect(0, 0, 8, 32);
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 32, 8, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 16; // three clamps to the hardware max
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

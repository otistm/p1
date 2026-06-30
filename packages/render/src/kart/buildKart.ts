import * as THREE from 'three';

/**
 * Visual descriptor for a kart, derived from its part loadout by the game layer.
 * Geometry responds to part choices so a "made from scratch" build looks distinct.
 */
export interface KartVisual {
  colorHex: number;
  accentHex?: number;
  /** Rear wing height — taller = more aggressive aero parts. */
  wing?: 'low' | 'mid' | 'high';
  /** Wheel radius scale (tire choice). */
  wheelScale?: number;
  /** Nose length scale (chassis choice). */
  noseScale?: number;
  /** Number of exhaust stacks (engine choice). */
  exhausts?: 1 | 2;
}

export interface KartObject {
  group: THREE.Group;
  tilt: THREE.Group;
  fl: THREE.Group;
  fr: THREE.Group;
  spinners: THREE.Group[];
  dispose: () => void;
}

const WING_Y = { low: 0.78, mid: 0.9, high: 1.04 } as const;

/**
 * Build a kart as a hierarchy: group (yaw/position) > tilt (roll/pitch) > parts.
 * Front wheels live in steer groups; every wheel has a spin group. Materials are
 * created per kart (only ~6 on track) and disposed with the object.
 */
export function buildKart(visual: KartVisual): KartObject {
  const { colorHex } = visual;
  const accentHex = visual.accentHex ?? 0xf1c40f;
  const wheelScale = visual.wheelScale ?? 1;
  const noseScale = visual.noseScale ?? 1;
  const wing = visual.wing ?? 'mid';
  const exhausts = visual.exhausts ?? 2;

  const group = new THREE.Group();
  const tilt = new THREE.Group();
  group.add(tilt);

  const body = new THREE.MeshStandardMaterial({
    color: colorHex,
    flatShading: true,
    metalness: 0.1,
    roughness: 0.5,
    envMapIntensity: 0.4,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: accentHex,
    flatShading: true,
    metalness: 0.1,
    roughness: 0.5,
    envMapIntensity: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x2c3e50,
    flatShading: true,
    metalness: 0.45,
    roughness: 0.55,
    envMapIntensity: 0.5,
  });
  const silver = new THREE.MeshStandardMaterial({
    color: 0xcdd2d6,
    flatShading: true,
    metalness: 0.95,
    roughness: 0.32,
    envMapIntensity: 0.7,
  });
  const materials = [body, accent, dark, silver];
  const geometries: THREE.BufferGeometry[] = [];

  const add = (
    geom: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh => {
    geometries.push(geom);
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    tilt.add(m);
    return m;
  };

  // Parts deliberately interpenetrate their neighbours by a few cm instead of abutting
  // exactly: shared (coplanar) faces between same-material parts z-fight and make the kart
  // shimmer as the camera angle changes. Overlapping faces never co-plane, so no flicker.
  add(new THREE.BoxGeometry(1.2, 0.3, 2.4), body, 0, 0, 0);
  const nose = add(
    new THREE.CylinderGeometry(0, 0.6, 0.8 * noseScale, 4),
    body,
    0,
    0.1,
    -1.2 * noseScale,
  );
  nose.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  // Side pods sunk ~3cm into the body (inner face at 0.57 < body side at 0.6).
  add(new THREE.BoxGeometry(0.3, 0.25, 1.2), accent, -0.72, 0.05, 0);
  add(new THREE.BoxGeometry(0.3, 0.25, 1.2), accent, 0.72, 0.05, 0);
  // Engine cover + air-box dropped so their undersides sit below the body top (0.15).
  add(new THREE.BoxGeometry(0.6, 0.2, 0.6), dark, 0, 0.22, 0.3);
  const sb = add(new THREE.BoxGeometry(0.6, 0.7, 0.2), dark, 0, 0.6, 0.7);
  sb.rotation.x = -0.1;
  add(new THREE.BoxGeometry(0.8, 0.5, 0.6), silver, 0, 0.37, 1.0);

  if (exhausts >= 1) {
    const e1 = add(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), dark, -0.2, 0.5, 1.35);
    e1.rotation.x = Math.PI / 2;
  }
  if (exhausts >= 2) {
    const e2 = add(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), dark, 0.2, 0.5, 1.35);
    e2.rotation.x = Math.PI / 2;
  }
  add(new THREE.BoxGeometry(0.05, 0.6, 0.2), dark, -0.4, 0.6, 1.1);
  add(new THREE.BoxGeometry(0.05, 0.6, 0.2), dark, 0.4, 0.6, 1.1);
  const w = add(new THREE.BoxGeometry(1.4, 0.1, 0.5), accent, 0, WING_Y[wing], 1.2);
  w.rotation.x = -0.1;
  const col = add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), dark, 0, 0.5, -0.4);
  col.rotation.x = Math.PI / 3;
  const sw = add(new THREE.TorusGeometry(0.2, 0.05, 4, 8), dark, 0, 0.75, -0.6);
  sw.rotation.x = Math.PI / 3;

  // Wheels: steer group (front) > spin group > tire + rim.
  const r = 0.34 * wheelScale;
  const wheelGeom = new THREE.CylinderGeometry(r, r, 0.26, 9);
  const rimGeom = new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.28, 6);
  geometries.push(wheelGeom, rimGeom);
  const spinners: THREE.Group[] = [];

  const wheel = (px: number, pz: number): THREE.Group => {
    const sGroup = new THREE.Group();
    sGroup.position.set(px, 0, pz);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeom, dark);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeom, silver);
    rim.rotation.z = Math.PI / 2;
    spin.add(tire, rim);
    sGroup.add(spin);
    tilt.add(sGroup);
    spinners.push(spin);
    return sGroup;
  };
  const fl = wheel(-0.75, -0.8);
  const fr = wheel(0.75, -0.8);
  wheel(-0.75, 0.9);
  wheel(0.75, 0.9);

  return {
    group,
    tilt,
    fl,
    fr,
    spinners,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

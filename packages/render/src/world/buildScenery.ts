import * as THREE from 'three';
import { makeRng } from '@grid/sim';

/**
 * How a location's foliage looks and scatters. Colours + tree geometry (a stack of `tiers` cones
 * lets one style cover rounded broadleaf trees, tall palms, and layered conifers) + the radial band
 * the props are sprinkled into (kept clear of the widest circuit).
 */
export interface SceneryStyle {
  leaf: number;
  trunk: number;
  rock: number;
  /** Number of trees to scatter. */
  trees: number;
  /** Rocks as a fraction of the tree count. */
  rockRatio: number;
  trunkH: number;
  trunkTopR: number;
  trunkBotR: number;
  leafR: number;
  leafH: number;
  /** Stacked leaf cones per tree (1 = single canopy, 3 = conifer). */
  tiers: number;
  spreadMin: number;
  spreadMax: number;
}

/** Rolling ground plane with gentle hills beyond the track. */
export function buildGround(color = 0x67b23f, flatRadius = 92): THREE.Mesh {
  const g = new THREE.PlaneGeometry(620, 620, 48, 48);
  const pos = g.attributes.position;
  const rng = makeRng(0x6d05);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dr = Math.hypot(x, y);
    if (dr > flatRadius) pos.setZ(i, rng() * 4 - 1.2);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.2,
    // Bias the ground away from the camera so the near-coplanar road (biased toward the
    // camera) reliably wins the depth test at the far track edges — kills z-fighting.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const ground = new THREE.Mesh(g, m);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

/**
 * Instanced trees and rocks scattered around the circuit. Deterministic from a seed so a track
 * always looks the same. Trunk + rocks are one draw call each; leaves are one per canopy tier
 * (so ≤ `tiers + 2` draw calls total).
 */
export function buildScenery(seed: number, style: SceneryStyle): THREE.Group {
  const group = new THREE.Group();
  const rng = makeRng(seed >>> 0);
  const TAU = Math.PI * 2;

  const TREES = style.trees;
  const trunkGeo = new THREE.CylinderGeometry(style.trunkTopR, style.trunkBotR, style.trunkH, 5);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: style.trunk,
    flatShading: true,
    roughness: 0.9,
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
  trunks.castShadow = true;

  const tiers = Math.max(1, Math.floor(style.tiers));
  const leafMat = new THREE.MeshStandardMaterial({
    color: style.leaf,
    flatShading: true,
    roughness: 0.85,
  });
  // One InstancedMesh per canopy tier; higher tiers are narrower and sit further up the trunk.
  const tierH = tiers > 1 ? style.leafH * 0.72 : style.leafH;
  const tierMeshes: THREE.InstancedMesh[] = [];
  for (let k = 0; k < tiers; k++) {
    const r = tiers > 1 ? style.leafR * (1 - k * 0.24) : style.leafR;
    const geo = new THREE.ConeGeometry(Math.max(0.4, r), tierH, 5);
    const mesh = new THREE.InstancedMesh(geo, leafMat, TREES);
    mesh.castShadow = true;
    tierMeshes.push(mesh);
  }

  const ROCKS = Math.floor(TREES * style.rockRatio);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: style.rock,
    flatShading: true,
    roughness: 0.85,
  });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(1, ROCKS));
  rocks.castShadow = true;
  let rockI = 0;

  const d = new THREE.Object3D();
  const band = style.spreadMax - style.spreadMin;
  const canopyBase = style.trunkH; // first tier starts at the top of the trunk

  for (let i = 0; i < TREES; i++) {
    const ang = rng() * TAU;
    const rad = style.spreadMin + rng() * band;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const yaw = rng() * TAU;

    d.position.set(x, style.trunkH / 2, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix);

    for (let k = 0; k < tiers; k++) {
      const y = canopyBase + tierH / 2 + k * tierH * 0.62;
      d.position.set(x, y, z);
      d.rotation.set(0, yaw, 0);
      d.updateMatrix();
      tierMeshes[k].setMatrixAt(i, d.matrix);
    }

    if (rng() < style.rockRatio && rockI < ROCKS) {
      const sc = 0.5 + rng() * 1.4;
      const rr = style.spreadMin - 12 + rng() * (band + 12);
      d.position.set(Math.cos(ang) * rr, sc / 2, Math.sin(ang) * rr);
      d.rotation.set(rng(), rng(), rng());
      d.scale.setScalar(sc);
      d.updateMatrix();
      rocks.setMatrixAt(rockI++, d.matrix);
    }
  }

  trunks.instanceMatrix.needsUpdate = true;
  for (const m of tierMeshes) {
    m.instanceMatrix.needsUpdate = true;
    group.add(m);
  }
  rocks.count = Math.max(0, rockI);
  rocks.instanceMatrix.needsUpdate = true;
  group.add(trunks, rocks);
  return group;
}

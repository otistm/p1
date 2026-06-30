import * as THREE from 'three';
import { makeRng } from '@grid/sim';

/** Rolling ground plane with gentle hills beyond the track. */
export function buildGround(): THREE.Mesh {
  const g = new THREE.PlaneGeometry(560, 560, 46, 46);
  const pos = g.attributes.position;
  const rng = makeRng(0x6d05);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dr = Math.hypot(x, y);
    if (dr > 78) pos.setZ(i, rng() * 4 - 1.2);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({
    color: 0x67b23f,
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
 * Instanced trees and rocks scattered around the circuit. Deterministic from a seed
 * so a track always looks the same. Two draw calls for trees + one for rocks.
 */
export function buildScenery(seed: number): THREE.Group {
  const group = new THREE.Group();
  const rng = makeRng(seed >>> 0);
  const TAU = Math.PI * 2;

  const TREES = 70;
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 2, 5);
  const leafGeo = new THREE.ConeGeometry(2, 4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6f4d37,
    flatShading: true,
    roughness: 0.9,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x37953b,
    flatShading: true,
    roughness: 0.85,
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, TREES);
  trunks.castShadow = true;
  leaves.castShadow = true;
  const d = new THREE.Object3D();

  const ROCKS = Math.floor(TREES / 3);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x8a9295,
    flatShading: true,
    roughness: 0.85,
  });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  rocks.castShadow = true;
  let rockI = 0;

  for (let i = 0; i < TREES; i++) {
    const ang = rng() * TAU;
    const rad = 72 + rng() * 120;
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    d.position.set(x, 1, z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix);
    d.position.set(x, 3.4, z);
    d.rotation.set(0, rng() * TAU, 0);
    d.updateMatrix();
    leaves.setMatrixAt(i, d.matrix);

    if (i % 3 === 0 && rockI < ROCKS) {
      const sc = 0.5 + rng() * 1.4;
      const rr = 80 + rng() * 70;
      d.position.set(Math.cos(ang) * rr, sc / 2, Math.sin(ang) * rr);
      d.rotation.set(rng(), rng(), rng());
      d.scale.setScalar(sc);
      d.updateMatrix();
      rocks.setMatrixAt(rockI++, d.matrix);
    }
  }
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  rocks.count = rockI;
  rocks.instanceMatrix.needsUpdate = true;
  group.add(trunks, leaves, rocks);
  return group;
}

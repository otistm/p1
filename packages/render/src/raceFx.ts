import * as THREE from 'three';

/** Road surface height (see buildTrack: road verts at y=0.02). */
const ROAD_Y = 0.02;

/** Ring-buffer capacity for skid scuffs — plenty for several corners of double tracks. */
const SKID_MAX = 512;
/** Trail is short (fades in ~0.6s), so a small pool suffices. */
const TRAIL_MAX = 64;
const TRAIL_LIFE = 0.6;

export interface RaceFx {
  /** InstancedMeshes to mount in the scene (1 under reduced-motion, 2 otherwise). */
  readonly meshes: THREE.Object3D[];
  /** Lay a dark tire scuff flat on the road at a world (x,z). Cheap: one matrix write. */
  dropSkid(x: number, z: number): void;
  /** Add a glowing wake point behind the leader; recoloured to the leader's kart colour. */
  dropTrail(x: number, z: number, colorHex: number): void;
  /** Advance the trail fade. Call once per frame. */
  update(dt: number): void;
  dispose(): void;
}

/**
 * Instanced, screen-budget-friendly race VFX: persistent tire scuffs on hard corners and a
 * glowing wake behind the current leader. Both are a single InstancedMesh (2 draw calls
 * total) so they never threaten the ~150-call in-race budget (see docs/rendering-budget.md).
 *
 * Skid scuffs are small flat squares recycled through a ring buffer — squares need no yaw, so
 * overlapping drops from the two rear wheels read as one continuous smear regardless of the
 * kart's orientation. The leader trail is additive and fades by scaling toward zero, which
 * tapers naturally under additive blending without per-instance alpha.
 *
 * `reducedMotion` drops the animated trail entirely (and its draw call); the static scuffs
 * stay, since a decal that never moves is not "motion".
 */
export function createRaceFx(reducedMotion: boolean): RaceFx {
  const scratch = new THREE.Object3D();

  const skidGeom = new THREE.PlaneGeometry(0.42, 0.42);
  const skidMat = new THREE.MeshBasicMaterial({
    color: 0x090b0f,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    // Bias hard toward the camera (past the road's -2 and curbs' -3) so scuffs never z-fight.
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const skid = new THREE.InstancedMesh(skidGeom, skidMat, SKID_MAX);
  skid.count = 0; // grows as scuffs are dropped, then wraps
  skid.frustumCulled = false; // instances span the whole track, not the mesh's origin bounds
  skid.renderOrder = 1;
  let skidHead = 0;

  const dropSkid = (x: number, z: number): void => {
    scratch.position.set(x, ROAD_Y + 0.012, z);
    scratch.rotation.set(-Math.PI / 2, 0, 0); // lay the +Z-facing plane flat (normal → +Y)
    scratch.scale.setScalar(1);
    scratch.updateMatrix();
    skid.setMatrixAt(skidHead, scratch.matrix);
    skidHead = (skidHead + 1) % SKID_MAX;
    if (skid.count < SKID_MAX) skid.count++;
    skid.instanceMatrix.needsUpdate = true;
  };

  const trailGeom = new THREE.PlaneGeometry(1.2, 1.2);
  const trailMat = new THREE.MeshBasicMaterial({
    // White base so the per-instance colour (material.color × instanceColor) is exact.
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trail = new THREE.InstancedMesh(trailGeom, trailMat, TRAIL_MAX);
  trail.count = TRAIL_MAX;
  trail.frustumCulled = false;
  trail.renderOrder = 2;
  const tpts = Array.from({ length: TRAIL_MAX }, () => ({ x: 0, z: 0, life: 0 }));
  let trailHead = 0;
  const tmpColor = new THREE.Color();

  // Start every trail instance collapsed (invisible) until it's dropped. Seed per-instance
  // colour so multiple wakes (player trail + leader) can share this one mesh (1 draw call).
  scratch.scale.setScalar(0);
  scratch.updateMatrix();
  for (let i = 0; i < TRAIL_MAX; i++) {
    trail.setMatrixAt(i, scratch.matrix);
    trail.setColorAt(i, tmpColor.setHex(0xffffff));
  }
  trail.instanceMatrix.needsUpdate = true;
  if (trail.instanceColor) trail.instanceColor.needsUpdate = true;

  const dropTrail = (x: number, z: number, colorHex: number): void => {
    if (reducedMotion) return;
    const p = tpts[trailHead];
    p.x = x;
    p.z = z;
    p.life = TRAIL_LIFE;
    trail.setColorAt(trailHead, tmpColor.setHex(colorHex));
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
    trailHead = (trailHead + 1) % TRAIL_MAX;
  };

  const update = (dt: number): void => {
    if (reducedMotion) return;
    let dirty = false;
    for (let i = 0; i < TRAIL_MAX; i++) {
      const p = tpts[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = Math.max(0, p.life) / TRAIL_LIFE;
      scratch.position.set(p.x, ROAD_Y + 0.03, p.z);
      scratch.rotation.set(-Math.PI / 2, 0, 0);
      scratch.scale.setScalar(p.life <= 0 ? 0 : 0.35 + t * 1.05);
      scratch.updateMatrix();
      trail.setMatrixAt(i, scratch.matrix);
      dirty = true;
    }
    if (dirty) trail.instanceMatrix.needsUpdate = true;
  };

  return {
    meshes: reducedMotion ? [skid] : [skid, trail],
    dropSkid,
    dropTrail,
    update,
    dispose() {
      skidGeom.dispose();
      skidMat.dispose();
      trailGeom.dispose();
      trailMat.dispose();
      skid.dispose();
      trail.dispose();
    },
  };
}

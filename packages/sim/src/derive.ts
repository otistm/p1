import type { DerivedAttributes, KartStats } from './contracts';

/**
 * Reference kart mass (kg). A kart at this mass is "neutral": heavier karts accelerate a
 * touch slower and shove harder in contact, lighter karts the reverse. Kept in sync with
 * `@grid/content`'s BASE_MASS so an unspecified loadout resolves to the same neutral kart.
 */
export const REF_MASS = 170;

/**
 * Map the five legible ratings to the physics quantities the engine integrates.
 * This is the "legibility backbone": training/drafting a rating visibly changes how
 * the kart drives. Constants are tuned for a ~13..25 m/s field on the default track.
 */
export function derive(stats: KartStats, massOverride?: number): DerivedAttributes {
  const { speed, stamina, power, guts, wit } = stats;
  // Coefficients rebalanced 2026-07-01 (Phase-1 balance pass). Prior tuning left endurance
  // (stamina→energyMax, guts→fadeFloor) worth far more than raw Speed/Power over a 3-lap
  // race, so the Stamina/Guts closer (Atlas) and all-rounder (Vortex) dominated while the
  // Speed front-runner (Blitz) and Power bruiser (Crusher) were non-viable. This pass gives
  // Speed and Power a bit more, softens the energy/fade endurance cliff, and continues the
  // earlier Wit de-weighting. See docs/CHANGELOG-KNOWLEDGE.md and DECISIONS.md.
  return {
    topSpeed: 13 + speed * 0.12 + stamina * 0.018 + power * 0.012,
    accel: 7 + power * 0.1 + wit * 0.02 + guts * 0.03,
    brake: 22 + power * 0.05,
    latGrip: 9.5 + power * 0.095 + wit * 0.05 + guts * 0.02,
    yawGrip: 22 + wit * 0.05,
    energyMax: 65 + stamina * 1.2,
    drainEff: 1 - wit * 0.002,
    fadeFloor: 0.55 + guts * 0.0035,
    judge: 0.58 + wit * 0.0035,
    surge: 1 + guts * 0.0014,
    // Mass comes from the kart's chassis/ballast loadout (threaded via Entrant.mass). When
    // unknown we use the neutral reference so collision impulses/accel stay stable.
    mass: massOverride ?? REF_MASS,
  };
}

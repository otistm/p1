import type { DerivedAttributes, KartStats } from './contracts';

/**
 * Map the five legible ratings to the physics quantities the engine integrates.
 * This is the "legibility backbone": training/drafting a rating visibly changes how
 * the kart drives. Constants are tuned for a ~13..25 m/s field on the default track.
 */
export function derive(stats: KartStats, massOverride?: number): DerivedAttributes {
  const { speed, stamina, power, guts, wit } = stats;
  // Coefficients rebalanced 2026-06-29 after the headless balance run flagged Wit as
  // over-weighted (it had dominated cornering). Power now leads corner grip, Wit is a
  // secondary contributor, and judge/economy lean on Wit more gently. See
  // docs/CHANGELOG-KNOWLEDGE.md and DECISIONS.md.
  return {
    topSpeed: 13 + speed * 0.1 + stamina * 0.02,
    accel: 7 + power * 0.085 + wit * 0.025 + guts * 0.03,
    brake: 22 + power * 0.05,
    latGrip: 9.5 + power * 0.09 + wit * 0.06 + guts * 0.02,
    yawGrip: 22 + wit * 0.05,
    energyMax: 55 + stamina * 1.5,
    drainEff: 1 - wit * 0.002,
    fadeFloor: 0.5 + guts * 0.0045,
    judge: 0.58 + wit * 0.0035,
    surge: 1 + guts * 0.0014,
    // Mass nominally comes from the kart's chassis/ballast loadout. When unknown we use
    // a sensible default so collision impulses are stable.
    mass: massOverride ?? 170,
  };
}

/**
 * Triggered card effects — the deterministic in-sim layer that turns draft cards from flat
 * stat bumps into situational, position/proximity-driven behaviour. See
 * docs/cards-proximity-conditional.md and docs/sim-physics.md ("Card effects + spatial zones").
 *
 * Determinism: this module is pure. Effects read an `EffectContext` (facts the engine derives
 * from kart positions + track each fixed step) and a small mutable `EffectState` (timers), and
 * return a `ModifierBag` (multipliers/overrides) that the kart's integration applies on top of
 * its `DerivedAttributes`. Any randomness arrives via a seeded `Rng` advanced only on fixed
 * steps, so the whole thing is frame-batching invariant.
 */
import type { Rng } from './contracts';

/** Spatial zone sizes (metres / seconds). Shared so cards and context-builders agree. */
export const ZONE = {
  /** Proximity bubble radius. */
  bubble: 3,
  /** Draft column half-width and length. */
  draftHalfWidth: 1.2,
  draftLen: 6,
  /** Clean-air lookahead. */
  cleanAir: 15,
  /** Curvature magnitude above which a track sample counts as "in a corner". */
  cornerCurv: 0.01,
} as const;

/** Phase-1 (implemented) and Phase-2 (scaffolded, inert) effect kinds. */
export const PHASE1_KINDS = [
  'slingshotSiphon',
  'cornerPocket',
  'claustrophobia',
  'paintScraper',
  'cleanAirSupercharger',
  'desperationDraft',
  'vanguardShield',
] as const;

/** Phase-2 kinds need new sim subsystems (heat/tyre/drift/KERS/surface/hazards) — inert today. */
export const PHASE2_KINDS = [
  'redlineGambler',
  'driftChainReaction',
  'conservationist',
  'grooveLock',
  'gutterHook',
  'debrisDodger',
] as const;

export const CARD_EFFECT_KINDS = [...PHASE1_KINDS, ...PHASE2_KINDS] as const;
export type CardEffectKind = (typeof CARD_EFFECT_KINDS)[number];

const PHASE2_SET = new Set<string>(PHASE2_KINDS);
/** True for kinds whose supporting subsystem is not yet implemented (so they no-op). */
export function isPhase2Kind(kind: CardEffectKind): boolean {
  return PHASE2_SET.has(kind);
}

/**
 * A card's in-race effect: a kind plus tunable numeric params (the doc's percentages, etc.).
 * Keeping params as a flat numeric record means tuning/adding a card is a data change; only a
 * brand-new `kind` requires an engine change + a new handler.
 */
export interface CardEffect {
  kind: CardEffectKind;
  params?: Record<string, number>;
}

/** Per-kart, per-tick facts the engine derives from the field + track. */
export interface EffectContext {
  rank: number;
  lap: number;
  laps: number;
  lastLap: boolean;
  /** Track corner state at the kart's current sample. */
  inCorner: boolean;
  /** Sign of the corner's inside (lateral sign), 0 on a straight. */
  cornerInsideSign: number;
  /** Counts of rivals within the proximity bubble. */
  proxTotal: number;
  proxLeft: number;
  proxRight: number;
  proxAhead: number;
  proxBehind: number;
  /** Side with the most open space (-1 left, +1 right). */
  openSide: number;
  /** A rival is side-by-side within the bubble: its side sign (-1/+1), else 0. */
  sideNeighborSign: number;
  /** The rival directly ahead in my draft column, if any. */
  draftTargetId: string | null;
  /** Distance to that rival (m); Infinity when none. */
  draftDistance: number;
  /** Clear lane ahead for 15+ m. */
  cleanAirAhead: boolean;
  /** A rival is drafting me from directly behind. */
  beingDrafted: boolean;
  /** A rival holds the apex (inside line) just ahead in a corner. */
  apexOccupiedAhead: boolean;
  // --- Phase-2 stubs (inert until their subsystems land) ---
  engineHeat: number;
  tireWear: number;
  driftStreak: number;
  onRubberLine: boolean;
  hazardAhead: boolean;
  hazardDistance: number;
}

/** Mutable per-kart effect state (timers). Reset when a kart is (re)placed. */
export interface EffectState {
  draftSeconds: number;
  draftTargetId: string | null;
}

export function newEffectState(): EffectState {
  return { draftSeconds: 0, draftTargetId: null };
}

/** Per-tick modifiers layered onto a kart's derived attributes. */
export interface ModifierBag {
  topSpeedMult: number;
  accelMult: number;
  latGripMult: number;
  /** Steering-authority (yaw rate) multiplier — <1 dulls turn-in (drift penalty). */
  steerAuthorityMult: number;
  /** Metres added to the lateral racing-line target (push toward a side). */
  lateralBias: number;
  /** 0..1 pull of the lateral target back toward track centre (defensive line). */
  centerPull: number;
  /** Collision radius multiplier (wider hit box). */
  collisionRadiusMult: number;
  /** Collision impulse multiplier when this kart contacts another. */
  impactForceMult: number;
}

export function defaultBag(): ModifierBag {
  return {
    topSpeedMult: 1,
    accelMult: 1,
    latGripMult: 1,
    steerAuthorityMult: 1,
    lateralBias: 0,
    centerPull: 0,
    collisionRadiusMult: 1,
    impactForceMult: 1,
  };
}

const p = (e: CardEffect, key: string, dflt: number): number => e.params?.[key] ?? dflt;

/**
 * Evaluate all of a kart's effects for this tick. Mutates `state` (draft timer) and returns the
 * accumulated modifier bag. Pure given (effects, ctx, state, dt, rng).
 *
 * `fired` is an optional render-only sink: when provided, the kind of every effect that actually
 * *applied* this tick is pushed onto it. It never influences the sim (determinism is untouched);
 * the renderer reads it purely to pop "tuning procced" feedback.
 */
export function evaluateEffects(
  effects: CardEffect[],
  ctx: EffectContext,
  state: EffectState,
  dt: number,
  _rng: Rng,
  fired?: CardEffectKind[],
): ModifierBag {
  const bag = defaultBag();
  if (effects.length === 0) return bag;

  // Maintain the continuous-draft timer (Slingshot Siphon).
  if (ctx.draftTargetId && ctx.draftDistance <= ZONE.draftLen) {
    if (state.draftTargetId === ctx.draftTargetId) state.draftSeconds += dt;
    else {
      state.draftTargetId = ctx.draftTargetId;
      state.draftSeconds = 0;
    }
  } else {
    state.draftTargetId = null;
    state.draftSeconds = 0;
  }

  for (const e of effects) {
    if (isPhase2Kind(e.kind)) continue; // subsystem not implemented yet
    switch (e.kind) {
      case 'slingshotSiphon': {
        const minSec = p(e, 'minDraftSeconds', 1.5);
        if (!ctx.inCorner && state.draftTargetId && state.draftSeconds >= minSec) {
          bag.accelMult *= 1 + p(e, 'accelPct', 15) / 100;
          fired?.push(e.kind);
        }
        break;
      }
      case 'cornerPocket': {
        if (ctx.inCorner && ctx.apexOccupiedAhead) {
          bag.latGripMult *= 1 + p(e, 'exitGripPct', 15) / 100;
          // Take the outer line (opposite the corner's inside).
          bag.lateralBias += -ctx.cornerInsideSign * p(e, 'outerMeters', 3);
          fired?.push(e.kind);
        }
        break;
      }
      case 'claustrophobia': {
        if (ctx.proxTotal >= p(e, 'bubbleCount', 3)) {
          const sp = 1 + p(e, 'speedPct', 10) / 100;
          bag.topSpeedMult *= sp;
          bag.accelMult *= sp;
          bag.steerAuthorityMult *= 1 - p(e, 'driftPenaltyPct', 15) / 100;
          bag.lateralBias += ctx.openSide * 3;
          fired?.push(e.kind);
        }
        break;
      }
      case 'paintScraper': {
        if (ctx.inCorner && ctx.sideNeighborSign !== 0) {
          bag.impactForceMult *= 1 + p(e, 'impactPct', 25) / 100;
          bag.lateralBias += ctx.sideNeighborSign * p(e, 'leanMeters', 1);
          fired?.push(e.kind);
        }
        break;
      }
      case 'cleanAirSupercharger': {
        if (ctx.rank === 1 && ctx.cleanAirAhead) {
          bag.topSpeedMult *= 1 + p(e, 'topPct', 8) / 100;
          bag.latGripMult *= 1 - p(e, 'stabilityPct', 5) / 100;
          fired?.push(e.kind);
        }
        break;
      }
      case 'desperationDraft': {
        const range = ZONE.draftLen * p(e, 'rangeMult', 3);
        if (ctx.lastLap && ctx.rank >= 4 && ctx.draftTargetId && ctx.draftDistance <= range) {
          bag.topSpeedMult *= 1 + p(e, 'topPct', 12) / 100;
          bag.accelMult *= 1 + p(e, 'topPct', 12) / 200;
          fired?.push(e.kind);
        }
        break;
      }
      case 'vanguardShield': {
        if (ctx.rank <= 3 && ctx.beingDrafted) {
          bag.collisionRadiusMult *= 1 + p(e, 'boxPct', 20) / 100;
          bag.centerPull = Math.max(bag.centerPull, p(e, 'centerPull', 0.6));
          fired?.push(e.kind);
        }
        break;
      }
      default:
        break;
    }
  }
  return bag;
}

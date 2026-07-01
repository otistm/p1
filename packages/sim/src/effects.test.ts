import { describe, it, expect } from 'vitest';
import {
  ZONE,
  defaultBag,
  evaluateEffects,
  isPhase2Kind,
  newEffectState,
  type CardEffect,
  type EffectContext,
} from './effects';
import { makeRng } from './rng';

function baseCtx(over: Partial<EffectContext> = {}): EffectContext {
  return {
    rank: 5,
    lap: 0,
    laps: 3,
    lastLap: false,
    inCorner: false,
    cornerInsideSign: 0,
    proxTotal: 0,
    proxLeft: 0,
    proxRight: 0,
    proxAhead: 0,
    proxBehind: 0,
    openSide: 1,
    sideNeighborSign: 0,
    draftTargetId: null,
    draftDistance: Infinity,
    cleanAirAhead: false,
    beingDrafted: false,
    apexOccupiedAhead: false,
    engineHeat: 0,
    tireWear: 0,
    driftStreak: 0,
    onRubberLine: false,
    hazardAhead: false,
    hazardDistance: Infinity,
    ...over,
  };
}

const rng = makeRng(1);
const evalOnce = (effects: CardEffect[], ctx: EffectContext) =>
  evaluateEffects(effects, ctx, newEffectState(), 1 / 60, rng);

describe('evaluateEffects — neutral cases', () => {
  it('returns the default bag with no effects', () => {
    expect(evalOnce([], baseCtx())).toEqual(defaultBag());
  });

  it('treats Phase-2 kinds as inert', () => {
    expect(isPhase2Kind('redlineGambler')).toBe(true);
    expect(evalOnce([{ kind: 'redlineGambler' }], baseCtx())).toEqual(defaultBag());
  });
});

describe('Slingshot Siphon', () => {
  const card: CardEffect = { kind: 'slingshotSiphon', params: { accelPct: 15, minDraftSeconds: 1.5 } };

  it('fires only after a sustained draft on a straight', () => {
    const state = newEffectState();
    const ctx = baseCtx({ draftTargetId: 'x', draftDistance: 4, inCorner: false });
    // First tick registers the target (timer starts at 0) — no boost yet.
    const first = evaluateEffects([card], ctx, state, 1.6, rng);
    expect(first.accelMult).toBeCloseTo(1, 5);
    // Second tick crosses the 1.5s threshold.
    const second = evaluateEffects([card], ctx, state, 1.6, rng);
    expect(second.accelMult).toBeCloseTo(1.15, 5);
  });

  it('does not fire in a corner', () => {
    const state = newEffectState();
    const ctx = baseCtx({ draftTargetId: 'x', draftDistance: 4, inCorner: true });
    evaluateEffects([card], ctx, state, 1.6, rng);
    const out = evaluateEffects([card], ctx, state, 1.6, rng);
    expect(out.accelMult).toBeCloseTo(1, 5);
  });

  it('resets the timer when the draft is lost', () => {
    const state = newEffectState();
    const drafting = baseCtx({ draftTargetId: 'x', draftDistance: 4 });
    evaluateEffects([card], drafting, state, 1.6, rng);
    evaluateEffects([card], drafting, state, 1.6, rng);
    // Lose the tow (no target) — timer clears.
    evaluateEffects([card], baseCtx({ draftTargetId: null }), state, 1.6, rng);
    expect(state.draftSeconds).toBe(0);
  });
});

describe('Corner Pocket', () => {
  it('takes the outer line with extra exit grip when the apex is occupied', () => {
    const out = evalOnce(
      [{ kind: 'cornerPocket', params: { exitGripPct: 15, outerMeters: 3 } }],
      baseCtx({ inCorner: true, apexOccupiedAhead: true, cornerInsideSign: 1 }),
    );
    expect(out.latGripMult).toBeCloseTo(1.15, 5);
    expect(out.lateralBias).toBeCloseTo(-3, 5); // opposite the inside sign
  });

  it('does nothing if the apex is clear', () => {
    const out = evalOnce(
      [{ kind: 'cornerPocket' }],
      baseCtx({ inCorner: true, apexOccupiedAhead: false, cornerInsideSign: 1 }),
    );
    expect(out).toEqual(defaultBag());
  });
});

describe('Claustrophobia', () => {
  it('jumps to open space and trades steering for speed in a crowd', () => {
    const out = evalOnce(
      [{ kind: 'claustrophobia', params: { speedPct: 10, driftPenaltyPct: 15, bubbleCount: 3 } }],
      baseCtx({ proxTotal: 3, openSide: -1 }),
    );
    expect(out.topSpeedMult).toBeCloseTo(1.1, 5);
    expect(out.steerAuthorityMult).toBeCloseTo(0.85, 5);
    expect(out.lateralBias).toBeCloseTo(-3, 5);
  });
});

describe('Paint-Scraper', () => {
  it('leans into a side-by-side rival with a harder shove mid-corner', () => {
    const out = evalOnce(
      [{ kind: 'paintScraper', params: { impactPct: 25, leanMeters: 1 } }],
      baseCtx({ inCorner: true, sideNeighborSign: 1 }),
    );
    expect(out.impactForceMult).toBeCloseTo(1.25, 5);
    expect(out.lateralBias).toBeCloseTo(1, 5);
  });
});

describe('Clean-Air Supercharger', () => {
  it('boosts the leader in clean air', () => {
    const out = evalOnce(
      [{ kind: 'cleanAirSupercharger', params: { topPct: 8, stabilityPct: 5 } }],
      baseCtx({ rank: 1, cleanAirAhead: true }),
    );
    expect(out.topSpeedMult).toBeCloseTo(1.08, 5);
    expect(out.latGripMult).toBeCloseTo(0.95, 5);
  });

  it('does nothing outside the lead', () => {
    const out = evalOnce(
      [{ kind: 'cleanAirSupercharger' }],
      baseCtx({ rank: 2, cleanAirAhead: true }),
    );
    expect(out).toEqual(defaultBag());
  });
});

describe('Desperation Draft', () => {
  const card: CardEffect = { kind: 'desperationDraft', params: { topPct: 12, rangeMult: 3 } };

  it('fires from the back on the final lap within the extended range', () => {
    const out = evalOnce(
      [card],
      baseCtx({ lastLap: true, rank: 4, draftTargetId: 'x', draftDistance: ZONE.draftLen * 3 - 1 }),
    );
    expect(out.topSpeedMult).toBeCloseTo(1.12, 5);
  });

  it('does nothing when not on the final lap', () => {
    const out = evalOnce(
      [card],
      baseCtx({ lastLap: false, rank: 4, draftTargetId: 'x', draftDistance: 5 }),
    );
    expect(out).toEqual(defaultBag());
  });
});

describe('Vanguard Shield', () => {
  it('widens the hit box and centres up when defended from behind in the top-3', () => {
    const out = evalOnce(
      [{ kind: 'vanguardShield', params: { boxPct: 20, centerPull: 0.6 } }],
      baseCtx({ rank: 2, beingDrafted: true }),
    );
    expect(out.collisionRadiusMult).toBeCloseTo(1.2, 5);
    expect(out.centerPull).toBeCloseTo(0.6, 5);
  });
});

describe('fired sink (render-only proc feedback)', () => {
  it('reports the kinds that actually applied, and stays silent otherwise', () => {
    // A firing effect (leader in clean air) reports its kind…
    const firing: string[] = [];
    evaluateEffects(
      [{ kind: 'cleanAirSupercharger' }],
      baseCtx({ rank: 1, cleanAirAhead: true }),
      newEffectState(),
      1 / 60,
      rng,
      firing,
    );
    expect(firing).toEqual(['cleanAirSupercharger']);

    // …while the same effect out of the lead reports nothing (no false positives).
    const quiet: string[] = [];
    evaluateEffects(
      [{ kind: 'cleanAirSupercharger' }],
      baseCtx({ rank: 4, cleanAirAhead: true }),
      newEffectState(),
      1 / 60,
      rng,
      quiet,
    );
    expect(quiet).toEqual([]);
  });

  it('collects every simultaneously-active kind', () => {
    const fired: string[] = [];
    evaluateEffects(
      [
        { kind: 'paintScraper' },
        { kind: 'claustrophobia', params: { bubbleCount: 3 } },
      ],
      baseCtx({ inCorner: true, sideNeighborSign: 1, proxTotal: 3 }),
      newEffectState(),
      1 / 60,
      rng,
      fired,
    );
    expect(new Set(fired)).toEqual(new Set(['paintScraper', 'claustrophobia']));
  });
});

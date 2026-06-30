/**
 * "The experience" harness. Runs many races the way the game assembles them (player vs a
 * field of scaled rival archetypes, across the 3 season rounds) and measures what the race
 * actually FEELS like: placements, finish-line gaps, photo finishes, lead changes, and
 * overtakes. Prints one JSON blob (a narrated season + an aggregate sweep) for summarizing.
 *
 *   npx tsx tools/diag/season.ts
 */
import {
  RaceEngine,
  FIXED_DT,
  hashSeed,
  isPhase2Kind,
  makeRng,
  clamp,
  STAT_KEYS,
  type Entrant,
  type RaceConfig,
  type KartStats,
} from '@grid/sim';
import {
  loadoutToStats,
  SUNSET_DERBY,
  ROUNDS,
  RIVAL_ARCHETYPES,
  STARTER_LOADOUT,
  STARTER_CARD_IDS,
  CARDS,
  CARDS_BY_ID,
  type Loadout,
} from '@grid/content';
import { initialSeason, beginRound, applyTraining, computeRaceStats, effectsFromCardIds } from '@grid/game';
import { rollDraft } from '@grid/game';

const overall = (s: KartStats): number => STAT_KEYS.reduce((a, k) => a + s[k], 0);

const STAT_TO_TRAINING: Record<string, string> = {
  speed: 'speed',
  power: 'power',
  wit: 'corner',
  stamina: 'endure',
  guts: 'grit',
};

/**
 * Play one realistic season turn-by-turn: each turn rest if spent, else train the weakest
 * current stat; draft the highest-value card each round. Returns the player's final race
 * stats for the requested round (training + cards accumulate across rounds).
 */
function developedStatsByRound(loadout: Loadout, seed: number): KartStats[] {
  let season = initialSeason();
  const cards: string[] = [];
  const base = loadoutToStats(loadout).stats;
  const out: KartStats[] = [];

  for (let ri = 0; ri < ROUNDS.length; ri++) {
    season = beginRound(season, ri);

    // Draft one card: the offered card with the largest net stat swing.
    const offer = rollDraft(hashSeed(seed, ri, 53), STARTER_CARD_IDS, 3);
    let bestId = offer[0];
    let bestVal = -Infinity;
    for (const id of offer) {
      const m = CARDS_BY_ID[id].mods;
      const v = STAT_KEYS.reduce((a, k) => a + (m[k] ?? 0), 0);
      if (v > bestVal) {
        bestVal = v;
        bestId = id;
      }
    }
    cards.push(bestId);

    // Train every turn.
    let turn = 0;
    while (season.turnsLeft > 0) {
      const cur = computeRaceStats(loadout, season.trainedStats, cards).stats;
      let lowK = STAT_KEYS[0];
      for (const k of STAT_KEYS) if (cur[k] < cur[lowK]) lowK = k;
      const trainingId = season.energy < 35 ? 'rest' : STAT_TO_TRAINING[lowK];
      season = applyTraining(season, trainingId, makeRng(hashSeed(seed, ri * 31 + turn, 17))).season;
      turn++;
    }
    out.push(computeRaceStats(loadout, season.trainedStats, cards).stats);
  }
  void base;
  return out;
}

// Two player builds, both buildable from the free starter parts.
const BUILDS: Record<string, Loadout> = {
  Stock: { ...STARTER_LOADOUT },
  Tuned: {
    chassis: 'chassis.stock',
    engine: 'engine.stock',
    tires: 'tires.soft',
    brakes: 'brakes.stock',
    gearing: 'gearing.tall',
    aero: 'aero.lowdrag',
    ballast: 'ballast.stock',
  },
};

/** Mirror of game `makeOpponents` for a fresh save (no ghosts): scaled rival archetypes. */
function opponents(roundIdx: number, seed: number): Entrant[] {
  const rng = makeRng(hashSeed(seed, roundIdx, 7));
  const scale = ROUNDS[roundIdx].rivalScale;
  return RIVAL_ARCHETYPES.map((a) => {
    const st = {} as KartStats;
    for (const k of STAT_KEYS) st[k] = clamp(a.stats[k] * (1 + scale) + (rng() * 6 - 3), 5, 120);
    return { id: `rival-${a.id}`, name: a.name, colorHex: 0xffffff, stats: st };
  });
}

function config(loadout: Loadout, roundIdx: number, seed: number): RaceConfig {
  const { stats } = loadoutToStats(loadout);
  const player: Entrant = { id: 'player', name: 'You', colorHex: 0x2bd9ff, stats, isPlayer: true };
  const track = { ...SUNSET_DERBY, laps: ROUNDS[roundIdx].laps };
  return { track, seed, entrants: [player, ...opponents(roundIdx, seed)] };
}

// --- Effects variant (mirrors game `makeOpponents`/`assembleRaceConfig`) -------
const EFFECT_CARD_IDS: string[] = CARDS.filter(
  (c) => c.effect && !isPhase2Kind(c.effect.kind),
).map((c) => c.id);
// A representative conditional deck the player might draft.
const PLAYER_EFFECT_CARDS = ['card.siphon', 'card.cornerpocket', 'card.vanguard'];

/** Rivals each draw one effect card off a dedicated seeded stream (stats unchanged). */
function opponentsEff(roundIdx: number, seed: number): Entrant[] {
  const effRng = makeRng(hashSeed(seed, roundIdx, 0xeffec7));
  return opponents(roundIdx, seed).map((o) => ({
    ...o,
    effects:
      EFFECT_CARD_IDS.length > 0
        ? effectsFromCardIds([EFFECT_CARD_IDS[Math.floor(effRng() * EFFECT_CARD_IDS.length)]])
        : [],
  }));
}

function configEff(loadout: Loadout, roundIdx: number, seed: number): RaceConfig {
  const { stats } = loadoutToStats(loadout);
  const player: Entrant = {
    id: 'player',
    name: 'You',
    colorHex: 0x2bd9ff,
    stats,
    isPlayer: true,
    effects: effectsFromCardIds(PLAYER_EFFECT_CARDS),
  };
  const track = { ...SUNSET_DERBY, laps: ROUNDS[roundIdx].laps };
  return { track, seed, entrants: [player, ...opponentsEff(roundIdx, seed)] };
}

interface RaceObs {
  playerRank: number;
  field: number;
  winnerId: string;
  winnerName: string;
  playerGap: number; // s behind winner (0 if won)
  p1p2Gap: number; // winner margin (s)
  leadChanges: number;
  overtakes: number;
  leaderShare: Record<string, number>; // fraction of race each id led
  order: { id: string; name: string; rank: number; finishTime: number; gap: number }[];
}

/** Step a race to completion, sampling order ~4x/sec to count drama metrics. */
function observe(cfg: RaceConfig): RaceObs {
  const eng = new RaceEngine(cfg);
  eng.start();
  const ids = eng.racers.map((r) => r.id);
  // Per-pair relative order sign, to count order flips (overtakes) robustly.
  const pairSign = new Map<string, number>();
  const orderByRank = () => [...eng.racers].sort((a, b) => a.rank - b.rank).map((r) => r.id);
  const snapPairs = (order: string[]) => {
    const pos = new Map(order.map((id, i) => [id, i]));
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const key = ids[i] + '|' + ids[j];
        pairSign.set(key, Math.sign(pos.get(ids[i])! - pos.get(ids[j])!));
      }
  };
  snapPairs(orderByRank());

  let overtakes = 0;
  let leadChanges = 0;
  let lastLeader = orderByRank()[0];
  const leaderTicks: Record<string, number> = {};
  let samples = 0;

  let t = 0;
  let nextSample = 0;
  let guard = 0;
  while (!eng.over && guard++ < 500_000) {
    eng.step(FIXED_DT);
    t += FIXED_DT;
    if (t >= nextSample) {
      nextSample += 0.25;
      const order = orderByRank();
      const pos = new Map(order.map((id, i) => [id, i]));
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const key = ids[i] + '|' + ids[j];
          const sign = Math.sign(pos.get(ids[i])! - pos.get(ids[j])!);
          if (sign !== 0 && sign !== pairSign.get(key)) {
            if (pairSign.get(key) !== 0) overtakes++;
            pairSign.set(key, sign);
          }
        }
      const leader = order[0];
      if (leader !== lastLeader) {
        leadChanges++;
        lastLeader = leader;
      }
      leaderTicks[leader] = (leaderTicks[leader] ?? 0) + 1;
      samples++;
    }
  }

  const res = eng.result()!;
  const winner = res.order[0];
  const second = res.order[1];
  const player = res.order.find((r) => r.id === 'player')!;
  const order = res.order.map((r) => ({
    id: r.id,
    name: r.name,
    rank: r.rank,
    finishTime: r.finishTime,
    gap: r.finishTime - winner.finishTime,
  }));
  const leaderShare: Record<string, number> = {};
  for (const [id, n] of Object.entries(leaderTicks)) leaderShare[id] = n / Math.max(samples, 1);

  return {
    playerRank: player.rank,
    field: res.order.length,
    winnerId: winner.id,
    winnerName: winner.name,
    playerGap: player.finishTime - winner.finishTime,
    p1p2Gap: second ? second.finishTime - winner.finishTime : 0,
    leadChanges,
    overtakes,
    leaderShare,
    order,
  };
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// --- Aggregate sweep ----------------------------------------------------------
const N = 250;
const sweep: Record<string, unknown[]> = {};
for (const [buildName, loadout] of Object.entries(BUILDS)) {
  const rows = ROUNDS.map((rdef, ri) => {
    let wins = 0;
    let podiums = 0;
    let placeSum = 0;
    let p1p2Sum = 0;
    let photo = 0;
    let leadSum = 0;
    let otSum = 0;
    let gapSum = 0;
    for (let s = 0; s < N; s++) {
      const o = observe(config(loadout, ri, 4000 + s * 17));
      if (o.playerRank === 1) wins++;
      if (o.playerRank <= 3) podiums++;
      placeSum += o.playerRank;
      p1p2Sum += o.p1p2Gap;
      if (o.p1p2Gap < 0.2) photo++;
      leadSum += o.leadChanges;
      otSum += o.overtakes;
      gapSum += o.playerGap;
    }
    return {
      round: rdef.name,
      rivalScale: rdef.rivalScale,
      winPct: round((wins / N) * 100, 1),
      podiumPct: round((podiums / N) * 100, 1),
      avgPlace: round(placeSum / N),
      avgWinnerMarginS: round(p1p2Sum / N),
      photoFinishPct: round((photo / N) * 100, 1),
      avgLeadChanges: round(leadSum / N, 1),
      avgOvertakes: round(otSum / N, 1),
      avgPlayerGapS: round(gapSum / N),
    };
  });
  sweep[buildName] = rows;
}

// Developed profile: Stock parts, but trained + carded through a real season each seed.
{
  const rows = ROUNDS.map((rdef, ri) => {
    let wins = 0;
    let podiums = 0;
    let placeSum = 0;
    let photo = 0;
    let gapSum = 0;
    let ovSum = 0;
    for (let s = 0; s < N; s++) {
      const seed = 4000 + s * 17;
      const stats = developedStatsByRound(BUILDS.Stock, seed)[ri];
      const player: Entrant = { id: 'player', name: 'You', colorHex: 0x2bd9ff, stats, isPlayer: true };
      const track = { ...SUNSET_DERBY, laps: rdef.laps };
      const o = observe({ track, seed, entrants: [player, ...opponents(ri, seed)] });
      if (o.playerRank === 1) wins++;
      if (o.playerRank <= 3) podiums++;
      placeSum += o.playerRank;
      if (o.p1p2Gap < 0.2) photo++;
      gapSum += o.playerGap;
      ovSum += overall(stats);
    }
    return {
      round: rdef.name,
      rivalScale: rdef.rivalScale,
      avgPlayerOverall: round(ovSum / N, 0),
      winPct: round((wins / N) * 100, 1),
      podiumPct: round((podiums / N) * 100, 1),
      avgPlace: round(placeSum / N),
      photoFinishPct: round((photo / N) * 100, 1),
      avgPlayerGapS: round(gapSum / N),
    };
  });
  sweep['Developed'] = rows;
}

// --- Effects balance pass: same seeds, effects OFF vs ON ----------------------
// Confirms triggered effects stay a net-neutral trade-off (small win delta) while adding
// race drama (overtakes), and don't worsen the known field-over-wins skew.
{
  const rows = ROUNDS.map((rdef, ri) => {
    let offWins = 0;
    let onWins = 0;
    let offPod = 0;
    let onPod = 0;
    let offOt = 0;
    let onOt = 0;
    let offGap = 0;
    let onGap = 0;
    for (let s = 0; s < N; s++) {
      const seed = 4000 + s * 17;
      const off = observe(config(BUILDS.Stock, ri, seed));
      const on = observe(configEff(BUILDS.Stock, ri, seed));
      if (off.playerRank === 1) offWins++;
      if (on.playerRank === 1) onWins++;
      if (off.playerRank <= 3) offPod++;
      if (on.playerRank <= 3) onPod++;
      offOt += off.overtakes;
      onOt += on.overtakes;
      offGap += off.playerGap;
      onGap += on.playerGap;
    }
    return {
      round: rdef.name,
      winPctOff: round((offWins / N) * 100, 1),
      winPctOn: round((onWins / N) * 100, 1),
      podiumPctOff: round((offPod / N) * 100, 1),
      podiumPctOn: round((onPod / N) * 100, 1),
      avgOvertakesOff: round(offOt / N, 1),
      avgOvertakesOn: round(onOt / N, 1),
      avgPlayerGapSOff: round(offGap / N),
      avgPlayerGapSOn: round(onGap / N),
    };
  });
  sweep['EffectsBalance'] = rows;
}

// --- Narrated season (Stock build, one fixed seed) ----------------------------
const seasonSeed = 0x5eed01;
const narrated = ROUNDS.map((rdef, ri) => {
  const o = observe(config(BUILDS.Stock, ri, hashSeed(seasonSeed, ri, 977)));
  const topLeader = Object.entries(o.leaderShare).sort((a, b) => b[1] - a[1])[0];
  return {
    round: rdef.name,
    field: o.field,
    playerRank: o.playerRank,
    winner: o.winnerName,
    winnerMarginS: round(o.p1p2Gap),
    playerGapS: round(o.playerGap),
    leadChanges: o.leadChanges,
    overtakes: o.overtakes,
    mostLed: topLeader ? `${topLeader[0]} (${round(topLeader[1] * 100, 0)}%)` : 'n/a',
    order: o.order.map((r) => ({ rank: r.rank, name: r.name, gap: round(r.gap) })),
  };
});

// Narrated developed season (one fixed seed): the realistic player arc.
const devNarrated = (() => {
  const seed = hashSeed(seasonSeed, 0, 977);
  const statsByRound = developedStatsByRound(BUILDS.Stock, seed);
  return ROUNDS.map((rdef, ri) => {
    const stats = statsByRound[ri];
    const player: Entrant = { id: 'player', name: 'You', colorHex: 0x2bd9ff, stats, isPlayer: true };
    const track = { ...SUNSET_DERBY, laps: rdef.laps };
    const o = observe({ track, seed, entrants: [player, ...opponents(ri, seed)] });
    return {
      round: rdef.name,
      playerOverall: overall(stats),
      playerRank: o.playerRank,
      winner: o.winnerName,
      winnerMarginS: round(o.p1p2Gap),
      playerGapS: round(o.playerGap),
      leadChanges: o.leadChanges,
      overtakes: o.overtakes,
      order: o.order.map((r) => ({ rank: r.rank, name: r.name, gap: round(r.gap) })),
    };
  });
})();

const playerStats = Object.fromEntries(
  Object.entries(BUILDS).map(([n, l]) => {
    const { stats } = loadoutToStats(l);
    return [n, { ...stats, overall: overall(stats) }];
  }),
);

console.log(JSON.stringify({ N, playerStats, sweep, narrated, devNarrated }, null, 2));

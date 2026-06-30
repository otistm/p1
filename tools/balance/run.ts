/**
 * Headless balance simulator. Resolves many deterministic races across the rival
 * archetypes and prints win-rate / average-finish tables. Use after any change to
 * `derive`, the physics, or content tuning.
 *
 *   npm run balance              # default: archetypes head-to-head
 */
import { RaceEngine, type Entrant, type RaceConfig } from '@grid/sim';
import { RIVAL_ARCHETYPES, SUNSET_DERBY } from '@grid/content';

const RACES = 2000;

function makeField(): Entrant[] {
  return RIVAL_ARCHETYPES.map((a, i) => ({
    id: a.id,
    name: a.name,
    colorHex: 0xffffff + i,
    stats: { ...a.stats },
  }));
}

function run(): void {
  const wins = new Map<string, number>();
  const placeSum = new Map<string, number>();
  for (const a of RIVAL_ARCHETYPES) {
    wins.set(a.id, 0);
    placeSum.set(a.id, 0);
  }

  for (let s = 0; s < RACES; s++) {
    const config: RaceConfig = { track: SUNSET_DERBY, seed: 10_000 + s, entrants: makeField() };
    const res = RaceEngine.resolve(config);
    for (const row of res.order) {
      placeSum.set(row.id, (placeSum.get(row.id) ?? 0) + row.rank);
      if (row.rank === 1) wins.set(row.id, (wins.get(row.id) ?? 0) + 1);
    }
  }

  const rows = RIVAL_ARCHETYPES.map((a) => ({
    name: a.name,
    winPct: ((wins.get(a.id) ?? 0) / RACES) * 100,
    avgPlace: (placeSum.get(a.id) ?? 0) / RACES,
  })).sort((x, y) => y.winPct - x.winPct);

  console.log(`\nP1 — balance report  (${RACES} races on ${SUNSET_DERBY.name})\n`);
  console.log('  archetype     win%    avg place');
  console.log('  ---------------------------------');
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(10)}  ${r.winPct.toFixed(1).padStart(5)}    ${r.avgPlace.toFixed(2)}`,
    );
  }
  console.log('');
}

run();

/**
 * Race ranking diagnostic. Builds a field with a deliberately WEAK player and strong
 * rivals, then steps the engine and logs the live leaderboard (by rank) alongside each
 * racer's accumulated progress + an independent absolute-arc position derived from (x,z).
 * If the rank order disagrees with the on-track arc order, that's the "won when they
 * didn't" bug.
 *
 *   npx tsx tools/diag/rank.ts
 */
import { RaceEngine, FIXED_DT, Track, type Entrant, type RaceConfig } from '@grid/sim';
import { SUNSET_DERBY } from '@grid/content';

function field(): Entrant[] {
  return [
    { id: 'player', name: 'PLAYER(weak)', colorHex: 1, isPlayer: true, stats: { speed: 20, stamina: 20, power: 20, guts: 20, wit: 20 } },
    { id: 'r1', name: 'Rival-A', colorHex: 2, stats: { speed: 70, stamina: 70, power: 70, guts: 70, wit: 70 } },
    { id: 'r2', name: 'Rival-B', colorHex: 3, stats: { speed: 75, stamina: 65, power: 72, guts: 60, wit: 68 } },
    { id: 'r3', name: 'Rival-C', colorHex: 4, stats: { speed: 68, stamina: 72, power: 66, guts: 70, wit: 64 } },
  ];
}

const cfg: RaceConfig = { track: { ...SUNSET_DERBY, laps: 2 }, seed: 1234, entrants: field() };
const track = new Track(cfg.track);

const eng = new RaceEngine(cfg);
eng.start();

let t = 0;
let nextLog = 0;
const hints = new Map<string, number>();
for (const r of eng.racers) hints.set(r.id, r.idx);

while (!eng.over && t < 600) {
  eng.step(FIXED_DT);
  t += FIXED_DT;
  if (t >= nextLog) {
    nextLog += 3;
    const ranked = [...eng.racers].sort((a, b) => a.rank - b.rank);
    const rows = ranked.map((r) => {
      const hint = hints.get(r.id)!;
      const pr = track.project(r.x, r.z, hint);
      hints.set(r.id, pr.idx);
      return `P${r.rank} ${r.name.padEnd(13)} cp=${r.prog.toFixed(1).padStart(7)} lap=${r.lap} arcIdx=${pr.idx.toString().padStart(3)} lat=${pr.lateral.toFixed(1)}`;
    });
    console.log(`t=${t.toFixed(1)}\n  ` + rows.join('\n  '));
  }
}

console.log('\n=== FINAL ===');
const res = eng.result()!;
for (const row of res.order) {
  console.log(`P${row.rank} ${row.name.padEnd(13)} finished=${row.finished} finishTime=${row.finishTime.toFixed(2)}`);
}

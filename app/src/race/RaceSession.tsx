import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RaceEngine, FIXED_DT } from '@grid/sim';
import { useGame } from '@grid/game';
import { getAudio } from '@grid/audio';
import type { BoardRow, TuningStatus, RaceSituation, LivePerf } from '@grid/ui';

interface HudData {
  lap: number;
  laps: number;
  speedKmh: number;
  /** Speed as a fraction of the player's own top speed (0..~1) — drives the speed FX. */
  speedFrac: number;
  stamina: number;
  board: BoardRow[];
  /** Player's staged tuning effects + whether each is applying right now. */
  tuning: TuningStatus[];
  /** Live facts that gate those effects; null when the player staged no tuning. */
  situation: RaceSituation | null;
  /** Live performance multipliers (tuning bag + stamina fade) for the vitals gauges. */
  perf: LivePerf;
}

interface RaceSessionValue {
  engine: RaceEngine | null;
  running: boolean;
  countdown: string | null;
  /** Playback rate for the deterministic clock — 1× or 2× (does not change the result). */
  raceSpeed: number;
  setRaceSpeed: (n: number) => void;
  /** Fast-forward the sim to the finish and jump straight to results. */
  skipRace: () => void;
}

const EMPTY_HUD: HudData = {
  lap: 0,
  laps: 3,
  speedKmh: 0,
  speedFrac: 0,
  stamina: 1,
  board: [],
  tuning: [],
  situation: null,
  perf: { speedFrac: 0, gripLoad: 0, topMult: 1, accelMult: 1, gripMult: 1, steerMult: 1, fade: 1 },
};

// The HUD lives in its own context, deliberately separate from the engine/running session.
// HUD state updates ~15Hz; if it shared a context with the engine, every consumer (incl.
// the 3D RaceField) would re-render 15x/sec — which rebuilt all kart meshes and made the
// karts visibly jump. Keeping them split means the render-driving components only re-render
// when the engine or countdown actually changes.
const RaceSessionContext = createContext<RaceSessionValue>({
  engine: null,
  running: false,
  countdown: null,
  raceSpeed: 1,
  setRaceSpeed: () => {},
  skipRace: () => {},
});
const RaceHudContext = createContext<HudData>(EMPTY_HUD);

export const useRaceSession = () => useContext(RaceSessionContext);
export const useRaceHud = () => useContext(RaceHudContext);

function computeHud(engine: RaceEngine): HudData {
  const racers = engine.racers;
  const player = racers.find((r) => r.isPlayer) ?? racers[0];
  const ranked = [...racers].sort((a, b) => a.rank - b.rank);
  const leader = ranked[0];
  const leadProg = leader?.prog ?? 0;
  // Convert each kart's along-track distance behind the leader into a time gap using ONE
  // shared pace, not each kart's own instantaneous speed. Dividing by per-kart speed made
  // the gaps non-monotonic (a lower-placed kart in a fast moment could read as "closer"
  // than the kart ahead of it), which looked like the board was wrong. A shared pace keeps
  // the gaps strictly increasing down the order, matching the positions. Floored so a slow
  // corner doesn't blow the numbers up.
  const pace = Math.max(leader?.speed ?? 0, 12);
  const board: BoardRow[] = ranked.map((r) => ({
    pos: r.rank,
    name: r.name,
    colorHex: r.colorHex,
    me: r.isPlayer,
    gap:
      r === leader
        ? ''
        : r.finished
          ? 'fin'
          : `-${Math.max(0, (leadProg - r.prog) / pace).toFixed(1)}s`,
  }));
  // Tuning readout: the player's staged effects (deduped) + whether each is applying this tick,
  // plus the live situational facts that trigger them. Only meaningful when tuning is staged.
  const activeSet = new Set<string>(player.activeEffects);
  const seen = new Set<string>();
  const tuning: TuningStatus[] = [];
  for (const e of player.effects) {
    if (seen.has(e.kind)) continue;
    seen.add(e.kind);
    tuning.push({ kind: e.kind, active: activeSet.has(e.kind) });
  }
  const t = player.telemetry;
  const situation: RaceSituation | null =
    player.effects.length > 0
      ? {
          drafting: t.drafting,
          draftDist: t.draftDist,
          cleanAir: t.cleanAir,
          traffic: t.traffic,
          beingDrafted: t.beingDrafted,
        }
      : null;

  const l = player.live;
  return {
    lap: player.lap,
    laps: engine.config.track.laps,
    speedKmh: player.speed * 3.6,
    speedFrac: player.speed / Math.max(1, player.d.topSpeed),
    stamina: player.energy / player.d.energyMax,
    board,
    tuning,
    situation,
    perf: {
      speedFrac: l.speedFrac,
      gripLoad: l.gripLoad,
      topMult: l.topMult,
      accelMult: l.accelMult,
      gripMult: l.gripMult,
      steerMult: l.steerMult,
      fade: l.fade,
    },
  };
}

/**
 * Owns the RaceEngine instance for the current race: runs the countdown, exposes the
 * engine to the in-canvas field, polls HUD data at ~15Hz, and reports the final result
 * to the store when the deterministic sim completes.
 */
export function RaceSessionProvider({ children }: { children: ReactNode }) {
  const raceConfig = useGame((s) => s.raceConfig);
  const phase = useGame((s) => s.phase);
  const finishRace = useGame((s) => s.finishRace);

  const engine = useMemo(() => (raceConfig ? new RaceEngine(raceConfig) : null), [raceConfig]);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [raceSpeed, setRaceSpeed] = useState(1);
  const [hud, setHud] = useState<HudData>(EMPTY_HUD);
  const handled = useRef(false);

  // Fast-forward the SAME deterministic sim to its finish (mirrors RaceEngine.resolve), then
  // report the result once. The result is identical to watching it play out — skip only
  // changes how long the player waits, never who wins.
  const skipRace = useCallback(() => {
    if (!engine || handled.current) return;
    handled.current = true;
    if (!engine.started) engine.start();
    let guard = 0;
    while (!engine.over && guard++ < 200_000) engine.step(FIXED_DT * 8);
    setRunning(false);
    const audio = getAudio();
    audio.engineOff();
    audio.finishChord();
    const result = engine.result();
    if (result) finishRace(result);
  }, [engine, finishRace]);

  // Countdown then go.
  useEffect(() => {
    if (!engine || phase !== 'race') return;
    const audio = getAudio();
    audio.resume();
    handled.current = false;
    setRunning(false);
    setRaceSpeed(1);
    const seq = ['3', '2', '1', 'GO!'];
    const timers: number[] = [];
    seq.forEach((label, i) => {
      timers.push(
        window.setTimeout(() => {
          setCountdown(label);
          if (label === 'GO!') {
            audio.blip(660, 0.3);
            audio.engineOn();
            engine.start();
            setRunning(true);
          } else {
            audio.blip(440);
          }
        }, i * 800),
      );
    });
    timers.push(window.setTimeout(() => setCountdown(null), seq.length * 800));
    return () => timers.forEach(clearTimeout);
  }, [engine, phase]);

  // Poll HUD + detect finish.
  useEffect(() => {
    if (!engine) return;
    const audio = getAudio();
    const id = window.setInterval(() => {
      setHud(computeHud(engine));
      const player = engine.racers.find((r) => r.isPlayer);
      if (player) audio.setEngine(player.speed / player.d.topSpeed);
      if (engine.over && !handled.current) {
        handled.current = true;
        setRunning(false);
        audio.engineOff();
        audio.finishChord();
        const result = engine.result();
        if (result) finishRace(result);
      }
      // ~30Hz: the standings now track real track positions, so poll fast enough that a
      // pass shows on the board almost the instant it happens on track (not ~66ms later).
    }, 33);
    return () => {
      clearInterval(id);
      audio.engineOff();
    };
  }, [engine, finishRace]);

  const value = useMemo<RaceSessionValue>(
    () => ({ engine, running, countdown, raceSpeed, setRaceSpeed, skipRace }),
    [engine, running, countdown, raceSpeed, skipRace],
  );
  return (
    <RaceSessionContext.Provider value={value}>
      <RaceHudContext.Provider value={hud}>{children}</RaceHudContext.Provider>
    </RaceSessionContext.Provider>
  );
}

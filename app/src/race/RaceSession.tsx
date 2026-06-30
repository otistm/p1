import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RaceEngine } from '@grid/sim';
import { useGame } from '@grid/game';
import { getAudio } from '@grid/audio';
import type { BoardRow } from '@grid/ui';

interface HudData {
  lap: number;
  laps: number;
  speedKmh: number;
  stamina: number;
  board: BoardRow[];
}

interface RaceSessionValue {
  engine: RaceEngine | null;
  running: boolean;
  countdown: string | null;
}

const EMPTY_HUD: HudData = { lap: 0, laps: 3, speedKmh: 0, stamina: 1, board: [] };

// The HUD lives in its own context, deliberately separate from the engine/running session.
// HUD state updates ~15Hz; if it shared a context with the engine, every consumer (incl.
// the 3D RaceField) would re-render 15x/sec — which rebuilt all kart meshes and made the
// karts visibly jump. Keeping them split means the render-driving components only re-render
// when the engine or countdown actually changes.
const RaceSessionContext = createContext<RaceSessionValue>({
  engine: null,
  running: false,
  countdown: null,
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
  return {
    lap: player.lap,
    laps: engine.config.track.laps,
    speedKmh: player.speed * 3.6,
    stamina: player.energy / player.d.energyMax,
    board,
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
  const [hud, setHud] = useState<HudData>(EMPTY_HUD);
  const handled = useRef(false);

  // Countdown then go.
  useEffect(() => {
    if (!engine || phase !== 'race') return;
    const audio = getAudio();
    audio.resume();
    handled.current = false;
    setRunning(false);
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
    () => ({ engine, running, countdown }),
    [engine, running, countdown],
  );
  return (
    <RaceSessionContext.Provider value={value}>
      <RaceHudContext.Provider value={hud}>{children}</RaceHudContext.Provider>
    </RaceSessionContext.Provider>
  );
}

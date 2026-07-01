import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameCanvas, TrackWorld, ShowroomKart, RaceField, timeOfDayNow, type TimeOfDay } from '@grid/render';
import { trackForRound, trailHex } from '@grid/content';
import { useGame, visualFor } from '@grid/game';
import {
  TitleScreen,
  GarageScreen,
  TrainingScreen,
  ShopScreen,
  ResultsScreen,
  RaceHud,
  KartInspector,
  CardPlayFx,
  RaceProcFx,
  type RaceProc,
  Wallet,
  CoachMarks,
} from '@grid/ui';
import { RaceSessionProvider, useRaceSession, useRaceHud } from './race/RaceSession';

const PREFERS_REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ShowroomConnected() {
  const save = useGame((s) => s.save);
  const phase = useGame((s) => s.phase);
  const round = useGame((s) => s.season.round);
  const openKartInspector = useGame((s) => s.openKartInspector);
  const cardPlayPulse = useGame((s) => s.cardPlayPulse);
  const visual = visualFor(save);
  // In the garage we hold a fixed 3/4 view (and frame a touch closer) so the build
  // screen's leader lines stay pinned to the kart's parts.
  const inGarage = phase === 'garage';
  // Select the kart (garage or training) to open the build/tuning inspector.
  const selectable = phase === 'garage' || phase === 'training';
  return (
    <ShowroomKart
      track={trackForRound(round)}
      visual={visual}
      orbit={!PREFERS_REDUCED_MOTION && !inGarage}
      angle={-0.92}
      radius={inGarage ? 8 : 9}
      height={inGarage ? 3.5 : 4.2}
      onSelect={selectable ? openKartInspector : undefined}
      pulseKey={cardPlayPulse}
    />
  );
}

function RaceFieldConnected({ onProc }: { onProc?: (kind: string, x: number, y: number) => void }) {
  const save = useGame((s) => s.save);
  const { engine, running, raceSpeed } = useRaceSession();
  // Stable reference so RaceField never rebuilds its kart meshes from an incidental
  // re-render — only when the player's actual visual loadout changes.
  const visualsById = useMemo(() => ({ player: visualFor(save) }), [save]);
  if (!engine) return null;
  return (
    <RaceField
      engine={engine}
      running={running}
      speed={raceSpeed}
      visualsById={visualsById}
      playerTrailHex={trailHex(save.trailId)}
      onProc={onProc}
    />
  );
}

function HudConnected() {
  const { countdown, running, raceSpeed, setRaceSpeed, skipRace } = useRaceSession();
  const hud = useRaceHud();
  return (
    <RaceHud
      lap={hud.lap}
      laps={hud.laps}
      speedKmh={hud.speedKmh}
      speedFrac={hud.speedFrac}
      stamina={hud.stamina}
      board={hud.board}
      countdown={countdown}
      raceSpeed={raceSpeed}
      onCycleSpeed={() => setRaceSpeed(raceSpeed === 1 ? 2 : 1)}
      onSkip={skipRace}
      showControls={running && !countdown}
      tuning={hud.tuning}
      situation={hud.situation}
      perf={hud.perf}
    />
  );
}

function Toast() {
  const toast = useGame((s) => s.toast);
  const clearToast = useGame((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(clearToast, 2600);
    return () => clearTimeout(id);
  }, [toast, clearToast]);
  if (!toast) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        background: 'rgba(20,23,31,.95)',
        border: '1px solid var(--line)',
        color: 'var(--ink)',
        padding: '12px 18px',
        borderRadius: 10,
        fontSize: 14,
        maxWidth: '80vw',
        textAlign: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,.4)',
      }}
    >
      {toast}
    </div>
  );
}

function Screen() {
  const phase = useGame((s) => s.phase);
  switch (phase) {
    case 'title':
      return <TitleScreen />;
    case 'garage':
      return <GarageScreen />;
    case 'training':
      return <TrainingScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'results':
      return <ResultsScreen />;
    case 'race':
      return <HudConnected />;
    default:
      return null;
  }
}

export function App() {
  const phase = useGame((s) => s.phase);
  const round = useGame((s) => s.season.round);
  const racing = phase === 'race' || phase === 'results';
  // Each cup has its own circuit + location (biome). The environment's time of day is separate:
  // it tracks the player's real local clock, so a track can be seen at dawn, noon, dusk or night.
  const track = trackForRound(round);
  const location = track.meta.location;
  // `?time=dawn|day|dusk|night` forces the mood (handy for testing/screenshots); otherwise it
  // tracks the player's real local clock, re-checked each minute so long sessions roll over.
  const forcedTime = useMemo<TimeOfDay | null>(() => {
    const t = new URLSearchParams(window.location.search).get('time');
    return t === 'dawn' || t === 'day' || t === 'dusk' || t === 'night' ? t : null;
  }, []);
  const [clockTime, setClockTime] = useState(timeOfDayNow);
  useEffect(() => {
    if (forcedTime) return;
    const id = window.setInterval(() => setClockTime(timeOfDayNow()), 60_000);
    return () => window.clearInterval(id);
  }, [forcedTime]);
  const time = forcedTime ?? clockTime;

  // Transient tuning-proc chips. RaceField reports a proc + its projected kart position; we hold
  // it briefly, then drop it once the float-up animation has run. Disabled under reduced motion.
  const [procs, setProcs] = useState<RaceProc[]>([]);
  const procId = useRef(0);
  const pushProc = useCallback((kind: string, x: number, y: number) => {
    const id = ++procId.current;
    setProcs((prev) => [...prev, { id, kind, x, y }]);
    window.setTimeout(() => setProcs((prev) => prev.filter((p) => p.id !== id)), 1200);
  }, []);

  return (
    <RaceSessionProvider>
      <GameCanvas time={time}>
        <TrackWorld track={track} scenerySeed={track.meta.scenerySeed} location={location} />
        {racing ? (
          <RaceFieldConnected onProc={PREFERS_REDUCED_MOTION ? undefined : pushProc} />
        ) : (
          <ShowroomConnected />
        )}
      </GameCanvas>
      <Screen />
      <Wallet />
      <KartInspector />
      <CardPlayFx />
      <RaceProcFx procs={procs} />
      <CoachMarks />
      <Toast />
    </RaceSessionProvider>
  );
}

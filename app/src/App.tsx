import { useEffect, useMemo } from 'react';
import { GameCanvas, TrackWorld, ShowroomKart, RaceField } from '@grid/render';
import { SUNSET_DERBY } from '@grid/content';
import { useGame, visualFor } from '@grid/game';
import {
  TitleScreen,
  GarageScreen,
  DraftScreen,
  TrainingScreen,
  ResultsScreen,
  RaceHud,
} from '@grid/ui';
import { RaceSessionProvider, useRaceSession, useRaceHud } from './race/RaceSession';

const PREFERS_REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function ShowroomConnected() {
  const save = useGame((s) => s.save);
  const phase = useGame((s) => s.phase);
  const visual = visualFor(save);
  // In the garage we hold a fixed 3/4 view (and frame a touch closer) so the build
  // screen's leader lines stay pinned to the kart's parts.
  const inGarage = phase === 'garage';
  return (
    <ShowroomKart
      track={SUNSET_DERBY}
      visual={visual}
      orbit={!PREFERS_REDUCED_MOTION && !inGarage}
      angle={-0.92}
      radius={inGarage ? 8 : 9}
      height={inGarage ? 3.5 : 4.2}
    />
  );
}

function RaceFieldConnected() {
  const save = useGame((s) => s.save);
  const { engine, running } = useRaceSession();
  // Stable reference so RaceField never rebuilds its kart meshes from an incidental
  // re-render — only when the player's actual visual loadout changes.
  const visualsById = useMemo(() => ({ player: visualFor(save) }), [save]);
  if (!engine) return null;
  return <RaceField engine={engine} running={running} visualsById={visualsById} />;
}

function HudConnected() {
  const { countdown } = useRaceSession();
  const hud = useRaceHud();
  return (
    <RaceHud
      lap={hud.lap}
      laps={hud.laps}
      speedKmh={hud.speedKmh}
      stamina={hud.stamina}
      board={hud.board}
      countdown={countdown}
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
    case 'draft':
      return <DraftScreen />;
    case 'training':
      return <TrainingScreen />;
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
  const racing = phase === 'race' || phase === 'results';

  return (
    <RaceSessionProvider>
      <GameCanvas>
        <TrackWorld track={SUNSET_DERBY} scenerySeed={SUNSET_DERBY.meta.scenerySeed} />
        {racing ? <RaceFieldConnected /> : <ShowroomConnected />}
      </GameCanvas>
      <Screen />
      <Toast />
    </RaceSessionProvider>
  );
}

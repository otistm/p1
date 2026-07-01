import { hexToCss } from '../theme';
import { SpeedFx } from '../components/SpeedFx';
import { RaceVitals, type TuningStatus, type RaceSituation, type LivePerf } from '../components/RaceVitals';

const NEUTRAL_PERF: LivePerf = {
  speedFrac: 0,
  gripLoad: 0,
  topMult: 1,
  accelMult: 1,
  gripMult: 1,
  steerMult: 1,
  fade: 1,
};

export interface BoardRow {
  pos: number;
  name: string;
  colorHex: number;
  gap: string;
  me: boolean;
}

interface RaceHudProps {
  lap: number;
  laps: number;
  speedKmh: number;
  /** Player speed as a fraction of their top speed (0..~1); drives the speed FX. */
  speedFrac?: number;
  stamina: number;
  board: BoardRow[];
  countdown?: string | null;
  /** Current playback rate (1 or 2); when set with handlers, the race controls render. */
  raceSpeed?: number;
  onCycleSpeed?: () => void;
  onSkip?: () => void;
  showControls?: boolean;
  /** Player's staged tuning effects + their live on/off state (drives the TUNING readout). */
  tuning?: TuningStatus[];
  /** Live situational facts that gate those effects; null when no tuning is staged. */
  situation?: RaceSituation | null;
  /** Live performance multipliers (tuning bag + stamina fade) for the vitals gauges. */
  perf?: LivePerf;
}

export function RaceHud({
  lap,
  laps,
  speedKmh,
  speedFrac = 0,
  stamina,
  board,
  countdown,
  raceSpeed = 1,
  onCycleSpeed,
  onSkip,
  showControls,
  tuning = [],
  situation = null,
  perf = NEUTRAL_PERF,
}: RaceHudProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8, pointerEvents: 'none', fontFamily: 'Inter' }}>
      {/* Speed cues sit behind the HUD readouts (first child = painted under later siblings). */}
      {!countdown && <SpeedFx frac={speedFrac} />}

      {/* Race controls — the one bit of agency in the auto-race: change playback speed or skip
          straight to the result (both keep the deterministic outcome). Top-right, clickable. */}
      {showControls && onCycleSpeed && onSkip && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            gap: 8,
            pointerEvents: 'auto',
          }}
        >
          <button className="btn ghost sm" style={{ minWidth: 52 }} onClick={onCycleSpeed}>
            {raceSpeed}&times;
          </button>
          <button className="btn ghost sm" onClick={onSkip}>
            Skip &rarr;
          </button>
        </div>
      )}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
        <div className="display" style={{ fontSize: 34, lineHeight: 0.9 }}>
          {Math.min(lap + 1, laps)}/{laps}
        </div>
        <div style={{ fontSize: 11, letterSpacing: 3, color: 'var(--cyan)', fontWeight: 700 }}>LAP</div>
      </div>

      <div
        className="board"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(20,23,31,.82)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '10px 12px',
          minWidth: 200,
          backdropFilter: 'blur(6px)',
        }}
      >
        {board.map((r) => (
          <div
            key={r.pos + r.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '3px 4px',
              fontSize: 13,
              borderRadius: 6,
              background: r.me ? 'rgba(43,217,255,.12)' : 'transparent',
            }}
          >
            <span className="mono" style={{ fontWeight: 700, width: 20, color: 'var(--muted)' }}>
              {r.pos}
            </span>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: hexToCss(r.colorHex) }} />
            <span
              style={{
                flex: 1,
                fontWeight: r.me ? 800 : 600,
                color: r.me ? 'var(--cyan)' : undefined,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 120,
              }}
            >
              {r.me ? `${r.name} (you)` : r.name}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              {r.gap}
            </span>
          </div>
        ))}
      </div>

      {!countdown && (
        <RaceVitals stamina={stamina} speedKmh={speedKmh} perf={perf} tuning={tuning} situation={situation} />
      )}

      <div style={{ position: 'absolute', bottom: 20, right: 20, textAlign: 'right' }}>
        <div className="display" style={{ fontSize: 44, lineHeight: 0.85 }}>
          {Math.round(speedKmh)}
        </div>
        <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--muted)' }}>KM/H</div>
      </div>

      {countdown && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="display"
            style={{
              fontSize: 160,
              color: countdown === 'GO!' ? 'var(--green)' : '#fff',
              textShadow: '0 6px 30px rgba(0,0,0,.6)',
            }}
          >
            {countdown}
          </div>
        </div>
      )}
    </div>
  );
}

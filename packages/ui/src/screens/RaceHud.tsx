import { hexToCss } from '../theme';

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
  stamina: number;
  board: BoardRow[];
  countdown?: string | null;
}

export function RaceHud({ lap, laps, speedKmh, stamina, board, countdown }: RaceHudProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8, pointerEvents: 'none', fontFamily: 'Inter' }}>
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

      <div style={{ position: 'absolute', bottom: 24, left: 20, width: 200 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--muted)', fontWeight: 700, marginBottom: 5 }}>
          STAMINA
        </div>
        <div
          style={{
            height: 12,
            background: 'rgba(20,23,31,.7)',
            border: '1px solid var(--line)',
            borderRadius: 7,
            overflow: 'hidden',
          }}
        >
          <i
            style={{
              display: 'block',
              height: '100%',
              width: `${Math.max(0, Math.min(100, stamina * 100))}%`,
              background:
                stamina < 0.25
                  ? 'linear-gradient(90deg,#ff8a4b,var(--red))'
                  : 'linear-gradient(90deg,#4ee08a,#2bd9ff)',
              transition: 'width .2s',
            }}
          />
        </div>
      </div>

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

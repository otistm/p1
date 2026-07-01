import { effectMeta } from './effectMeta';

export interface RaceProc {
  id: number;
  kind: string;
  /** Projected kart screen position (px) captured when the effect procced. */
  x: number;
  y: number;
}

/**
 * Floating "tuning procced" chips anchored to the player's kart. Each chip is positioned at the
 * projected screen point captured when the effect fired (see `RaceField.onProc`) and floats up +
 * fades via the `procfloat` CSS animation; the parent removes it once the animation ends. Purely
 * presentational and pointer-transparent, so it never intercepts the race controls.
 */
export function RaceProcFx({ procs }: { procs: RaceProc[] }) {
  if (procs.length === 0) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9, pointerEvents: 'none', fontFamily: 'Inter' }}>
      {procs.map((p) => {
        const meta = effectMeta(p.kind);
        return (
          <div
            key={p.id}
            className="procfloat"
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              fontSize: 'var(--fs-body)',
              fontWeight: 800,
              letterSpacing: 0.3,
              color: '#0b0e13',
              background: meta.tint,
              boxShadow: '0 6px 18px rgba(0,0,0,.45)',
            }}
          >
            <span aria-hidden>⚡</span>
            {meta.label}
          </div>
        );
      })}
    </div>
  );
}

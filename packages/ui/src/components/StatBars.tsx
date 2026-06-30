import { useState } from 'react';
import { STAT_KEYS, type KartStats, type StatKey } from '@grid/sim';
import { STAT_COLOR, STAT_DESC, STAT_LABEL } from '../theme';

interface StatBarsProps {
  stats: KartStats;
  /** Optional recent gains, shown as a green +N next to the value. */
  gains?: Partial<KartStats>;
  /** Max value used to scale the bars. */
  max?: number;
}

/** Tooltip height estimate (header + two lines) used to decide above/below placement. */
const TOOLTIP_H = 84;

export function StatBars({ stats, gains, max = 100 }: StatBarsProps) {
  const [hovered, setHovered] = useState<StatKey | null>(null);
  // Flip the tooltip above the label when there isn't room below it in the viewport, so the
  // lower stats (Guts/Wit) near the screen edge don't get clipped.
  const [above, setAbove] = useState(false);

  const open = (k: StatKey, el: HTMLElement | null) => {
    if (el) {
      const rect = el.getBoundingClientRect();
      setAbove(rect.bottom + 6 + TOOLTIP_H > window.innerHeight);
    }
    setHovered(k);
  };
  const close = (k: StatKey) => setHovered((h) => (h === k ? null : h));

  return (
    <div>
      {STAT_KEYS.map((k) => {
        const v = stats[k];
        const pct = Math.max(0, Math.min(100, (v / max) * 100));
        const gain = gains?.[k];
        return (
          <div
            key={k}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, margin: '9px 0' }}
            onMouseEnter={(e) => open(k, e.currentTarget)}
            onMouseLeave={() => close(k)}
          >
            <div
              tabIndex={0}
              onFocus={(e) => open(k, e.currentTarget)}
              onBlur={() => close(k)}
              style={{
                width: 78,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: STAT_COLOR[k],
                cursor: 'help',
                outline: 'none',
              }}
            >
              {STAT_LABEL[k]}
            </div>
            {hovered === k && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute',
                  ...(above ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
                  left: 0,
                  zIndex: 50,
                  width: 230,
                  padding: '8px 10px',
                  background: 'rgba(20,23,31,.98)',
                  border: `1px solid ${STAT_COLOR[k]}`,
                  borderRadius: 8,
                  boxShadow: '0 10px 30px rgba(0,0,0,.45)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: STAT_COLOR[k],
                    marginBottom: 3,
                  }}
                >
                  {STAT_LABEL[k]}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--ink)' }}>{STAT_DESC[k]}</div>
              </div>
            )}
            <div
              style={{
                flex: 1,
                height: 10,
                background: 'var(--panel2)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <i
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${pct}%`,
                  background: STAT_COLOR[k],
                  borderRadius: 6,
                  transition: 'width .5s cubic-bezier(.2,.8,.2,1)',
                }}
              />
            </div>
            <div
              className="mono"
              style={{ width: 34, textAlign: 'right', fontSize: 14, fontWeight: 700 }}
            >
              {Math.round(v)}
            </div>
            <div
              className="mono"
              style={{
                width: 30,
                fontSize: 12,
                color: 'var(--green)',
                opacity: gain ? 1 : 0,
                transition: 'opacity .3s',
              }}
            >
              {gain ? `+${Math.round(gain)}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { STAT_KEYS, type KartStats } from '@grid/sim';
import { STAT_COLOR, STAT_LABEL } from '../theme';

interface StatBarsProps {
  stats: KartStats;
  /** Optional recent gains, shown as a green +N next to the value. */
  gains?: Partial<KartStats>;
  /** Max value used to scale the bars. */
  max?: number;
}

export function StatBars({ stats, gains, max = 100 }: StatBarsProps) {
  return (
    <div>
      {STAT_KEYS.map((k) => {
        const v = stats[k];
        const pct = Math.max(0, Math.min(100, (v / max) * 100));
        const gain = gains?.[k];
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '9px 0' }}>
            <div
              style={{
                width: 78,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: STAT_COLOR[k],
              }}
            >
              {STAT_LABEL[k]}
            </div>
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

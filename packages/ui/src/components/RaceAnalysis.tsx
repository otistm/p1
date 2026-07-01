import { type CSSProperties, useState } from 'react';
import { hexToCss } from '../theme';

/** Per-lap aggregate — structural mirror of `@grid/sim`'s `LapStat` (no cross-boundary import). */
export interface LapStat {
  topSpeed: number;
  avgSpeed: number;
  avgCorner: number;
  stamina: number;
}

/** Minimal structural shape of a result row — matches `@grid/sim`'s `RaceResultRow`. */
export interface AnalysisRow {
  id: string;
  name: string;
  rank: number;
  finishTime: number;
  finished: boolean;
  /** Cumulative time (s) at each completed lap; index 0 = end of lap 1. */
  lapSplits: number[];
  /** Per-lap speed/corner/stamina aggregates, parallel to `lapSplits`. */
  lapStats: LapStat[];
}

type Metric = 'position' | 'speed' | 'stamina' | 'corner';

const METRICS: Array<{ id: Metric; label: string }> = [
  { id: 'position', label: 'Position' },
  { id: 'speed', label: 'Speed' },
  { id: 'stamina', label: 'Stamina' },
  { id: 'corner', label: 'Corner' },
];

function fmt(t: number): string {
  return t.toFixed(2);
}

/** A thin 0..1 bar used inside speed/stamina/corner cells, echoing the in-race vitals gauges. */
function MiniBar({ frac, color }: { frac: number; color: string }) {
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 3, overflow: 'hidden', marginTop: 3 }}>
      <i style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, frac * 100))}%`, background: color }} />
    </div>
  );
}

/**
 * The lap-by-lap breakdown in the results panel's Analysis tab. A metric switch lets the player
 * replay the whole field through the same lens as the in-race vitals HUD: running **Position**
 * (with ▲/▼ swings + lap time), peak **Speed**, end-of-lap **Stamina**, or average **Corner** load
 * — per lap, per racer. Reads only the recorded splits/stats, so it's a faithful post-mortem of the
 * same deterministic race the player watched.
 */
export function RaceAnalysis({
  rows,
  laps,
  colorFor,
  playerId = 'player',
}: {
  rows: AnalysisRow[];
  laps: number;
  colorFor: (id: string) => number;
  playerId?: string;
}) {
  const [metric, setMetric] = useState<Metric>('position');
  const lapCount = Math.max(1, laps);

  // Running position at the end of each lap: sort everyone who finished that lap by cumulative time.
  const lapRank: Array<Record<string, number>> = [];
  for (let l = 0; l < lapCount; l++) {
    const done = rows.filter((r) => r.lapSplits[l] != null).sort((a, b) => a.lapSplits[l] - b.lapSplits[l]);
    const m: Record<string, number> = {};
    done.forEach((r, i) => (m[r.id] = i + 1));
    lapRank.push(m);
  }

  // Field extremes, to spotlight the standout cell for the active metric.
  let fastestLap = Infinity;
  let topSpeedKmh = 0;
  for (const r of rows) {
    for (let l = 0; l < lapCount; l++) {
      const t = r.lapSplits[l];
      if (t != null) {
        const lt = t - (l > 0 ? (r.lapSplits[l - 1] ?? 0) : 0);
        if (lt < fastestLap) fastestLap = lt;
      }
      const st = r.lapStats[l];
      if (st && st.topSpeed * 3.6 > topSpeedKmh) topSpeedKmh = st.topSpeed * 3.6;
    }
  }

  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  const th: CSSProperties = {
    padding: '6px 8px',
    fontSize: 10,
    letterSpacing: 1,
    color: 'var(--muted)',
    fontWeight: 700,
    textAlign: 'center',
    borderBottom: '1px solid var(--line)',
  };
  const cell: CSSProperties = { padding: '7px 8px', borderBottom: '1px solid var(--line)', textAlign: 'center', lineHeight: 1.25 };

  function renderCell(r: AnalysisRow, l: number) {
    const hasLap = r.lapSplits[l] != null;
    if (!hasLap) return <span style={{ color: 'var(--muted)' }}>—</span>;
    const st = r.lapStats[l];

    if (metric === 'position') {
      const t = r.lapSplits[l];
      const lt = t - (l > 0 ? (r.lapSplits[l - 1] ?? 0) : 0);
      const pos = lapRank[l][r.id];
      const prev = l > 0 ? lapRank[l - 1][r.id] : undefined;
      const move = prev != null && pos != null ? prev - pos : 0;
      const isFastest = Math.abs(lt - fastestLap) < 1e-6;
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <span className="display" style={{ fontSize: 14 }}>
              P{pos}
            </span>
            {move !== 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, color: move > 0 ? 'var(--green)' : 'var(--red)' }}>
                {move > 0 ? `▲${move}` : `▼${-move}`}
              </span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10, color: isFastest ? 'var(--green)' : 'var(--muted)', fontWeight: isFastest ? 800 : 400 }}>
            {isFastest ? '★ ' : ''}
            {fmt(lt)}s
          </div>
        </>
      );
    }

    if (!st) return <span style={{ color: 'var(--muted)' }}>—</span>;

    if (metric === 'speed') {
      const kmh = st.topSpeed * 3.6;
      const isTop = topSpeedKmh > 0 && Math.abs(kmh - topSpeedKmh) < 1e-6;
      return (
        <>
          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: isTop ? 'var(--green)' : 'var(--ink)' }}>
            {isTop ? '★ ' : ''}
            {Math.round(kmh)}
          </div>
          <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>
            avg {Math.round(st.avgSpeed * 3.6)}
          </div>
          <MiniBar frac={topSpeedKmh > 0 ? kmh / topSpeedKmh : 0} color="#2bd9ff" />
        </>
      );
    }

    if (metric === 'stamina') {
      const pct = Math.round(st.stamina * 100);
      const color = st.stamina < 0.25 ? 'var(--red)' : st.stamina < 0.5 ? 'var(--amber)' : 'var(--green)';
      return (
        <>
          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color }}>
            {pct}%
          </div>
          <MiniBar frac={st.stamina} color={st.stamina < 0.25 ? '#ff5470' : '#4ee08a'} />
        </>
      );
    }

    // corner
    const pct = Math.round(st.avgCorner * 100);
    return (
      <>
        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: st.avgCorner > 0.7 ? 'var(--amber)' : 'var(--ink)' }}>
          {pct}%
        </div>
        <MiniBar frac={st.avgCorner} color={st.avgCorner > 0.7 ? '#ffb648' : '#2bd9ff'} />
      </>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 10 }}>
        {METRICS.map((m) => (
          <button
            key={m.id}
            className={metric === m.id ? 'btn cyan' : 'btn ghost'}
            style={{ padding: '3px 12px', fontSize: 12 }}
            onClick={() => setMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ maxHeight: '48vh', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', width: 34 }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Racer</th>
              {Array.from({ length: lapCount }, (_, l) => (
                <th key={l} style={th}>
                  L{l + 1}
                </th>
              ))}
              <th style={th}>Finish</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => {
              const me = r.id === playerId;
              return (
                <tr key={r.id} style={{ background: me ? 'rgba(43,217,255,.10)' : undefined }}>
                  <td className="display" style={{ padding: '7px 8px', borderBottom: '1px solid var(--line)', fontSize: 17 }}>
                    {r.rank}
                  </td>
                  <td
                    style={{
                      padding: '7px 8px',
                      borderBottom: '1px solid var(--line)',
                      fontSize: 13,
                      fontWeight: me ? 800 : 500,
                      color: me ? 'var(--cyan)' : undefined,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        display: 'inline-block',
                        marginRight: 7,
                        verticalAlign: 'middle',
                        background: hexToCss(colorFor(r.id) ?? 0xffffff),
                      }}
                    />
                    {me ? `${r.name} (you)` : r.name}
                  </td>
                  {Array.from({ length: lapCount }, (_, l) => (
                    <td key={l} style={cell}>
                      {renderCell(r, l)}
                    </td>
                  ))}
                  <td className="mono" style={{ ...cell, fontSize: 12, color: 'var(--muted)' }}>
                    {r.finished ? `${fmt(r.finishTime)}s` : 'DNF'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {metric === 'position' ? (
          <>
            <span>
              <b style={{ color: 'var(--green)' }}>▲</b>/<b style={{ color: 'var(--red)' }}>▼</b> places gained/lost that lap
            </span>
            <span>
              <b style={{ color: 'var(--green)' }}>★</b> fastest lap of the race
            </span>
          </>
        ) : metric === 'speed' ? (
          <span>Top speed per lap (km/h), avg below · <b style={{ color: 'var(--green)' }}>★</b> fastest of the race</span>
        ) : metric === 'stamina' ? (
          <span>Stamina remaining at each lap's end</span>
        ) : (
          <span>Average corner load per lap — how hard the kart leaned on its grip</span>
        )}
      </div>
    </div>
  );
}

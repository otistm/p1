import { useGame } from '@grid/game';
import { ROUNDS } from '@grid/content';
import { hexToCss } from '../theme';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

export function ResultsScreen() {
  const result = useGame((s) => s.lastResult);
  const season = useGame((s) => s.season);
  const raceConfig = useGame((s) => s.raceConfig);
  const nextRound = useGame((s) => s.nextRound);
  if (!result) return null;
  const colorById = (id: string) =>
    raceConfig?.entrants.find((e) => e.id === id)?.colorHex ?? 0xffffff;

  const order = result.order;
  const player = order.find((r) => r.id === 'player');
  const rank = player?.rank ?? order.length;
  const isLast = season.round >= ROUNDS.length - 1;
  const won = rank === 1;
  const round = ROUNDS[season.round];

  const title = isLast ? (won ? 'Champion!' : 'Season Over') : won ? 'Race Won!' : `P${rank} Finish`;

  return (
    <div className="overlay" style={{ pointerEvents: 'auto' }}>
      <div className="card" style={{ width: 'min(560px,94vw)', padding: '30px 32px' }}>
        <div className="display" style={{ fontSize: 40, textAlign: 'center' }}>
          {title}
        </div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 18 }}>
          {round.name} · finished {ordinal(rank)} of {order.length}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 22 }}>
          <tbody>
            {order.map((r) => {
              const colorHex = colorById(r.id);
              return (
                <tr key={r.id} style={{ background: r.id === 'player' ? 'rgba(43,217,255,.10)' : undefined }}>
                  <td className="display" style={{ padding: '9px 8px', borderBottom: '1px solid var(--line)', fontSize: 20, width: 42 }}>
                    {r.rank}
                  </td>
                  <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        display: 'inline-block',
                        marginRight: 8,
                        verticalAlign: 'middle',
                        background: hexToCss(colorHex ?? 0xffffff),
                      }}
                    />
                    {r.name}
                  </td>
                  <td
                    className="mono"
                    style={{ padding: '9px 8px', borderBottom: '1px solid var(--line)', fontSize: 14, textAlign: 'right', color: 'var(--muted)' }}
                  >
                    {r.finished ? formatTime(r.finishTime) : 'DNF'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn cyan" onClick={nextRound}>
            {isLast ? 'Finish Season' : 'Next Round →'}
          </button>
        </div>
      </div>
    </div>
  );
}

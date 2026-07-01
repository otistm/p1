import { useState } from 'react';
import { useGame, racePayout } from '@grid/game';
import { ROUNDS } from '@grid/content';
import { MoneyBadge } from '../components/MoneyBadge';
import { RaceAnalysis } from '../components/RaceAnalysis';
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
  const goShop = useGame((s) => s.goShop);
  const money = useGame((s) => s.save.money);
  const [tab, setTab] = useState<'summary' | 'analysis'>('summary');
  if (!result) return null;
  const colorById = (id: string) =>
    raceConfig?.entrants.find((e) => e.id === id)?.colorHex ?? 0xffffff;

  const order = result.order;
  const laps = raceConfig?.track.laps ?? order[0]?.laps ?? 3;
  const player = order.find((r) => r.id === 'player');
  const rank = player?.rank ?? order.length;
  const isLast = season.round >= ROUNDS.length - 1;
  const won = rank === 1;
  const round = ROUNDS[season.round];

  const title = isLast ? (won ? 'Champion!' : 'Season Over') : won ? 'Race Won!' : `P${rank} Finish`;
  const winnings = racePayout(rank, season.round);
  const podium = rank <= 3;

  return (
    <div className="overlay" style={{ pointerEvents: 'auto' }}>
      <div className="card" style={{ width: tab === 'analysis' ? 'min(700px,96vw)' : 'min(560px,94vw)', padding: '30px 32px' }}>
        <div className="display" style={{ fontSize: 'var(--fs-h1)', textAlign: 'center' }}>
          {title}
        </div>
        <div style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 14 }}>
          {round.name} · finished {ordinal(rank)} of {order.length}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 16,
            fontSize: 'var(--fs-body)',
            color: 'var(--muted)',
          }}
        >
          <span style={{ color: podium ? 'var(--green)' : 'var(--muted)' }}>
            {podium
              ? 'Podium! Winnings'
              : winnings > 0
                ? 'Off the podium — consolation'
                : 'Off the podium — no winnings'}
          </span>
          <MoneyBadge amount={money} delta={winnings} />
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {(['summary', 'analysis'] as const).map((t) => (
            <button
              key={t}
              className={tab === t ? 'btn cyan' : 'btn ghost'}
              style={{ padding: '5px 16px', fontSize: 13, textTransform: 'capitalize' }}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'analysis' ? (
          <div style={{ marginBottom: 22 }}>
            <RaceAnalysis rows={order} laps={laps} colorFor={colorById} />
          </div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 22 }}>
          <tbody>
            {order.map((r) => {
              const colorHex = colorById(r.id);
              return (
                <tr key={r.id} style={{ background: r.id === 'player' ? 'rgba(43,217,255,.10)' : undefined }}>
                  <td className="display" style={{ padding: '9px 8px', borderBottom: '1px solid var(--line)', fontSize: 20, width: 42 }}>
                    {r.rank}
                  </td>
                  <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: r.id === 'player' ? 800 : 400, color: r.id === 'player' ? 'var(--cyan)' : undefined }}>
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
                    {r.id === 'player' ? `${r.name} (you)` : r.name}
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
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {!isLast && (
            <button className="btn ghost" onClick={goShop}>
              Shop
            </button>
          )}
          <button className="btn cyan" onClick={nextRound}>
            {isLast ? 'Finish Season' : 'Next Round'}
          </button>
        </div>
      </div>
    </div>
  );
}

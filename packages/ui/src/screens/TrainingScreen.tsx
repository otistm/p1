import { useGame, computeRaceStats, projectedGain, TRAININGS } from '@grid/game';
import { ROUNDS } from '@grid/content';
import { StatBars } from '../components/StatBars';
import { STAT_COLOR, STAT_LABEL } from '../theme';

export function TrainingScreen() {
  const save = useGame((s) => s.save);
  const season = useGame((s) => s.season);
  const train = useGame((s) => s.train);
  const headToRace = useGame((s) => s.headToRace);

  const { stats } = computeRaceStats(save.loadout, season.trainedStats, season.draftedCardIds);
  const round = ROUNDS[season.round];
  const energy = season.energy;
  const cond = energy > 75 ? 'Fresh' : energy > 45 ? 'Good' : energy > 20 ? 'Tired' : 'Spent';
  const done = season.turnsLeft <= 0;

  return (
    <div
      className="overlay"
      style={{ pointerEvents: 'auto', flexDirection: 'column', justifyContent: 'space-between', padding: 18 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow">Your Kart</div>
          <div className="display" style={{ fontSize: 28, lineHeight: 1 }}>
            {save.name}
          </div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--cyan)' }}>
            Round {season.round + 1} · {round.name}
          </div>
        </div>
        <div className="panel" style={{ padding: 16, minWidth: 280 }}>
          <StatBars stats={stats} />
        </div>
        <div className="panel" style={{ padding: 16, minWidth: 220 }}>
          <div className="eyebrow">Condition</div>
          <div
            style={{
              height: 16,
              background: 'var(--panel2)',
              borderRadius: 8,
              overflow: 'hidden',
              marginTop: 8,
            }}
          >
            <i
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.max(0, Math.min(100, energy))}%`,
                background:
                  energy < 35
                    ? 'linear-gradient(90deg,#ff8a4b,var(--red))'
                    : 'linear-gradient(90deg,#ffb648,#ff6a2b)',
                transition: 'width .4s',
              }}
            />
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            {cond} · {Math.round(energy)}%
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 12,
            width: 'min(760px,94vw)',
          }}
        >
          {TRAININGS.map((t) => {
            const gain = projectedGain(t, energy);
            return (
              <button
                key={t.id}
                onClick={() => train(t.id)}
                disabled={done}
                style={{
                  textAlign: 'left',
                  cursor: done ? 'not-allowed' : 'pointer',
                  opacity: done ? 0.5 : 1,
                  background: 'rgba(37,43,56,.95)',
                  border: `1px solid ${t.id === 'rest' ? 'var(--orange)' : 'var(--line)'}`,
                  borderStyle: t.id === 'rest' ? 'dashed' : 'solid',
                  borderRadius: 14,
                  padding: 16,
                  color: 'var(--ink)',
                  font: 'inherit',
                }}
              >
                <div style={{ fontSize: 26 }}>{t.icon}</div>
                <div className="display" style={{ fontSize: 19, margin: '6px 0 8px' }}>
                  {t.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {t.main ? (
                    <>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: `${STAT_COLOR[t.main]}22`,
                          color: STAT_COLOR[t.main],
                        }}
                      >
                        +{gain} {STAT_LABEL[t.main]}
                      </span>
                      {t.splash && t.splashAmt && (
                        <span
                          className="mono"
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: `${STAT_COLOR[t.splash]}22`,
                            color: STAT_COLOR[t.splash],
                          }}
                        >
                          +{t.splashAmt} {STAT_LABEL[t.splash]}
                        </span>
                      )}
                    </>
                  ) : (
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: '#ff6a2b22',
                        color: 'var(--orange)',
                      }}
                    >
                      +{t.restore} Energy
                    </span>
                  )}
                </div>
                {t.cost > 0 && (
                  <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--orange)' }}>
                    −{t.cost} energy
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
          Turns left this round: <b style={{ color: 'var(--ink)' }}>{season.turnsLeft}</b>
        </div>
        {done && (
          <button className="btn cyan" onClick={headToRace}>
            Head to Race Day →
          </button>
        )}
      </div>
    </div>
  );
}

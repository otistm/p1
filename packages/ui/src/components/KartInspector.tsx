import { useGame } from '@grid/game';
import { CARDS_BY_ID, PARTS_BY_ID } from '@grid/content';
import { STAT_KEYS } from '@grid/sim';
import { RARITY_COLOR, SLOT_LABEL, SLOT_ORDER, STAT_COLOR, STAT_LABEL } from '../theme';

/**
 * "Select your kart" — a read-only panel showing the current build (parts) plus the
 * tuning cards staged for the next race, so the player can confirm what will race before
 * committing to race day. Opened by clicking the 3D kart or the "View Build" button (see
 * docs/training-tuning-cards.md).
 */
export function KartInspector() {
  const open = useGame((s) => s.kartInspectorOpen);
  const close = useGame((s) => s.closeKartInspector);
  const save = useGame((s) => s.save);
  const staged = useGame((s) => s.season.stagedTuningCardIds);

  if (!open) return null;

  const stagedCards = staged.map((id) => CARDS_BY_ID[id]).filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div
      className="overlay"
      style={{ pointerEvents: 'auto', zIndex: 40 }}
      onClick={close}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(460px,92vw)', maxHeight: '82vh', overflowY: 'auto', padding: '24px 26px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="display" style={{ fontSize: 'var(--fs-h3)' }}>
            {save.name}
          </div>
          <button className="btn ghost sm" onClick={close}>
            Close
          </button>
        </div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Your Build
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
          {SLOT_ORDER.map((slot) => {
            const part = PARTS_BY_ID[save.loadout[slot]];
            if (!part) return null;
            return (
              <div
                key={slot}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'var(--panel2)',
                  border: '1px solid var(--line)',
                }}
              >
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', minWidth: 64 }}>
                  {SLOT_LABEL[slot]}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600 }}>
                  <span style={{ color: RARITY_COLOR[part.rarity], fontSize: 10 }}>●</span>
                  {part.name}
                </span>
              </div>
            );
          })}
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Tuning staged for the next race ({stagedCards.length})
        </div>
        {stagedCards.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-body)', margin: 0 }}>
            No tuning cards staged — drag one from your hand onto the kart.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {stagedCards.map((card, i) => {
              const rc = RARITY_COLOR[card.rarity ?? 'common'];
              const mods = card.mods ?? {};
              return (
                <div
                  key={`${card.id}-${i}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(43,217,255,.06)',
                    border: `1px solid ${rc}55`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{card.name}</span>
                    <span
                      className="mono"
                      style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: rc }}
                    >
                      {card.rarity ?? 'common'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {STAT_KEYS.filter((k) => mods[k]).map((k) => (
                      <span
                        key={k}
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: `${STAT_COLOR[k]}22`,
                          color: STAT_COLOR[k],
                        }}
                      >
                        {mods[k]! > 0 ? '+' : ''}
                        {mods[k]} {STAT_LABEL[k]}
                      </span>
                    ))}
                  </div>
                  {card.effectText && (
                    <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 6, lineHeight: 1.35 }}>
                      ⚡ {card.effectText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

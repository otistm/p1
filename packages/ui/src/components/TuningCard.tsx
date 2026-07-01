import type { CSSProperties } from 'react';
import { STAT_KEYS } from '@grid/sim';
import type { Card } from '@grid/content';
import { RARITY_COLOR, STAT_COLOR, STAT_LABEL } from '../theme';
import { cardDragProps } from './KartDropZone';

export type TuningCardSize = 'hand' | 'shop';

interface TuningCardProps {
  card: Card;
  /** `shop` = wide catalog face (flavor + effect box); `hand` = compact draggable face. */
  size: TuningCardSize;
  onClick?: () => void;
  disabled?: boolean;
}

/** Signed, colored stat-mod chips — the shared visual for a card's stat changes. */
function ModChips({ card, chipSize }: { card: Card; chipSize: number }) {
  const mods = card.mods ?? {};
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {STAT_KEYS.filter((k) => mods[k]).map((k) => (
        <span
          key={k}
          className="mono"
          style={{
            fontSize: chipSize,
            fontWeight: 700,
            padding: '2px 7px',
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
  );
}

/**
 * The single source of truth for how a tuning card looks, in two sizes (see
 * docs/game-review.md §5 — this replaced the drifting `CardView` + inline `TuningCardFace`).
 * `hand` cards are draggable onto the kart to stage them; `shop` cards are click-to-buy.
 */
export function TuningCard({ card, size, onClick, disabled }: TuningCardProps) {
  const rc = RARITY_COLOR[card.rarity ?? 'common'];
  const hand = size === 'hand';
  const drag = hand ? cardDragProps({ kind: 'tuning', id: card.id }) : {};

  const base: CSSProperties = {
    textAlign: 'left',
    font: 'inherit',
    color: 'var(--ink)',
    borderRadius: hand ? 14 : 16,
    border: `1px solid ${rc}`,
    background: hand ? 'rgba(37,43,56,.97)' : 'rgba(37,43,56,.96)',
    display: 'flex',
    flexDirection: 'column',
    gap: hand ? 6 : 8,
    overflow: 'hidden',
    opacity: disabled ? 'var(--disabled-opacity)' : 1,
    boxShadow: hand
      ? '0 10px 26px rgba(0,0,0,.4)'
      : `0 10px 30px rgba(0,0,0,.35), inset 0 0 0 1px ${rc}22`,
    ...(hand
      ? { width: 156, height: 178, padding: 12, cursor: disabled ? 'not-allowed' : 'grab' }
      : { width: 220, padding: 18, cursor: disabled ? 'default' : 'pointer', transition: 'transform .1s' }),
  };

  return (
    <button
      {...drag}
      onClick={onClick}
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => !hand && !disabled && (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={(e) => !hand && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span
          style={{
            fontSize: 'var(--fs-label)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: rc,
          }}
        >
          {card.rarity ?? 'common'}
        </span>
        {!hand && card.archetype && (
          <span
            style={{
              fontSize: 'var(--fs-label)',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 999,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.14)',
              color: 'var(--muted)',
            }}
          >
            {card.archetype}
          </span>
        )}
      </div>

      <div className="display" style={{ fontSize: hand ? 15 : 22, lineHeight: 1.05, margin: hand ? 0 : '2px 0 2px' }}>
        {card.name}
      </div>

      <ModChips card={card} chipSize={hand ? 12 : 11} />

      {hand ? (
        <>
          {card.effect && card.archetype && (
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--cyan)', lineHeight: 1.3 }}>
              &#9889; {card.archetype}
            </div>
          )}
          <div className="mono" style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 'auto' }}>
            drag onto the kart
          </div>
        </>
      ) : (
        <>
          {card.effect && (card.trigger || card.effectText) && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(43,217,255,.07)',
                border: '1px solid rgba(43,217,255,.22)',
              }}
            >
              {card.trigger && (
                <div style={{ fontSize: 'var(--fs-label)', lineHeight: 1.35 }}>
                  <span
                    style={{
                      fontSize: 'var(--fs-label)',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: 'var(--muted)',
                    }}
                  >
                    When{' '}
                  </span>
                  <span style={{ color: 'var(--ink)' }}>{card.trigger}</span>
                </div>
              )}
              {card.effectText && (
                <div style={{ fontSize: 'var(--fs-label)', lineHeight: 1.35, marginTop: 2 }}>
                  <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>&rarr; </span>
                  <span style={{ color: 'var(--ink)' }}>{card.effectText}</span>
                </div>
              )}
            </div>
          )}
          {card.special && !card.effect && (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--cyan)' }}>{card.special}</div>
          )}
          {card.flavor && (
            <div style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
              {card.flavor}
            </div>
          )}
        </>
      )}
    </button>
  );
}

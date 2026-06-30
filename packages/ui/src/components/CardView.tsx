import { STAT_KEYS } from '@grid/sim';
import type { Card } from '@grid/content';
import { RARITY_COLOR, STAT_COLOR, STAT_LABEL } from '../theme';

interface CardViewProps {
  card: Card;
  onPick?: () => void;
  disabled?: boolean;
}

export function CardView({ card, onPick, disabled }: CardViewProps) {
  const rc = RARITY_COLOR[card.rarity];
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      style={{
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        background: 'rgba(37,43,56,.96)',
        border: `1px solid ${rc}`,
        borderRadius: 16,
        padding: 18,
        width: 220,
        color: 'var(--ink)',
        boxShadow: `0 10px 30px rgba(0,0,0,.35), inset 0 0 0 1px ${rc}22`,
        transition: 'transform .1s',
        font: 'inherit',
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: rc,
          }}
        >
          {card.rarity}
        </span>
        {card.archetype && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
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
      <div className="display" style={{ fontSize: 22, margin: '4px 0 10px' }}>
        {card.name}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {STAT_KEYS.map((k) => {
          const m = card.mods[k];
          if (!m) return null;
          return (
            <span
              key={k}
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 6,
                background: `${STAT_COLOR[k]}22`,
                color: STAT_COLOR[k],
              }}
            >
              {m > 0 ? '+' : ''}
              {m} {STAT_LABEL[k]}
            </span>
          );
        })}
      </div>
      {card.effect && (card.trigger || card.effectText) && (
        <div
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(43,217,255,.07)',
            border: '1px solid rgba(43,217,255,.22)',
          }}
        >
          {card.trigger && (
            <div style={{ fontSize: 11, lineHeight: 1.35 }}>
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
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
            <div style={{ fontSize: 11, lineHeight: 1.35, marginTop: 2 }}>
              <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>&rarr; </span>
              <span style={{ color: 'var(--ink)' }}>{card.effectText}</span>
            </div>
          )}
        </div>
      )}
      {card.special && !card.effect && (
        <div style={{ fontSize: 12, color: 'var(--cyan)', marginBottom: 6 }}>{card.special}</div>
      )}
      <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
        {card.flavor}
      </div>
    </button>
  );
}

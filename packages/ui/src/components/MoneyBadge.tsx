interface MoneyBadgeProps {
  amount: number;
  /** Optional signed delta shown alongside (e.g. winnings just earned). */
  delta?: number;
}

/** Consistent credits readout used in the garage, training, shop, and results screens. */
export function MoneyBadge({ amount, delta }: MoneyBadgeProps) {
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontWeight: 700,
        fontSize: 15,
        color: 'var(--amber)',
        background: 'rgba(255,182,72,.10)',
        border: '1px solid rgba(255,182,72,.4)',
        borderRadius: 999,
        padding: '4px 12px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 13 }}>◈</span>
      {amount.toLocaleString()}
      {delta !== undefined && delta > 0 && (
        <span style={{ color: 'var(--green)', fontSize: 13 }}>+{delta}</span>
      )}
    </span>
  );
}

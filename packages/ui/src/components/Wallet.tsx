import { useGame } from '@grid/game';

/** Phases where the player has (and spends) credits, so the wallet is worth showing. */
const WALLET_PHASES = new Set(['garage', 'training', 'shop', 'results']);

/**
 * A single persistent credits readout pinned to the top-left corner across the
 * economy screens, so players never hunt for their balance (see docs/game-review.md §5).
 * Mounted once in the app shell; screens no longer render their own "current balance" badge.
 */
export function Wallet() {
  const phase = useGame((s) => s.phase);
  const money = useGame((s) => s.save.money);
  if (!WALLET_PHASES.has(phase)) return null;
  return (
    <div
      className="mono"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 24,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontWeight: 700,
        fontSize: 'var(--fs-base)',
        color: 'var(--amber)',
        background: 'rgba(255,182,72,.10)',
        border: '1px solid rgba(255,182,72,.4)',
        borderRadius: 999,
        padding: '6px 14px',
        pointerEvents: 'none',
        boxShadow: '0 6px 20px rgba(0,0,0,.35)',
      }}
    >
      <span style={{ fontSize: 'var(--fs-body)' }}>&#9672;</span>
      {money.toLocaleString()}
    </div>
  );
}

import { useState } from 'react';
import { useGame, type GamePhase } from '@grid/game';

/** Bumped if the tips change materially, so an update can re-show them once. */
const SEEN_KEY = 'p1-coach-v1';

interface Tip {
  eyebrow: string;
  title: string;
  lines: string[];
}

/**
 * First-run onboarding: a single dismissible coach card shown the first time a player reaches
 * the garage and the training screen (see docs/game-review.md §1). Kept as contextual,
 * once-only tips rather than element-anchored tooltips so it can't drift with the bespoke
 * per-screen layouts. State lives in localStorage, independent of the game save (no migration).
 */
const TIPS: Partial<Record<GamePhase, Tip>> = {
  garage: {
    eyebrow: 'Welcome to P1',
    title: 'Build your kart',
    lines: [
      'Every part is a trade-off — tap a callout around the kart to swap in parts you own.',
      'Your starter build is already race-ready, so you can just press Start Season.',
    ],
  },
  training: {
    eyebrow: 'How training works',
    title: 'Drag cards onto your kart',
    lines: [
      'Drag a training card onto the kart to spend energy and build a stat.',
      'Tuning cards (bought in the Shop) stage on the kart for a single race.',
      'When the build feels right, hit Head to Race Day.',
    ],
  },
};

function loadSeen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function CoachMarks() {
  const phase = useGame((s) => s.phase);
  const [seen, setSeen] = useState<Record<string, boolean>>(loadSeen);

  const tip = TIPS[phase];
  if (!tip || seen[phase]) return null;

  const dismiss = () => {
    const next = { ...seen, [phase]: true };
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      // Non-fatal: if storage is blocked the tip simply shows again next visit.
    }
  };

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(10,12,16,.45)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(400px,92vw)', padding: '26px 28px' }}
      >
        <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
          {tip.eyebrow}
        </div>
        <div className="display" style={{ fontSize: 'var(--fs-h3)', margin: '4px 0 14px' }}>
          {tip.title}
        </div>
        <ul style={{ margin: '0 0 20px', paddingLeft: 18, display: 'grid', gap: 8 }}>
          {tip.lines.map((line, i) => (
            <li key={i} style={{ fontSize: 'var(--fs-body)', lineHeight: 1.45, color: 'var(--ink)' }}>
              {line}
            </li>
          ))}
        </ul>
        <button className="btn cyan" style={{ width: '100%' }} onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}

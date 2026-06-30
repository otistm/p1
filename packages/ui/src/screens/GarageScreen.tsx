import { useLayoutEffect, useRef, useState } from 'react';
import { useGame, overallRating } from '@grid/game';
import {
  loadoutToStats,
  PARTS_BY_ID,
  PARTS_BY_SLOT,
  type Part,
  type Slot,
} from '@grid/content';
import { STAT_KEYS } from '@grid/sim';
import { StatBars } from '../components/StatBars';
import { RARITY_COLOR, STAT_COLOR } from '../theme';

const SLOT_LABEL: Record<Slot, string> = {
  chassis: 'Chassis',
  engine: 'Engine',
  tires: 'Tires',
  brakes: 'Brakes',
  gearing: 'Gearing',
  aero: 'Aero',
  ballast: 'Ballast',
};

/** One-line trade-off framing per slot — the thing the player is choosing between. */
const SLOT_TAGLINE: Record<Slot, string> = {
  chassis: 'Sharp turn-in ⇄ forgiveness',
  engine: 'Top end ⇄ stamina',
  tires: 'Grip ⇄ wear',
  brakes: 'Late braking ⇄ heat',
  gearing: 'Acceleration ⇄ top speed',
  aero: 'Downforce ⇄ drag',
  ballast: 'Stability ⇄ agility',
};

const STAT_ABBR: Record<string, string> = {
  speed: 'SPD',
  stamina: 'STA',
  power: 'PWR',
  guts: 'GUT',
  wit: 'WIT',
};

/**
 * Where each callout box sits (edge + vertical %) and the point on the kart its leader
 * line targets (viewport %). Tuned against the fixed 3/4 garage camera in App. Keeping it
 * as one table makes the whole blueprint trivial to re-tune.
 */
type CalloutCfg = { slot: Slot; side: 'left' | 'right'; y: number; target: { x: number; y: number } };
const LAYOUT: CalloutCfg[] = [
  { slot: 'aero', side: 'right', y: 22, target: { x: 60, y: 50 } },
  { slot: 'engine', side: 'right', y: 42, target: { x: 55, y: 49 } },
  { slot: 'gearing', side: 'right', y: 62, target: { x: 62, y: 60 } },
  { slot: 'chassis', side: 'left', y: 28, target: { x: 51, y: 54 } },
  { slot: 'brakes', side: 'left', y: 48, target: { x: 44, y: 59 } },
  { slot: 'tires', side: 'left', y: 68, target: { x: 41, y: 63 } },
  { slot: 'ballast', side: 'right', y: 82, target: { x: 52, y: 62 } },
];

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Compact, signed stat-delta chips that make a part's trade-off legible at a glance. */
function StatDeltas({ part }: { part: Part }) {
  const entries = STAT_KEYS.filter((k) => part.stats[k] !== undefined).map(
    (k) => [k, part.stats[k] as number] as const,
  );
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {entries.map(([k, v]) => {
        const up = v > 0;
        return (
          <span
            key={k}
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 6,
              color: up ? STAT_COLOR[k] : 'var(--red)',
              background: up ? `${STAT_COLOR[k]}1a` : 'rgba(255,77,109,.12)',
              border: `1px solid ${up ? `${STAT_COLOR[k]}55` : 'rgba(255,77,109,.4)'}`,
            }}
          >
            {STAT_ABBR[k]} {up ? '+' : ''}
            {v}
          </span>
        );
      })}
      {part.mass !== undefined && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 6,
            color: 'var(--muted)',
            border: '1px solid var(--line)',
          }}
        >
          {part.mass > 0 ? '+' : ''}
          {part.mass}kg
        </span>
      )}
    </div>
  );
}

export function GarageScreen() {
  const save = useGame((s) => s.save);
  const equipPart = useGame((s) => s.equipPart);
  const startSeason = useGame((s) => s.startSeason);
  const goTitle = useGame((s) => s.goTitle);

  const { stats } = loadoutToStats(save.loadout);
  const overall = overallRating(stats);

  const [open, setOpen] = useState<Slot | null>(null);
  const headers = useRef(new Map<Slot, HTMLDivElement>());
  const [lines, setLines] = useState<Partial<Record<Slot, Line>>>({});

  // Measure each callout's inner edge in viewport pixels and pair it with its kart target.
  // Recomputed on layout-affecting changes (open popover, equipped part) and on resize.
  useLayoutEffect(() => {
    const recompute = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const next: Partial<Record<Slot, Line>> = {};
      for (const cfg of LAYOUT) {
        const el = headers.current.get(cfg.slot);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const x1 = cfg.side === 'left' ? r.right : r.left;
        const y1 = r.top + r.height / 2;
        next[cfg.slot] = { x1, y1, x2: (cfg.target.x / 100) * W, y2: (cfg.target.y / 100) * H };
      }
      setLines(next);
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [open, save.loadout]);

  return (
    <div className="overlay" style={{ padding: 0, pointerEvents: 'none', display: 'block' }}>
      {/* Leader lines from each callout to the part it controls. */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          overflow: 'visible',
        }}
      >
        {LAYOUT.map(({ slot }) => {
          const l = lines[slot];
          if (!l) return null;
          const active = open === slot;
          const color = active ? 'var(--cyan)' : 'var(--line)';
          return (
            <g key={slot} style={{ transition: 'opacity .15s', opacity: open && !active ? 0.35 : 1 }}>
              <line
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={color}
                strokeWidth={active ? 2 : 1.25}
                strokeDasharray={active ? undefined : '1 5'}
                strokeLinecap="round"
              />
              <circle cx={l.x1} cy={l.y1} r={3} fill={active ? 'var(--cyan)' : 'var(--muted)'} />
              <circle cx={l.x2} cy={l.y2} r={active ? 5 : 3.5} fill="var(--cyan)" />
              <circle
                cx={l.x2}
                cy={l.y2}
                r={active ? 9 : 7}
                fill="none"
                stroke="var(--cyan)"
                strokeWidth={1}
                opacity={0.4}
              />
            </g>
          );
        })}
      </svg>

      {/* Click-away layer to dismiss an open popover. */}
      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'auto' }}
        />
      )}

      {/* Title — top center. */}
      <div
        style={{
          position: 'absolute',
          top: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        <div className="eyebrow">Build · every part is a trade-off</div>
        <div className="display" style={{ fontSize: 36, lineHeight: 1.04 }}>
          {save.name}
        </div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--cyan)' }}>
          Overall {overall} · Rating {save.rating}
        </div>
      </div>

      {/* Part callouts pinned around the kart. */}
      {LAYOUT.map((cfg) => {
        const equipped = PARTS_BY_ID[save.loadout[cfg.slot]];
        const owned = PARTS_BY_SLOT[cfg.slot].filter((p) => save.ownedPartIds.includes(p.id));
        const isOpen = open === cfg.slot;
        const dropUp = cfg.y > 55;
        return (
          <div
            key={cfg.slot}
            style={{
              position: 'absolute',
              top: `${cfg.y}%`,
              [cfg.side]: 'clamp(16px, 3vw, 48px)',
              transform: 'translateY(-50%)',
              width: 230,
              zIndex: isOpen ? 6 : 3,
              pointerEvents: 'auto',
            }}
          >
            <div style={{ position: 'relative' }}>
              <div
                ref={(el) => {
                  if (el) headers.current.set(cfg.slot, el);
                  else headers.current.delete(cfg.slot);
                }}
                role="button"
                tabIndex={0}
                onClick={() => setOpen(isOpen ? null : cfg.slot)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen(isOpen ? null : cfg.slot);
                  }
                }}
                className="panel"
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderColor: isOpen ? 'var(--cyan)' : 'var(--line)',
                  boxShadow: isOpen ? '0 0 0 1px var(--cyan), 0 12px 30px rgba(0,0,0,.45)' : undefined,
                  transition: 'border-color .12s, box-shadow .12s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span className="eyebrow" style={{ fontSize: 10 }}>
                    {SLOT_LABEL[cfg.slot]}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{isOpen ? '▴' : '▾'}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 14,
                    fontWeight: 600,
                    margin: '3px 0 4px',
                  }}
                >
                  <span style={{ color: RARITY_COLOR[equipped.rarity], fontSize: 11 }}>●</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {equipped.name}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.3 }}>
                  {SLOT_TAGLINE[cfg.slot]}
                </div>
              </div>

              {isOpen && (
                <div
                  className="panel"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    [dropUp ? 'bottom' : 'top']: 'calc(100% + 8px)',
                    width: 264,
                    maxHeight: '46vh',
                    overflowY: 'auto',
                    padding: 8,
                    display: 'grid',
                    gap: 6,
                    zIndex: 7,
                    boxShadow: '0 18px 44px rgba(0,0,0,.5)',
                  }}
                >
                  {owned.map((p) => {
                    const sel = p.id === equipped.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          equipPart(cfg.slot, p.id);
                          setOpen(null);
                        }}
                        style={{
                          textAlign: 'left',
                          cursor: 'pointer',
                          font: 'inherit',
                          padding: '8px 10px',
                          borderRadius: 10,
                          color: 'var(--ink)',
                          background: sel ? 'var(--panel2)' : 'transparent',
                          border: `1px solid ${sel ? RARITY_COLOR[p.rarity] : 'var(--line)'}`,
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ color: RARITY_COLOR[p.rarity], fontSize: 10 }}>●</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                          {sel && (
                            <span
                              className="mono"
                              style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--cyan)' }}
                            >
                              EQUIPPED
                            </span>
                          )}
                        </div>
                        <StatDeltas part={p} />
                        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.35 }}>
                          {p.blurb}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Live stats + actions — bottom center. */}
      <div
        className="panel"
        style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          pointerEvents: 'auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          maxWidth: '92vw',
        }}
      >
        <div style={{ width: 300 }}>
          <StatBars stats={stats} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn cyan" onClick={startSeason}>
            Start Season →
          </button>
          <button
            className="btn ghost"
            style={{ fontSize: 14, padding: '9px 16px' }}
            onClick={goTitle}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

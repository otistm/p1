import { useGame } from '@grid/game';
import {
  loadoutToStats,
  PARTS_BY_ID,
  PARTS_BY_SLOT,
  SLOTS,
  type Slot,
} from '@grid/content';
import { overallRating } from '@grid/game';
import { StatBars } from '../components/StatBars';
import { RARITY_COLOR } from '../theme';

const SLOT_LABEL: Record<Slot, string> = {
  chassis: 'Chassis',
  engine: 'Engine',
  tires: 'Tires',
  brakes: 'Brakes',
  gearing: 'Gearing',
  aero: 'Aero',
  ballast: 'Ballast',
};

export function GarageScreen() {
  const save = useGame((s) => s.save);
  const equipPart = useGame((s) => s.equipPart);
  const startSeason = useGame((s) => s.startSeason);
  const goTitle = useGame((s) => s.goTitle);

  const { stats } = loadoutToStats(save.loadout);
  const overall = overallRating(stats);

  return (
    <div
      className="overlay"
      style={{ pointerEvents: 'auto', alignItems: 'stretch', justifyContent: 'space-between', gap: 16 }}
    >
      <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="panel" style={{ padding: 18, minWidth: 300, maxWidth: 360 }}>
          <div className="eyebrow">Your Kart</div>
          <div className="display" style={{ fontSize: 30, lineHeight: 1, marginBottom: 4 }}>
            {save.name}
          </div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--cyan)', marginBottom: 12 }}>
            Overall {overall} · Rating {save.rating}
          </div>
          <StatBars stats={stats} />
          <button className="btn cyan" style={{ marginTop: 16, width: '100%' }} onClick={startSeason}>
            Start Season →
          </button>
          <button
            className="btn ghost"
            style={{ marginTop: 10, width: '100%', fontSize: 14, padding: '10px 16px' }}
            onClick={goTitle}
          >
            Back
          </button>
        </div>

        <div className="panel" style={{ padding: 18, flex: 1, minWidth: 320 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Build — every part is a trade-off
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {SLOTS.map((slot) => {
              const owned = PARTS_BY_SLOT[slot].filter((p) => save.ownedPartIds.includes(p.id));
              const equipped = PARTS_BY_ID[save.loadout[slot]];
              return (
                <div key={slot}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>
                    {SLOT_LABEL[slot].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {owned.map((p) => {
                      const sel = p.id === equipped.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => equipPart(slot, p.id)}
                          title={p.blurb}
                          style={{
                            cursor: 'pointer',
                            font: 'inherit',
                            fontSize: 13,
                            padding: '8px 12px',
                            borderRadius: 10,
                            color: 'var(--ink)',
                            background: sel ? 'var(--panel2)' : 'transparent',
                            border: `1px solid ${sel ? RARITY_COLOR[p.rarity] : 'var(--line)'}`,
                            boxShadow: sel ? `inset 0 0 0 1px ${RARITY_COLOR[p.rarity]}55` : 'none',
                          }}
                        >
                          <span style={{ color: RARITY_COLOR[p.rarity], marginRight: 6 }}>●</span>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

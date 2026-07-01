import { effectMeta } from './effectMeta';

/** One staged tuning effect + whether it's applying to the kart *right now* (live from the sim). */
export interface TuningStatus {
  kind: string;
  active: boolean;
}

/** The live situational facts that gate tuning effects (from the player's `Racer.telemetry`). */
export interface RaceSituation {
  drafting: boolean;
  /** Metres to the draft target (only meaningful while `drafting`). */
  draftDist: number;
  cleanAir: boolean;
  traffic: number;
  beingDrafted: boolean;
}

/** Live performance readout from `Racer.live` (player). `speedFrac`/`gripLoad` move every tick;
 *  the `*Mult` fields + `fade` capture how tuning/tiring reshape the kart. */
export interface LivePerf {
  /** Speed ÷ top speed (0..~1) — climbs on straights, dips into corners. */
  speedFrac: number;
  /** Share of lateral grip the current corner is using (0..1) — spikes mid-corner. */
  gripLoad: number;
  topMult: number;
  accelMult: number;
  gripMult: number;
  steerMult: number;
  /** Stamina-fade factor on top speed (drops as the kart tires). */
  fade: number;
}

interface Chip {
  label: string;
  tint: string;
}

function situationChips(s: RaceSituation): Chip[] {
  const chips: Chip[] = [];
  if (s.drafting) {
    const d = Number.isFinite(s.draftDist) ? ` ${s.draftDist.toFixed(1)}m` : '';
    chips.push({ label: `Slipstream${d}`, tint: 'var(--cyan)' });
  }
  if (s.cleanAir) chips.push({ label: 'Clean air', tint: 'var(--green)' });
  if (s.traffic > 0) chips.push({ label: `Traffic ×${s.traffic}`, tint: 'var(--amber)' });
  if (s.beingDrafted) chips.push({ label: 'Defending', tint: 'var(--orange)' });
  return chips;
}

/** Net live tuning modifiers → signed-% chips, one per dimension that's currently off baseline.
 *  These pop in/out as effects fire, so they read as live magnitude (green boost / red penalty). */
function modifierChips(p: LivePerf): Array<{ label: string; pct: number }> {
  const out: Array<{ label: string; pct: number }> = [];
  const push = (label: string, mult: number) => {
    const pct = Math.round((mult - 1) * 100);
    if (Math.abs(pct) >= 2) out.push({ label, pct });
  };
  push('Top', p.topMult);
  push('Accel', p.accelMult);
  push('Grip', p.gripMult);
  push('Steer', p.steerMult);
  return out;
}

const GAUGE_FILL: Record<string, string> = {
  cyan: 'linear-gradient(90deg,#1b9bd8,#2bd9ff)',
  green: 'linear-gradient(90deg,#4ee08a,#2bd9ff)',
  amber: 'linear-gradient(90deg,#ffb648,#ff8a4b)',
  red: 'linear-gradient(90deg,#ff8a4b,#ff5470)',
};

/** A 0..1 fill gauge (like the stamina bar) for a value that genuinely moves each tick. */
function Gauge({ label, frac, tone, value }: { label: string; frac: number; tone: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 52, fontSize: 9, letterSpacing: 1, color: 'var(--muted)', fontWeight: 700 }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: 'rgba(20,23,31,.7)',
          border: '1px solid var(--line)',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <i
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.max(0, Math.min(100, frac * 100))}%`,
            background: GAUGE_FILL[tone] ?? GAUGE_FILL.cyan,
            transition: 'width .12s linear',
          }}
        />
      </div>
      <span className="mono" style={{ width: 44, textAlign: 'right', fontSize: 10, color: 'var(--muted)' }}>
        {value}
      </span>
    </div>
  );
}

/**
 * The in-race "vitals" cluster (bottom-left): a live window into the player's kart as the race
 * unfolds. STAMINA, SPEED and CORNER are true per-tick physics and move constantly (speed climbs
 * on straights and dips into corners; the corner-load gauge spikes as the kart leans on its grip).
 * When tuning is staged it also lists the staged effects (lighting ON as each applies), pops
 * signed-% magnitude chips for whichever modifier is live, and shows the situational facts that
 * trigger them. Purely presentational.
 */
export function RaceVitals({
  stamina,
  speedKmh,
  perf,
  tuning,
  situation,
}: {
  stamina: number;
  speedKmh: number;
  perf: LivePerf;
  tuning: TuningStatus[];
  situation: RaceSituation | null;
}) {
  const tuned = tuning.length > 0 && !!situation;
  const chips = situation ? situationChips(situation) : [];
  const mods = modifierChips(perf);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        width: 232,
        background: 'rgba(20,23,31,.82)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '11px 13px',
        backdropFilter: 'blur(6px)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Gauge
          label="STAMINA"
          frac={stamina}
          tone={stamina < 0.25 ? 'red' : 'green'}
          value={`${Math.round(stamina * 100)}%`}
        />
        <Gauge label="SPEED" frac={perf.speedFrac} tone="cyan" value={`${Math.round(speedKmh)}`} />
        <Gauge
          label="CORNER"
          frac={perf.gripLoad}
          tone={perf.gripLoad > 0.85 ? 'amber' : 'cyan'}
          value={`${Math.round(perf.gripLoad * 100)}%`}
        />
      </div>

      {tuned && (
        <>
          <div style={{ height: 1, background: 'var(--line)', margin: '9px 0 8px' }} />

          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
            TUNING
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tuning.map((t, i) => {
              const meta = effectMeta(t.kind);
              return (
                <div
                  key={`${t.kind}-${i}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: t.active ? 1 : 0.5, transition: 'opacity .12s' }}
                  title={meta.hint}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: t.active ? meta.tint : 'var(--line)',
                      boxShadow: t.active ? `0 0 8px ${meta.tint}` : 'none',
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: t.active ? 800 : 600,
                      color: t.active ? meta.tint : 'var(--ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {meta.label}
                  </span>
                  {t.active && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 1,
                        color: '#0b0e13',
                        background: meta.tint,
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      ON
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live magnitude of whatever tuning is applying this instant. */}
          {mods.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {mods.map((m) => (
                <span
                  key={m.label}
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#0b0e13',
                    background: m.pct > 0 ? 'var(--green)' : 'var(--red)',
                    borderRadius: 4,
                    padding: '1px 6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.label} {m.pct > 0 ? `+${m.pct}%` : `${m.pct}%`}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {chips.length === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Open track</span>
            ) : (
              chips.map((c) => (
                <span
                  key={c.label}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: c.tint,
                    border: `1px solid ${c.tint}`,
                    borderRadius: 999,
                    padding: '1px 7px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.label}
                </span>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

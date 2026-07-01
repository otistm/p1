import { useGame } from '@grid/game';
import { LIVERIES, TRAILS } from '@grid/content';
import { hexToCss } from '../theme';
import { DevNotes } from '../components/DevNotes';

export function TitleScreen() {
  const save = useGame((s) => s.save);
  const setName = useGame((s) => s.setName);
  const setLivery = useGame((s) => s.setLivery);
  const setTrail = useGame((s) => s.setTrail);
  const goGarage = useGame((s) => s.goGarage);

  return (
    <div className="overlay" style={{ pointerEvents: 'auto' }}>
      <DevNotes />
      <div className="card float" style={{ width: 'min(560px,92vw)', padding: '40px 38px', textAlign: 'center' }}>
        <div
          className="display"
          style={{ fontSize: 'clamp(46px,9vw,84px)', lineHeight: 0.92, letterSpacing: 1 }}
        >
          <span style={{ color: 'var(--orange)' }}>P</span>
          <span style={{ color: 'var(--cyan)' }}>1</span>
        </div>
        <p style={{ color: 'var(--muted)', margin: '14px 0 26px', fontSize: 15, lineHeight: 1.5 }}>
          Build a kart from scratch, train it, and tune your hand of cards, then watch it carve
          its own line against the field. You don't steer — you build the driver.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
          <input
            value={save.name}
            maxLength={14}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name your kart"
            style={{
              background: 'var(--panel2)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 16,
              width: 220,
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          />
        </div>

        <div className="eyebrow" style={{ marginTop: 16 }}>Livery</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px 0 4px' }}>
          {LIVERIES.map((l) => {
            const hex = l.value as number;
            const sel = hex === save.liveryHex;
            return (
              <div
                key={l.id}
                onClick={() => setLivery(hex)}
                title={l.name}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: hexToCss(hex),
                  border: `2px solid ${sel ? '#fff' : 'transparent'}`,
                  transform: sel ? 'scale(1.12)' : 'none',
                  transition: 'transform .1s',
                }}
              />
            );
          })}
        </div>

        <div className="eyebrow" style={{ marginTop: 14 }}>Trail</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px 0 4px' }}>
          {TRAILS.map((t) => {
            const hex = t.value as number;
            const sel = t.id === save.trailId;
            return (
              <div
                key={t.id}
                onClick={() => setTrail(t.id)}
                title={`${t.name} trail`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  cursor: 'pointer',
                  // A glowing pip: the trail tint radiates out, matching the in-race wake.
                  background: `radial-gradient(circle, ${hexToCss(hex)} 0%, ${hexToCss(hex)}44 70%, transparent 100%)`,
                  border: `2px solid ${sel ? '#fff' : 'transparent'}`,
                  transform: sel ? 'scale(1.12)' : 'none',
                  transition: 'transform .1s',
                }}
              />
            );
          })}
        </div>

        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={goGarage}>
            Enter Garage
          </button>
        </div>
      </div>
    </div>
  );
}

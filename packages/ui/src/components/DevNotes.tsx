import { useState } from 'react';
import { DEV_NOTES, DEV_BUILD } from '../devNotes';

/**
 * A small "Dev Notes" tag pinned to the top-right of the title screen. Clicking it opens a
 * scrollable changelist (newest first) sourced from `devNotes.ts`. Each commit + push prepends a
 * new entry — older builds stay in the list so testers can scroll back through updates.
 */
export function DevNotes() {
  const [open, setOpen] = useState(false);
  const count = DEV_NOTES.length;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="What changed in this build"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'rgba(20,23,31,.82)',
          border: '1px solid var(--line)',
          borderRadius: 999,
          padding: '6px 12px',
          color: 'var(--ink)',
          font: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
        Dev Notes
        <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>
          {DEV_BUILD}
        </span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div
            role="dialog"
            aria-label="Dev Notes changelist"
            style={{
              position: 'fixed',
              top: 54,
              right: 16,
              zIndex: 31,
              width: 'min(360px,92vw)',
              maxHeight: '72vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(16,19,26,.96)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 12px 40px rgba(0,0,0,.5)',
              overflow: 'hidden',
            }}
          >
            {/* Header stays pinned while the list scrolls. */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px 10px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div>
                <div className="display" style={{ fontSize: 18 }}>
                  Dev Notes
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {count} update{count === 1 ? '' : 's'} · scroll for older builds
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close dev notes"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 16px 14px',
                overscrollBehavior: 'contain',
              }}
            >
              {DEV_NOTES.map((note, idx) => (
                <article
                  key={note.id}
                  style={{
                    marginBottom: idx < count - 1 ? 0 : 0,
                    paddingBottom: idx < count - 1 ? 14 : 0,
                    marginTop: idx > 0 ? 14 : 0,
                    paddingTop: idx > 0 ? 14 : 0,
                    borderTop: idx > 0 ? '1px solid var(--line)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    {idx === 0 && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          color: 'var(--cyan)',
                          background: 'rgba(43,217,255,.12)',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}
                      >
                        Latest
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 700 }}>
                      {note.date}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{note.title}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.55 }}>
                    {note.changes.map((c, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

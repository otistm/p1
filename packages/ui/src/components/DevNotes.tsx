import { useState } from 'react';
import { DEV_NOTES, DEV_BUILD } from '../devNotes';

/**
 * A small "Dev Notes" tag pinned to the top-right of the title screen. Clicking it opens a
 * changelist panel (newest first) sourced from `devNotes.ts`, which we append to on every
 * commit + push. Self-contained (own open state + click-away backdrop); purely presentational.
 */
export function DevNotes() {
  const [open, setOpen] = useState(false);
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
          {/* Click-away backdrop. */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div
            style={{
              position: 'fixed',
              top: 54,
              right: 16,
              zIndex: 31,
              width: 'min(340px,92vw)',
              maxHeight: '72vh',
              overflow: 'auto',
              background: 'rgba(16,19,26,.96)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '14px 16px',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 12px 40px rgba(0,0,0,.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="display" style={{ fontSize: 18 }}>
                Dev Notes
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close dev notes"
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {DEV_NOTES.map((note) => (
              <div key={note.date} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 700 }}>
                    {note.date}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{note.title}</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
                  {note.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Screen-space speed cues for the race, tied to the player's fraction of top speed
 * (docs/game-review.md §6 — "speed doesn't read"). Two composited DOM layers, so this adds
 * **zero draw calls** to the 3D scene (protecting the render budget):
 *  - a vignette that tightens toward top speed (tunnel vision), and
 *  - radial "speed lines" that rush outward, masked to the screen edges.
 * Reduced-motion users get the static vignette only (no rushing streaks).
 */
export function SpeedFx({ frac }: { frac: number }) {
  // Thresholds tuned for this bright daytime track, where a kart spends most of its time at
  // ~0.4–0.8 of top speed: the vignette (which reads regardless of scene brightness) carries
  // the cue and the light streaks accent it near the top end.
  const vignette = clamp01((frac - 0.32) / 0.5) * 0.55;
  const streaks = clamp01((frac - 0.48) / 0.5) * 0.6;
  if (vignette <= 0.001 && (REDUCED_MOTION || streaks <= 0.001)) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} aria-hidden>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: vignette,
          transition: 'opacity .25s linear',
          background: 'radial-gradient(ellipse at 50% 52%, transparent 46%, rgba(0,0,0,.92) 100%)',
        }}
      />
      {!REDUCED_MOTION && streaks > 0.001 && (
        <div style={{ position: 'absolute', inset: 0, opacity: streaks, transition: 'opacity .2s linear' }}>
          <div
            className="speedrush"
            style={{
              position: 'absolute',
              inset: '-25%',
              background:
                'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.6) 0deg .35deg, transparent .35deg 6deg)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 34%, #000 74%)',
              maskImage: 'radial-gradient(circle at 50% 50%, transparent 34%, #000 74%)',
              mixBlendMode: 'screen',
              transformOrigin: '50% 50%',
            }}
          />
        </div>
      )}
    </div>
  );
}

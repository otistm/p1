import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGame } from '@grid/game';
import { COLORS } from '../theme';

interface Particle {
  dx: number;
  dy: number;
  size: number;
  color: string;
  dur: number;
  delay: number;
}

interface Burst {
  id: number;
  particles: Particle[];
}

const PARTICLE_COLORS = [COLORS.cyan, COLORS.green, COLORS.orange, COLORS.amber, COLORS.ink];
const PARTICLE_COUNT = 18;
const BURST_LIFETIME_MS = 950;

const REDUCED_MOTION =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 120;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 6 + Math.random() * 8,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      dur: 620 + Math.random() * 300,
      delay: Math.random() * 60,
    };
  });
}

/**
 * A screen-space particle burst that fires at the kart whenever a card is played. It watches
 * the store's `cardPlayPulse` signal (bumped on every successful play) and spawns a short-lived
 * ring of particles at the kart's on-screen anchor. Purely decorative and non-interactive; the
 * kart's own scale pulse (see ShowroomKart) is the 3D half of the same feedback.
 */
export function CardPlayFx() {
  const pulse = useGame((s) => s.cardPlayPulse);
  const phase = useGame((s) => s.phase);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seen = useRef(pulse);

  useEffect(() => {
    if (pulse === seen.current) return;
    seen.current = pulse;
    if (REDUCED_MOTION) return;
    const burst: Burst = { id: pulse, particles: makeParticles() };
    setBursts((b) => [...b, burst]);
    const timer = window.setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== burst.id)),
      BURST_LIFETIME_MS,
    );
    return () => window.clearTimeout(timer);
  }, [pulse]);

  // Only meaningful on the training screen (the only place cards are played onto the kart).
  if (phase !== 'training' || bursts.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 25,
        overflow: 'hidden',
      }}
    >
      {bursts.map((burst) => (
        <div
          key={burst.id}
          style={{
            position: 'absolute',
            // The showroom kart sits around here on screen (matches KartDropZone's framing).
            left: '50%',
            top: '38%',
          }}
        >
          {burst.particles.map((p, i) => (
            <span
              key={i}
              style={
                {
                  position: 'absolute',
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  background: p.color,
                  boxShadow: `0 0 10px ${p.color}`,
                  animation: `cardburst ${p.dur}ms cubic-bezier(.15,.7,.3,1) ${p.delay}ms forwards`,
                  '--dx': `${p.dx}px`,
                  '--dy': `${p.dy}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

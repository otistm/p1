import { useState, type ReactNode } from 'react';

export interface HandCard {
  key: string;
  node: ReactNode;
}

interface CardHandProps {
  cards: HandCard[];
  /** Rendered card width in px (used to size the overlap of a large hand). */
  cardWidth?: number;
}

/**
 * Lays a set of cards out as a fanned "hand" along the bottom of the screen, like a digital
 * trading-card game. Cards rotate around a shared pivot and arc downward toward the edges;
 * a hovered/focused card straightens, lifts, and rises above its neighbours so it can be
 * read and clicked. Purely presentational — each card's own button handles interaction.
 */
export function CardHand({ cards, cardWidth = 156 }: CardHandProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const n = cards.length;
  const mid = (n - 1) / 2;
  // Tighten the fan as the hand grows so it always fits; overlap big hands like real cards.
  const step = n > 1 ? Math.min(4.5, 38 / n) : 0; // degrees between adjacent cards
  const overlap = n > 6 ? -(cardWidth * 0.34) : 10; // negative margin = overlap

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        // Headroom so a lifted/rotated card is never clipped by the container, and bottom room
        // so the downward arc of the edge cards stays on-screen.
        paddingTop: 44,
        paddingBottom: 52,
      }}
    >
      {cards.map((c, i) => {
        const off = i - mid;
        const rot = off * step;
        const arc = Math.abs(off) * Math.abs(off) * 0.8; // edge cards sit a little lower
        const isHover = hovered === c.key;
        return (
          <div
            key={c.key}
            onMouseEnter={() => setHovered(c.key)}
            onMouseLeave={() => setHovered((h) => (h === c.key ? null : h))}
            onFocusCapture={() => setHovered(c.key)}
            onBlurCapture={() => setHovered((h) => (h === c.key ? null : h))}
            style={{
              margin: `0 ${overlap / 2}px`,
              transformOrigin: 'bottom center',
              transform: isHover
                ? 'translateY(-30px) rotate(0deg) scale(1.1)'
                : `translateY(${arc}px) rotate(${rot}deg)`,
              transition: 'transform .16s ease',
              zIndex: isHover ? 200 : i,
              willChange: 'transform',
            }}
          >
            {c.node}
          </div>
        );
      })}
    </div>
  );
}

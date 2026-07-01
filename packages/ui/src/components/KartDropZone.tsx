import { useState, type DragEvent } from 'react';

/** The custom drag payload MIME type cards in the hand write to `dataTransfer`. */
export const CARD_DRAG_MIME = 'application/x-p1-card';

export interface CardDragPayload {
  kind: 'training' | 'tuning';
  id: string;
}

/** Helper for a draggable hand card: spread onto the card's root element. */
export function cardDragProps(payload: CardDragPayload) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(CARD_DRAG_MIME, JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', payload.id);
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}

interface KartDropZoneProps {
  onDropTraining?: (cardId: string) => void;
  onDropTuning?: (cardId: string) => void;
}

/**
 * The kart itself is the play surface: dragging a card out of the hand and releasing it
 * here plays it (see docs/training-tuning-cards.md). A real 3D drop target would need
 * raycasting into the R3F canvas from the UI layer, so this is an invisible screen-space hit
 * area roughly framing where the showroom kart sits — no visible container, just a soft glow
 * while a card is actively dragged over it so the drop reads as "onto the kart".
 */
export function KartDropZone({ onDropTraining, onDropTuning }: KartDropZoneProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const raw = e.dataTransfer.getData(CARD_DRAG_MIME);
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as CardDragPayload;
          if (payload.kind === 'training') onDropTraining?.(payload.id);
          else onDropTuning?.(payload.id);
        } catch {
          // Malformed/foreign drag payload — ignore.
        }
      }}
      style={{
        position: 'absolute',
        top: '14%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(52vw, 480px)',
        height: '46vh',
        borderRadius: '50%',
        background: over ? 'radial-gradient(closest-side, rgba(43,217,255,.16), transparent 70%)' : 'transparent',
        transition: 'background .15s',
        pointerEvents: 'auto',
        zIndex: 4,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 12,
      }}
    >
      {over && (
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'var(--cyan)' }}>
          Release to play on the kart
        </span>
      )}
    </div>
  );
}

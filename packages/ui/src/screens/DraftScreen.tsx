import { useGame } from '@grid/game';
import { CARDS_BY_ID, ROUNDS } from '@grid/content';
import { CardView } from '../components/CardView';

export function DraftScreen() {
  const season = useGame((s) => s.season);
  const pick = useGame((s) => s.pickDraftCard);
  const offer = season.pendingDraft ?? [];
  const round = ROUNDS[season.round];

  return (
    <div className="overlay" style={{ pointerEvents: 'auto', flexDirection: 'column', gap: 8 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div className="eyebrow">{round.name} · Setup Draft</div>
        <div className="display" style={{ fontSize: 36 }}>
          Choose a Tune
        </div>
        <p style={{ color: 'var(--muted)', margin: '6px 0 0' }}>
          Conditional tunes: small stat shifts plus a triggered effect that fires from your
          position, the pack, and the corner you&rsquo;re in. Pick the one that fits your build.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {offer.map((id) => {
          const card = CARDS_BY_ID[id];
          if (!card) return null;
          return <CardView key={id} card={card} onPick={() => pick(id)} />;
        })}
      </div>
    </div>
  );
}

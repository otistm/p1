import type { CSSProperties } from 'react';
import {
  useGame,
  computeRaceStats,
  projectedGain,
  canAffordTraining,
  trainingSessionsLeft,
  MAX_TRAINING_SESSIONS_PER_ROUND,
} from '@grid/game';
import { CARDS_BY_ID, ROUNDS, TRAINING_CARDS, type Card } from '@grid/content';
import { StatBars } from '../components/StatBars';
import { CardHand, type HandCard } from '../components/CardHand';
import { TuningCard } from '../components/TuningCard';
import { KartDropZone, cardDragProps } from '../components/KartDropZone';
import { COLORS, STAT_COLOR, STAT_LABEL } from '../theme';

const CARD_W = 156;
const cardBase: CSSProperties = {
  width: CARD_W,
  height: 178,
  borderRadius: 14,
  padding: 12,
  textAlign: 'left',
  color: 'var(--ink)',
  font: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  overflow: 'hidden',
  boxShadow: '0 10px 26px rgba(0,0,0,.4)',
};

function chip(label: string, color: string) {
  return (
    <span
      key={label}
      className="mono"
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: 6,
        background: `${color}22`,
        color,
      }}
    >
      {label}
    </span>
  );
}

/** A permanent training card: drag onto the kart (or click) to spend energy playing it. */
function TrainingCardFace({
  t,
  energy,
  sessionsLeft,
  onPlay,
}: {
  t: Card;
  energy: number;
  sessionsLeft: number;
  onPlay: () => void;
}) {
  // Rest (pure energy restore) is never session-capped; stat-building cards are.
  const isStatSession = !t.restoreEnergy;
  const outOfSessions = isStatSession && sessionsLeft <= 0;
  const disabled = !canAffordTraining(t, energy) || outOfSessions;
  const accent = t.mainStat ? STAT_COLOR[t.mainStat] : COLORS.orange;
  const gain = projectedGain(t, energy);
  return (
    <button
      {...cardDragProps({ kind: 'training', id: t.id })}
      onClick={onPlay}
      disabled={disabled}
      style={{
        ...cardBase,
        cursor: disabled ? 'not-allowed' : 'grab',
        opacity: disabled ? 0.45 : 1,
        background: 'rgba(30,35,46,.97)',
        border: `1px solid ${accent}55`,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div className="eyebrow" style={{ color: accent }}>
        Training
      </div>
      <div style={{ fontSize: 32, lineHeight: 1 }}>{t.icon}</div>
      <div className="display" style={{ fontSize: 16, lineHeight: 1.05 }}>
        {t.name}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
        {t.mainStat ? (
          <>
            {chip(`+${gain} ${STAT_LABEL[t.mainStat]}`, STAT_COLOR[t.mainStat])}
            {t.splashStat && t.splashAmt ? chip(`+${t.splashAmt} ${STAT_LABEL[t.splashStat]}`, STAT_COLOR[t.splashStat]) : null}
          </>
        ) : (
          chip(`+${t.restoreEnergy} Energy`, COLORS.orange)
        )}
      </div>
      <div className="mono" style={{ fontSize: 'var(--fs-label)', color: (t.energyCost ?? 0) > 0 ? 'var(--orange)' : 'var(--muted)' }}>
        {outOfSessions ? 'no sessions left' : (t.energyCost ?? 0) > 0 ? `−${t.energyCost} energy` : 'free'}
      </div>
    </button>
  );
}

export function TrainingScreen() {
  const save = useGame((s) => s.save);
  const season = useGame((s) => s.season);
  const playTrainingCard = useGame((s) => s.playTrainingCard);
  const playTuningCard = useGame((s) => s.playTuningCard);
  const headToRace = useGame((s) => s.headToRace);
  const goShop = useGame((s) => s.goShop);
  const openKartInspector = useGame((s) => s.openKartInspector);
  const editBuild = useGame((s) => s.editBuild);

  const { stats } = computeRaceStats(save.loadout, season.trainedStats, season.stagedTuningCardIds);
  const round = ROUNDS[season.round];
  const energy = season.energy;
  const cond = energy > 75 ? 'Fresh' : energy > 45 ? 'Good' : energy > 20 ? 'Tired' : 'Spent';
  const sessionsLeft = trainingSessionsLeft(season);

  // Owned tuning copies not yet staged for this race — playing one removes it from the hand
  // (it's staged on the kart instead; see the kart inspector) until the race resolves.
  const stagedCounts = new Map<string, number>();
  for (const id of season.stagedTuningCardIds) stagedCounts.set(id, (stagedCounts.get(id) ?? 0) + 1);
  const availableTuningIds: string[] = [];
  const seenCounts = new Map<string, number>();
  for (const id of save.ownedCardIds) {
    const seen = (seenCounts.get(id) ?? 0) + 1;
    seenCounts.set(id, seen);
    if (seen > (stagedCounts.get(id) ?? 0)) availableTuningIds.push(id);
  }

  const hand: HandCard[] = [
    ...TRAINING_CARDS.map((t) => ({
      key: `train:${t.id}`,
      node: <TrainingCardFace t={t} energy={energy} sessionsLeft={sessionsLeft} onPlay={() => playTrainingCard(t.id)} />,
    })),
    ...availableTuningIds
      .map((id) => CARDS_BY_ID[id])
      .filter((c): c is Card => !!c)
      .map((card, i) => ({
        key: `tune:${card.id}:${i}`,
        node: <TuningCard card={card} size="hand" onClick={() => playTuningCard(card.id)} />,
      })),
  ];

  return (
    <div
      className="overlay"
      style={{ pointerEvents: 'auto', flexDirection: 'column', justifyContent: 'space-between', padding: 18 }}
    >
      {/* Status bar (offset down to clear the fixed top-left wallet and top-right CTA). */}
      <div style={{ position: 'relative', zIndex: 6, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginTop: 40 }}>
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow">Your Kart</div>
          <div className="display" style={{ fontSize: 'var(--fs-h3)', lineHeight: 1 }}>
            {save.name}
          </div>
          <div className="mono" style={{ fontSize: 'var(--fs-body)', color: 'var(--cyan)' }}>
            Round {season.round + 1} · {round.name}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className="btn ghost sm"
              onClick={openKartInspector}
              title="Select your kart to view build & staged tuning"
            >
              View Build
            </button>
            <button
              className="btn ghost sm"
              onClick={editBuild}
              title="Pop into the garage to re-equip owned parts, then come back"
            >
              Edit Build
            </button>
          </div>
        </div>
        <div className="panel" style={{ padding: 16, minWidth: 280 }}>
          <StatBars stats={stats} />
        </div>
        <div className="panel" style={{ padding: 16, minWidth: 200 }}>
          <div className="eyebrow">Condition</div>
          <div style={{ height: 14, background: 'var(--panel2)', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
            <i
              style={{
                display: 'block',
                height: '100%',
                width: `${Math.max(0, Math.min(100, energy))}%`,
                background:
                  energy < 35
                    ? 'linear-gradient(90deg,#ff8a4b,var(--red))'
                    : 'linear-gradient(90deg,#ffb648,#ff6a2b)',
                transition: 'width .4s',
              }}
            />
          </div>
          <div className="mono" style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)', marginTop: 6 }}>
            {cond} · {Math.round(energy)}% · {sessionsLeft}/{MAX_TRAINING_SESSIONS_PER_ROUND} sessions
          </div>
          <button className="btn ghost sm" style={{ marginTop: 10, width: '100%' }} onClick={goShop}>
            Shop
          </button>
        </div>
      </div>

      {/* Head to Race Day — pinned to the top-right corner at the shared primary-CTA size. */}
      <button
        className="btn cyan"
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 8 }}
        onClick={headToRace}
      >
        Head to Race Day →
      </button>

      {/* The kart drop target — an invisible hit area roughly framing the 3D showroom kart. */}
      <KartDropZone onDropTraining={playTrainingCard} onDropTuning={playTuningCard} />

      {/* Hand legend, centered. */}
      <div style={{ position: 'relative', zIndex: 6, textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
          Drag a <span style={{ color: 'var(--ink)' }}>training</span> card onto the kart to spend energy · drag{' '}
          <span style={{ color: 'var(--cyan)' }}>tuning</span> cards to stage them for this race
        </div>
      </div>

      {/* The hand, fanned along the bottom. Raised above the kart drop zone so it's always
          clickable/draggable where the two overlap. */}
      <div style={{ position: 'relative', zIndex: 6 }}>
        <CardHand cards={hand} cardWidth={CARD_W} />
      </div>
    </div>
  );
}

import { useGame, cardPrice, rerollCost, MAX_OWNED_TUNING, SHOP_MAX_REROLLS, SHOP_SLOTS } from '@grid/game';
import { CARDS_BY_ID } from '@grid/content';
import { TuningCard } from '../components/TuningCard';
import { MoneyBadge } from '../components/MoneyBadge';

/**
 * A 4-slot rotating stall (see docs/training-tuning-cards.md): a fresh weighted sample of
 * the live tuning catalog every visit, a slot empties once bought, and up to
 * `SHOP_MAX_REROLLS` paid rerolls (doubling in price) refresh the whole offer.
 */
export function ShopScreen() {
  const save = useGame((s) => s.save);
  const slots = useGame((s) => s.shopSlotCardIds);
  const rerollCount = useGame((s) => s.shopRerollCount);
  const buyShopSlot = useGame((s) => s.buyShopSlot);
  const rerollShop = useGame((s) => s.rerollShop);
  const closeShop = useGame((s) => s.closeShop);

  const collectionFull = save.ownedCardIds.length >= MAX_OWNED_TUNING;
  const rerollsLeft = SHOP_MAX_REROLLS - rerollCount;
  const nextRerollCost = rerollCost(rerollCount);
  const canReroll = rerollsLeft > 0 && save.money >= nextRerollCost;

  return (
    <div
      className="overlay"
      style={{ pointerEvents: 'auto', flexDirection: 'column', padding: 18, gap: 14 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          width: 'min(1080px,96vw)',
          margin: '0 auto',
          // Clear the fixed top-left wallet.
          marginTop: 34,
        }}
      >
        <div>
          <div className="eyebrow">Tuning Shop</div>
          <div className="display" style={{ fontSize: 'var(--fs-h2)', lineHeight: 1 }}>
            Spend your winnings
          </div>
          <p style={{ color: 'var(--muted)', margin: '6px 0 0', maxWidth: 560, fontSize: 'var(--fs-body)' }}>
            {SHOP_SLOTS} tuning cards on offer. Buying adds a card to your collection (max{' '}
            {MAX_OWNED_TUNING}); stage it on the kart back in training. Staged cards are spent on
            race day, so keep coming back.
          </p>
        </div>
        <button className="btn cyan" onClick={closeShop}>
          Done
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: 'min(1080px,96vw)',
          margin: '0 auto',
        }}
      >
        <div className="mono" style={{ fontSize: 'var(--fs-label)', color: 'var(--muted)' }}>
          Collection: {save.ownedCardIds.length}/{MAX_OWNED_TUNING} tuning cards
          {collectionFull && (
            <span style={{ color: 'var(--red)', marginLeft: 8 }}>full — play one before buying more</span>
          )}
        </div>
        <button className="btn ghost" onClick={rerollShop} disabled={!canReroll}>
          {rerollsLeft > 0 ? `Reroll (${nextRerollCost})` : 'No rerolls left'}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          width: 'min(1080px,96vw)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          justifyItems: 'center',
          alignContent: 'start',
          paddingBottom: 8,
        }}
      >
        {slots.map((id, slot) => {
          if (!id) {
            return (
              <div
                key={`empty-${slot}`}
                style={{
                  width: 220,
                  height: 260,
                  borderRadius: 16,
                  border: '1px dashed var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  fontSize: 'var(--fs-label)',
                }}
              >
                Sold
              </div>
            );
          }
          const card = CARDS_BY_ID[id];
          if (!card) return null;
          const price = cardPrice(id);
          const canAfford = save.money >= price && !collectionFull;
          return (
            <div key={`${id}-${slot}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 4px',
                  minHeight: 22,
                }}
              >
                <MoneyBadge amount={price} />
                {!canAfford && (
                  <span className="mono" style={{ fontSize: 'var(--fs-label)', color: 'var(--red)' }}>
                    {collectionFull ? 'Collection full' : 'Not enough'}
                  </span>
                )}
              </div>
              <TuningCard card={card} size="shop" onClick={() => buyShopSlot(slot)} disabled={!canAfford} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

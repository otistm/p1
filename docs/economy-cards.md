# Reference: shop economy (collection + card hand)

Decision: a persistent collection bought with podium **winnings**, played from a **hand** of
cards on the training screen. (The earlier per-run *draft* — pick 1 of 3 random owned cards —
was removed on 2026-06-30; see `DECISIONS.md`.)

## The loop

1. **Collection (persistent meta)** — players own parts and tuning cards across seasons
   (`PlayerSave.ownedCardIds`), saved locally now, server-side later. New tuning cards are
   **bought** in the shop with `money`.
2. **Currency (`PlayerSave.money`)** — earned by finishing a race. `racePayout(rank, round)`
   pays `FINISH_PAYOUT = [120, 70, 35, 22, 14, 9]` (podium best, with a small 4th–6th
   consolation added in Phase 1 so a loss isn't a total wipe — see `docs/game-review.md` §2),
   scaled up `×(1 + round*0.4)` in the tougher later rounds. New players start with a small
   seed balance so the shop is usable before the first win.
3. **Shop (`ShopScreen`)** — tuning cards priced by rarity (`cardPrice`: common 40 / rare 90 /
   epic 160 / legendary 280). Buying adds the card to the collection. Phase-2 (inert) cards are
   excluded via `LIVE_CARD_IDS`. The storefront layout (4 rotating slots + paid rerolls) is
   specified in [training-tuning-cards.md](training-tuning-cards.md).
4. **Hand + play (per season)** — the training screen shows a fanned, TCG-style hand
   (`CardHand`): the six **training** cards (always available) plus the player's owned
   **tuning** cards. This is the moment-to-moment build expression and gives runs variety.
   **The card/hand rules are specified in [training-tuning-cards.md](training-tuning-cards.md)**
   (unified card database, drag-to-kart play, 4-card consumable tuning hand, kart inspector,
   and the 4-slot reroll shop), which supersedes the earlier equip-up-to-3
   (`EQUIP_SLOTS`) model described here.

## Cards

A card is data: it targets ratings with modest flat `mods`, has a rarity + theme, and may
carry a **triggered in-sim effect** (`effect`) plus human-readable `trigger`/`effectText`
and an `archetype` tag. Flat examples:

- *Sticky Compound* (rare): +power, +latGrip; faster tire wear.
- *Long-Haul Tune* (epic): +stamina, −drain; −accel.
- *Late Brake Master* (epic): +brake, +judge on final lap.
- *Featherweight Frame* (legendary): −mass, +accel, +handling; −stamina.

### Triggered (conditional) cards

The marquee model: small stat shift **plus** an effect that fires from in-race context
(proximity, position, the corner you're in). Identical decks therefore diverge. Effects are
evaluated deterministically inside the sim for **all entrants** (player, ghosts, rivals);
see `sim-physics.md` → "Card effects + spatial zones". Phase-1 cards (live):

- *Slingshot Siphon* — sustained draft on a straight → +15% accel.
- *Corner Pocket* — rival on the apex → take the outer line, +15% exit grip.
- *Claustrophobia* — 3+ karts in your bubble → +10% speed to open space, −15% steering.
- *Paint-Scraper* — rival alongside mid-corner → +25% shove, push them wide.
- *Clean-Air Supercharger* — leading in clean air → +8% top speed, −5% stability.
- *Desperation Draft* — 4th+ on the final lap → 3× draft range, +12% tow speed.
- *Vanguard Shield* — top-3 and defended → centre line, +20% blocking width.

Phase-2 cards (engine heat, tyre wear, drift/KERS, rubber line, kerb hook, hazards) exist as
scaffolded data but are **inert** until their subsystems ship. Balance: the season harness
(`tools/diag/season.ts`) confirms effects are a net-neutral trade-off on win/podium rates
while adding overtakes (more drama).

## Non-pay-to-win stance (recommended)

- Power comes from **synergy and trade-offs**, not flat stat walls. Higher rarity raises
  ceilings and adds *conditional* effects, not unconditional power.
- Monetization (if any) is **cosmetic-only** (livery, decals, wheels, trails). Cosmetics
  never touch `KartStats`.
- Winnings pay **only** on the podium, so power tracks *racing well*, not grinding; the shop
  sells conditional trade-off cards, not flat stat walls.

## Data location

Parts, cards, and cosmetics are Zod-validated data in `@grid/content`. Adding content is
a data change (see `content-schema.md`), never an engine change.

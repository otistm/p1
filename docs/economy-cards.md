# Reference: hybrid economy (draft + collection)

Decision: **hybrid**. A persistent collection of parts/cards earned over time, PLUS an
in-run draft that assembles the kart for the current season.

## Two layers

1. **Collection (persistent meta)** — like Umamusume support cards. Players earn/own
   parts and cards across seasons; cards can be leveled/upgraded. Saved locally now,
   server-side later. This is the long-term progression.
2. **In-run draft (per season)** — at the season start (and at milestones), the player
   is offered a choice of cards drawn from their collection (plus some neutral pool). The
   chosen cards modify the kart's parts/ratings for that run. This is the moment-to-moment
   build expression and gives runs variety.

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
- Draft offers are **seeded** so a run can be reproduced and shared.

## Data location

Parts, cards, and cosmetics are Zod-validated data in `@grid/content`. Adding content is
a data change (see `content-schema.md`), never an engine change.

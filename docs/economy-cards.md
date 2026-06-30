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

A card is data: it targets parts or ratings with modifiers, has a rarity, and may carry
a special modifier (conditional effect) and a flavor theme. Examples:

- *Sticky Compound* (rare): +power, +latGrip; faster tire wear.
- *Long-Haul Tune* (epic): +stamina, −drain; −accel.
- *Late Brake Master* (epic): +brake, +judge on final lap.
- *Featherweight Frame* (legendary): −mass, +accel, +handling; −stamina.

## Non-pay-to-win stance (recommended)

- Power comes from **synergy and trade-offs**, not flat stat walls. Higher rarity raises
  ceilings and adds *conditional* effects, not unconditional power.
- Monetization (if any) is **cosmetic-only** (livery, decals, wheels, trails). Cosmetics
  never touch `KartStats`.
- Draft offers are **seeded** so a run can be reproduced and shared.

## Data location

Parts, cards, and cosmetics are Zod-validated data in `@grid/content`. Adding content is
a data change (see `content-schema.md`), never an engine change.

# Reference: training & tuning cards

> **Status: implemented** (2026-07-01). Sections below describe the shipped model; file paths
> point at the real implementation. See [§8](#8-balance--economy-risks-flagged-not-resolved)
> for balance risks that are flagged but not yet tuned.

The card system is the moment-to-moment expression layer of the meta loop: between races
the player spends **energy** on training cards to grow the kart's ratings, and spends
**credits** in the shop on tuning cards that they then **play onto the kart** for a single
race. This doc is the source of truth for the unified card database, the hand rules, how and
when cards are played, the kart inspector, and the reroll shop.

> Supersedes the "Hand + equip" section of [economy-cards.md](economy-cards.md). The
> currency, payout, pricing, and non-pay-to-win stance there still hold; the card/hand model
> below replaces the old equip-up-to-3 loop.

## Goals

- **One database for all cards.** Training and tuning are two kinds of the same card entity,
  so the whole catalog is browsable, validatable, and extendable in one place.
- **A legible, tactile play verb.** The player *drags a card out of the hand onto the kart*
  to play it — no hidden click-toggles. What's on the kart is what races.
- **A reason to keep shopping.** Tuning cards are **consumable** (spent when the race they
  were played in resolves), so the shop stays relevant every single race instead of being a
  one-time buy.

---

## 1. The unified card database

Today the two card kinds are modelled by two separate types — `Training`
([packages/game/src/season.ts](../packages/game/src/season.ts)) and `Card`
([packages/content/src/schema.ts](../packages/content/src/schema.ts)). This design **merges
them into a single `CardSchema`** in `@grid/content`, discriminated by `kind`.

```ts
// @grid/content — sketch of the unified schema
kind: 'training' | 'tuning'

// common
id: string            // stable, unique (e.g. 'card.nitromap', 'train.speed')
name: string
flavor: string

// training-only (required when kind === 'training')
icon?: string         // emoji shown on the card face
energyCost?: number   // energy spent to play it (rest = 0)
mainStat?: StatKey | null
mainAmt?: number
splashStat?: StatKey
splashAmt?: number
restoreEnergy?: number // rest cards only

// tuning-only (required when kind === 'tuning')
rarity?: Rarity
theme?: StatKey
mods?: Partial<KartStats>
effect?: CardEffect    // triggered in-sim effect (see sim-physics.md)
trigger?: string
effectText?: string
archetype?: string
```

Implementation hook: enforce the by-kind requirements with a Zod `.refine()` on the schema
so malformed content fails at the boundary (per [content-schema.md](content-schema.md)). The
existing `CardEffect` mirror is unchanged.

### The catalog

Two registries collapse into one `CARDS` array. Current data, restated as the unified rows:

#### Training cards (kind: `training`) — always in hand, permanent

| id | icon | name | main | splash | energy cost |
|----|------|------|------|--------|-------------|
| `train.speed` | 🏁 | Speed Sprints | +11 speed | +3 power | −30 |
| `train.power` | 💪 | Power Drills | +11 power | +3 guts | −30 |
| `train.corner` | 🌀 | Slalom Lab | +11 wit | +3 speed | −28 |
| `train.endure` | 🫀 | Endurance Laps | +11 stamina | +3 guts | −32 |
| `train.grit` | 🔥 | Grit Session | +11 guts | +3 stamina | −30 |
| `train.rest` | 😴 | Rest & Tune | — | — | free, +48 energy |

Main-stat gain scales with condition: `round(mainAmt * (0.5 + 0.5*energy/100))` (see
`projectedGain` / `applyTraining`). Splash is flat. Low-energy sessions can "fail" for
reduced gains. These formulas carry over unchanged.

#### Tuning cards (kind: `tuning`) — bought, played, consumed

Flat cards:

| id | name | rarity | mods |
|----|------|--------|------|
| `card.balanced` | Balanced Setup | common | +2 to every stat |
| `card.nitromap` | Aggressive Map | rare | +7 speed, −2 stamina |
| `card.sticky` | Sticky Compound | rare | +6 power, −3 stamina |
| `card.racecraft` | Racecraft | rare | +8 wit |
| `card.gritseat` | Grit & Bracing | rare | +6 guts, +2 power |
| `card.latebrake` | Late-Brake Master | epic | +5 power, +4 wit |
| `card.longhaul` | Long-Haul Tune | epic | +8 stamina, +2 wit |
| `card.slingshot` | Slipstream Slingshot | epic | +6 speed, +3 power, −1 wit |
| `card.ironwill` | Iron Will | epic | +8 guts, +3 stamina |
| `card.feather` | Featherweight Tune | legendary | +5 speed, +4 power, −3 stamina |

Conditional (triggered) cards — small mods, power comes from the situation:

| id | name | rarity | archetype | trigger → effect |
|----|------|--------|-----------|------------------|
| `card.cornerpocket` | Corner Pocket | rare | Cornering | rival holds the apex ahead → outer line, +15% exit traction |
| `card.claustro` | Claustrophobia | rare | Traffic | 3+ karts crowd your bubble → +10% speed, −15% steering |
| `card.desperation` | Desperation Draft | rare | Underdog | 4th+ on final lap → 3× draft range, +12% tow speed |
| `card.siphon` | Slingshot Siphon | epic | Draft | 1.5s tucked in a draft → +15% accel out of the tow |
| `card.paintscraper` | Paint-Scraper | epic | Traffic | rival alongside mid-corner → +25% shove, pushes them wide |
| `card.vanguard` | Vanguard Shield | epic | Leader | top-3 while defended → centre line, +20% blocking width |
| `card.cleanair` | Clean-Air Supercharger | legendary | Leader | leading in clean air → +8% top speed, −5% stability |

Phase-2 (scaffolded, **inert** until their sim subsystems ship, excluded from the shop via
`LIVE_CARD_IDS`): `card.redline`, `card.driftchain`, `card.conserve`, `card.groovelock`,
`card.gutterhook`, `card.debrisdodger`. See [economy-cards.md](economy-cards.md) for the
phase split.

Rarity prices (`cardPrice`, unchanged): common 40 / rare 90 / epic 160 / legendary 280.

---

## 2. The hand — composition & limits

The hand is the fanned, TCG-style strip along the bottom of the training screen
([CardHand.tsx](../packages/ui/src/components/CardHand.tsx)).

| | Training cards | Tuning cards |
|---|---|---|
| In hand | All 6, always | Up to **4** |
| Ownership | Permanent — never leave the hand | Owned copies; **at most 4 total** |
| Play cost | Energy (`energyCost`) | Free to play; consumed after the race |
| Playable when | The player has energy to pay the cost | Not yet played this race |
| After a race | Unchanged | Played copies are **removed from the collection** |

Rules, stated precisely:

- **Training cards are always available** as long as the player has enough energy for the
  card's `energyCost`. When energy is too low to pay for any training card, the training
  phase is effectively over.
- **Energy is the sole gate.** The current dual gate (a fixed `turnsLeft` counter *and*
  energy) is simplified: `SeasonState.turnsLeft` is **retired**, energy alone limits how much
  training a player can do. `rest` (free, +48 energy) is the pressure-release valve, so a
  season has a soft, self-pacing length rather than a hard turn budget.
- **The player can own at most 4 tuning cards at a time**, and therefore never has more than
  4 tuning cards in hand. Duplicates of the same card id are allowed (they're consumable), so
  ownership is a small bag of ≤4 copies, not a set of unique ids. Buying while full is
  blocked in the shop (the player must play/consume or make room first).
- **The player starts with zero tuning cards.** `PlayerSave.ownedCardIds` begins empty — every
  tuning card in the collection was bought in the shop. Training cards need no starting
  allotment since they're catalog-defined and always in hand.
- **Only training cards are permanent in the hand.** Tuning cards come and go with the shop
  and with consumption: a tuning card **disappears from the hand the instant it's played**
  (dragged onto the kart) — it isn't shown "staged" in the hand, so the hand only ever shows
  cards still available to play. What's staged for the next race is visible in the kart
  inspector (§4) instead.

---

## 3. Playing a card — drag onto the kart

The play verb is **drag-and-drop**: the player drags a card out of the hand and drops it onto
the 3D kart. This replaces today's click-to-train / tap-to-equip.

- **Drag a training card onto the kart** → the training resolves immediately: apply the
  main + splash stat gains and subtract `energyCost` (the existing `applyTraining` math). The
  card returns to the hand (it's permanent) and a toast confirms what was gained (e.g. "Speed
  Sprints: +11 Speed, +3 Power") — every play gives explicit feedback, not just the occasional
  flavor event or failure.
- **Drag a tuning card onto the kart** → the card is **staged** for the next race and
  **disappears from the hand** immediately (it isn't rendered as a "staged" tile — the hand
  only shows cards still available to play). Staged tuning cards feed the race exactly like
  today's equipped cards do (`computeRaceStats` sums their `mods`; `effectsFromCardIds`
  attaches their triggered effects). What's staged is visible in the kart inspector (§4).
- A tuning card **can only be played once per race** — once staged it can't be played again
  for that race (and it's no longer in the hand to play again anyway).
- When the race resolves (`finishRace`), **every staged/played tuning card is permanently
  removed** from `ownedCardIds`, win or lose. To use it again the player re-buys it.

Drop feedback: hovering a dragged card over the kart shows a soft glow on the (otherwise
invisible) drop area; releasing elsewhere returns the card to the hand with no effect. There
is no persistent visible container for the drop target — the kart itself is the target, not a
box drawn around it.

Play feedback (both halves fire on every *successful* play): the game layer bumps a monotonic
`cardPlayPulse` counter in the store, and the render + UI layers each watch it. The 3D kart
plays a quick scale up/down bounce (`ShowroomKart`'s `pulseKey` prop → a one-hump sine over
~0.42s) to signal "you just affected me", and a screen-space particle burst
(`CardPlayFx`, [packages/ui/src/components/CardPlayFx.tsx](../packages/ui/src/components/CardPlayFx.tsx))
sprays a short-lived ring of particles at the kart's on-screen anchor. Both respect
`prefers-reduced-motion`. The game layer stays effect-agnostic — it only increments the
counter.

The **"Head to Race Day →"** button is pinned to the top-right corner of the training screen
(not a center CTA) so it stays reachable and out of the way of the hand/kart at all times —
heading to race is a deliberate action the player can take whenever they're ready, not gated
by a turn counter.

---

## 4. The kart inspector — "select your kart"

The player can **select their kart** to see what's applied to it. Selecting the kart (click
the 3D kart, with a fallback "View Build" button — raycasting from the UI layer into the R3F
canvas needs a deliberate hook, and `render` may not import `ui`) opens an inspector panel
showing:

- **The build**: the current part loadout per slot, reusing the Garage's blueprint/leader-line
  pattern ([GarageScreen.tsx](../packages/ui/src/screens/GarageScreen.tsx)) and the derived
  `KartStats` bars.
- **Applied tuning**: the tuning cards staged for the next race, with their `mods` chips and
  `effectText`, so the player can confirm exactly what the kart will race with before
  committing to race day.

This is a read-only view; playing/removing still happens by dragging cards.

---

## 5. The shop — 4 slots + reroll

The shop ([ShopScreen.tsx](../packages/ui/src/screens/ShopScreen.tsx)) changes from a
full-catalog storefront to a **4-slot rotating stall**, roguelike-style.

- **Exactly 4 tuning cards are displayed at a time.** The 4 slots are a seeded weighted sample
  of `LIVE_CARD_IDS` (weighted by rarity so commons/rares show more often). Duplicates of
  cards the player already owns or has previously consumed may reappear — everything is
  buyable again.
- **Buying** deducts `cardPrice` and adds the card to the collection (subject to the ≤4 owned
  cap). A bought slot empties for the rest of the visit (until a reroll or the next visit).
- **Reroll**: the player may pay to reroll the 4 slots **up to twice per shop visit**. The
  cost **doubles on the second reroll**:
  - 1st reroll: `SHOP_REROLL_COST` (default **20** credits)
  - 2nd reroll: `SHOP_REROLL_COST * 2` (**40** credits)
  - A 3rd reroll is not offered.
- The reroll allowance and slot contents **reset each time the shop is opened**.

Suggested tunable constants live next to the existing `RARITY_PRICE` in
[economy.ts](../packages/game/src/economy.ts): `SHOP_SLOTS = 4`, `SHOP_MAX_REROLLS = 2`,
`SHOP_REROLL_COST = 20`, `MAX_OWNED_TUNING = 4`.

---

## 6. State model (as implemented)

- `PlayerSave.ownedCardIds: string[]` — a bag of **≤4 tuning-card copies**, duplicates
  allowed. Training cards are catalog-defined and not stored per-player.
- `SeasonState.stagedTuningCardIds: string[]` (renamed from `equippedCardIds`) — the tuning
  cards played onto the kart for the upcoming race.
- `SeasonState.turnsLeft` — **removed** (energy is the gate).
- New transient shop state (not persisted): `GameStore.shopSlotCardIds: (string | null)[]`
  (length 4, `null` = bought/empty) and `shopRerollCount: number`, both reset in `goShop`.
- `finishRace` strikes `stagedTuningCardIds` from `save.ownedCardIds` (`removeOneEach` in
  [store.ts](../packages/game/src/store.ts)), then clears staging.
- `SAVE_VERSION` bumped 3 → 4; the `migrate` hook in `store.ts`'s `persist` config clamps any
  returning save's `ownedCardIds` to the 4 most recently acquired. `SeasonState` is never
  persisted (only `PlayerSave` is), so no migration was needed for `turnsLeft` /
  `equippedCardIds` themselves.

`EQUIP_SLOTS` (formerly 3, persistent) is retired in favor of `MAX_OWNED_TUNING` (4,
consumable), both defined in [economy.ts](../packages/game/src/economy.ts).

One implementation note beyond the original design: a true 3D-raycast drop target onto the
kart mesh would need pointer picking wired through `@grid/render`'s R3F canvas. Instead,
`KartDropZone` ([packages/ui/src/components/KartDropZone.tsx](../packages/ui/src/components/KartDropZone.tsx))
is a screen-space DOM overlay roughly framing where the showroom kart sits — good enough to
read as "drop it on the kart" without crossing the `ui → render` package boundary. Clicking
(not just dragging) a card also plays it, and clicking a staged card un-stages it — small
accessibility/undo affordances layered on top of the drag verb, not a replacement for it.
Selecting the kart itself (click) is wired via a new optional `onSelect` prop on
`ShowroomKart` — a plain callback prop, so `@grid/render` still never imports `ui`/DOM.

---

## 7. Migration from the previous implementation

| Aspect | Before | Now |
|--------|-------|-------------|
| Card types | `Training` + `Card` (two types) | one `CardSchema`, `kind` discriminant |
| Tuning cap | equip up to 3, persistent (`EQUIP_SLOTS`) | own up to 4, consumable (`MAX_OWNED_TUNING`) |
| Play verb | click training / tap-to-equip | drag card onto the kart (click also works) |
| Tuning lifetime | permanent, re-equipped every round | consumed when the race resolves |
| Training gate | `turnsLeft` counter + energy | energy only |
| Shop | full catalog, browse & buy | 4 rotating slots + up to 2 doubling rerolls |
| Inspect build | Garage blueprint only | select the kart (garage or training) to view build + staged tuning |

---

## 8. Balance & economy risks

- **Burn rate — addressed (2026-07-01).** Staging + burning all 4 tuning cards is still allowed
  (intended per spec), but `racePayout` now adds a small off-podium consolation (`FINISH_PAYOUT
  = [120, 70, 35, 22, 14, 9]`) so a losing player isn't zeroed while also losing their staged
  cards. The season harness ([tools/diag/season.ts](../tools/diag/season.ts)) now simulates the
  money loop (buy → stage → consume → reroll) and confirms the cadence: for a developed player,
  full-burn nets ~+48/season (roughly break-even), thrifty ~+200, hoarding ~+400 — restraint is
  rewarded and full-burn is sustainable for a podium finisher without the collection sitting
  empty.
- **Reroll affordability.** 20/40 rerolls remain cheap relative to card prices (40–280). Left
  as-is for now; the harness money model is the tool to revisit this if legendary-hunting
  proves dominant (raise `SHOP_REROLL_BASE_COST` or scale it with round).
- **Energy-only pacing — addressed (2026-07-01).** Training is now capped at
  `MAX_TRAINING_SESSIONS_PER_ROUND` (6) stat-building plays per round
  (`SeasonState.sessionsThisRound`). `rest` is uncapped but only refills energy to spend on
  those capped sessions, so the free-Rest loop can no longer over-train before a race. The
  training screen shows the remaining session count and disables stat cards once it's spent.

A change isn't done until this doc reflects it — update the tables here when card data or
these constants change.

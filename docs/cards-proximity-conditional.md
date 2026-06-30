# Design proposal: Proximity & Conditional Racing Cards

Status: accepted (Phase 1 implemented, Phase 2 scaffolded). Source: gameplay design proposal,
reviewed by the Technical Director (sim) and the Cards/Economy owner. See the review at the
bottom for the Phase 1 / Phase 2 split and determinism constraints.

## Intent

Draft cards should not be flat number increases. Because karts run on a deterministic,
physics-ish simulation with spatial constraints, cards trigger on **proximity**, **track
position**, **environmental state**, and **engine/tyre state** so that even identical decks
diverge into distinct finishes.

## Spatial zones (sim vocabulary)

- **Draft Zone** — a narrow column directly behind a kart (up to ~6 m).
- **Proximity Bubble** — a 360° circle around the kart (~3 m radius).
- **Clean Air Zone** — a clear path ahead (15+ m with no rivals).
- **Apex Slot** — the inside line of a corner.
- **Marbles Zone** — the outer, low-grip line of a corner.

## Card catalogue

### Traffic & Pack (proximity)

- **Paint-Scraper** — Trigger: a rival enters the side Proximity Bubble during cornering.
  Effect: steer into the rival with +25% impact force, shoving them toward the Marbles Zone.
- **Slingshot Siphon** — Trigger: trailing a rival inside their Draft Zone on a straight for
  >1.5 s. Effect: +15% acceleration (and +10% engine heat — Phase 2).
- **Corner Pocket** — Trigger: entering a corner while a rival holds the Apex Slot. Effect:
  brake ~10% earlier, take the outer line, +15% exit traction.
- **Claustrophobia** — Trigger: 3+ karts in your Proximity Bubble. Effect: "panic steering"
  toward the nearest open space, +10% speed, -15% drift accuracy.

### Leader & Underdog (position)

- **Clean Air Supercharger** — Trigger: 1st place AND clean air ahead. Effect: +8% top speed,
  -5% cornering stability.
- **Desperation Draft** — Trigger: 4th or lower on the final lap. Effect: ~3x draft-zone
  detection length and +12% draft top speed.
- **Vanguard Shield** — Trigger: top-3 while being drafted from behind. Effect: defensive
  center-lane pathing, +20% collision box to block overtakes.

### Track & Surface (environmental) — Phase 2

- **Groove-Lock** — on the rubber line laid by earlier karts: +8% cornering grip.
- **Gutter Hook** — on the extreme inner boundary of a hairpin: pivot +15% faster, no slide.
- **Debris Dodger** — hazard within 10 m ahead: seeded dexterity check (80% micro-swerve,
  -2% speed; 20% safe brake, -15% speed).

### Resource & Engine (state) — Phase 2

- **Redline Gambler** — engine heat hits 90%: push to 105% for +20% speed (3 s), then a 2 s
  cooling coast (-30% speed).
- **Drift-Chain Reaction** — three consecutive clean "perfect drift" corners: fill KERS and
  burst on the next straight.
- **Conservationist** — tyre wear > 60%: -5% top speed, +15% cornering safety/traction.

## Technical Director review (feasibility + determinism)

The sim is pure, fixed-step (`FIXED_DT = 1/60`), and seeded; every effect must preserve
cross-machine determinism. Mapping each card's `%` to a multiplier/override on the existing
`DerivedAttributes` keeps the kinematic model intact.

**Phase 1 (computable from current state — positions, ranks, lap, track curvature):**
Paint-Scraper, Slingshot Siphon, Corner Pocket, Claustrophobia, Clean Air Supercharger,
Desperation Draft, Vanguard Shield. These read the field positions (already scanned for
overtaking) and the track's signed curvature (`curvS`) for corner/apex/inside-side; no new
persistent track or kart subsystems are required.

**Phase 2 (need new subsystems, deferred):**
Groove-Lock & Gutter Hook (evolving surface / kerb zones), Debris Dodger (hazard + crashed-kart
entities), Redline Gambler (engine-heat model), Drift-Chain Reaction (perfect-drift detection +
KERS), Conservationist (tyre-wear model). Their state fields and `EffectContext` flags are
scaffolded now (default-inert) so the schema and handlers exist before the subsystems land.

**Determinism rules adopted:**
- Effects are optional on `Entrant`; absent effects reproduce existing seeds bit-for-bit.
- Any effect randomness (e.g. Debris Dodger) draws from a **per-racer seeded RNG**
  (`hashSeed(seed, index, salt)`), advanced only on fixed sub-steps, so frame batching is
  invariant.
- Effects are layered as a per-tick **modifier bag** (multipliers/overrides) on top of
  `derive()` output; the core integration math is untouched.
- Effects apply to **all entrants** (player, recorded ghosts, AI rivals) so the "identical
  decks diverge" property holds in mirrored fields.

See `sim-physics.md` ("Card effects + spatial zones") and `economy-cards.md` for the
implemented model, and `DECISIONS.md` for the ADR.

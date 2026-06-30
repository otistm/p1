# Reference: data-driven content

Everything addable over time — tracks, parts, cards, cosmetics — is **data** validated
by **Zod** in `@grid/content`. Adding content must not require engine changes.

## Schemas (overview)

- **PartSchema** — `{ id, name, slot, rarity, stats: Partial<KartStats>, special?,
  cosmeticModelId? }`. `slot` ∈ chassis | engine | tires | brakes | gearing | aero |
  ballast.
- **CardSchema** — `{ id, name, rarity, theme, mods: Partial<KartStats>, effect?,
  trigger?, effectText?, archetype?, special?, flavor }`. `effect` is a `CardEffect`
  `{ kind, params?: Record<string, number> }` — a Zod mirror of the sim's
  `CardEffectKind` union (the canonical kinds live in `@grid/sim`). `trigger`/`effectText`
  are the human-readable strings the draft UI renders; `archetype` is a short tag. A card
  may have both a small flat `mods` and an `effect`.
- **TrackSchema** — conforms to `@grid/sim`'s `TrackDef` `{ id, name, points, width,
  laps, samplesPerSegment? }` plus presentation metadata (theme, scenery seed).
- **CosmeticSchema** — `{ id, name, kind, rarity }`, `kind` ∈ livery | wheels | decal |
  trail. Cosmetics are visual only and never affect stats.

## Rules

- Validate at the boundary (`parseContent(data)`); internally trust the typed value.
- IDs are stable and unique; content is referenced by ID in saves and snapshots.
- A loadout (set of part IDs + cosmetic IDs) deterministically computes `KartStats`
  via a pure `loadoutToStats()` so the same build always yields the same kart.
- Keep a `contentVersion`; snapshots/saves record it for forward-compat.

## How to add content

1. Add the data object to the relevant registry in `@grid/content`.
2. `npm test` runs schema validation over all registered content.
3. If it introduced a new mechanic, document it and run `npm run balance`.

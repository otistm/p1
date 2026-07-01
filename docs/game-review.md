# P1 — Full Game Review

A studio-wide review of P1 as it stands, written through the lens of the AAA-studio roles the
team role-plays (per `.cursor/rules/knowledge-base.mdc`). Every finding cites code
(`file:line`) or an external source, and each carries a concrete recommendation. The closing
roadmap is phased, with **correctness + balance first**.

> This is a findings document — it proposes no code changes on its own. Acting on it is the
> job of the phased roadmap in [section 9](#9-prioritized-roadmap).

> **Phase 1 status (2026-07-01): implemented.** The correctness + balance items in
> [§9 Phase 1](#phase-1--correctness--balance-do-first) have shipped — the loadout-mass P0 fix,
> the free-Rest over-training cap, the off-podium consolation economy, and a `derive` rebalance
> that also fixed the difficulty ramp. The season harness now models the money loop. Details
> and measured before/after figures are in each finding below and in `docs/CHANGELOG-KNOWLEDGE.md`.

> **Phase 2 status (2026-07-01): fully implemented (5–10).** The accessibility + UX
> consolidation items in [§9 Phase 2](#phase-2--accessibility-ux-consolidation-onboarding) have
> shipped — a rem-based type scale + one primary-CTA size, a WCAG contrast/label-floor pass, one
> disabled token, a unified `<TuningCard>`, a copy sweep, a persistent wallet, and the doc/comment
> sweep. **Phase 2b** (item 9) also landed: first-run onboarding coach marks (garage + training,
> once-only via localStorage) and a mid-season garage/re-equip hatch (`Edit Build` → garage →
> `Back to Training`, no season reset).

> **Phase 3 status (2026-07-01): items 11–14 done (motion blur skipped by choice).** The headline
> race-VFX gap ("speed doesn't read") is closed: screen-space `SpeedFx` (vignette + speed lines,
> zero draw calls) + instanced in-world **tire scuffs** and **leader/player wakes** (`raceFx.ts`,
> 2 draw calls). Race **agency** (item 14): 1×/2× toggle + Skip→result, same deterministic engine;
> ghosts labelled as past builds. **Race-time tuning FX** (item 12): player procs pop a labelled
> chip at the kart's projected position (sim surfaces fired effects via render-only
> `Racer.activeEffects`). **Cups differentiated** (item 13): `TrackMeta.theme` drives a full
> day/dusk/night `ThemePreset` per round, and a `trail` cosmetic (title-screen picker,
> `PlayerSave.trailId`, save v5) colours the player's wake. Motion blur was intentionally skipped;
> only trail *unlock/shop-gating* remains open under item 13. **In-race legibility** was extended
> beyond the proc pops with a persistent **TUNING readout** (staged effects + live on/off) and a
> **situation strip** (slipstream/clean-air/traffic/defending) fed by a render-only
> `Racer.telemetry` — the player can now watch their drafting choices arm and fire in real time.
> **Extended again 2026-07-01**: the readout is now a full **`RaceVitals`** panel whose STAMINA /
> SPEED / CORNER gauges are true per-tick physics (from a render-only `Racer.live`) and move every
> tick like the stamina bar — speed climbs on straights and dips into corners, the corner-load
> gauge spikes mid-bend — with signed-% tuning **magnitude chips** popping when an effect actually
> fires. And the results panel gained an
> **Analysis tab**: a lap-by-lap table with a **Position · Speed · Stamina · Corner** metric switch
> (per-lap position + ▲/▼ swings + ★ fastest lap, or the vitals data — peak km/h, end-of-lap
> stamina, avg corner load) derived from newly-recorded deterministic `Racer.lapSplits`/`lapStats`.

## Severity legend

- **P0** — broken / incorrect: ships wrong behavior today.
- **P1** — high impact on fun, fairness, or clarity.
- **P2** — medium: noticeable, worth scheduling.
- **P3** — polish: nice-to-have, low risk.

## Method

- Read-only audit of `packages/{sim,content,game,render,ui,audio}`, `app`, `tools/`, and
  `docs/`.
- Cross-checked against the team's own recorded findings in `docs/DECISIONS.md` and
  `docs/CHANGELOG-KNOWLEDGE.md`.
- Compared against genre peers and public design sentiment (Umamusume, Balatro / Slay the
  Spire, auto-battlers) and WCAG guidance; sources are linked inline in
  [section 8](#8-competitive-analysis).

---

## 1. Creative Director — cohesion, first-time experience, flow

**The pitch is strong and the pillars are coherent.** "You don't steer — you build the
driver" (TitleScreen tagline) is a clear fantasy, and the five ratings map 1:1 from parts →
training → sim so a stat change is legible in how the kart drives (`docs/umamusume-loop.md`,
`packages/sim/src/derive.ts`). The persistent visual `<Canvas>` that never tears down between
screens (`app/src/App.tsx:126`) gives the whole product a single, continuous stage — a
genuine strength most web games skip.

### P1 — The race, the payoff moment, is fully passive with zero agency or spectacle hooks

The race is the climax of every loop, but the player can only watch: there is no pause, skip,
speed-up, camera control, or any mid-race input (`app/src/App.tsx` race phase renders only
`HudConnected`; `packages/render/src/RaceField.tsx` is view-only). This is defensible for an
"auto" racer, but the genre research is explicit that passive phases must earn attention
through **spectacle plus small, impactful interactions** (see [section 8](#8-competitive-analysis)).
Today the race has neither much spectacle (see VFX, [section 6](#6-technical-artist--vfx)) nor
any interaction. Recommendation: treat the race as a payoff to *stage*, not just compute —
add a skip/2x control at minimum, and evaluate one small in-race agency beat (e.g. a single
"cheer"/tactic trigger) once VFX lands.

### P1 — Training is a one-way funnel with no exit hatch

Once `Start Season` is pressed, the only ways out of the training loop are the shop (which
returns to training) or racing; there is no "back to garage" mid-season and no way to re-tune
parts between rounds without finishing the whole season (`packages/game/src/store.ts`
navigation actions; the training screen has no garage link). Since parts are the largest
determinant of a build and can't be changed once a season starts, a player who mis-built is
locked in for three rounds. Recommendation: allow returning to the garage between rounds
(re-equip owned parts), or surface part-swapping inside training.

### P2 — First-time experience drops the player into systems with no onboarding

A new player lands in the garage facing seven part callouts, five stats, and trade-off jargon
("Downforce ⇄ drag"), then a hand of 6 training cards + tuning cards + energy + a shop with
rerolls — with no tutorial, tooltip tour, or suggested first move. Auto-battler post-mortems
call this the genre's core retention risk: everything is thrown at the player at once
([Autochess design analysis](https://www.gamedeveloper.com/design/autochess-market-status-and-design-analysis)).
Recommendation: a lightweight first-run coach mark sequence (garage → one training play →
race), or a "recommended build" default so step one is a single click.

### P2 — Tone/voice is consistent but the loop lacks a narrative "why"

Copy is characterful and consistent (part blurbs, card flavor), but there is no framing for
*why* you race a season, what a championship means, or what carries over. `pastBuilds` become
ghost opponents (`packages/game/src/snapshots.ts`) — a great hook — but the player is never
told this is happening. Recommendation: a one-line season framing on the title/garage and a
callout when a ghost (your past build) appears in a race.

### Cohesion nits (P3)

- Two visual dialects — modal `.card` (title/results/inspector) vs HUD `.panel`
  (garage/training) — are used without a stated rule; see [section 5](#5-uiux-designer).
- The showroom kart is clickable to inspect only in garage/training
  (`app/src/App.tsx:28`), so the same 3D object is interactive on some screens and inert on
  others with no visual signal of the difference.

---

## 2. Systems & Economy Designer — money, shop, reroll, burn-rate

### The numbers, as shipped

- Start with **150** credits, **0** tuning cards owned (`packages/game/src/store.ts:30,39`).
- Income is **podium-only**: `PODIUM_PAYOUT = [120, 70, 35]` scaled `×(1 + round*0.4)`
  (`packages/game/src/economy.ts:39-44`). Off-podium (4th–6th) pays **0**.
- Card prices by rarity: common **40** / rare **90** / epic **160** / legendary **280**
  (`packages/game/src/economy.ts:48-52`).
- Own at most **4** tuning cards (`MAX_OWNED_TUNING`), shop shows **4** slots, up to **2**
  paid rerolls at **20** then **40** (`packages/game/src/economy.ts:22-35`). Reroll resets
  each visit (`store.ts` `goShop`).
- Tuning cards are **consumed on race finish, win or lose** (`store.ts` `finishRace` →
  `removeOneEach`).

### Per-round income ceiling (all-1st, perfect season)

- Round 0: 120 · Round 1: 168 · Round 2: 216 → **504** podium + **150** seed = **654**
  credits across a flawless 3-round season.

### P1 — Full-burn play is economically unsustainable by a wide margin

If a player stages a full hand of 4 tuning cards every race (the natural instinct — you own
them, why not use them), they must **rebuy the whole hand after every race** because staged
cards are consumed. Weighting the 17 live tuning cards by their shop roll odds (common 40 /
rare 28 / epic 14 / legendary 6, `economy.ts:60-64`) gives an **expected ~110 credits per
card**, so a full 4-card refill costs **~440 credits/race** against a best-case **216**
income at round 2 — a **~220 credit/race deficit** even while winning. The team already
flagged this as unresolved in `docs/training-tuning-cards.md` §8 ("Burn rate… makes tuning a
fast-draining resource") and in the 2026-07-01 ADR ("burn-rate/reroll-affordability/energy-
pacing risks… still unresolved"). Recommendation: pick one of — (a) refund/keep un-triggered
cards, (b) only consume on podium or on trigger, (c) lower prices / raise off-podium income,
or (d) make most staging free and reserve consumption for a small "one-shot" card class — then
validate with the extended season harness ([section 9](#9-prioritized-roadmap)).

### P2 — Consume-on-loss punishes exactly the experimentation the game wants

Because staged cards burn whether you finish 1st or 6th, a player who is already losing (and
therefore earning 0) also loses their card investment — a compounding downward spiral. This is
the opposite of the genre's most-praised economic virtue: Balatro is celebrated because it
**doesn't require perfection** and lets you freely dump/replace items
([Slerahan on Balatro](https://slerahan.com/balatros-secret-sauce-is-not-requiring-perfection/)).
See [section 8](#8-competitive-analysis).

### P2 — Rerolls are underpowered relative to genre norms and to card prices

P1 caps rerolls at **2/visit** (20, then 40). Balatro's model — start cheap, **+1 each
reroll, reset every shop, unlimited** ([Balatro Wiki: The Shop](https://balatrogame.fandom.com/wiki/The_Shop))
— gives players a smooth "how hard do I chase this" dial. P1's hard cap of 2 removes that dial
and, because 20+40 = **60** is cheaper than a single rare (90), the reroll is a strictly cheap
gamble to fish for a legendary (weight 6/346 ≈ **1.7%** per slot) rather than a paced economic
decision. Recommendation: consider an escalating-but-uncapped reroll (or raise the count) and
re-price so rerolling trades against buying.

### P3 — No interest / savings mechanic means credits are purely a sink

Balatro's interest ("$1 per $5 held, capped") rewards restraint and creates a meaningful
"spend vs save" tension every shop ([Casual Game Guides](https://casualgameguides.com/walkthroughs/balatro/money-interest-reroll-strategy)).
P1 has no such loop; credits only ever drain. This is fine for a tighter game but worth noting
as a lever if the economy needs more depth.

### Note: the balance harness does not model money

`tools/diag/season.ts` grants `SAMPLE_TUNING_CARD_IDS` for free and re-stages them every round
(`tools/diag/season.ts:53-60`), so its win-rates **overstate** real card availability. Any
economy tuning must extend the harness to simulate buy/consume/reroll (see
[section 9](#9-prioritized-roadmap)).

---

## 3. Sim & Balance Designer — win-rates, stat weighting, difficulty

The team has already done real, data-driven balance work here; the findings below are mostly
**quoted from the studio's own records** and remain open.

### P1 — The all-rounder still over-wins; pure-Power still under-performs (open)

First headless run (`docs/CHANGELOG-KNOWLEDGE.md`, 2026-06-29): "First headless balance run
(`npm run balance`, 2000 races): Vortex 58.9% / Oracle 26.8% / Atlas 11.6% / Blitz 2.8% /
Crusher 0.0%. Takeaway: **Wit is over-weighted** in `derive()`… pure-Power builds with low Wit
are non-viable." After the rebalance pass: "New 2000-race spread: Vortex 60.1 / Atlas 20.7 /
Blitz 14.6 / Oracle 4.3 / Crusher 0.3… Known follow-up: **the all-rounder (Vortex) still
over-wins and pure-Power (Crusher) under-performs**." Net: the rebalance moved Wit's dominance
but did not fix the archetype spread — Vortex actually rose slightly (58.9% → 60.1%). Target
per the team's own note was "every archetype 10-30% win share"; that target is unmet.

### P2 — Wit is still a multi-channel stat

Even post-rebalance, Wit feeds **five** derived attributes — `accel`, `latGrip`, `yawGrip`,
`drainEff`, and `judge` (`packages/sim/src/derive.ts:16-23`), while Power feeds three and
Speed feeds essentially one (`topSpeed`). Broad stats out-value narrow ones per credit/energy,
which is a structural reason the all-rounder wins. Recommendation: audit each stat's total
derived "surface area" and aim for rough parity, or make Speed/Power wider to compensate.

### P1 — The season difficulty curve outruns a single developed playthrough

From `docs/CHANGELOG-KNOWLEDGE.md` (2026-06-30, season difficulty curve, ~2,250 races):
"(2) parts alone never compete — a starter build (OVR 193) finishes **last in 100%** of
parts-only races; … (3) training + cards is the real lever — a developed player climbs
193→241→290→351 OVR and wins **70%** of Rookie Cups; (4) **the season outruns one
playthrough** — developed win% collapses **70%→6%→0%** as rivalScale ramps
(×1→×1.28→×1.6)…" The rounds are defined at `packages/content/src/archetypes.ts:57-61`
(rivalScale 0.0 / 0.28 / 0.6). So a first-time player is essentially guaranteed to lose rounds
2–3, and the design intends "the championship reads as multi-season meta progression" — but
nothing in the UI communicates that (see [section 1](#1-creative-director--cohesion-first-time-experience-flow)).
Recommendation: either soften round 2–3 rivalScale for the first season, or explicitly frame
the championship as multi-season so a round-3 loss reads as expected, not as failure.

### P2 — Ghost opponents can make late rounds harder than rivalScale implies

Rounds 1+ seed up to 2 of the player's own recent `pastBuilds` as ghosts alongside scaled
rivals (`packages/game/src/snapshots.ts` `makeOpponents`). A strong past build becomes a
strong opponent, compounding the difficulty ramp unpredictably. Recommendation: cap ghost
strength relative to the current build, or clearly label ghosts so the player understands the
field.

### P3 — Training preview hides the failure penalty

`projectedGain` shows the optimistic number (`packages/game/src/season.ts:47-50`), but a play
below 20 energy has a 40% chance to yield ×0.4 gain and cost 10 extra energy
(`season.ts:89-95`). The card face can promise "+11" while frequently delivering ~+4.
Recommendation: show a risk indicator (or the expected value) when energy is low.

---

## 4. Gameplay Engineer — correctness, dead code, determinism

### P0 — Loadout mass never reaches the sim; ballast is cosmetic for physics

`computeRaceStats` computes and returns `mass` from the loadout (`packages/game/src/economy.ts:127-140`),
but `assembleRaceConfig` destructures only `{ stats }` and never forwards mass onto the
`Entrant` (`packages/game/src/snapshots.ts:79-87`). The engine always calls `derive(e.stats)`
with **no** `massOverride` (`packages/sim/src/engine.ts:40-41`), and `derive` therefore falls
back to `mass: massOverride ?? 170` (`packages/sim/src/derive.ts:27`). Result: `ballast.feather`
(−25 kg) and any heavy ballast change the **displayed** stats but have **zero** effect on
collision impulses/physics — a whole part slot's core promise ("weight strategy") is silently
inert in races. Recommendation: thread `mass` through `Entrant` → `RaceEngine` → `derive`, then
re-run the balance harness (mass affects collisions, so this is a balance change too).

### P1 — Unbounded pre-race training via the free Rest loop

`train.rest` costs **0** energy and restores **+48** (`packages/content/src/cards.ts` rest
card; applied at `packages/game/src/season.ts:84-87`), and there is **no per-round cap** on how
many cards a player may play before racing — energy is the only gate and Rest refills it for
free. A patient player can loop train×3 → rest → train×3 → … indefinitely to max stats before
every race, which trivializes the training economy and the difficulty curve. The team flagged
this in `docs/training-tuning-cards.md` §8 ("`rest` fully controls season length; the UI has no
hard cap on training sessions per round"). Recommendation: add a per-round action/session
budget, make Rest cost a scarce resource, or apply diminishing returns to repeated training.

### P2 — Two unrelated systems both named "energy"

Season "energy" (0–100 training gate, `SeasonState.energy`) and in-race "stamina"
(`Racer.energy` / `derive().energyMax`, `packages/sim/src/derive.ts:20`) are distinct systems
sharing a name. The UI already renames the training one to "Condition" on screen
(`TrainingScreen`), but the code and some copy still say "energy," which invites bugs and
confusion. Recommendation: rename the season field to `condition` in code for clarity, or
document the split prominently.

### P2 — Training accumulates unrounded floats; preview rounds

`applyTraining` adds the raw float `amt` to `trainedStats` (`packages/game/src/season.ts:88-92`)
while the UI preview and toast use `Math.round`. Over a season the displayed and actual totals
drift. Low risk, but it means "what you see" isn't exactly "what you get." Recommendation:
round on apply, or round consistently everywhere.

### P3 — Dead / unused exports and stale references

- `isLiveCard` (`packages/game/src/economy.ts:76`) — exported, no external callers (only
  `LIVE_CARD_IDS` is used).
- `selectPlayerStats` (`packages/game/src/store.ts`, end of file) — exported, no callers.
- `README.md` and `docs/economy-cards.md` still describe the removed **draft** loop as current;
  `docs/README.md` "screens (title, garage, draft, training, HUD)" lists a `draft` screen that
  no longer exists. See [section 7](#7-qa) for the full list.

### Determinism (healthy, with one caveat)

The race pipeline is properly deterministic and the ESLint guardrails against `Math.random` /
`Date.now` in the sim hold (`README.md` determinism contract). The one intentional exception:
the **shop** uses `Math.random` (`store.ts` `goShop`/`rerollShop`), so a full run is not
byte-reproducible if shop order matters for a study. This is fine for commerce but should be
noted before using runs for economy analysis.

---

## 5. UI/UX Designer — type, contrast, consolidation, consistency

The palette and stat-color system are coherent (`packages/ui/src/theme.ts`), and the garage
blueprint callouts are a genuinely strong, distinctive build UX. The issues are consistency
and accessibility at the detail level.

### P1 — No shared typographic scale; primary CTAs are sized ad hoc

"Primary heading" appears at seven different sizes across screens: Title logo `clamp(46–84)`,
Results **40**, GarageScreen kart name **36**, RaceHud lap **34**, Shop **32**, TrainingScreen
kart name & KartInspector **26**. Primary forward CTAs are also inconsistent: the shared
`.btn` is **20px** (`global.css`), and Title/Garage/Shop use it, but the training screen's main
action "Head to Race Day →" is only **15px / 10px 18px** (`TrainingScreen.tsx`) — the single
most important button in the loop is the smallest primary CTA. Recommendation: define a type
scale as CSS custom properties (e.g. 1.25 ratio on a 16px base per
[Made Good Designs](https://madegooddesigns.com/web-font-size-guide/)) and one "primary CTA"
size, and remove per-call inline overrides.

### P1 — Two parallel card components for the same data

Tuning cards render through **`CardView`** (220px wide, display name 22px) in the shop
(`packages/ui/src/components/CardView.tsx`) and through a separate inline **`TuningCardFace`**
(156px wide, display name 15px, rarity 9px) in the training hand
(`packages/ui/src/screens/TrainingScreen.tsx`). Two implementations of one card drift in
typography and are double the maintenance. Recommendation: extract one `<Card size="hand|shop">`
component and delete the duplicate.

### P1 — Small-text + muted-color density fails accessibility guidance

Helper/label copy sits at **9–11px** in many places (card rarity 9px, garage stat deltas &
slot eyebrows 10px, the global `.eyebrow` 11px, taglines/legends/flavor 11px) and much of it
is `--muted` `#8b93a3` on dark panels. Practical accessibility guidance puts the **UI-label
floor at ~12–14px** and captions no smaller than ~12px, and recommends `rem` units so text
honors browser zoom ([Xerobit font-size guide](https://xerobit.dev/blog/font-size-accessibility/)).
WCAG 1.4.3 requires **4.5:1** for normal text, and small low-weight text should aim for **7:1**
([W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum),
[FontFYI](https://fontfyi.com/blog/accessible-typography-guide/)). `--muted` on the panel
background is ~4.5:1 — passing for normal text but **borderline at 9–11px non-bold**, and all
sizes are hard-coded `px` (no zoom scaling). Recommendation: raise the label floor to 12px,
lighten `--muted` (or reserve it for ≥14px), and move to `rem`.

### P2 — Disabled/dimmed states use three different opacities

`.btn:disabled` is 0.4 (`global.css`), disabled training cards are 0.45 (`TrainingScreen.tsx`),
inactive garage leader lines are 0.35 (`GarageScreen.tsx`). A dimmed training card fades its
whole name below comfortable legibility. Recommendation: one "disabled" token, and keep text
legible when a control is disabled.

### P2 — Copy inconsistencies and one misleading string

- Same action, two labels: "Shop" (garage/training) vs "Visit Shop" (results).
- **Misleading:** the shop description says bought cards "are staged onto your kart and
  consumed on race day" (`ShopScreen.tsx`), but buying only adds to the **collection** —
  staging happens later on the training screen. This mis-teaches the core loop.
- `BuildSnapshot.cardIds` is still commented "Drafted card ids" (`packages/game/src/types.ts`),
  a leftover from the removed draft system.

Recommendation: settle one verb per action ("Shop"), fix the shop description to describe
buying (not staging), and clean stale comments.

### P2 — No consistent "wallet" location

`MoneyBadge` appears centered under the garage title, at the bottom of the training Condition
panel, top-right in the shop header, and inline in the results winnings row. A persistent
wallet in one corner would let players track credits without hunting. Recommendation: pin the
wallet to a fixed screen corner across shop-relevant screens.

### P3 — Duplicated constants and mixed token consumption

- `SLOT_LABEL` is defined independently in both `GarageScreen.tsx` and `KartInspector.tsx` —
  extract to a shared module.
- Some components read CSS vars (`var(--cyan)`) while others import the `COLORS`/`STAT_COLOR`
  JS objects from `theme.ts` (`CardPlayFx.tsx`); a few values are hard-coded (`#fff`,
  `rgba(20,23,31,…)` ≈ but ≠ `--bg` `#14171f`). Pick one source of truth.
- Overlay padding varies (`.overlay` default 24 vs training/shop 18 vs garage 0) and the
  `.eyebrow` size is overridden to 9–10px in places, undermining the shared label.

---

## 6. Technical Artist / VFX — render polish and game feel

### What's implemented today

- **Bloom** post-process only: `<Bloom intensity={0.42} … mipmapBlur />` in a single
  `EffectComposer` (`packages/render/src/GameCanvas.tsx:57-59`).
- **Card-play feedback** (new): a kart scale pulse (`ShowroomKart` `pulseKey`) plus a
  screen-space particle burst (`packages/ui/src/components/CardPlayFx.tsx`), both
  `prefers-reduced-motion`-guarded.
- Solid fundamentals already fixed by the team: interpolated transforms, tuned shadow
  frustum, mipmapped curbs, corrected wheel spin (`docs/CHANGELOG-KNOWLEDGE.md`, 2026-06-29/30).

### P1 — The race has essentially no motion VFX, so speed doesn't read

The climactic phase renders karts, track, and a chase camera — but no tire smoke, skid marks,
speed lines, boost/heat glow, collision sparks, dust, or draft visualization. For an
auto-viewed racer where the player can't feel the speed through input, on-screen speed cues are
what sell the fantasy. Recommendation (cheap → dear): screen-space speed lines / vignette
tied to `topSpeed`; ground skid decals on high-lateral-g corners; a light particle trail
behind the leader. Reuse the existing `CardPlayFx` particle approach to keep draw calls down.

### P1 — Promised motion blur is not implemented (doc vs code gap)

`docs/rendering-budget.md:27` states Post FX is "bloom + light motion blur via
`@react-three/postprocessing`," and line 20 sets the budget "Draw calls < ~150 in-race." The
`EffectComposer` ships **Bloom only** — there is no motion-blur pass
(`GameCanvas.tsx:57-59`). Either implement the promised motion blur (it directly helps the
"speed doesn't read" problem above) or correct the doc.

### P2 — Card-play FX is not wired into the race, and the burst anchor is fixed

`CardPlayFx` sprays particles at a **hard-coded screen anchor** (the training-kart position),
not the kart's actual projected position, and the effect only exists in menu phases — during a
race a triggered tuning card would have no visual. Recommendation: project the kart's world
position to screen space for the burst origin, and decide whether tuning triggers should have
race-time VFX.

### P2 — Authored content hooks exist but are unused

`TrackMeta.theme` (track visual theming) and cosmetic **trail/decal** fields are defined in
content/schema but never consumed by the renderer, and `drei` is installed but unused. These
are ready-made game-feel levers left on the table. Recommendation: wire cosmetic trails
(easy, high visible payoff for the collection loop) and use `TrackMeta.theme` to differentiate
the three cups, or remove the unused dependency/fields.

### P3 — Draw-call headroom is thin before adding VFX

The budget notes ~150 draw calls in-race and the current scene runs near that ceiling. Any VFX
work should lean on instancing / shared particle systems (as curbs already do — 2 draw calls)
rather than per-effect meshes. Recommendation: budget VFX against the draw-call ceiling up
front and prefer instanced/screen-space techniques.

---

## 7. QA — doc/UI/comment mismatches and test gaps

### P1 — Stale "draft" system references across docs (feature removed)

The draft loop was replaced by the shop, but several docs still present it as current:

- `README.md` and `docs/README.md` list a **`draft`** screen among the game's screens.
- `docs/economy-cards.md` describes the old draft/equip model as the live economy (partially
  patched to point at `training-tuning-cards.md`, but draft language remains).

(Note: "draft" also legitimately means aerodynamic **slipstream** in `packages/sim/src/effects.ts`
and `sim-physics.md` — those are correct and unrelated.) Recommendation: sweep the docs for the
removed **card draft** and update to the shop model.

### P2 — Stale comments in shipped code

- `packages/game/src/types.ts`: `BuildSnapshot.cardIds` commented "Drafted card ids."
- The shop description string mis-describes buying as staging (see
  [section 5](#5-uiux-designer)).

Recommendation: fix comments during the same sweep so code and docs agree.

### P2 — Test coverage gaps around the areas most likely to break

- **No test asserts mass reaches the sim** — the P0 in [section 4](#4-gameplay-engineer--correctness-dead-code-determinism)
  would have been caught by an integration test that swaps ballast and checks a physics
  quantity. Add one.
- **No economy test** for buy → stage → consume → rebuy affordability; the current `season.ts`
  harness gives cards for free, so the burn-rate deficit is untested.
- **No test for the Rest over-training loop** (per-round budget), since none exists to assert.
- E2E `e2e/smoke.spec.ts` covers the happy path (title → training → race HUD) but not the
  shop, reroll, drag-to-play, or a losing outcome.

### P3 — Verification hygiene is good

Unit tests (44), lint, typecheck, production build, and a Playwright smoke test are all green
per the latest changelog entries. The gaps above are additive, not regressions.

---

## 8. Competitive analysis

P1's DNA is Umamusume's train-then-compete meta loop (`docs/umamusume-loop.md`) crossed with a
Balatro-style shop and an auto-battler-style non-interactive climax. Comparing to each surfaces
concrete deltas.

### vs. Umamusume (the stated inspiration)

- **Wit training restores energy in Uma; P1's Rest is a separate free card.** In Umamusume,
  Wits training recovers a little energy while also training, making the "smart" stat do double
  duty ([Umamusume training guide, GameWith](https://gamewith.net/umamusume-pretty-derby/article/show/45078)).
  P1 instead has a standalone free `train.rest` (+48, cost 0), which is what enables the
  over-training loop ([section 4](#4-gameplay-engineer--correctness-dead-code-determinism)).
  Delta: fold recovery into a stat (Wit) so resting has an opportunity cost.
- **Uma rewards repeated/co-located training (friendship, rainbow bonuses); P1 has flat
  per-card gains.** Uma's standout feel comes from escalating "rainbow" training when supports
  stack ([Umamusume beginner guide](https://www.gamewith.net/umamusume-pretty-derby/article/show/45031)).
  P1's training is memoryless — the 10th Speed play is as exciting as the 1st. Delta: add a
  streak/synergy bonus for focused training to create build momentum.
- **Both hide race agency**, which Uma gets away with because the *training* phase is rich and
  the race is a short, high-stakes payoff with commentary and stakes. P1's race is longer and
  quieter. Delta: raise race spectacle/stakes ([sections 1](#1-creative-director--cohesion-first-time-experience-flow),
  [6](#6-technical-artist--vfx)).

### vs. Balatro / Slay the Spire (the shop/run DNA)

- **Balatro doesn't require perfection; P1 punishes it.** Balatro is widely credited for
  letting you win without optimal play and freely sell/replace jokers
  ([Slerahan](https://slerahan.com/balatros-secret-sauce-is-not-requiring-perfection/)). P1
  consumes staged cards **on a loss** and gates rating on podium-or-bust, so a bad run
  compounds ([section 2](#2-systems--economy-designer--money-shop-reroll-burn-rate)). Delta:
  soften consumption / add a floor reward so losing still teaches and progresses.
- **Balatro's reroll is a smooth, uncapped dial with interest; P1's is a 2-cap gamble.**
  Balatro: reroll starts cheap, +$1 each, **resets every shop**, unlimited, alongside a $1/$5
  interest cap that makes saving meaningful
  ([Balatro Wiki](https://balatrogame.fandom.com/wiki/The_Shop),
  [Casual Game Guides](https://casualgameguides.com/walkthroughs/balatro/money-interest-reroll-strategy)).
  P1 caps at 2 and has no interest. Delta: uncap/escalate rerolls and consider an interest
  loop for spend-vs-save tension.
- **Slay the Spire's shop always has a removal + relics with clear synergies.** P1's tuning
  cards are mostly flat stat mods with a few "special" hooks; the synergy ceiling is low.
  Delta: add a few build-defining cards with visible synergies so the shop creates plans, not
  just stat top-ups.

### vs. auto-battlers (the passive-climax DNA)

- **Passive phases must earn attention.** Auto-battler analysis is consistent that the "watch"
  phase works only when it's spectacle-rich and paired with small, high-impact pre/mid
  decisions; otherwise it reads as downtime
  ([Autochess design analysis, Game Developer](https://www.gamedeveloper.com/design/autochess-market-status-and-design-analysis)).
  P1's race currently has neither strong spectacle nor any interaction. Delta: this is the
  single biggest experiential gap — invest in race VFX first, then evaluate one small in-race
  beat.

### Where P1 already wins

Persistent 3D stage across all screens, a legibly deterministic sim where stat changes visibly
alter driving, and the garage blueprint UX are distinctive strengths none of the above pair
with a kart builder. The opportunities above are about tightening the loop, not reinventing it.

---

## 9. Prioritized roadmap

Ordered by the user's stated priority — **correctness + balance first** — then accessibility/UX,
then game-feel/VFX. Each item links back to its finding.

### Phase 1 — Correctness & balance (do first) — ✅ implemented 2026-07-01

1. **Fix mass → sim** (P0, [§4](#4-gameplay-engineer--correctness-dead-code-determinism)) — **done.**
   `mass` now threads `Entrant.mass → RaceEngine → derive(stats, mass)` (default `REF_MASS`),
   collisions are mass-weighted (heavier shoves, lighter gets shoved; reduces to the old split
   at equal mass), and accel scales `× REF_MASS/mass`. Regression tests cover threading, the
   solo time-trial (lighter = faster), and the collision split.
2. **Resolve the tuning-card burn rate** (P1, [§2](#2-systems--economy-designer--money-shop-reroll-burn-rate)) — **done.**
   Kept single-use consumption (per spec) but added an off-podium consolation
   (`FINISH_PAYOUT = [120,70,35,22,14,9]`) so a loss isn't a total wipe. The new harness money
   model confirms full-burn ≈ break-even for a podium finisher (~+48/season), thrifty ~+200,
   hoarding ~+400 — restraint rewarded, no death spiral.
3. **Cap pre-race training / fix the Rest loop** (P1, [§4](#4-gameplay-engineer--correctness-dead-code-determinism)) — **done.**
   `MAX_TRAINING_SESSIONS_PER_ROUND = 6` caps stat-building plays per round; Rest only refills
   energy to spend on those capped sessions, so the free-Rest loop can't over-train. Shown in
   the training UI (session counter + disabled cards when spent).
4. **Archetype spread & difficulty ramp** (P1, [§3](#3-sim--balance-designer--win-rates-stat-weighting-difficulty)) — **done.**
   `derive` retuned (endurance de-emphasised, Wit trimmed, Speed/Power lifted) + two outlier
   archetype stat lines nudged: head-to-head went from Atlas 57.5 / Vortex 33.7 / Oracle 7.1 /
   Crusher 1.2 / Blitz 0.5 → **Oracle 36 / Vortex 32 / Atlas 18 / Crusher 13 / Blitz 0.4**.
   The ramp fixed itself as a *side effect*: developed win% went from `88→40→12` to `86→93→56`
   across rounds, so **`rivalScale` was left unchanged** (no risky second lever needed).
   Residual: Blitz (pure Speed) stays ~0% — a single-corner-track structural issue that needs
   **track variety**, not more coefficient hacks (documented in `docs/sim-physics.md`).

**Prerequisite tool work — done.** `tools/diag/season.ts` now simulates **money, shop rolls,
buying, staging, consumption, and rerolls** across fullBurn / thrifty / noBuy strategies, and
threads `mass` into every player entrant so it exercises the new physics path.

### Phase 2 — Accessibility, UX consolidation, onboarding — ✅ items 5–10 implemented 2026-07-01

5. **Type scale + primary-CTA size** as CSS custom properties; fix "Head to Race Day" sizing
   (P1, [§5](#5-uiux-designer)) — **done.** `global.css` owns a rem-based scale
   (`--fs-label`…`--fs-hero`, ~1.25 ratio / 16px base) so text honours browser zoom; one primary
   `.btn` size + a `.btn.sm` token replaced per-call overrides, and "Head to Race Day →" now uses
   the shared CTA size (was the smallest primary button).
6. **Accessibility pass**: 12px label floor, lighten/limit `--muted`, move to `rem`, one
   disabled token (P1, [§5](#5-uiux-designer)) — **done.** `--muted` `#8b93a3`→`#a6afc0`
   (~4.9:1 → ~7:1 on panels), all label text raised to the 12px floor, the type scale is `rem`,
   `--disabled-opacity: 0.45` unifies button/card dimming, and the missing `--amber` var (which
   silently broke `MoneyBadge`) was added.
7. **Unify the card component** (`CardView` + `TuningCardFace` → one) and shared `SLOT_LABEL`
   (P1/P3, [§5](#5-uiux-designer)) — **done.** One `<TuningCard size="hand|shop">` (duplicate
   deleted); `SLOT_LABEL`/`SLOT_ORDER` moved to `theme.ts` and shared by garage + inspector.
8. **Copy sweep**: one verb per action, fix the misleading shop description, persistent wallet
   (P2, [§5](#5-uiux-designer)) — **done.** "Shop" everywhere (was "Visit Shop" on results); the
   shop description now describes buying-into-collection vs staging-in-training; results shows the
   new off-podium consolation; a single persistent top-left `<Wallet>` replaced the four
   differently-placed balance badges.
9. **First-run onboarding** coach marks + recommended default build; add a mid-season
   garage/return hatch (P2, [§1](#1-creative-director--cohesion-first-time-experience-flow)) —
   **done (Phase 2b).** A `<CoachMarks>` component shows a once-only, contextual welcome on the
   first garage visit and a "drag cards onto your kart" tip on the first training visit
   (localStorage-backed, no save migration; the e2e dismisses them). The garage doubles as a
   **mid-season re-equip hatch**: training's `Edit Build` opens the garage with `garageReturn =
   'training'`, which swaps the "Start Season" launcher for `Back to Training →` and re-labels it
   "Edit build · re-equip owned parts" — so re-equipping owned parts between rounds no longer
   requires finishing the season, and the season is never reset by accident. The recommended
   default is the existing starter loadout (already one-click to race).
10. **Doc/comment sweep**: remove stale draft references, fix `cardIds` comment, reconcile
    `rendering-budget.md` motion-blur claim (P1/P2, [§6](#6-technical-artist--vfx),
    [§7](#7-qa)) — **done.** Card-draft language removed from the READMEs, `economy-cards.md`,
    `content-schema.md`, and `umamusume-loop.md`; `rendering-budget.md` now says "bloom only,
    motion blur is a planned Phase-3 pass"; the `cardIds` comment was already corrected in Phase 1.

### Phase 3 — Game feel & VFX

11. **Race speed VFX** (P1, [§6](#6-technical-artist--vfx)): speed lines/vignette, skid decals,
    leader trail — instanced/screen-space to protect the draw-call budget. — **done 2026-07-01.**
    (a) Screen-space: `packages/ui/src/components/SpeedFx.tsx` renders a speed-reactive vignette +
    radial speed lines driven by `HudData.speedFrac` (player speed ÷ top speed), composited in the
    DOM HUD for **zero extra draw calls**, disabled under `prefers-reduced-motion` (vignette-only
    fallback). (b) In-world: `packages/render/src/raceFx.ts` adds instanced **tire scuffs** on
    hard corners (|roll| + speed gated, dropped at both rear wheels, distance-spaced) and a
    colour-tinted **leader wake**, each a single `InstancedMesh` — **2 draw calls total** for the
    whole field. Scuffs recycle through a ring buffer; the wake fades by scaling under additive
    blending; reduced-motion keeps the static scuffs but drops the animated wake. Driven from
    `RaceField`'s existing per-frame loop (zero per-frame allocation).
12. **Race-time card/tuning FX** with a projected kart anchor (P2, [§6](#6-technical-artist--vfx)).
    — **done 2026-07-01** (motion blur intentionally **skipped** per direction). When one of the
    *player's* staged tuning effects actually applies mid-race, a labelled "⚡ proc" chip pops at
    the kart's projected screen position and floats up. The sim surfaces which effects fired via a
    render-only `Racer.activeEffects` (filled by an optional `fired` sink in `evaluateEffects` —
    determinism untouched); `RaceField` edge-detects the player's procs (per-kind cooldown),
    projects the kart world→screen, and calls `onProc`; `RaceProcFx` renders the chips. Disabled
    under `prefers-reduced-motion`. **Extended 2026-07-01** with a persistent **TUNING readout**
    (twin to the stamina bar, [§4](#4-ui-designer--information-architecture--visual-consistency)):
    lists the effects the player staged this race and lights each one up the instant it applies,
    plus a live **situation strip** (Slipstream · Clean air · Traffic ×N · Defending) showing the
    facts that gate them — sourced from a new render-only `Racer.telemetry`, polled through the HUD
    at ~30Hz. So the transient proc pop answers "it fired!" and the panel answers "…and here's why,
    and what's armed." **Extended again 2026-07-01** into a full **`RaceVitals`** panel (absorbs the
    old stamina bar + `RaceTuningPanel`): **live gauges** that move every tick like stamina —
    STAMINA / SPEED / CORNER, sourced from a render-only `Racer.live` where `speedFrac` and
    `gripLoad` are true per-tick physics (speed climbs on straights and dips into corners; corner
    load spikes mid-bend). Staged tuning still lists ON/idle effects and now pops signed-%
    **magnitude chips** (green boost / red penalty) for whichever tuning modifier is applying this
    instant. (An initial pass rendered the tuning multipliers themselves as baseline-×1 gauges, but
    those sit flat unless an effect is firing and read as frozen — hence the live speed/corner
    physics.) And the **results panel gained an Analysis tab**: `Racer.lapSplits` (cumulative
    per-lap crossing times, recorded deterministically — the final lap logged at the finish line,
    guarded to exactly `laps` per finisher; carried on `RaceResultRow.{lapSplits,laps}`) feeds
    `RaceAnalysis`, a lap-by-lap table of each racer's position + lap time with ▲/▼ place swings and
    the field's ★ fastest lap. **Extended once more 2026-07-01** to fold the vitals data into the
    breakdown: the sim banks per-lap aggregates for every racer (`Racer.lapStats` — peak/avg speed,
    avg corner load, end-of-lap stamina, in lockstep with the splits) and `RaceAnalysis` gained a
    **Position · Speed · Stamina · Corner** metric switch, so each lap column can be replayed through
    the same lens as the in-race gauges (with mini-bars + ★ highlights). Both are pure
    recorded/derived data — no sim behaviour change.
13. **Wire cosmetic trails + `TrackMeta.theme`** to differentiate cups and feed the collection
    loop (P2, [§6](#6-technical-artist--vfx)). — **done 2026-07-01.** (a) `TrackMeta.theme`
    (`meadow`/`sunset`/`night`) now drives a full `ThemePreset` (`packages/render/src/world/theme.ts`)
    — sky gradient, fog, the 3-light rig, and ground/foliage tints — threaded through `GameCanvas`,
    `SceneEnvironment`, and `TrackWorld`. Each `RoundDef` carries a theme, so the season escalates
    **day → dusk → night** across the three cups on the same track geometry. (b) A `trail` cosmetic
    kind (`content/cosmetics.ts`, 5 tints) + `PlayerSave.trailId` (default, migrated at save v5) is
    picked on the title screen and drives the player's in-race **wake colour** (the leader keeps
    their own tint via per-instance colour on the shared trail mesh — still 1 draw call). Remaining
    to "feed the collection loop": trails aren't yet unlockable/shop-gated (all are available).
14. **Race agency & framing** (P1/P2, [§1](#1-creative-director--cohesion-first-time-experience-flow)):
    add skip/2x, evaluate one small in-race beat, surface ghost/past-build identity. — **done
    2026-07-01.** The auto-race now has controls (top-right, clickable): a **1×/2× playback
    toggle** and a **Skip → result** button. Both drive the *same* deterministic engine — 2×
    just scales the frame `dt` fed to `engine.step` (`RaceField` `speed` prop); Skip mirrors
    `RaceEngine.resolve`, fast-forwarding fixed sub-steps to the finish then reporting once — so
    neither changes who wins, only how long you watch. Controls live in `RaceSession`
    (`raceSpeed`/`setRaceSpeed`/`skipRace`) and render via `RaceHud` (`showControls` = running &&
    !countdown). Ghost/past-build identity is already surfaced: the live board and results label
    your snapshots as `Dragon (ghost 1/2)` vs `Dragon (you)`. Remaining under §1: an optional
    one-beat in-race moment (deferred — low ROI for the auto-viewer).

### Quick reference — severity roll-up

| # | Finding | Sev | Phase |
|---|---------|-----|-------|
| §4 | Loadout mass never reaches the sim | P0 | 1 |
| §2 | Full-burn economy deficit (~220/race) | P1 | 1 |
| §4 | Unbounded Rest over-training loop | P1 | 1 |
| §3 | All-rounder over-wins / ramp outruns playthrough | P1 | 1 |
| §1 | Passive race, no spectacle or agency | P1 | 3 |
| §5 | No type scale; smallest CTA is most important | P1 | 2 |
| §5 | Small-text + muted contrast vs WCAG | P1 | 2 |
| §5 | Duplicate card components | P1 | 2 |
| §6 | No race VFX; motion blur promised, absent | P1 | 3 |
| §7 | Stale draft references in docs | P1 | 2 |

---

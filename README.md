# P1

A AAA-grade web auto kart-racer. Draft cards, build a kart from scratch, then watch
it auto-race a field reconstructed from other players' builds. Inspired by the
training/draft loop of Umamusume, built on the modern web 3D stack.

## Architecture

A TypeScript monorepo (npm workspaces). Packages are consumed as source by the Vite
app via path aliases, so there is no per-package build step in development.

| Package          | Role                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| `@grid/sim`      | Pure, deterministic race engine (no DOM, no three, seeded RNG).       |
| `@grid/content`  | Data + Zod schemas for parts, cards, tracks, cosmetics.               |
| `@grid/game`     | Season loop, card draft, hybrid economy, save/load (Zustand).         |
| `@grid/render`   | React Three Fiber scene: modular kart, spline track, post FX.         |
| `@grid/ui`       | Design system + screens (title, garage, draft, training, HUD).        |
| `@grid/audio`    | Engine sound tied to sim RPM, music, SFX.                             |
| `app`            | Vite app shell + screen state machine.                                |
| `tools/balance`  | Headless batch race simulator for balancing.                          |

## Determinism contract

`@grid/sim` is the source of truth for race outcomes. Given the same `RaceConfig`
(track + entrant builds) and `seed`, it always produces the same result. This makes
async "snapshot" racing possible: opponents are stored as builds and re-simulated
locally, and (later) verified server-side. ESLint forbids `Math.random`, `Date.now`,
and `performance.now` inside the sim.

## Getting started

```bash
npm install
npm run dev        # start the game (http://localhost:5173)
npm test           # determinism + balance unit tests
npm run typecheck  # project-wide TS build
npm run lint       # eslint (incl. determinism guardrails)
npm run balance    # headless balance report
npm run e2e        # Playwright smoke test
```

## Knowledge base

The team's shared references live in [`docs/`](./docs). Per the project rule
(`.cursor/rules/knowledge-base.mdc`): when you learn something, document it in `docs/`,
log the decision in `docs/DECISIONS.md`, and relay it in `docs/CHANGELOG-KNOWLEDGE.md`.

# Concept prototype

`p1-concept.html` (provided by the design brief) is the original single-file
Three.js auto-racer that seeded this project. It established the systems we hardened:

- Catmull-Rom spline track with arc-length parameterization and signed curvature.
- A `derive(stats)` mapping from five legible ratings to physics quantities.
- A pure-pursuit, racing-line-following kart with stamina fade and collisions.
- A fixed `1/60` timestep loop and a season/training meta-loop.

The production version lives in `packages/sim` (deterministic, headless, tested),
`packages/render` (R3F visuals), and `packages/game` (shop + economy + season).
Place the original HTML here as `p1-concept.html` for side-by-side reference.

# Reference: web 3D stack & 60fps budget

Research basis (2026): Three.js/R3F vs Babylon vs PlayCanvas comparisons (youngju.dev,
pkgpulse, cinevva, utsubo). All three hit 60fps; the choice is workflow.

## Stack decision

**React + TypeScript + React Three Fiber + Three.js**, Vite bundler.

- Three.js is the de-facto standard (~2.7–5M weekly downloads, vast ecosystem) and made
  WebGPU near zero-config in recent releases; R3F gives us a declarative, component-based
  scene that fits the rest of the React app.
- We assemble our own systems (sim, audio) anyway, so a "batteries-included" engine
  (Babylon) buys less here. PlayCanvas is editor-first and WebGL2-first.
- **WebGPU primary, WebGL2 fallback**: prefer the WebGPU renderer where available, fall
  back automatically so the game runs everywhere.

## 60fps budget (mid-tier 2023 laptop GPU)

- Frame budget 16.6ms. Draw calls < ~150 in-race.
- **Instancing** (drei `<Instances>`) for trees, rocks, crowd, curbs, and the kart field.
- **LOD** (drei `<Detailed>`) for distant props; frustum culling on by default.
- Build geometry/materials **once**; never allocate in `useFrame` (reuse scratch math).
- One shadow-casting directional light; shadow map ≤ 2048; bias tuned.
- **Asset pipeline**: glTF + Draco (geometry), KTX2/Basis (textures), sprite atlases
  (particles). Keep total VRAM modest.
- **Post FX**: bloom + light motion blur via `@react-three/postprocessing`; gate heavy
  passes behind a quality setting; honor `prefers-reduced-motion`.

## Separation of concerns

Rendering **reads** sim state each frame and interpolates between fixed ticks for
smoothness. It never mutates game logic. The sim runs at fixed `1/60`; the renderer can
draw at the display refresh.

### Gotcha: always interpolate fixed-step state (no raw reads)

Reading raw sim positions in `useFrame` looks fine on a 60 Hz vsync display but
**vibrates badly** on 120/144 Hz monitors (and even on 60 Hz under `rAF` jitter): the
accumulator does 0 sim steps on some frames and 1 on others, so transforms stutter and
the chase camera amplifies it into the *entire scene* (including static geometry) shaking.

Fix (implemented in `RaceField`):

- Each `Racer` keeps a `prev*` snapshot captured at the top of every `step()`/`coast()`.
- `RaceEngine.alpha` exposes the leftover accumulator fraction in `[0,1]`.
- The renderer draws `lerp(prev, current, alpha)` for position, and shortest-path angle
  lerp for heading; the camera follows the **interpolated** player.
- Camera/visual smoothing must be frame-rate-independent: use `1 - exp(-k*dt)`, never a
  fixed per-frame lerp factor (which over-snaps on high-Hz displays).

### Gotcha: z-fighting at the track edges (depth precision)

Symptom: the track edges shimmer/flicker as the camera moves (looks like "vibration" but
it's depth-buffer fighting, not motion). Two coplanar-ish surfaces compete for the same
depth and the winner flips per pixel per frame.

Causes & fixes here:

- **Tight near plane.** `near` was `0.6` with `far` `420` (≈700:1) → almost no depth
  precision in the distance, so the road (`y=0.02`) and the large ground plane (`y=0`)
  fought at the far edges. Fix: `near = 1.5` — the chase/showroom cameras are always ~9+
  units from the subject, so nothing clips, and precision jumps. Keep `near` as large as
  the scene allows.
- **Bias coplanar surfaces apart with `polygonOffset`.** Road biased toward the camera
  (`factor/units = -2`), ground biased away (`+1/+1`) → road deterministically wins.
- **Don't stack geometry at identical heights.** The start/finish line was at `y=0.16`,
  exactly the curb-top height; moved clear so it never co-planes at the crossings.

### Gotcha: shimmer on thin high-contrast patterns (texture, don't tessellate)

Symptom: the red/white curbs sparkle/shimmer in the distance even after z-fighting is
fixed. This is **geometric aliasing**: the curbs were many tiny solid-colored boxes, so
far away several stripes fall inside one pixel with no mip chain to average them →
temporal sparkle. MSAA samples edges only and can't resolve sub-pixel pattern detail.

Fix (the AAA approach): render the pattern as a **texture with mipmaps + anisotropy**, not
as tessellated/instanced solid-color geometry. The curbs are now a single ribbon per side
carrying a tiny repeating red/white `CanvasTexture` (`LinearMipmapLinearFilter`,
`anisotropy = 16`, arc-length UVs snapped so it tiles seamlessly at the seam). Mipmapping
blends the stripes toward smooth grey with distance — no shimmer — and it drops the curbs
from ~2·N instanced boxes to **2 draw calls**. Rule of thumb: any repeating high-contrast
detail (stripes, grids, checkers, text) belongs in a mipmapped texture, never in geometry.
Remember to dispose `material.map` (disposing the material does **not** free its textures).

### Gotcha: kart "vibration" = intra-model z-fighting + shadow swim

When the *karts themselves* shimmer as they move (not the world), suspect two things:

- **Coplanar part faces.** Karts are assembled from many boxes/cylinders. If two
  same-material parts share a face plane (e.g. a side pod's inner face exactly at the body's
  side, or a cover's underside exactly at the body top), those faces z-fight and flicker as
  the view angle changes. Fix: make abutting parts **interpenetrate by a few cm** so no two
  faces are coplanar (see `buildKart.ts`). Verified the motion itself is smooth first via
  `tools/diag/jitter.ts` (a headless replay of the render-loop interpolation — it found zero
  high-frequency position/camera wobble across 60/144/165 Hz with frame jitter).
- **Shadow swimming.** A loose shadow-camera frustum spreads few texels over a big area, so
  shadow edges crawl under moving objects. Fit the frustum to the play area (we use ±66u to
  cover the track) for denser, stable shadow texels.

Note: headless Chromium throttles `requestAnimationFrame` (~7.5 fps), so browser frame-pacing
numbers from Playwright are meaningless — use the deterministic `jitter.ts` harness instead.

### Gotcha: React re-renders rebuilding 3D objects (the real "karts jump" bug)

Symptom: karts jump forward/back as they drive — but `tools/diag/jitter.ts` proves the sim +
interpolation are perfectly smooth. That mismatch is the tell: the cause is **React, not the
math**, so an offline harness can't see it.

What happened: the race HUD state updated ~15 Hz and lived in the **same context** as the
engine. Every HUD tick re-rendered all `useRaceSession()` consumers, including the 3D
`RaceField`. Its parent passed a **fresh `visualsById={{...}}` object literal** each render,
so `useMemo([engine, visualsById])` rebuilt all kart meshes 15×/sec (and disposed the old
ones). The freshly-built kart groups sit at the origin until the next `useFrame` repositions
them → visible jumping, plus GC hitches.

Rules to avoid it:

- **Never pass freshly-allocated objects/arrays as props that feed a `useMemo`/`useEffect`
  dep** that builds GPU resources. Memoize them (`useMemo`) keyed on real inputs.
- **Isolate high-frequency UI state (HUD) in its own context/store** so it can't re-render
  the canvas/3D components. We split `useRaceSession()` (engine/running/countdown) from
  `useRaceHud()` (15 Hz HUD).
- Build heavy 3D objects keyed on stable identities only (here: `[engine, visualsById]` with
  a memoized `visualsById`) so they're created once per race.

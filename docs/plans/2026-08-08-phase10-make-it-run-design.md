# Phase 10: Make It Actually Run — Design

## Priority and delivery

The phase is delivered in six independently verified, pushed parts. Runtime
correctness (Parts 1–3) takes precedence over visual polish. Image generation
and test execution never overlap, and `.omo/` plus `.omx/` remain untouched.

## Runtime clock

Replace the UI `setInterval` with one `requestAnimationFrame` fixed-timestep
clock. The clock owns an elapsed-time accumulator, multiplies elapsed time by
the selected speed (`0`, `1`, `3`, or `5`), advances at 20 ticks per second,
and drops backlog beyond five ticks per rendered frame. It computes successive
`GameState` snapshots outside the reducer and commits the final snapshot with a
pure reducer action. A deterministic scheduler seam lets a store-level test run
600 ticks without wall-clock sleeps.

The same clock exposes its interpolation alpha to the render runtime. Render
code records previous and current walker positions locally and interpolates
between them; no presentation timing enters `GameState`.

## Logistics and placement

Placement enforces physical constraints only: bounds, occupancy, buildable
terrain, era, materials, and kind-specific adjacent terrain. Road connectivity
is evaluated after placement as an operating condition. Unserved buildings
remain present, receive no production or transport service, and expose the
Korean diagnosis `길이 필요합니다`. Onboarding highlights the full set of
valid forest-adjacent logging-camp origins rather than prescribing one tile.

## Readability

The opening camera and zoom floor keep a one-tile building at least 80 CSS
pixels high. Existing manuscript palette tokens remain canonical, while
decorative panel transforms, textures, clipping, and tight padding are removed
from information surfaces. Build choices use at least 56-pixel sprite or SVG
art with persistent labels and group spacing. Layouts at 1280, 768, and 375
pixels scroll internally instead of clipping.

## World assets

Generate six sequential candidates for each required tree and terrain family
against accepted building references on DGX. Promote one candidate per asset
through the existing manifest and verification pipeline. Tree rendering stays
sprite-first with procedural fallback; terrain patterns are seamless,
world-anchored, and composited at 45 percent over palette base colours.

## Proof

Each behavior begins with a failing test. Part 6 drives the production UI at
1x through a fresh timber-chain session, captures every requested state, checks
the roadless idle case, measures 5x frame time, and then repeats the smoke check
against the published URL. `docs/PHASE10_REPORT.md` records decisions, review
objections, hashes, screenshots, skipped work, and an honest two-minute read.

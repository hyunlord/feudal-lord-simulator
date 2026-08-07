# Phase 8: Finish What Was Started — Design

## Goal

Finish the presentation work that the published build still exposes as incomplete: readable text, one coherent guidance layout, usable build controls, an authored starting village, consistent tree and terrain art, and honest stump feedback for logging. Preserve the existing economy, era, and construction rules.

## Boundaries

- Presentation, generated assets, authored initial state, and the minimum world-history evidence required to render fresh and old stumps are in scope.
- Production rates, build costs, service radii, era thresholds, construction timing, delivery behavior, and other economy balance are out of scope.
- The ford is a fixed decorative landmark, not a building, placement tool, route node, or economy object.
- Harvest history records which deterministic forest tile supplied an existing logging production completion. It does not add finite resources, regrowth, new workers, new routes, or a new production step.
- All heavy generation, full tests, asset verification, performance measurement, and browser capture run on DGX Spark.

## Architecture

### Readability

Every text-bearing DOM surface uses an opaque flat palette fill. Parchment character remains in borders, scroll frames, and non-text empty areas. Numeric values use a monospace stack, are right aligned, and are darker than their labels. Vermilion remains a heading and warning accent.

`scripts/checkContrast.ts` parses explicit foreground/background declarations from `src/styles/global.css`, calculates WCAG contrast, and fails below 7:1 for body/numeric text or 8:1 for text below 13px. CSS contract tests also reject repeating background images on text-bearing selectors. Canvas placement and guidance labels use an opaque vellum plate with padding and an ink outline.

### Guidance regions

The application has three spatial regions:

1. The fixed bottom console contains the minimap, build tray, ledger, speed controls, and overlay legend.
2. A fixed right rail contains the current era panel followed by exactly the current task and a dimmed next task.
3. The floating layer contains only transient tooltips and the placement status line.

Population history is opened from a ledger control instead of remaining at the top left. Welcome guidance appears only until any click dismisses it; dismissal persists in browser local storage and never enters deterministic gameplay state.

At 375px the build tray scrolls horizontally rather than shrinking controls below 48px. Shared CSS region variables keep the right rail, bottom console, placement status, and canvas usable area disjoint.

### Build controls

Each placement control has a minimum 48px icon, a short visible Korean label, grouped spacing, cost/requirement/shortfall tooltip, dimmed unaffordable state, and a pressed selected state that remains visible without relying on color alone.

### Authored starting settlement

The seed-1 map uses a fixed settlement centered at `(45, 41)`:

- four level-0 cottages at `(44,40)`, `(46,40)`, `(44,42)`, and `(46,42)`, with three residents each;
- one well at `(45,41)`;
- road tiles `(45,41)` through `(52,41)`;
- one decorative ford at water tile `(53,41)`.

The starting population is 12 and treasury timber remains 205. The camera targets the authored village center and keeps the existing approximately 20-by-20-tile opening span.

### Trees and harvest evidence

DGX ComfyUI generates eight candidates each for six tree forms and two stump forms, using accepted `house_03`, `mill_02`, and `granary_08` sprites as IPAdapter style references. The processing pipeline removes chroma, resizes to exact target geometry, quantises to `foliage` and `timber` ramps, and emits a contact sheet and selection manifest.

Tree selection, tint, scale, sway, and depth remain deterministic. Tint spans the complete foliage ramp, scale expands to `0.70..1.30`, and render ordering uses y position. Existing building and construction clearings remain authoritative.

When an existing logging-camp production cycle completes, a pure selector chooses the nearest eligible forest tile with deterministic tie-breaking. A compact harvest record stores the coordinate and tick. Rendering replaces that tile's tree with `stump_fresh`, then `stump_old` after a fixed presentation age. This does not change output quantity, cycle time, labor, routes, or forest terrain.

### Terrain and parchment

The existing 256px terrain pipeline remains authoritative. Five regenerated textures pass palette and 2x2 seam checks, render at 45% over the flat terrain ramp, use world-anchored patterns, and receive deterministic quarter-turn variation.

Parchment is regenerated as low-frequency, even fibre. Automated low-frequency range and seam metrics decide whether it is acceptable. If it still forms blotches, the shipped texture is a flat palette tile and the release report says so explicitly.

## Verification

Behavior changes use strict red-green-refactor TDD. DGX runs typecheck, all tests including ffmpeg-backed asset tests, build, harness twice, contrast check, palette/asset gates, terrain seam checks, and the 5x render benchmark.

Real-browser evidence covers 1280px, 768px, and 375px without panel intersections. Required 1280px captures are the opening village, ledger close-up, era/task rail, build menu, woodland, and three-tree close-up. The public GitHub Pages build receives the same fresh-load and first-ten-seconds audit after `main` lands.

# Stage 1: Make Cause Visible — Design

## Goal

Let a first-time player identify why population is falling within thirty seconds by reading only the live game screen. The work is presentation and diagnosis only: simulation rules, balance, `GameState`, tick order, and the determinism hash remain unchanged.

## Constraints

- All facts are derived from the current `GameState`; diagnostic code never dispatches or mutates it.
- The economy, population, labour, delivery, and roaming rules are not changed.
- The canonical nineteen-colour palette remains the only colour source.
- Cards, logs, labels, and overlays use the existing living-manuscript visual language.
- The selected target, population history, and highlighted houses are React/render presentation state.
- The existing 436-test baseline and harness hash `4d92c66f9408a603` are release gates.

## Chosen interaction model

Use a world-adjacent selection card plus an always-visible compact population log above the court console.

The alternatives were extending the hover inspector alone or moving all diagnosis into the right console. The hover-only approach cannot support persistent comparison, event-group highlighting, or Walker selection. A console-only approach separates the cause from the affected world object and weakens the thirty-second diagnosis goal.

When no placement seal is armed, clicking a building or Walker selects it. The card stays open until another target is selected, empty world is clicked, or Escape is pressed. A pure placement function chooses a card position inside the viewport and on the side with enough room, offset from the selected object's screen bounds so it does not cover the target. Hover remains transient and selection remains persistent.

## Read-only diagnostic models

### Shared geometry

Extract the footprint-to-footprint Manhattan distance already used by well service into a pure world helper and keep the housing call site behavior-identical. Add a road-component BFS that returns exact existing-road tiles from one or more access points. These helpers accept immutable grid/building inputs and return new presentation values only.

### House diagnosis

`houseDiagnosisModel(state, houseId)` produces identity, level, residents, water status, bread status, and cause lines.

Water states:

1. A serving well exists: `우물 공급 중`.
2. No well exists: `우물이 없습니다`.
3. Wells exist but none serve the house: show the nearest footprint distance and the locked service radius, for example `우물이 너무 멉니다 — 거리 9 / 범위 6`.

Bread states are evaluated in this exact order:

1. The house holds bread: `빵이 있습니다`.
2. There is no granary: `곡창이 없습니다`.
3. Every granary has zero available bread: `곡창에 빵이 없습니다 — 방앗간 확인`.
4. No bread-holding granary shares an existing road component with the house: `곡창에서 이 집까지 도로가 이어지지 않음`.
5. A bread-holding granary is connected but the house has no bread: `배급자가 이 집을 지나가지 않음 — 경로가 멀거나 순회 범위 밖`.

The model reuses actual building access-road rules and existing road tiles. It does not predict or alter distributor movement.

### Walker diagnosis

`walkerDiagnosisModel(state, walkerId)` renders only fields already present on `Walker`:

- role and phase;
- cargo;
- home/source and destination building labels;
- remaining path distance from `pathIndex`;
- ETA in ticks when the current movement rate makes it meaningful;
- houses adjacent to the already-traversed/current route;
- a Korean one-to-one label for each `CarterCancellationReason`.

The selected Walker overlay receives `walker.path.slice(walker.pathIndex)` unchanged and draws that exact sequence as a thin ink/road line. Distributor cards explicitly describe roaming and return-to-granary phases instead of inventing a fixed destination.

### Population presentation history

`PopulationEvent` remains outside `GameState`:

```ts
type PopulationEvent = {
  readonly tick: number;
  readonly delta: 1 | -1;
  readonly cause: "growth" | "starvation" | "no_water" | "recruited";
  readonly houseId: string;
};
```

A pure diff compares previous and current house records. Multi-person changes expand into single-person events. The active rules currently produce `growth` and `starvation`; `no_water` and `recruited` remain explicit schema cases but are never fabricated when the simulation provides no such transition. Initial authored residents are not backfilled.

The presentation reducer appends events and keeps only the newest 200. Consecutive events group only when their cause matches; a group carries the involved unique house IDs. Clicking a group stores those IDs in presentation state and highlights their footprints. The always-visible panel shows the newest readable groups and an empty-state line before the first event.

## Overlays

Extend `OverlayMode` with `distribution` and `road_component` without adding fields to `GameState`.

- Distribution reach performs a bounded BFS from every granary road-access tile over existing road neighbors. Tiles with shortest-path distance at most `BALANCE.DISTRIBUTOR_RANGE` are included. Adjacent houses are marked as service-reachable. The acceptance test compares this result with an independent brute-force BFS.
- Road component performs an unbounded BFS from the selected building's access road tiles and draws exactly that connected component. With no selected building, the control remains available but the legend prompts the player to select one.

Overlay derivation is memoized by immutable `tiles`, `buildings`, `roadRevision`, mode, and selection in the presentation/render layer. No cache is written to simulation state.

## Exact problem labels

The existing glyph condition remains the source of which marker is drawn. Hovering a marked building exposes a precise cause label:

- labour: `일꾼 {idleWorkers}명 대기 — 도로 연결 확인` when workers are idle, otherwise `가용 일꾼이 없습니다`;
- material: distinguish empty required input from an unreachable store route;
- full storage: distinguish a missing eligible store from no road route to one;
- house water and bread markers use the same exact house diagnosis chain.

No generic merged warning string substitutes for these branches.

## Rendering and responsive layout

Selection paths, road components, distribution reach, and event house highlights draw after world objects but before DOM cards. The cards use existing parchment texture and palette CSS variables; no new hex, gradients, blur, shadow, pill, or rounded dashboard chrome is introduced.

Desktop cards target a 270–300px width. At 768px they clamp between the world edge and the console. At 375px the card uses the available width, Korean text uses `word-break: keep-all` with safe overflow wrapping, and the population log caps its height so the selected target and console remain usable. All screen positions are clamped against the visible world area above the 150px console.

## Verification

Automated tests lock every constructed house cause state, exact road and distribution BFS results, event grouping and the 200-event cap, actual Walker path forwarding, cancellation labels, no `GameState` presentation fields, palette compliance, and viewport clamping.

Release verification runs focused tests locally, the full suite and asset-bound tests on DGX, typecheck, production build, economy harness, determinism comparison, three 5x performance samples, and real-browser QA at 1280x720, 768px, and 375px. The final timed acceptance test starts after population decline is visible and records whether a tester can identify the affected house and exact cause within thirty seconds.

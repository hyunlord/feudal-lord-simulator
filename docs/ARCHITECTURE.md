# Architecture

Feudal Lord Simulator uses a pure rules core, a render-owned interaction bridge,
and a React shell. The live Phase 2 runtime is intentionally narrow: it supports
deterministic terrain, building and road placement, camera control, and the
court console. Economy, population, and agent simulation modules are present as
future pure layers but remain non-advancing stubs in this phase.

## Module boundaries

- `content/`: canonical data and constants. Palette, terrain, building,
  housing, and balance definitions live here.
- `world/`: pure tile, grid, placement, and road rules. It knows nothing about
  React or Canvas.
- `engine/`: mutating game actions and tick advancement. In Phase 2 it only
  increments tick and applies validated building and road placements.
- `economy/`, `population/`, `agents/`: reserved pure modules for future
  phases. Their current functions are explicit stubs or type shells.
- `render/`: the only layer that knows about screen coordinates. It owns camera
  math, pointer picking, visible-range culling, draw ordering, overlays, and
  presentation-time motion.
- `ui/`: React controls and status surfaces.
- `state/`: game-state provider and reducer wiring.
- `App` and `GameCanvas`: the bridge that composes the canvas scene with the
  console.

The four simulation axes may import `content/` and files within their own axis,
but never one another. `engine/` is the only simulation layer that combines
them. The axes and engine remain pure TypeScript with no React, DOM, or Canvas
dependencies.

## Live scope

The live loop does not yet run production, storage, labor allocation, housing
progression, or walker behavior. Those systems are scaffolded so the module
shape is ready, but they are intentionally not part of the active Phase 2 game.

Delivery and roaming remain separate future agent behaviours. Delivery owns a
destination, a planned road path, and cargo; roaming chooses local directions
and distributes services. They may share walker data and movement primitives,
but destination pathfinding must not absorb roaming rules and roaming must not
become hidden delivery logic.

## Render ownership

`GameCanvas` owns camera pan, zoom, and clamp behavior; pointer-to-tile hover and
release conversion; middle-drag and space-drag panning; wheel zoom; and
placement previews and road drag state.

`GameState` never stores camera or pointer state. That separation keeps
simulation data deterministic and makes the canvas the only screen-coordinate
bridge.

## Draw order

`renderFrame` always executes three passes in order:

1. ground
2. objects
3. overhang

Terrain draws first, then depth-sorted buildings and trees, then the
intentionally empty overhang seam reserved for future walls and walkers.
Placement overlays render after the passes. This order is asserted by tests and
should not be collapsed into a single mixed pass.

## Determinism

Terrain generation is coordinate-hash based. The same `(tx, ty)` always yields
the same terrain, the same small variation, and the same road and transition
accents. Visible tiles are clipped to the viewport before drawing and are sorted
back-to-front by depth key. Object sway uses a deterministic sine offset
derived from tick and identity; no per-object animation state is stored.

## Placement and actions

Placement validation is pure and explicit:

- `world/placement.ts` checks bounds, occupancy, terrain, road adjacency,
  adjacent terrain, and timber cost.
- `render/interactions.ts` derives previews, pointer tiles, and drag endpoints
  from the current camera.
- `engine/gameActions.ts` mutates state only after validation succeeds.

That keeps rule evaluation in pure code while leaving pointer mechanics in the
render layer.

## Visual system

All visible surfaces use the canonical nineteen-colour palette and the shared
Canvas style helpers. Generated UI assets are limited to the court console
surfaces, seal wells, parchment texture, scroll frame, and illumination
corners. No dashboard chrome, gradients, blur, shadow blur, or ad hoc hex
colours belong in the live UI.

# Architecture

Feudal Lord Simulator uses a pure rules core, a render-owned interaction bridge,
and a React shell. The live Phase 3 runtime now advances economy, population,
labour, walkers, and the Palisade Age transition while keeping screen-space
work in `render/`.

## Module boundaries

- `content/`: canonical data and constants. Palette, terrain, building,
  housing, and balance definitions live here.
- `world/`: pure tile, grid, placement, and road rules. It knows nothing about
  React or Canvas.
- `engine/`: mutating game actions and tick advancement. In Phase 3 it
  coordinates tick order, applies validated building and road placements, and
  advances the active economy loop.
- `economy/`, `population/`, `agents/`: active pure simulation layers for
  production, storage, delivery, roaming, housing, and labour.
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

## Palisade Age boundaries

Stage 3 adds the first era transition without changing the Stage 2 construction
contract into a finished-building shortcut. Construction sites are a
discriminated union: ordinary building sites carry a `buildingKind`, while
palisade sites carry ordered wall-segment metadata and complete into
`PalisadeSegment` state. A wall segment is never represented as a
`BuildingKind`, never produces a `Building`, and never creates a `House`.

The proclamation action is the single gameplay boundary for the transition. It
validates the selected perimeter, atomically spends timber, records the era,
chooses one deterministic gate, and creates the ordered wall sites. Before that
confirmation, wall editing is presentation state owned by React and `render/`:
the draft polygon, drag handles, ceremony clock, and house material wave are not
stored in `GameState` and are excluded from deterministic harness hashes.

Palisades do not participate in placement or routing. They do not block roads,
reroute carters, reserve terrain occupancy, or create new access rules.
Delivery and construction use existing road-to-site access helpers; a completed
wall affects only the explicitly modeled housing-protection calculation and the
rendered enclosure.

## Live scope

The live loop runs production, storage, labour allocation, housing progression,
and walker behavior. The shape is deliberately split so the economy can stay
deterministic and legible.

Delivery and roaming remain separate walker behaviours. Delivery owns a
destination, a planned road path, cargo, reservations, and cancellation
recovery. Roaming chooses local road directions and distributes services. They
may share walker data and movement primitives, but destination pathfinding must
not absorb roaming rules and roaming must not become hidden delivery logic.

Outbound delivery carters reserve contingency capacity at home when they load.
A successful destination deposit releases that claim; a cancellation retains
it through the visible return. Production therefore cannot consume the slot
needed to restore cargo while the carter is away. Fetching carters use their
existing inbound-home reservation for the same guarantee. Bread distributors
likewise exchange carried bread for a granary capacity claim: serving a house
releases one unit of that claim, and restoring leftover bread releases the
remainder. A malformed returning walker without enough valid home capacity
waits instead of overfilling storage.

An outbound carter validates both the remaining destination path and a live
road path back to its home before completing delivery. Removing the home-side
access behind a carter therefore triggers the same cancellation and cargo
recovery path instead of allowing a one-way delivery followed by despawn.

The economy loop is ordered in `engine/tick.ts` as:

1. step delivery carters
2. step roaming distributors
3. update housing
4. allocate labour
5. run production
6. spawn carters
7. spawn distributors

Road-path caching is held in game state and invalidated when road edits bump the
road revision. Delivery routes may reuse cached paths between those invalidation
points, but no stale cache survives a map change.

## Render ownership

`GameCanvas` owns camera pan, zoom, and clamp behavior; pointer-to-tile hover and
release conversion; middle-drag and space-drag panning; wheel zoom; and
placement previews and road drag state.

`GameState` never stores camera or pointer state. That separation keeps
simulation data deterministic and makes the canvas the only screen-coordinate
bridge.

## Economy overlays

`EconomyOverlayControls` exposes only two economy overlays and binds them to
`Digit1` and `Digit2`:

- `Digit1` toggles the water overlay, which draws well service radii and marks
  dry houses
- `Digit2` toggles the labour overlay, which highlights buildings that are
  short of workers

`drawOverlay` only renders these two modes. The rest of the overlay states are
intentionally silent.

## Draw order

`renderFrame` always executes three passes in order:

1. ground
2. objects
3. overhang (walkers and their visible cargo)

Terrain draws first, then depth-sorted buildings, trees, construction sites,
and completed palisade segments, then walkers in the overhang seam. Palisade
proposal geometry remains an overlay, while proclaimed queued/active/completed
wall segments join the object seam so terrain, buildings, walls, and walkers
share one deterministic depth order.
Placement overlays render after the passes. This order is asserted by tests and
should not be collapsed into a single mixed pass.

## Authored opening state

The one pre-placed house starts as a level-2 household with 10 residents. That
authored opening condition supplies exactly five available workers, which makes
the required first logging camp (3 workers) and sawmill (2 workers) operable in
sequence. It does not change the housing table or labour constants: water,
bread, starvation, growth, and 400-tick devolution rules apply from the first
tick, so the unsupported household naturally declines unless the player builds
services.

The opening treasury is tuned to 205 timber. The required logging camp,
sawmill, storehouse, and well cost 95; one complete food chain costs 90; and a
second 20-timber wheat farm supplies the throughput needed by the measured
default-map opening. There is no hidden starter food or household provision.

Housing records retain delivered bread as visible stock. Bread-supported house
levels require both positive stock and a recent service, while starvation itself
is a service-recency rule: a house loses residents when its last bread service
is more than 300 ticks old. Growth does not consume one bread every 50 ticks.
This keeps household state aligned with roaming-distributor service rather than
creating a third, implicit consumption rate outside the locked economy table.

The browser clock applies the 20-ticks-per-second base rate before its `1x`,
`3x`, and `5x` multipliers, yielding 20, 60, and 100 simulation ticks per real
second.

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

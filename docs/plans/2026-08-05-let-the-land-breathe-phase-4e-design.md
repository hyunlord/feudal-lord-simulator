# Phase 4E Let the Land Breathe Design

## Goal

Restore visual breathing room to the world without changing simulation state,
economy, balance, UI, or the locked deterministic hash. Ground texture should
read as the dominant surface, sparse cover should respect settlement space,
and the sawmill should become unmistakable beside the unchanged storehouse.

## Approved visual direction

Ground cover becomes a four-sprite family: two low, trunkless shrubs plus a
grass tuft and field stone. DGX generation produces four candidates for each
ground-cover sprite and six candidates for the sawmill. Selection is based on
silhouette, palette compliance, transparency, and in-game scale rather than a
one-shot generation result. The storehouse, wheat farm, and every other world
asset remain byte-for-byte unchanged.

The final canvas contracts are:

- `shrub_a`: 40 x 28, low and wider than tall.
- `shrub_b`: 32 x 22, low and wider than tall.
- `grass_tuft`: 28 x 18.
- `field_stone`: 24 x 16.
- `sawmill`: existing release dimensions and anchor, but a new silhouette with
  an open work face, a vertical saw frame rising above the roofline, plank
  stacks, and a sawdust patch.

All selected pixels pass through the existing world-sprite quantization and
contract pipeline. The release manifest extends only the foliage keys needed by
the four-cover family and replaces only the sawmill entry.

## Sparse deterministic placement

One pure placement predicate owns ground-cover eligibility. It rejects forest,
water, road/building tiles, and every tile whose Chebyshev distance from any
building footprint or road tile is at most two. The renderer computes the
protected set once for a render input and checks it before constructing cover
descriptors.

Eligible open-grass tiles use the existing stable coordinate/seed hash. A tile
is empty when its normalized roll is below `0.92`, leaving approximately eight
percent occupied. A second hash selects uniformly among the four sprite keys;
later hashes preserve deterministic scale and within-tile offsets. Tests sample
a large fixed grid, assert a bounded density around eight percent, prove every
exclusion boundary, and compare repeated descriptor arrays byte-for-byte.

## Terrain composition and repeat control

Each terrain diamond first receives its flat palette base. Ready terrain
textures are then clipped over that base at approximately 45 percent alpha;
water uses a lower faint alpha so its palette identity stays clear. Existing
procedural variation remains a restrained final overlay.

Grass repetition is broken without introducing another terrain asset. A stable
tile hash chooses one of four quarter-turn rotations. The pattern is transformed
around the tile centre inside the existing clipped diamond, so camera pan, zoom,
and DPR do not alter the choice or phase. Pattern instances and transforms are
cached per rendering context and quarter turn.

## Performance boundary

Performance evidence is collected in two stages with the same deterministic
fixture and entity counts. First, the sparse placement and two-tile protected
set are applied alone and measured at 1x and 5x. Only after recording that result
are the asset and terrain changes integrated and measured again. Each run records
average, p95, worst frame time, buildings, roads, trees, ground-cover descriptors,
and walkers.

The target is a worst 5x frame below 12 ms. If Part 1 exceeds it, optimization
stays within rendering: precompute the protected set, reject outside the visible
range before descriptor construction, and batch the ground-cover pass where
depth correctness permits. Any remaining miss is reported with measured cause;
simulation cadence is not changed to disguise render cost.

## Verification and delivery

Focused tests lock density, two-tile exclusions, forest exclusion, determinism,
sprite aspect ratios, palette membership, terrain alpha/rotation, manifest
scope, and unchanged non-target asset bytes. The complete suite must retain the
340 existing tests and pass all additions, followed by typecheck, production
build, economy harness, `git diff --check`, and determinism hash
`4d92c66f9408a603`.

DGX is the authoritative generation, performance, browser-QA, and serving
environment. Final evidence includes default/open ground, settlement clearing,
sawmill-versus-storehouse, and squint terrain screenshots. The owned
`feudal-sim` tmux service is restarted on port 3200 from the delivered commit,
then local HEAD, DGX HEAD, and `origin/main` are compared before reporting.

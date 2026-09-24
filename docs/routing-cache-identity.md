# Building route cache identity

The building-pair cache represents one undirected road graph query. Its key is
the road revision, the completed wall and gate topology, and the two stable
building IDs in lexical order. A miss is always computed from the lower ID
to the higher ID. Reverse callers receive the reversed path. A missing route
is not cached.

The road revision changes when roads change; the wall topology signature
changes when completed barriers or gates change. Building relocation is not
supported. House merging clears the cache and increments the revision.
Inventory, tick, worker assignment, and request order cannot change road
access or the graph, so they are absent from the key. Existing directional
entries in an older raw state are ignored and recomputed under this key.

The A⁵ acceptance test compares request orders in a tied graph and compares
the non-derived state after 24,000 ticks from the same natural 24-lot state
with a retained versus initially empty route cache. The input fixture and its
hash are recorded in `tests/fixtures/wall/CACHE_FIXTURE.md`.

For one natural seed-1 building pair, 100,000 warm lookups took 26.55 ms
before and 22.21 ms after the canonical key change on the local machine.
This is a route-cache microbenchmark, not frame or full-simulation performance.

## Road tile to building runtime memo

`resolveRoadToBuildingRoute` separately memoizes exact BFS results in a runtime
`WeakMap` keyed by immutable tile-array identity. It never changes serialized
`GameState.pathCache`. A bucket includes width, height, road revision, and the
completed wall/gate topology signature. Each request includes the start tile,
destination ID, kind, position, and actual `buildingFootprint` dimensions.
Immutable tile replacement covers roads, terrain, bridge banks, and occupancy.
Inventory, workers, and tick are not inputs to this route calculation.

Unlike the building-pair cache, this memo also stores `null`: an unreachable
route stays unreachable while all these graph inputs remain identical. Each
bucket holds at most 2,048 FIFO entries. Returned paths are readonly and shared;
consumers must replace or copy arrays instead of mutating them. Tile arrays must
also be replaced for graph edits, as in the existing immutable state updates.

The natural seed3 120-tick regression compares the complete serialized state,
including `pathCache`, with a retained memo and with a fresh tile-array identity
each tick. Both match the pre-change hash. Profiler-off five-pair measurements,
fixture provenance, and the memory bound are recorded in
[the R9 measurement note](design/rule-repairs/R9-road-route-cache.md).

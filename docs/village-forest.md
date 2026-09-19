# Village forest proportions

The tree layout now expresses species stature separately from deterministic age
variation. Tall pines retain a 64-world-pixel nominal height, mature oaks use 90%
of that size, birch 80%, short pines 72%, young oaks 68%, and the retained legacy
dead-tree sprite 65%. Individual variation is 80–115% of each nominal stature.

Forest-edge trees use 72% stature with up to two cardinal forest neighbours and
80% with three; fully surrounded trees retain full stature. At the same camera
zoom, exposed tall pines therefore top out at about 53 world pixels, compared
with about 74 pixels inside a wood. This keeps clearings and small cottages
readable while preserving taller interior crowns. Tree anchors, species slots,
flips, seeds and one-or-two-tree density rules remain unchanged. The existing
starting-landmark visual clearance can admit previously oversized trees now
that they fit; terrain and harvestable forest resources never change.

The layout cache includes cardinal neighbour count as well as seed and count.
Without this distinction, a road or clearing can leave a retained tile object
with its old interior scale when its number of drawn trees remains unchanged.
Existing unit tests cover deterministic identity, safe anchors and species
ratios; added checks cover edge/interior resizing for the same tile object and
species-specific stature bounds. The previous Phase 12 uniform 55–145% scale
contract is deliberately superseded by these proportions.

No PNG, palette, simulation state, footprint, resource count or dependency is
changed. The dead-tree image remains legacy art at reduced size; this pass does
not claim a new matching dead-tree illustration. Actual browser comparison is
recorded under `output/playable-village-v1/` in the main image workspace.

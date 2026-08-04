# Phase 2.5: Make the Land Look Like Land - Design

## Problem

The Phase 2 renderer proves the isometric and interaction systems, but the
visible world is dominated by coordinate-level alternation: checkerboard land,
striped water, cloned trees, and disconnected material marks. The console also
uses generated surfaces whose noise competes with the controls. Phase 2.5 keeps
the game rules intact while replacing those visual failure modes with coherent,
seeded composition.

## Success Criteria

- A 64 by 64 ASCII preview reads immediately as land: connected lake mass,
  one or two woodland masses, and a rocky ridge.
- The same seed reproduces the complete terrain and tree layout.
- Small water regions below six tiles and forest or rock regions below four
  tiles do not survive cleanup.
- Terrain brightness changes by about five percent and adjacent tiles differ by
  only a few percent.
- Forests contain deterministic one-to-three-tree clusters with sparse edges,
  denser interiors, varied silhouettes, offsets, scales, and phases.
- Material seams explain boundaries without decorating every tile.
- The map is the lit focal plane inside a stepped ink-dark surround.
- The bottom console has three clear recesses and no clipped edge ornaments.
- The regenerated scroll has an empty interior and fully transparent exterior.

## Terrain Model

`valueNoise2D(x, y, seed)` hashes the four integer lattice corners, applies
smoothstep to the fractional coordinates, and bilinearly interpolates the
corner values. `fbm(x, y, seed, octaves)` sums normalized octaves with doubled
frequency and halved amplitude.

Generation samples independent coherent fields by offsetting the seed and
sample origin:

- elevation begins with water below `0.32`;
- elevation begins with rock above `0.78`;
- remaining land begins with forest when moisture exceeds `0.58`;
- remaining land is grass.

Those are calibration anchors rather than unreviewed constants. The preview and
region statistics decide small scale or offset adjustments while preserving the
classification meaning. A deterministic flood-fill cleanup converts water
components smaller than six tiles and forest or rock components smaller than
four tiles to grass. A grass cell enclosed on all four sides by water becomes
water. Cleanup repeats only where the deterministic rule requires it and never
uses runtime randomness.

The world builder accepts an explicit seed. The game store passes its declared
seed to the builder rather than maintaining an unrelated default.

## Surface Variation and Seams

Brightness uses a separate low-frequency fBm field mapped to approximately
`0.95..1.05`. Tests bound both the global range and the maximum adjacent
difference; the initial adjacent target is four percentage points and may be
tightened after measurement.

Only orthogonal unlike-neighbour edges receive seam marks:

- grass beside water: a narrow earth shoreline on the grass side;
- grass beside forest: two or three deterministic `sageDark` tufts;
- grass beside rock: deterministic `stoneDark` pebbles.

The canvas outside the diamond world is filled with `ink`. Three hard-edged
palette or alpha bands extend outward from the map boundary to approximate a
soft vignette without gradients, blur, or shadow effects.

## Woodland Model

A pure layout function derives tree descriptors from tile coordinates, world
seed, and forest-neighbour count. Forest edges yield one or two trees; fully
surrounded interiors yield two or three. Each descriptor contains:

- an offset clamped to the inner 35 percent of the isometric diamond;
- a scale within 25 percent of the base size;
- one of narrow, broad, or rounded silhouettes;
- a stable sway phase.

Descriptors are sorted by local y before drawing. Sway remains a draw-time sine
offset, so no animation state enters `GameState`.

## Generated UI Surfaces

Only `wood_console.png` and `scroll_frame.png` are regenerated. Several local
ComfyUI candidates are produced for each and inspected before selection.

The wood prompt targets plain horizontal planks, minimal grain, three sunken
rectangular recesses, and iron only at the ends. The scroll prompt targets
border, corners, and curled edges around a completely empty centre with a
transparent exterior. Selected candidates pass through the existing palette
quantiser; alpha is preserved. Verification rejects any scroll whose interior
is not more than half transparent or whose exterior contains opaque pixels.

The other generated surfaces remain unchanged. CSS removes the two far-edge
illumination fragments and assigns the three recesses unambiguously to minimap,
build seals, and ledger or speed.

## Verification

Pure tests lock noise determinism, fBm determinism, seed divergence, region
minimums, brightness range and adjacency, and every tree descriptor field.
Regression tests retain all Phase 2 contracts and the palette scan. The preview
script prints full maps for two fixed seeds.

Runtime verification includes default map, forest-edge zoom, shoreline zoom,
full-console, and narrow viewport captures. Browser console errors must remain
zero under React StrictMode. Final evidence records raw and quantised UI
candidates, test, typecheck, and build results, visual limitations, Git
provenance, and the exact server revision.

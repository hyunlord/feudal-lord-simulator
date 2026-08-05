# Phase 3.5 Readability Design

## Intent

Make the running economy legible without changing simulation state, tick order,
balance, routing, or deterministic outcomes. The render layer should let a
player distinguish structures, paths, and moving goods before reading labels.

## Visual direction

The existing Living Manuscript system remains authoritative: canonical palette
tokens only, ink outlines, upper-left light, flat shadows, integer-snapped
geometry, and no gradients or blur. Identity comes from three simultaneous
channels: footprint proportion, vertical height, and roof form. Colour confirms
category but never carries identity by itself.

## Rendering architecture

- `buildingVisualState.ts` owns stable silhouette and category data.
- Building body/roof drawing and tree drawing are separated so each file stays
  reviewable and zoom LOD can be tested independently.
- `terrainDetails.ts` owns deterministic decal hashes and road arm selection.
- `drawTerrain.ts` composes ground, sparse decals, seams, and paths.
- `buildingInspectorModel.ts` produces read-only Korean tooltip rows from
  `GameState`; the React view only positions and presents that model.
- Walkers remain in the overhang pass and compensate for camera scale below
  0.8x so their on-screen mark never disappears.

## Building language

- Houses progress from low thatched hut to taller farmhouse, two-storey stone
  gable, then the only house with a tower.
- The well is the only circular structure.
- Storehouse, granary, field, mill, logging camp, and sawmill each receive one
  unique signature detail in addition to distinct body/roof proportions.
- At 0.5x and below, buildings collapse to category-coloured footprint blocks;
  city mass replaces individual identity at that scale.

## Terrain language

Roads are earth pressed into the ground: a continuous diamond/arm fill without
long-edge ink, a subdued central rut, and deterministic stones. Grass gets
sparse deterministic tufts or rocks. Shoreline earth remains low contrast.
Below 0.7x, decals disappear and forests become simplified blobs.

## Interaction

Hovering a footprint resolves its `buildingId` and presents a parchment tooltip
next to the cursor. It lists Korean name, purpose, labour, stock and progress;
houses instead expose level, residents, water and ticks since bread. It clears
on mouse-out and never enters `GameState`.

## Verification

TDD covers silhouette uniqueness, tree clearing, deterministic decals, road
arms, LOD selection, minimum walker size, and inspector rows. Existing palette,
axis, and render-source guards remain intact. Final verification is typecheck,
build, all tests, the economy harness with hash `4d92c66f9408a603`, then browser
screenshots and StrictMode console inspection on the DGX server.

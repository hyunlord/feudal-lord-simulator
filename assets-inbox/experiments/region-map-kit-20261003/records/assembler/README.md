# Deterministic map assembler (candidate prototype)

No engine installation or repository modification. Node.js and existing `sharp` are required. No dependency installation is performed. Sharp is resolved normally, then from `MAPKIT_SHARP`, then `/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp`.

```sh
node assembler/cli.cjs --seed 17 --archetype open_field --kit kit --out samples/open_field-seed17
node assembler/cli.cjs --seed 83 --archetype core:forest_edge --estates estates.json --kit kit --out samples/custom
node assembler/cli.cjs --seed 17 --archetype open_field --neighbor references/neighbor-world.json --kit kit --out samples/neighbor-18
node assembler/cli.cjs --seed 17 --archetype open_field --terrain-only --kit kit --out samples/open_field-terrain-only
node assembler/brush.cjs kit/paths kit/ground/open_field.png
node assembler/test.cjs references/neighbor-world.json --render
```

Run from the package root. Output is `<prefix>.jpg` (1600×1000) and `<prefix>.json`. Inputs may use the five short archetype names or `core:` names: `open_field`, `coastal_port`, `chalk_downs`, `forest_edge`, `fen_drainage`. Seed is a string and must match exactly for identical output. CLI always uses string seeds. The JSON estate list can be an array or `{ "estates": [...] }`:

```json
[
  { "id": "estate-west", "kind": "manor", "x": 330, "y": 350 },
  { "id": "estate-east", "kind": "abbey", "x": 1200, "y": 720 },
  { "id": "estate-auto", "kind": "village" }
]
```

Coordinates are bottom-center anchors. Explicit IDs and coordinates remain unchanged. Missing coordinates are deterministically placed on dry land with spacing. One missing axis, duplicate ID, unsupported archetype, impossible placement, out-of-bounds anchor, or wet anchor fails closed. Supported list size is 1–30; crowded lists may be rejected. Default is 12 estates. The generator preserves input order; changing order is changing input.

## Rendering contract

Paper → tiled archetype ground PNG → continuous water → large painted terrain PNG clusters → connected roads → whole field PNG patches → continuous bank protection → crossings → whole settlement PNGs → painted flag PNGs. Painted terrain is never mirrored. Whole-site alpha bounds are trimmed before scaling and bottom-center anchoring. No building kit assembly and no vector replacement of painted terrain or settlement art. The full settlement art is resized as a single image. Rivers warp real hand-painted channel/bank pixels from `kit/water/river-master.png` continuously along sampled geometry; roads use layered strokes textured from generated ground and clipped to stroke alpha; matching 256×192 RGBA road/river/stream/crossing brush PNGs are exported in `kit/paths`. Procedural strokes are explicitly identified, not falsely described as generated paintings. Metadata records every composited painted PNG with hash, position, size, and no-flip state.

Generic roads use a minimum spanning tree of estate anchors, with cross-bank routes guided to a common crossing zone. Every road/river centerline intersection has an explicit bridge or ford. New open-field/fen maps use bridges; streams may use fords. Northern/western coastal boundaries contain sea, and a continuous stream reaches it. Optional `--terrain-only` suppresses sites and flags for an equivalent bare-map comparison; it does not alter geometry, fields, roads, or terrain. Samples contain no labels by default. Forest/chalk/fen terrain frequencies vary by archetype; they are illustration-layout weights, not the simulation's tile percentages.

Neighbor import preserves all 18 house/estate IDs, exact bottom-center coordinates, 39 source nodes, all 39 source edges and their geometry and `kind`. Source ford, proposed tributary bridge and proposed ferry are retained distinctly. Water is **reconstructed**, anchored at (810,400), (790,460), (1130,512.5); source JSON contains no river centerline. Supplementary crossings caused by reconstructed water are recorded explicitly. This is not an engine capture or pixel-exact reconstruction of the source map. Original market marker for h13 is retained as a market; it is not interpreted as a grain watermill.

## Verification and reproducibility

`test.cjs` checks 15 archetype/seed combinations, MST cardinality, graph connectivity, explicit crossings, dry estate anchors, coordinate bounds, invalid inputs, and exact neighbor geometry/IDs. `--render` additionally renders twice and compares JPEG SHA256 and full metadata bytes, checks JPEG1600×1000, and confirms real terrain/site PNG usage and no flips. Determinism requires identical input bytes/values, kit bytes, Node/sharp/libvips versions. Paths and timestamps are excluded from metadata. Metadata records the JPEG SHA256 and rendering versions.

Bounds/dryness tests concern anchors and placement margins, not pixel-perfect per-sprite terrain contact; alpha footprints, painterly banks and visual crowding require visual review. This prototype does not validate engine gameplay, travel times, economy, drainage mechanics, runtime animation or historical measurement. Supplemental reconstructed crossings are proposed illustration decisions, not approved bridges.

`node assembler/batch.cjs` writes the 15 archetype/seed maps plus the preserved-coordinate neighbor fixture and `samples/manifest.json`. The root package path may be supplied as its first argument. `kit/paths/ports.csv` specifies center pivot, endpoint ports, 8px overlap join rule and transform permissions for renderer-native brushes.

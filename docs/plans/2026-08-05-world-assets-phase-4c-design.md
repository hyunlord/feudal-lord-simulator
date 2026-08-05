# Phase 4C World Asset Design

## Goal

Generate the complete pre-integration world asset family on DGX Spark while preserving the procedural renderer and deterministic simulation. The Phase 4B picks `house_03`, `mill_02`, and `granary_08` are the visual reference and become stable Phase 4D manifest entries alongside the new buildings, foliage, and terrain textures.

## Architecture

Use one deterministic Python generation entry point for ComfyUI and separate TypeScript/Python preparation boundaries for buildings, foliage, terrain, manifest validation, and evidence. The generator owns prompts, seeds, geometry guides, IPAdapter reference conditioning, timing, and portable raw manifests. The preparation layer owns final canvas sizes, bottom-centre anchors, chroma removal, Lanczos resize, palette policies, material policies, outline construction, tileability, and release manifests.

The category boundaries share PNG decoding, canonical palette lookup, and reporting helpers but do not share category-specific validation. Buildings need footprint scale and height progression. Foliage needs a restricted foliage/timber interior palette. Terrain needs opaque, periodic 256px patterns and seam metrics rather than sprite alpha contracts.

## Generation contract

The batch contains exactly 59 deterministic SDXL jobs:

- 48 building candidates: six candidates for each of eight subjects.
- Six foliage assets: one deterministic generation for each named tree or shrub.
- Five terrain textures: one deterministic generation for each terrain type.

All jobs use `sd_xl_base_1.0.safetensors`, no LoRA, fixed seeds, DPM++ 2M Karras, 30 steps, CFG 6.0, and 1024px source images. A neutral 1024px reference atlas contains the three Phase 4B picks. ComfyUI applies the installed SDXL IPAdapter Plus and CLIP Vision model before sampling. Buildings additionally use deterministic 2:1 geometry guides; foliage uses isolated cyan-field silhouettes; terrain uses low-strength style conditioning so building structure does not leak into the texture.

The raw manifest records settings, seed, subject, output path, start/end timestamps, and elapsed seconds but never prompt IDs, credentials, or machine-specific absolute paths.

## Building family

Stable release keys are `house_l0`, `house_l1`, `house_l2`, `house_l3`, `mill`, `barn`, `well`, `storehouse`, `wheat_farm`, `logging_camp`, and `sawmill`. Phase 4B assets are copied byte-identically to `house_l0.png`, `mill.png`, and `barn.png`; the other eight keys are selected from the new candidates.

Every final building uses its specified canvas and a manifest anchor at the bottom-centre contact point. A 1x1 visible alpha bounding box must be 64–90px wide; a 2x2 box must be 115–141px wide. House alpha-bbox heights must strictly increase from L0 through L3. L3 alone may contain a tower.

Roof material is a separation channel:

- L0 and L1 use thatch.
- L2 uses shingle.
- L3 uses slate.
- Production buildings use slate or shingle.
- Storage uses barrel thatch.

All buildings use the Phase 4B exterior-only one-pixel ink outline at alpha 179, omitted in the lower third. Transparent pixels below the declared baseline are rejected. Selection combines geometry compliance, default-zoom legibility, material policy, silhouette separation, and visual-family fit.

`wheat_farm` is treated as a 2x2 field asset. Worked soil and furrows must occupy most of its visible mass; the incidental hut must stay in one corner. Its verifier reports the earth-ramp proportion and rejects a candidate whose field does not dominate.

## Foliage family

The foliage release contains the four tree variants and two shrubs at the exact requested canvases. Interior opaque pixels may use only the foliage and timber ramps. The approved exception is the same one-pixel `PALETTE.ink` outline at alpha 179; it is not counted as an interior foliage colour. No cast or baked ground shadow is allowed.

The manifest records the intended future variation contract: hash-selected variant, scale range 0.75–1.25, in-tile offset, and sine sway. Phase 4C does not modify `treeLayout.ts`, `drawTrees.ts`, or any renderer file.

## Terrain family

The terrain release contains opaque 256x256 textures for grass, forest floor, water, rock, and packed-earth road. Each texture has a category-specific allowed ramp set. Textures are generated, quantised, then made periodic with wrap-aware edge blending rather than copied borders.

Automated seamless verification constructs a 2x2 tiled image and evaluates both joins. It requires matching opposing edges and compares colour-gradient energy in a join band against representative internal bands. A texture fails when its join delta exceeds the configured absolute threshold or is materially larger than its internal variation.

Existing terrain diamonds, seams, hash brightness variation, and draw logic remain untouched. The texture files and manifest prepare the 4D data boundary only.

## Manifest and release layout

Release files live under:

- `public/assets/buildings/`
- `public/assets/foliage/`
- `public/assets/terrain/`
- `public/assets/world_asset_manifest.json`

Each manifest entry records key, category, repo-relative file path, width, height, anchor, footprint, source seed/candidate, palette policy, and alpha policy. The manifest also records the foliage variation contract and terrain seam metrics. Validation requires the exact key set, portable paths, matching PNG dimensions, and existence of every declared file.

## Evidence

`docs/assets/asset_family_sheet.png` shows the three promoted Phase 4B references and every Phase 4C asset at final size on a neutral background, grouped into buildings, foliage, and terrain.

`docs/assets/village_composite.png` places houses L0–L3, mill, barn, storehouse, well, wheat farm, and foliage tightly around a real default-zoom procedural road. Adjacent silhouettes nearly touch. The acceptance review checks building identity, height progression, roof separation, foliage fit, terrain busyness, and whether any neighbours merge.

## Testing and completion

Tests are written before production changes and cover exact generation contracts, manifest parsing, file existence and dimensions, building scale bands, house height progression, palette membership, outline alpha, transparent baselines, foliage palette restriction, terrain opacity and seamlessness, evidence presence, renderer hashes, and absence of sprite wiring.

Completion requires 275 existing tests plus new tests, Python tests, typecheck, production build, asset verification, determinism harness, dual visual QA, independent code review, and a requirement-by-requirement audit. `drawBuildings.ts`, `renderer.ts`, tree rendering, and terrain rendering remain byte-identical. Delivery is committed and pushed to `main`, then local and `git ls-remote` SHAs are compared.

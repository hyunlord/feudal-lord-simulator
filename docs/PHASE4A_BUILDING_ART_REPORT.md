# Phase 4A Building Art Style Report

## Generation

- Model: `sd_xl_base_1.0.safetensors`
- LoRA: none
- Workflow: deterministic subject-specific silhouette guide, SDXL inpaint, then exact cyan exterior restoration
- Resolution: 1024x1024
- Sampler: DPM++ 2M Karras, 30 steps, CFG 6.0, denoise 0.82
- Lighting/projection prompt: upper-left light and explicit 2:1 isometric camera looking down from the upper-left
- Background: exact `#00FFFF` chroma field; keyed without `rembg`
- Seeds: `64040101..64040106`, `64040201..64040206`, and `64040301..64040306`
- Timed 18-image batch: 613.54 seconds (10 minutes 13.54 seconds), excluding two diagnostic probes

The first text-only probe family was rejected before the final batch because it repeatedly generated settlements, multiple structures, paved ground, and baked shadows. A deterministic one-silhouette guide fixed isolation and background control. The raw source batch remains a temporary DGX diagnostic artifact and is not part of the release tree.

## Review artifacts

- `docs/assets/building_candidates.png` is the labelled 3x6 grid at exact final sprite size on neutral mid-grey.
- `docs/assets/building_in_context.png` places house 03, mill 03, and granary 03 at exact final size over a real port-3200 default-zoom terrain capture. It includes procedural water, trees, and a valid procedural road tile. No runtime renderer code was used or changed to make the composite.

## Picks

### House 03

The clearest low, single-building silhouette. Thatch, plaster, and timber remain separately readable after 96x112 downscaling and ramp quantisation. Candidate 02 is the runner-up, but its broad blank wall reads more like a model block than a lived-in hut.

### Mill 03

The wheel, timber frame, thatch, plaster, and stone base survive at 96x160, giving this candidate the strongest material test. It is only a review pick: the body is too tower-like for a low water mill and the wheel is presented too frontally.

### Granary 03

This candidate retains the best roof/wall material breakup at 160x144. It is not an acceptance-quality 2x2 granary: it is cylindrical rather than a wide rectangular store with a longitudinal barrel roof.

## Candidate failures

| Candidate | Failure evidence |
| --- | --- |
| house 01 | Roof overwhelms the wall mass; ragged openings weaken the one-room hut read. |
| house 02 | Clean silhouette, but large blank walls and near-model simplicity lose painted material detail. |
| house 04 | Roof reads as timber/tile rather than thatch; front annex distorts the simplest-hut brief. |
| house 05 | Flat roof and wall planes resist the ramps and read as a blockout. |
| house 06 | Slate-like roof and high-contrast gable depart from the level-zero thatch brief. |
| mill 01 | Bare two-storey tower; almost no medieval material texture beyond the wheel. |
| mill 02 | Tiled roof, weak timber identity, and wheel plane too frontal. |
| mill 04 | Readable wheel, but tower proportion and timber roof miss the low thatched mill. |
| mill 05 | Featureless tower body and slate roof; weakest material response. |
| mill 06 | Tall civic-tower facade and tiled roof; silhouette is not a working rural mill. |
| granary 01 | Open circular rim reads as an unfinished vat, not a roofed 2x2 granary. |
| granary 02 | Cylindrical hut with a blanket-like roof; wrong footprint and muddy midtones. |
| granary 04 | Cleanest alternate, but front-on cylinder and flat cap remain the wrong architecture. |
| granary 05 | Open circular rim again reads as a vat; irregular hanging forms weaken the base line. |
| granary 06 | Cylindrical footprint, coarse roof mass, and dark streaks produce an unusable silhouette. |

The three review picks are the best comparison samples, not approval recommendations. No granary candidate satisfies the required wide 2x2 barrel-roof structure, and no mill candidate has both the intended low proportion and a convincing 2:1 wheel/body relationship.

## Palette assessment

The 48 material colours plus ink and three accents are sufficient for this trial. Plaster and timber hold six distinguishable steps; the thatch ramp preserves useful highlight strands; stone/slate separation survives quantisation. No new material ramp is justified by these candidates.

The main losses are not missing colours but source structure and contrast. The mandatory opaque one-pixel ink outline is much stronger than the procedural terrain line at default zoom, and quantised grey roof areas can become muddy when source material boundaries are weak.

Existing semantic colours now map to canonical entries. The least clean compatibility mappings were the old vermilion (Delta E 19.75), `goldDark` (16.28), ultramarine (13.51), and snow (11.78). The exact requested accent values take precedence for vermilion and ultramarine; `goldDark` now aliases gold, and snow maps to the lightest plaster step.

## Verification

- `npm run typecheck`: pass
- `npm run build`: pass, Vite 8.2.0, 78 modules transformed
- `npm test`: 268/268 pass (all 257 pre-existing tests plus 11 Phase 4A regression tests)
- `python3 -m unittest discover -s tests -p 'test_generate_building_candidates.py' -v`: 8/8 pass
- `npx tsx scripts/verifyBuildingSprites.ts public/assets/buildings/candidates`: pass
- Processed set: exactly 18 non-interlaced 8-bit RGBA PNGs; exact dimensions, canonical RGB, bounded alpha coverage, and transparent rows below each base line
- Determinism before: `4d92c66f9408a603`
- Determinism after: `4d92c66f9408a603`
- `src/render/drawBuildings.ts` SHA-256 before/after: `0a07e98420e6025cc696176b97d5045fabd9d4c1adc60a47e8020d67cf85caba`
- `src/render/renderer.ts` SHA-256 before/after: `0a9ba537a2ef599539f90cb279f5071fcb8a7c655d39353dc22e405047a1baf3`
- Runtime integration: none; no sprite loading, `drawImage`, or generated-building renderer path

## Honest verdict

These now read as buildings, not procedural shape assemblies, but they still read as generated images pasted onto this world. House 03 is close enough to validate the painted-sprite direction. Mill 03 and granary 03 do not validate the subject-control method: the mill is too vertical and the granary is the wrong topology. Across all three, outline contrast is too strong against the subdued procedural terrain, the granary scale dominates nearby trees and water edges, and the camera language is only approximately rather than rigorously 2:1.

Do not generate the remaining eight from this prompt/guide family yet. The next iteration should use stronger structural control (a proper 2:1 blockout or depth/edge conditioning), make the granary guide explicitly rectangular in plan, lower the mill body, and test a softer outline treatment in context while retaining the same material ramps.

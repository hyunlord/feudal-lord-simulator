# Phase 4B — Make the Sprites Belong

## Generation and prompts

- Model: `sd_xl_base_1.0.safetensors`
- LoRA: none
- Workflow: deterministic subject-specific 2:1 guide → SDXL masked inpaint → exact cyan exterior restoration
- Source resolution: 1024x1024; final resize: Lanczos
- Sampler: DPM++ 2M Karras, 30 steps, CFG 6.0, denoise 0.82
- Lighting/background: upper-left light; transparent final canvas; no baked ground or cast shadow
- Count: eight candidates for each of three subjects, 24 total

Base prompt, verbatim:

> one single small humble painterly realistic medieval European building, object-only game sprite, Caesar III/Anno visual language, no settlement and no second structure, exact 2:1 isometric camera looking down from upper-left, upper-left light, visible material textures, walls predominantly plaster and timber with stone only on low foundations and slate only on roofs, isolated complete building, centered with generous padding, clean readable silhouette, perfectly flat uniform #00FFFF chroma field with no gradient or floor plane

House subject clause, verbatim:

> level-zero one-room single-storey thatched peasant hut with low timber frame, weathered plaster walls, small stone hearth chimney

Mill subject clause, verbatim:

> a wide short single-storey medieval workshop, the watermill beside the building has a timber wheel mounted in 2:1 perspective on the visible side face, the building body is about 1.2 tiles wide and no more than 2.2 tiles tall including its low thatched roof, timber-framed plaster walls on low stone footings

Storage-barn subject clause, verbatim:

> a long rectangular medieval storage barn, timber-framed plaster walls, a curved barrel-vaulted thatch roof running the length of the building, wide double doors on the long side, raised on low stone footings

Negative prompt, verbatim:

> ground, terrain, road, path, grass, dirt, contact shadow, cast shadow, drop shadow, ambient occlusion puddle, Roman architecture, columns, aqueduct, marble temple, fantasy, magic, glowing runes, text, letters, numbers, watermark, frame, people, animals, multi-storey, two-storey, townhouse, villa, mansion, hip roof, tiled roof, city, village

## Numeric family contract

The alpha bounding box after final downscale is authoritative. House and mill must be 64–90px wide (1.0–1.4 of the 64px tile width); the two-tile storage barn must be 115–141px wide (1.8–2.2 tiles). The verifier rejects a candidate outside its band. Phase 4B deliberately targets 78px for the house, 88px for the mill, and 126px for the barn before the upper silhouette outline, leaving room for its one-pixel expansion.

Visible RGB values are exact members of the eight six-step material ramps or four accents. `docs/asset-evidence/buildingCandidateProfilesV2.json` records visible width plus per-ramp pixel count and proportion for every candidate.

## Picks and ramp evidence

The recommended set is `house_03`, `mill_02`, and `granary_08`. The house keeps the most legible timber/plaster construction at hut scale; the mill is the widest low workshop with the clearest side-mounted wheel; the barn has the cleanest long barrel-vaulted thatch roof and the clearest long-side double doors. The storage-barn filename retains the existing `granary_*` compatibility key, but the prompt and visual target are the storage-barn clause above.

Selected-candidate ramp proportions (percentage of visible pixels; omitted ramps are zero, and the remaining percentage is canonical outline/accent pixels):

| Pick | Visible bbox | Thatch | Plaster | Timber | Earth | Stone | Slate | Water | Foliage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `house_03` | 78px wide | 14.73% | 29.66% | 40.88% | 9.19% | 0.69% | 0% | 0.06% | 0.17% |
| `mill_02` | 90px wide, 71px tall | 1.68% | 43.16% | 17.14% | 32.34% | 1.79% | 0.03% | 0% | 0% |
| `granary_08` | 128px wide | 5.90% | 33.10% | 36.76% | 14.30% | 6.72% | 0.08% | 0.01% | 0.02% |

The complete counts and unrounded proportions for all 24 candidates are in `docs/asset-evidence/buildingCandidateProfilesV2.json`.

## Outline verdict

The accepted outline is one final-scale exterior pixel in canonical ink at alpha 179 (70.2%). Exterior flood fill prevents outlining internal transparent holes; the lower third receives no added outline. The contact sheet includes the accepted hut again with these alpha-179 pixels removed. The no-outline hut is calmer but loses separation over dark forest; the soft partial outline is the better default-zoom compromise.

## Rejections and scale adjustment

All 24 committed candidates pass the numeric family contract; visual rejection is therefore about subject fidelity, not hidden scale drift. The seven non-picked houses lose to `house_03` on timber/plaster readability or silhouette calm. The seven non-picked mills are taller/narrower, have a less convincing side wheel, or read less clearly as a low workshop. `granary_01`, `02`, `04`, and `06` make the end door dominant or omit a wide long-side door; `05` is front-gable dominant; `07` reads partly as an open shed; `03` passes but has noisier plaster and weaker double-door clarity than `08`.

The generation workflow also rejected uncommitted intermediate barn runs before the final eight: six rounded-cap outputs that read as vats/pills, three no-cap outputs that reverted to hip/flat roofs, two outputs from a self-crossing guide that left an open cyan roof, and one sparse five-point arch that read as a gable. The final guide uses an eleven-point smooth barrel arch whose screen-space long axis follows the 2:1 isometric slope.

Scale normalization targets 78px house, 88px mill, and 126px barn content widths before the one-pixel exterior outline. The final selected alpha bboxes are 78px, 90px, and 128px wide; the selected mill is 71px tall, exactly at the automatic 2.2-tile-height rounded ceiling. No candidate outside 64–90px (house/mill), 115–141px (barn), or the mill height ceiling survives verification.

## Evidence

- `docs/assets/building_candidates_v2.png`: all 24 final-scale candidates plus the accepted no-outline hut variant.
- `docs/assets/building_old_new_v2.png`: Phase 4A pick versus Phase 4B pick for all three subjects.
- `docs/assets/building_in_context_v2.png`: three Phase 4B picks close together along one live procedural road at default zoom, with actual terrain, trees, and water.

## Verification

- TypeScript: `npm test` — 275 passed, 0 failed.
- Python: `test_generate_building_candidates.py` (8), `test_build_phase4b_evidence.py` (2), and existing `test_generate_ui_assets.py` (18) — 28 passed, 0 failed.
- Static/build: `npm run typecheck`, `npm run build`, `git diff --check` — passed.
- Asset contract: `npx tsx scripts/verifyBuildingSprites.ts public/assets/buildings/candidates_v2` — 24/24 passed; exactly 24 PNG files present.
- Determinism: `npm run harness` — `4d92c66f9408a603`, unchanged and all five metrics PASS.
- Protected renderer hashes remain byte-identical: `drawBuildings.ts` = `0a07e98420e6025cc696176b97d5045fabd9d4c1adc60a47e8020d67cf85caba`; `renderer.ts` = `0a9ba537a2ef599539f90cb279f5071fcb8a7c655d39353dc22e405047a1baf3`.
- Git delivery target: branch `main`, remote `https://github.com/hyunlord/feudal-lord-simulator.git`; the release commit containing this report is verified against `refs/heads/main` in the final handoff.

## Honest score and remaining issues

The structured visual gate scored the final evidence **91/100 (PASS)**, versus Phase 4A's 61/100. An adversarial second review also returned PASS while scoring more conservatively at 83/100. The honest combined Phase 4B assessment is **87/100**: the requested family contract and evidence are complete, but runtime image integration is intentionally deferred.

The remaining four issues are:

1. Generated roof texture is still more painterly and finely striated than the procedural terrain and trees, most visibly on `granary_08`.
2. The `mill_02` wheel is correctly side-mounted and short/wide in context, but its rim is pale and lower-contrast than the procedural line language.
3. `granary_08` is unmistakably a long barrel-roof storage barn, but its long-side opening reads less explicitly as a wide pair of doors than the literal prompt clause.
4. The context sheet is an honest composite over a live default-zoom terrain capture, not proof of runtime sprite anchors; renderer integration remains Phase 4D work.

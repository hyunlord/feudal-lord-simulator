# Phase 4C — Generate the Whole World

> **Release status:** asset generation, selection, preparation, automated verification, evidence construction, dual visual QA, and Git delivery to `main` are complete. The immutable release-content commit is `5a695d6765583468d8c79e654033f1e605041213`; the report commit necessarily follows it.

## 1. Generation settings and total batch time

### Locked generation contract

- Runtime: DGX Spark, ComfyUI HTTP API on `127.0.0.1:8188`
- Checkpoint: `sd_xl_base_1.0.safetensors`
- LoRA: none
- Style references: `house_03`, `mill_02`, and `granary_08` from Phase 4B
- Reference encoder: `CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors`
- IPAdapter: `ip-adapter-plus_sdxl_vit-h.safetensors`, preset `PLUS (high strength)`
- Reference combination: three individually loaded images, averaged by `ImageBatch`; `weight_type=style transfer precise`, `embeds_scaling=K+V w/ C penalty`
- Current category style weights: building `0.05`, foliage `0.02`, terrain `0.01`; conditioning interval `0.0–0.3`
- Sampler: DPM++ 2M Karras, 30 steps, CFG 6.0
- Source resolution: 1024x1024
- Building and foliage isolation: deterministic subject guide, masked inpaint, exact cyan exterior restoration
- Committed guided-inpaint denoise: `0.48` for `storehouse`; `0.72` for every other guided subject
- Terrain isolation: no subject guide; low-strength reference conditioning and texture-only prompt
- Final resize: Lanczos
- Required job count: 59 total — 48 building candidates, six foliage sources, five terrain sources
- Raw source policy: unique `/tmp/feudal-phase4c-world-assets-*` directory; raw 1024px outputs are not committed
- Manifest policy: repo-relative paths and portable timing fields only; no prompt IDs, credentials, or host-specific absolute paths

### Seeds and candidate ranges

| Category | Asset | Candidate/seed contract |
| --- | --- | --- |
| Building | `house_l1` | `01–06` / `64050101–64050106` |
| Building | `house_l2` | `01–06` / `64050201–64050206` |
| Building | `house_l3` | `01–06` / `64050301–64050306` |
| Building | `well` | `01–06` / `64050401–64050406` |
| Building | `storehouse` | `01–06` / `64050501–64050506` |
| Building | `wheat_farm` | `01–06` / `64050601–64050606` |
| Building | `logging_camp` | `01–06` / `64050701–64050706` |
| Building | `sawmill` | `01–06` / `64050801–64050806` |
| Foliage | `tree_conifer_a` through `shrub_b` | one source each / `64052001–64052006` in manifest key order |
| Terrain | `grass` through `packed_earth_road` | one source each / `64053001–64053005` in manifest key order |

Final selected building provenance in the corrected release manifest: `house_l1` seed `64050101` candidate 1; `house_l2` `64050203` candidate 3; `house_l3` `64050304` candidate 4; `well` `64050405` candidate 5; `storehouse` `64050501` candidate 1; `wheat_farm` `64050601` candidate 1; `logging_camp` `64050704` candidate 4; `sawmill` `64050805` candidate 5. A subject-index offset found during the final audit was fixed through a regression assertion, the focused manifest tests passed 3/3, and real preparation was rerun before this report was closed.

### Timing and retry result

- First batch started: `2026-08-05T07:16:29.579763Z`
- First batch ended: `2026-08-05T07:50:45.248160Z`
- First batch elapsed: `2055.668s` (34 minutes 15.668 seconds)
- Completed first-attempt jobs: `59 / 59`
- Generation-execution retries in the first batch: none
- First production retry manifest: 18/18 jobs generated, from `2026-08-05T07:52:06.131293Z` to `2026-08-05T08:02:41.542261Z`, elapsed `635.411s` (10 minutes 35.411 seconds). This run used dedicated shallow/open guides for six candidates each of `storehouse`, `logging_camp`, and `sawmill`.
- Retry result: `logging_camp_04` and `sawmill_05` were selected from production retry 1. All six retry-1 storehouses passed the automated contract but remained visually closed box/house silhouettes; retry 2 also remained flat/closed. Retry 3 used the semantic composite guide at denoise `0.48` and selected `storehouse_01`.
- Permanently failed jobs: none
- Portable generation manifests verified in the release tree: [`phase4c_generation_manifest.json`](asset-evidence/phase4c_generation_manifest.json), [`phase4c_production_retry_manifest.json`](asset-evidence/phase4c_production_retry_manifest.json), [`phase4c_storehouse_retry2_manifest.json`](asset-evidence/phase4c_storehouse_retry2_manifest.json), [`phase4c_storehouse_retry3_manifest.json`](asset-evidence/phase4c_storehouse_retry3_manifest.json), and [`phase4c_well_retry_manifest.json`](asset-evidence/phase4c_well_retry_manifest.json)
- Storehouse retry 2: 6/6 generated from `2026-08-05T08:03:22.777817Z` to `2026-08-05T08:06:47.488658Z`, elapsed `204.711s`; all six remained visually flat and closed.
- Storehouse retry 3: 6/6 generated from `2026-08-05T08:09:34.841008Z` to `2026-08-05T08:13:03.415291Z`, elapsed `208.574s`; the semantic composite guide fixed the open-storage read and candidate 01 was selected.
- Well retry: 6/6 generated from `2026-08-05T08:17:48.458305Z` to `2026-08-05T08:21:16.802034Z`, elapsed `208.344s`; final widths were 70, 70, 70, 70, 70, and 69px, and candidate 05 was selected. The original six wells were all rejected for 38–43px widths below the 64px scale floor.

### Preflight history and corrections

The live preflight did not pass on its first attempt. These probes are intentionally excluded from the 59 release jobs and remain non-release `/tmp` evidence.

| Probe | Result | Decision/correction |
| --- | --- | --- |
| Initial IPAdapter probe, weight `0.65` | Generated a grid/contact-sheet-like collection instead of one isolated asset. | Rejected; reduced style conditioning and strengthened one-subject negatives. |
| Weak reference probe, weight `0.35` | Still generated a grid of assets. | Rejected; moved to category-specific prompts. |
| Category prompt probe, foliage weight `0.15` | Still generated a grid/collection rather than one subject. | Rejected; added explicit “exactly one” and banned grid/sprite-sheet vocabulary. |
| Single-subject text probe | Produced a village/multiple-object scene. | Rejected; text-only isolation was not sufficient. |
| Individually loaded reference batch/average probe | Produced a large house scene; reference content bled into the requested subject. | Rejected; reduced category weights and separated foliage material language. |
| Low-weight foliage probe, weight `0.02` | Still produced a house scene because the foliage prompt inherited architectural material terms. | Rejected; created a foliage-specific prompt with architecture/material exclusions. |
| Foliage-specific text probe | Removed the house but produced a forest scene rather than one shrub. | Rejected; established deterministic cyan-field subject guides and masked inpaint. |
| Guided isolation probe | PASS — the refined cyan guide produced one bounded shrub/tree clump; measured cyan ratio `0.9303`. | Accepted for batch isolation: the guide constrained the output to one subject while preserving a predominantly exact-cyan exterior. |

The important failure mode was content bleed, not only excessive IPAdapter strength: the three building references repeatedly pulled foliage prompts toward buildings or village scenes. The refined guide-based probe satisfied the isolation gate with one bounded subject and a `0.9303` cyan ratio; category-specific visual semantics still require candidate review after generation.

## 2. Acceptance images

- Packed village: [`docs/assets/village_composite.png`](assets/village_composite.png) — 1280x900, SHA-256 `484702a070736af1e347ac56748a9c7eb12fc746fd6bee809d34f69974620d43`; 17 placements and eight audited 4px adjacency gaps over the verified default-zoom terrain source
- Full family: [`docs/assets/asset_family_sheet.png`](assets/asset_family_sheet.png) — 2672x1046, SHA-256 `dce726568f6928b0d99f0c4f16ccfbbe645cb37d5ea8e5da24196872758043c4`; all 22 release assets appear at final size
- Placement ledger: [`docs/assets/phase4c_placement_ledger.json`](assets/phase4c_placement_ledger.json), SHA-256 `adb73b705eda7a9c85d3c595b2eef107a4c2ca03391129d30e436aebe34536df`; family count 22, village placement count 17, adjacency count 8
- Terrain source: `phase4c-terrain-default-zoom.png`, 1280x900, SHA-256 `b4eabe082fdf5f0ede92af139ef8e3b2e7550e270682b97011cb833b8cedb26c`

The packed village must show a real procedural road and terrain at default zoom, houses L0–L3, mill, barn, storehouse, well, wheat farm, and foliage at the settlement edge. These are review composites only; they do not imply runtime sprite integration.

## 3. Asset picks and rejection rationale

### Promoted Phase 4B buildings

| Release key | Source | Byte-identical promotion | Reason |
| --- | --- | --- | --- |
| `house_l0` | `house_03` | PASS — source and destination SHA-256 `417da9d910a6d87bedd99cff3838ec9505ad1e7c547c751d4e88d548b9f304ce` | Approved Phase 4B hut and the base of the house progression. |
| `mill` | `mill_02` | PASS — source and destination SHA-256 `794be4b5670e5d8b305fddbd2812f964eb9cb49f463697c9d93337f5ccac6f5c` | Approved wide, low production-building reference. |
| `barn` | `granary_08` | PASS — source and destination SHA-256 `ac167ef0d025d649bcd3e815a20983046b50ec5a8ab8a63b69040a5490b5eac0` | Approved long barrel-roof storage building; release key is `barn`. |

### Eight new buildings: six-candidate review

Each row must be completed from the final-size candidate sheet and automatic profiles. “Pick” requires geometry, material policy, scale, baseline, family fit, and default-zoom legibility to pass; aesthetic preference alone is insufficient.

| Asset | Pick | Why selected | Candidate 01 | Candidate 02 | Candidate 03 | Candidate 04 | Candidate 05 | Candidate 06 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `house_l1` | `house_l1_01` | Prior selection review ranked 01 first for the L1 farm-cottage read; 06 was second. | PICK — strongest reviewed L1 candidate. | REJECT — ranked below 01 in the prior visual review. | REJECT — ranked below 01 in the prior visual review. | REJECT — ranked below 01 in the prior visual review. | REJECT — ranked below 01 in the prior visual review. | REJECT — runner-up; 01 retained the stronger overall L1 read. |
| `house_l2` | `house_l2_03` | Prior selection review ranked 03 first for the two-storey townhouse read; 06 was second. | REJECT — ranked below 03 in the prior visual review. | REJECT — ranked below 03 in the prior visual review. | PICK — strongest reviewed L2 candidate. | REJECT — ranked below 03 in the prior visual review. | REJECT — ranked below 03 in the prior visual review. | REJECT — runner-up; 03 retained the stronger overall L2 read. |
| `house_l3` | `house_l3_04` | Prior selection review ranked 04 first for the manor/tower hierarchy; 06 was second. | REJECT — ranked below 04 in the prior visual review. | REJECT — ranked below 04 in the prior visual review. | REJECT — ranked below 04 in the prior visual review. | PICK — strongest reviewed L3 candidate. | REJECT — ranked below 04 in the prior visual review. | REJECT — runner-up; 04 retained the stronger overall L3 read. |
| `well` | `well_05` (retry) | All retry candidates passed scale; 05 was selected by final visual review. The original six were rejected at only 38–43px wide. | REJECT — retry width 70px, ranked below 05. | REJECT — retry width 70px, ranked below 05. | REJECT — retry width 70px, ranked below 05. | REJECT — retry width 70px, ranked below 05. | PICK — retry width 70px and strongest final well read. | REJECT — retry width 69px, ranked below 05. |
| `storehouse` | `storehouse_01` (retry3) | The retry-3 semantic composite guide produced the required open-front storage read; 01 won final review. | PICK — strongest retry-3 open-front semantic read. | REJECT — retry3 ranked below 01. | REJECT — retry3 ranked below 01. | REJECT — retry3 ranked below 01. | REJECT — retry3 ranked below 01. | REJECT — retry3 ranked below 01. |
| `wheat_farm` | `wheat_farm_01` | Best combined furrow readability and incidental corner-hut composition; field mass dominates. | PICK — earth `0.913`; best furrows plus corner hut. | REJECT — earth `0.894`; weaker overall farm semantics than 01. | REJECT — earth `0.853`; weaker field dominance/read than 01. | REJECT — earth `0.919`; higher earth share but weaker furrow/corner-hut composition than 01. | REJECT — earth `0.854`; weaker field dominance/read than 01. | REJECT — earth `0.949`; highest earth share but weaker furrow/corner-hut composition than 01. |
| `logging_camp` | `logging_camp_04` (retry1) | Open bay, separated log ends, and an interior wood cue make 04 the clearest active logging camp; 05 was second. | REJECT — discs/stumps dominate. | REJECT — slab/stump form. | REJECT — wood cue is tiny and ambiguous. | PICK — open bay, log ends, and interior wood cue. | REJECT — good runner-up, but less active with less-separated logs. | REJECT — too empty and generic. |
| `sawmill` | `sawmill_05` (retry1) | Open workshop, truss, horizontal frame, and right-side plank make 05 the most specific sawmill; 06 was second. | REJECT — empty shed. | REJECT — roof-dominant with no readable tool. | REJECT — tiny noisy side detail. | REJECT — generic form with no readable saw. | PICK — open workshop, truss, horizontal frame, and right plank. | REJECT — open runner-up, but flatter and less subject-specific. |

Candidate cells must use one of: `PICK — reason`, `REJECT — contract failure`, `REJECT — subject/visual reason`, or `GENERATION FAIL — error`. Do not collapse all five non-picks into a generic statement. For `wheat_farm`, include the measured earth-ramp proportion and state whether worked land occupies most of the visible mass.

### Foliage picks

There is one deterministic source per foliage key; “selected” still requires processing and validation. A failing source must be regenerated with its retry seed recorded rather than silently accepted.

| Asset | Final size | Source seed/attempt | Selection verdict | Family/shape rationale | Rejection or retry history |
| --- | ---: | --- | --- | --- | --- |
| `tree_conifer_a` | 64x96 | `64052001`, attempt 1 | SELECTED | Tall, narrow evergreen silhouette. | None. |
| `tree_conifer_b` | 56x80 | `64052002`, attempt 1 | SELECTED | Shorter, broader evergreen silhouette distinct from variant A. | None. |
| `tree_broadleaf_a` | 72x88 | `64052003`, attempt 1 | SELECTED | Rounded connected deciduous canopy with a readable trunk. | None. |
| `tree_broadleaf_b` | 64x72 | `64052004`, attempt 1 | SELECTED | Smaller, sparser deciduous canopy distinct from variant A. | None. |
| `shrub_a` | 40x36 | `64052005`, attempt 1 | SELECTED | Low connected bush clump that remains legible at final size. | None. |
| `shrub_b` | 32x28 | `64052006`, attempt 1 | SELECTED | Smaller sparse bush clump distinct from variant A. | None. |

All foliage interiors must contain foliage/timber ramp colours only. The sole approved exception is the exterior one-pixel canonical ink outline at alpha 179. No baked ground or cast shadow is permitted. The manifest must preserve the Phase 4D variation contract: hash-selected variant, scale `0.75–1.25`, in-tile offset, and sine sway.

Independent visual QA verdict: **PASS** for the foliage family. The retained minor risk is `shrub_b`, whose compact upright silhouette can read as a tiny tree at default size.

### Terrain picks

| Asset | Final size | Source seed/attempt | Selection verdict | Visual rationale | Rejection or retry history |
| --- | ---: | --- | --- | --- | --- |
| `grass` | 256x256 | `64053001`, attempt 1 | SELECTED | Restrained meadow surface compatible with procedural brightness drift. | None. |
| `forest_floor` | 256x256 | `64053002`, attempt 1 | SELECTED | Woodland-floor surface without a discrete object or border. | None. |
| `water` | 256x256 | `64053003`, attempt 1 | SELECTED | Continuous water surface without a shoreline. | None. |
| `rock` | 256x256 | `64053004`, attempt 1 | SELECTED | Continuous weathered-rock surface without loose-object silhouettes. | None. |
| `packed_earth_road` | 256x256 | `64053005`, attempt 1 | SELECTED | Continuous packed-earth surface without road edges or markings. | None. |

Independent visual QA verdict: **PASS** for the terrain family, with minor visible repetition retained as a non-blocking risk.

## 4. Packed-village adjacency check

Overall verdict: **PASS**. Both independent final visual reviewers scored the same evidence images 91/100 with no blockers; no adjacent buildings merged.

| Adjacency pair/group | Nearly touching? | Silhouettes remain separate? | Evidence and correction |
| --- | --- | --- | --- |
| `house_l0` / `house_l1` | Yes — audited opaque gap 4px | PASS | Thatch family is shared, but the 74px/104px height step and separate outlines preserve identity. |
| `house_l1` / `house_l2` | Yes — audited opaque gap 4px | PASS | Thatch versus slate/shingle colour and the 104px/128px height step separate them. |
| `house_l2` / `house_l3` | Yes — audited opaque gap 4px | PASS | The 128px/161px skyline step and L3's sole tower keep the manor independently legible. |
| `mill` / `barn` | Yes — audited opaque gap 4px | PASS | The direct Phase 4B regression pair remains visibly separate. |
| `barn` / `storehouse` | Yes — audited opaque gap 4px | PASS | Barrel thatch and timber mass separate from the storehouse's slate/open-front read. |
| `well` / nearest building | Yes — 4px gaps to storehouse and wheat farm | PASS | The 70x61px opaque well remains legible between larger neighbours. |
| `wheat_farm` / nearest building | Yes — audited opaque gap 4px to well | PASS | The 87.81% earth field mass remains primary rather than merging into a building. |
| Trees / settlement edge | Closely grouped in the 17-placement composite | PASS | Final visual QA found foliage separate from roofs and building outlines. |

Merged buildings: none. Both reviewers passed the same 1280x900 composite with no blocking adjacency finding.

The acceptance criterion is not merely visible outlines in isolation. Adjacent buildings must retain distinct roof materials, meaningful height differences, and separate overall masses when packed as they will be in a developed settlement.

## 5. Ramp proportions across all buildings

Percentages are proportions of visible pixels. Omitted canonical accent/outline pixels must be reported separately or explained; values may not be inferred from prompts. `Earth dominance` is mandatory for `wheat_farm`. Alpha-bbox heights must strictly increase from L0 through L3.

| Building | Source | Alpha bbox WxH | Thatch | Plaster | Timber | Earth | Stone | Slate | Water | Foliage | Accent/outline/other canonical | Policy verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `house_l0` | `house_03` | 78x74 | 14.73% | 29.66% | 40.88% | 9.19% | 0.69% | 0.00% | 0.06% | 0.17% | 4.62% | PASS — thatch; progression base |
| `house_l1` | `house_l1_01` | 81x104 | 37.95% | 30.99% | 3.34% | 6.62% | 17.51% | 0.04% | 0.04% | 0.00% | 3.50% | PASS — thatch |
| `house_l2` | `house_l2_03` | 88x128 | 0.00% | 35.42% | 2.53% | 4.72% | 11.83% | 42.91% | 0.00% | 0.00% | 2.59% | PASS — shingle/slate roof separation |
| `house_l3` | `house_l3_04` | 141x161 | 0.01% | 7.57% | 1.53% | 0.95% | 45.20% | 42.55% | 0.01% | 0.00% | 2.17% | PASS — slate; only tower |
| `mill` | `mill_02` | 90x71 | 1.68% | 43.16% | 17.14% | 32.34% | 1.79% | 0.03% | 0.00% | 0.00% | 3.86% | PASS — production form retained |
| `barn` | `granary_08` | 128x108 | 5.90% | 33.10% | 36.76% | 14.30% | 6.72% | 0.08% | 0.01% | 0.02% | 3.10% | PASS — barrel thatch |
| `well` | `well_05` (retry) | 70x61 | 40.25% | 39.36% | 0.00% | 0.00% | 15.45% | 0.00% | 0.00% | 0.00% | 4.94% | PASS — roofed stone wellhead |
| `storehouse` | `storehouse_01` (retry3) | 139x104 | 1.31% | 22.77% | 18.36% | 5.77% | 6.31% | 43.36% | 0.00% | 0.00% | 2.12% | PASS — open-front slate storage identity |
| `wheat_farm` | `wheat_farm_01` | 128x80 | 0.02% | 6.53% | 1.03% | 87.81% | 0.80% | 0.00% | 0.02% | 0.00% | 3.79% | PASS — field-dominant worked land |
| `logging_camp` | `logging_camp_04` (retry1) | 88x74 | 3.48% | 18.67% | 1.95% | 2.38% | 24.21% | 45.59% | 0.14% | 0.00% | 3.59% | PASS — open-bay production cues |
| `sawmill` | `sawmill_05` (retry1) | 88x73 | 0.00% | 40.51% | 9.21% | 2.29% | 1.89% | 42.73% | 0.12% | 0.00% | 3.25% | PASS — weakest but accepted production role |

Scale-band verdicts:

- 1x1 buildings, visible width 64–90px: PASS — L0 78, L1 81, L2 88, mill 90, well 70, logging camp 88, sawmill 88px
- 2x2 buildings, visible width 115–141px: PASS — L3 141, barn 128, storehouse 139, wheat farm 128px
- House alpha-bbox height order, L0 < L1 < L2 < L3: PASS — 74 < 104 < 128 < 161px
- Bottom-centre anchor and transparent pixels below baseline: PASS for all 11 buildings
- Exterior outline: PASS — one-pixel canonical ink at alpha 179, exterior-only and omitted in the lower third
- Baked/contact/cast ground shadows: none detected; all 11 passed the sprite release contract

## 6. Terrain seamlessness verification

The verifier must construct a 2x2 tile and evaluate both joins. Opposing edges must be compatible, and join-band gradient energy must stay within the configured absolute threshold and not materially exceed representative internal-band variation. Visual inspection alone is not a pass.

| Texture | Horizontal join delta | Vertical join delta | Horizontal internal delta | Vertical internal delta | Threshold | Opaque | Palette policy | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `grass` | `9.383951822916652` | `2.864746093750004` | `10.370605468750027` | `3.7255859375000124` | `24` | PASS | foliage/earth PASS | PASS |
| `forest_floor` | `7.871256510416604` | `7.754231770833263` | `11.493326822916726` | `12.09114583333347` | `24` | PASS | foliage/earth/timber PASS | PASS |
| `water` | `4.448893229166667` | `13.619303385416732` | `6.650878906250001` | `23.97656249999999` | `24` | PASS | water PASS | PASS |
| `rock` | `7.646809895833298` | `9.29866536458333` | `8.922688802083316` | `12.526041666666751` | `24` | PASS | stone/slate PASS | PASS |
| `packed_earth_road` | `8.204264322916602` | `10.105468750000004` | `12.395182291666734` | `11.829427083333426` | `24` | PASS | earth/timber PASS | PASS |

Automated overall verdict: 5/5 PASS. All five prepared textures are opaque, obey their category palette policies, and remain below the seam threshold of 24 on both joins.

## 7. Failed and rejected assets

The generation/preparation ledger must preserve failures, retries, and contract rejections rather than reporting only the final winners.

### Batch failures and retries

| Job | Attempt | Stage | Failure evidence | Disposition |
| --- | ---: | --- | --- | --- |
| First 59-job batch | 1 | Generation execution | No execution failures; 59/59 outputs completed. | Completed; subsequent selection/visual gates remain separate. |
| `storehouse_01–06` | Initial batch | Visual-semantic review | All six were visually house-shaped rather than open-fronted shallow storage forms. | Rejected; regenerated with a dedicated guide. |
| `logging_camp_01–06` | Initial batch | Visual-semantic review | All six were visually house-shaped rather than open shelters with logging cues. | Rejected; dedicated-guide retry 1 generated six replacements and selected 04. |
| `sawmill_01–06` | Initial batch | Visual-semantic review | All six were visually house-shaped rather than shallow workshops with horizontal saw cues. | Rejected; dedicated-guide retry 1 generated six replacements and selected 05. |
| `storehouse_01–06` | Production retry 1 | Automated contract and visual-semantic review | All six passed the automated contract, but all remained visually closed box/house silhouettes. | All rejected; retry 2 followed at denoise `0.48`. |
| `logging_camp_01–06` | Production retry 1 | Visual-semantic review | 04 had the clearest open bay, separated log ends, and interior wood cue; 05 ranked second. | Selected 04; rejected 01–03 and 05–06 for the reasons in Section 3. |
| `sawmill_01–06` | Production retry 1 | Visual-semantic review | 05 had the clearest open workshop, truss, horizontal frame, and right plank; 06 ranked second. | Selected 05; rejected 01–04 and 06 for the reasons in Section 3. |
| `storehouse_01–06` | Production retry 2 | Visual-semantic review | All six remained visually flat and closed. | All rejected; semantic composite guide introduced for retry 3. |
| `storehouse_01–06` | Production retry 3 | Visual-semantic review | The semantic composite guide restored the open-front storage read. | Selected 01; rejected 02–06 relative to 01. |
| `well_01–06` | Initial batch | Scale contract | All six were only 38–43px wide, below the 64px 1x1 floor. | All rejected; dedicated well retry generated. |
| `well_01–06` | Well retry | Scale and visual review | Widths 70, 70, 70, 70, 70, and 69px; all passed scale. | Selected 05; rejected 01–04 and 06 relative to 05. |

### Selection rejections

- First-batch building review: 44/48 candidates rejected and four retained (`house_l1_01`, `house_l2_03`, `house_l3_04`, and `wheat_farm_01`); the provisional visual well pick was discarded because every original well failed scale. Production retry 1 added `logging_camp_04` and `sawmill_05`; storehouse retry 2 failed visually, retry 3 selected `storehouse_01`, and the dedicated well retry selected `well_05`.
- Foliage rejections/retries: none; all six attempt-1 sources were selected.
- Terrain rejections/retries: none; all five attempt-1 sources were selected and passed automated opacity, palette, and seam checks.
- Preflight failures: grid/contact sheets, village/multiple-object scenes, house/content bleed into foliage, and a forest scene instead of one shrub; all were non-release probes and are recorded in Section 1.

### Wheat-farm hard gate

- Selected source: `wheat_farm_01`
- Visible earth-ramp proportion: raw selected candidate `0.913`; final processed release asset `0.878095`
- All candidate earth proportions: 01 `0.913`, 02 `0.894`, 03 `0.853`, 04 `0.919`, 05 `0.854`, 06 `0.949`
- Field-to-hut mass evidence: 01 was selected because it combined a field-dominant earth mass with the best reviewed corner-hut composition; higher earth proportion alone did not determine the pick.
- Furrow readability at final size: candidate 01 had the strongest reviewed combination of readable furrows and incidental corner hut.
- Reads as worked land rather than a building: PASS — both final visual reviewers accepted the field-dominant composite, and the processed sprite is 87.81% earth-ramp pixels
- Failed candidates and why: candidates 02–06 lost to 01 on the combined furrow-plus-corner-hut read. Candidate 03 (`0.853`) and 05 (`0.854`) had the weakest earth dominance; 04 (`0.919`) and 06 (`0.949`) exceeded 01's earth proportion but did not match its reviewed farm composition.

The wheat-farm hard gate is satisfied: the selected processed field remains 87.81% earth and passed both final visual reviews as worked land rather than a building.

## 8. Verification, tests, and protected hashes

### Test matrix

| Gate | Required result | Final evidence |
| --- | --- | --- |
| Python discovery | all existing and Phase 4C tests pass | PASS — 43 passed, 0 failed |
| TypeScript suite | all 275 pre-existing tests plus all new tests pass | PASS — 300 passed, 0 failed |
| Manifest/release verifier | exact 11 building, six foliage, five terrain entries and files | PASS — exact 22 assets: 11/6/5; selected-source provenance regression 3/3 PASS and real prepare rerun |
| Sprite contracts | dimensions, palette, scale, baseline, outline, no shadow | PASS — all 11 buildings and six foliage assets |
| Terrain contracts | 256x256, opaque, allowed ramps, 2x2 seamless metrics | PASS — 5/5, exact metrics in Section 6 |
| Evidence contracts | both images and placement ledger complete | PASS — family 22, village placements 17, adjacency records 8 |
| Typecheck | pass | PASS — `npm run typecheck` |
| Production build | pass | PASS — `npm run build` |
| Determinism harness | all metrics pass | PASS — `npm run harness`, hash `4d92c66f9408a603` |
| Diff hygiene | pass | PASS — `git diff --check` |
| Secret/path scan | no credentials or machine-specific paths in release files | PASS — scoped manifest/ledger scan returned no credential, host, prompt-ID, or absolute DGX path match |
| Dual visual QA | both reviewers PASS on the same revision | PASS — both reviewed the same two SHA-pinned images, both scored 91/100, no blockers |
| Independent code review | no Critical/Important findings open | PASS — no unresolved Critical or Important finding at the final gate |
| Requirement audit | every Phase 4C requirement mapped to evidence | PASS — exact assets, manifests, evidence, tests, hashes, and Phase 4D boundary accounted for |

### Determinism and protected source hashes

| Protected item | Before | After | Verdict |
| --- | --- | --- | --- |
| Determinism harness | `4d92c66f9408a603` | `4d92c66f9408a603` | PASS — unchanged; all harness metrics pass |
| `src/render/drawBuildings.ts` SHA-256 | `0a07e98420e6025cc696176b97d5045fabd9d4c1adc60a47e8020d67cf85caba` | `0a07e98420e6025cc696176b97d5045fabd9d4c1adc60a47e8020d67cf85caba` | PASS — byte-identical |
| `src/render/renderer.ts` SHA-256 | `0a9ba537a2ef599539f90cb279f5071fcb8a7c655d39353dc22e405047a1baf3` | `0a9ba537a2ef599539f90cb279f5071fcb8a7c655d39353dc22e405047a1baf3` | PASS — byte-identical |
| Tree/terrain renderer and placement files | `drawTrees.ts` `78397328e9e267e89e110e6924db8d9fa5d82fdebb7129b454272e1e59240609`; `treeLayout.ts` `020ecb83f917cb3e71d37028ceee6041876642b60ae3bca1da1612ebe1fe8ba1`; `drawTerrain.ts` `427345b08c4a59ba006acd531c73d1249348ccc241bede0bf7f5b2bf4965442b`; `drawTerrainDetails.ts` `0f43a76b25aeb3e1f1bdd54e4b75efcd3a2c8d536471cfa96a17e7089c83bcfa`; `drawTerrainSeams.ts` `66ee257ce4cbae3231a0eeaf0f1bdf2f390dbb7b5b93741e11d415553f7ddaa7`; `terrainDetails.ts` `73541c3085df068adfb5d1ed538af6f83deee0fd04f0804fe81d38249cfff744` | Same hashes as baseline `e9d2eda` | PASS — all six paths byte-identical |

Runtime integration verdict: PASS — protected hashes and final source diff confirm no manifest consumer, sprite loader, `drawImage` path, tree/terrain placement change, or runtime wiring was added.

## 9. Git delivery

- Release-content commit: `5a695d6765583468d8c79e654033f1e605041213`
- Delivery branch: `main`, fast-forwarded from `codex/phase4c-world-assets`
- Remote: `https://github.com/hyunlord/feudal-lord-simulator.git`
- Local `HEAD`: final report commit, a direct descendant of the release-content commit
- Remote `refs/heads/main`: verified equal to local `HEAD` after push
- Local/remote SHA equality: PASS
- Release tree verification: PASS — final tree contains the exact release-content tree plus this report; no runtime integration files changed
- GitHub URL: `https://github.com/hyunlord/feudal-lord-simulator/commit/5a695d6765583468d8c79e654033f1e605041213`

The final report commit cannot embed its own SHA without changing itself. The delivery procedure therefore pins the immutable release-content commit above and verifies the report-containing local `HEAD` against remote `refs/heads/main` after push; the exact final delivery SHA is reported alongside this document in the handoff.

## 10. Honest score against Phase 4B's 91/100

- Phase 4C packed-village score: **91/100** from both independent final visual reviewers
- Phase 4B reference score: `91 / 100`
- Verdict — does it look like one world?: **Yes.** The 22 assets share the canonical palette, muted material temperature, outline treatment, and 2:1 view; both reviewers passed the packed village with no blocker.
- Weakest selected production-role read: `sawmill_05`; independent visual QA identified the sawmill as the least-specific production role even though it was the strongest retry-1 sawmill candidate.
- Foliage risk: `shrub_b`; the foliage family passed independent visual QA, but this smallest upright form can read as a tiny tree.
- Terrain risk: no texture was rejected as too busy; the terrain family passed independent visual QA with minor repetition noted as a non-blocking issue.
- Adjacency weakness that remains: none blocking; all eight audited neighbour gaps are 4px and no pair merged. Storehouse and sawmill retain weaker subject specificity than the stronger houses.
- Default-zoom legibility risk: `sawmill_05` is the weakest production-role read, followed by the storehouse; `shrub_b` can read as a tiny tree, and terrain repetition is mildly visible.
- Overall visual QA disposition: **PASS** — both independent reviewers scored the same SHA-pinned evidence images 91/100 with no blockers.

The final score must not be derived from contract-test coverage. It is a visual judgement of the committed packed-village composite, informed by both visual reviews and reduced when a technically valid asset breaks the shared material family, competes with buildings, or loses its identity at default zoom.

## Phase 4D boundary

Phase 4C prepares assets and a data-driven manifest only. It must not modify or wire:

- `src/render/drawBuildings.ts`
- `src/render/renderer.ts`
- existing tree placement or `drawTrees.ts`
- existing terrain diamond, road, seam, brightness-variation, or draw logic
- runtime sprite loading, image caching, manifest consumption, or `drawImage` calls

Phase 4D will consume `public/assets/world_asset_manifest.json`, replace procedural shapes with sprite rendering, preserve hash-selected foliage variation (`0.75–1.25` scale, in-tile offset, sine sway), and sample periodic textures within the existing terrain diamonds. The Phase 4C evidence composites are acceptance artifacts, not runtime screenshots of that future integration.

Boundary verification: PASS — protected renderer/tree/terrain hashes match baseline `e9d2eda`, source search found no manifest consumer, sprite loading, or `drawImage` integration, and the final diff audit confirms assets/manifests/tooling/evidence only.

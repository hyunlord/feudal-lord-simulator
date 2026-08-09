# Phase 4F UI Asset Report

Generated on a local DGX workstation with ComfyUI `0.19.1`, Python `3.12.3`,
workflow `building_pixelate.json`, checkpoint `sd_xl_base_1.0.safetensors`, and
LoRA `pixel-art-xl.safetensors`. Machine identity, private prompt IDs, and
workstation-specific roots stay in the external QA evidence rather than the
release repository.

The original Phase 2 batch used `CheckpointLoaderSimple -> LoraLoader ->
CLIPTextEncode positive/negative -> EmptyLatentImage -> KSampler -> VAEDecode ->
Pixelization -> SaveImage`. Phase 4F replaces only `scroll_frame` and
`wood_console` with guide-controlled ComfyUI generation conditioned by the
accepted house, mill, and granary building references. Both guides are
deterministic, seeded repository-script outputs. `wood_console` uses img2img and
restores the guide's three dark well masks after pixelization. `scroll_frame`
uses masked inpaint around the keyed cyan opening, preserves hue and saturation
during pixelization, then restores the cyan, light-parchment, and dark-ink guide
masks. Shared direction remains living illuminated manuscript, hand-painted
medieval court artifact, exact flat game UI surface, ink outlines, restrained
colour, no text, no watermark, no modern UI, no photorealism, no gradients, no
blur, and no drop shadow.

No terrain, buildings, agents, roads, or other world objects were intentionally
generated; all prompts targeted UI/surface art only. Contact sheets are retained
in the external QA bundle. The machine-verifiable manifest is committed at
`docs/asset-evidence/uiAssetManifest.json`; `scripts/verifyUiAssets.ts` resolves
its release-safe relative candidate paths against an explicitly supplied local
candidate root, then checks selected indices, seeds, dimensions, alpha
contracts, committed evidence, final PNGs, and this report. Selected candidates
go through only bounded crop/resize and alpha-key preparation where applicable;
the release path does not procedurally redraw either replacement asset.

## Selections

| Asset | Candidates | Selected | Before | Final | Dimensions | Alpha | Scan result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scroll_frame` | 31 seed `71310411`, 32 seed `71310412`, 33 seed `71310413` | 33 | `docs/asset-evidence/before/scroll_frame.png` | `public/assets/ui/scroll_frame.png` | 512x512 | present, preserved | Phase 13 accepted full-colour frame with transparent centre/perimeter and illuminated accent families |
| `wood_console` | 31 seed `71320421`, 32 seed `71320422`, 33 seed `71320423` | 31 | `docs/asset-evidence/before/wood_console.png` | `public/assets/ui/wood_console.png` | 1920x160 | all-opaque, preserved | Phase 13 accepted full-colour console with three dark recesses and visible wood grain |
| `seal_slot` | 31 seed `71331470`, 32 seed `71331471`, 33 seed `71331472` | 31 | `docs/asset-evidence/before/seal_slot.png` | `public/assets/ui/seal_slot.png` | 64x64 | present, preserved | Phase 13 candidates rejected; existing public asset preserved byte-for-byte |
| `parchment_texture` | 31 seed `71340441`, 32 seed `71340442`, 33 seed `71340443` | 31 | `docs/asset-evidence/before/parchment_texture.png` | `public/assets/ui/parchment_texture.png` | 512x512 | all-opaque, preserved | Phase 13 candidates rejected; existing public asset preserved byte-for-byte |
| `illumination_corner` | 31 seed `71350451`, 32 seed `71350452`, 33 seed `71350453` | 31 | `docs/asset-evidence/before/illumination_corner.png` | `public/assets/ui/illumination_corner.png` | 128x128 | present, preserved | Phase 13 candidates rejected; existing public asset preserved byte-for-byte |

## Candidate paths

Paths are relative to the private candidate root supplied to the verifier.
Prompt execution IDs are deliberately retained only in the external QA bundle.

Active Phase 13 full-colour candidates:

- Candidate `scroll_frame/candidate_31_seed_71310411.png`
- Candidate `scroll_frame/candidate_32_seed_71310412.png`
- Candidate `scroll_frame/candidate_33_seed_71310413.png`
- Candidate `wood_console/candidate_31_seed_71320421.png`
- Candidate `wood_console/candidate_32_seed_71320422.png`
- Candidate `wood_console/candidate_33_seed_71320423.png`

Rejected Phase 13 candidates for preserved assets:

- Candidate `seal_slot/candidate_31_seed_71331470.png`
- Candidate `seal_slot/candidate_32_seed_71331471.png`
- Candidate `seal_slot/candidate_33_seed_71331472.png`
- Candidate `parchment_texture/candidate_31_seed_71340441.png`
- Candidate `parchment_texture/candidate_32_seed_71340442.png`
- Candidate `parchment_texture/candidate_33_seed_71340443.png`
- Candidate `illumination_corner/candidate_31_seed_71350451.png`
- Candidate `illumination_corner/candidate_32_seed_71350452.png`
- Candidate `illumination_corner/candidate_33_seed_71350453.png`

## Asset Notes

- `scroll_frame`: selected Phase 13 candidate 33 is the strongest accepted
  warm parchment border from the 31-33 full-colour set, with restrained gold,
  ultramarine, and vermilion border accents. The release contract is
  hollow geometry, not merely “has alpha”: at least 70% of the central 50%
  rectangle must be exact alpha zero, and every pixel in the axis-specific outer
  `ceil(4%)` perimeter bands must be exact alpha zero. Phase 13 candidates 31-32
  were rejected for noisier or darker colour balance.
- `wood_console`: selected Phase 13 candidate 31 is the cleanest continuous band
  from the 31-33 full-colour set. Its structural contract is exactly three large dark wells in
  one row, separated by two plain timber posts, with visible plank variation and
  a raised upper edge. Phase 13 candidates 32-33 introduced weaker panel balance.
- `seal_slot`: Phase 13 candidate 31 is recorded for provenance, but all
  seal-slot candidates were rejected for release; the existing public asset is
  preserved byte-for-byte and its final hash matches the before snapshot.
- `parchment_texture`: Phase 13 candidate 31 is recorded for provenance, but
  the generated texture was not accepted; the existing public asset is
  preserved byte-for-byte and its final hash matches the before snapshot.
- `illumination_corner`: Phase 13 candidate 31 is recorded for provenance, but
  the generated corner was not accepted; the existing public asset is preserved
  byte-for-byte and its final hash matches the before snapshot.

## Reproduction

From the repository root, with the ComfyUI environment available locally:

```bash
python3 scripts/generateUiAssets.py --phase13-full-colour --target scroll_frame --target wood_console
python3 scripts/generateUiAssets.py --release-accepted-phase13 --selection scroll_frame=33 --selection wood_console=31
npx tsx scripts/verifyUiAssets.ts /path/to/active-release-candidates docs/asset-evidence/uiAssetManifest.json
```

`generateUiAssets.py` defaults to a `ComfyUI` directory under the current
user's home directory. `COMFYUI_ROOT`, `COMFYUI_OUTPUT`, and `COMFYUI_URL` may be
set when the workstation layout differs.

Phase 13 round 1 verification uses `docs/asset-evidence/uiAssetManifest.json`
and the independent summary at
`docs/asset-evidence/phase13/part2_round1_visual_verdict.json`. The UI release
path prepares accepted assets into
`docs/asset-evidence/phase13/prepared-ui/` and never writes
`docs/asset-evidence/before/`. The manifest records `beforeSha256`,
`preparedSha256`, and `finalSha256`; accepted assets must have matching
prepared/final hashes, and preserved assets must have matching before/final
hashes.

Current Phase 13 UI hashes:

| Asset | Status | Raw candidate SHA256 | Before SHA256 | Prepared SHA256 | Final SHA256 |
| --- | --- | --- | --- | --- | --- |
| `scroll_frame` | accepted-generated | `4843c81bb266d07c9e72a4b7ff8750f2a058f43b7157b5f7b7635d8460ee9dec` | `dd74f2509aeca154a044cc0138b5e89c6a12511c297ad38ff15860f9c6304f7d` | `045fbcb52e66a16f7dc32d2db57f58e1888e472f9829466d36103488e0949ddf` | `045fbcb52e66a16f7dc32d2db57f58e1888e472f9829466d36103488e0949ddf` |
| `wood_console` | accepted-generated | `ea9c37926b77a8a351403567edff9925a8d477f6fc145fba25cbb68851e5b693` | `31d46e32adc7b67ef9a42ec411ec6a7cc1bbecaa6dbdc86d413e701a52f0bb10` | `32fa12ce359d1f20ed7cefa550fcc867de4f18c5f14e0d9df1b49b2a54e75423` | `32fa12ce359d1f20ed7cefa550fcc867de4f18c5f14e0d9df1b49b2a54e75423` |
| `seal_slot` | preserved-existing | `bb45299b51dcb8c37ae570823f73d0647cca63a10dab121a0a652d191ab7e0d7` | `2ba82a986c35afe0c4e6d1aa5ffa7da24909a5f55e09f380679f6307f1688c91` | n/a | `2ba82a986c35afe0c4e6d1aa5ffa7da24909a5f55e09f380679f6307f1688c91` |
| `parchment_texture` | preserved-existing | `a67682218ab9aba603ecb4262735238f95a5bf0215edfa3540611e48da7042ce` | `023446b9cf14507dba7b63aadc229dbdceeebce78feafe3737c30cee181b6adf` | n/a | `023446b9cf14507dba7b63aadc229dbdceeebce78feafe3737c30cee181b6adf` |
| `illumination_corner` | preserved-existing | `8efe9b27e22faac274ca9b555a684f4db8dd36ff2654a0de11dc2b62b0d4e4fd` | `a8f5370015b1785ecbc6893e3972c84e0fef4603ff6679c4d6ee9d9dddd04d22` | n/a | `a8f5370015b1785ecbc6893e3972c84e0fef4603ff6679c4d6ee9d9dddd04d22` |

Evidence gaps:

- Per-group DGX unload receipts are not present in the available Part2 evidence;
  this is an explicit evidence gap, not relabeled proof.

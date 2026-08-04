# Phase 2 UI Asset Report

Generated on a local DGX workstation with ComfyUI `0.19.1`, Python `3.12.3`,
workflow `building_pixelate.json`, checkpoint `sd_xl_base_1.0.safetensors`, and
LoRA `pixel-art-xl.safetensors`. Machine identity, private prompt IDs, and
workstation-specific roots stay in the external QA evidence rather than the
release repository.

The base graph was `CheckpointLoaderSimple -> LoraLoader -> CLIPTextEncode positive/negative -> EmptyLatentImage -> KSampler -> VAEDecode -> Pixelization -> SaveImage`. Shared positive direction: living illuminated manuscript, hand-painted medieval court artifact, exact flat game UI surface, ink outlines, upper-left light, restrained gold leaf, muted parchment/earth/sage/ultramarine/vermilion, no text, no watermark, no modern UI, no photorealism, no gradients, no blur, no drop shadow. Shared negative direction included terrain, buildings, agents, roads, world objects, realistic/photo/3D, text, watermark, shadow, gradients, modern UI, labels, letters, and numbers.

No terrain, buildings, agents, roads, or other world objects were intentionally
generated; all prompts targeted UI/surface art only. Contact sheets are retained
in the external QA bundle. The machine-verifiable manifest is committed at
`docs/asset-evidence/uiAssetManifest.json`; `scripts/verifyUiAssets.ts` resolves
its release-safe relative candidate paths against an explicitly supplied local
candidate root, then checks selected indices, seeds, dimensions, alpha
contracts, committed evidence, final PNGs, and this report.

## Selections

| Asset | Candidates | Selected | Before | Final | Dimensions | Alpha | Scan result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `scroll_frame` | 1 seed `52010411`, 2 seed `52010412`, 3 seed `52010413` | 3 | `docs/asset-evidence/before/scroll_frame.png` | `public/assets/ui/scroll_frame.png` | 512x512 | present, preserved | all nonzero-alpha RGB values are canonical palette colours |
| `wood_console` | 1 seed `52020421`, 2 seed `52020422`, 3 seed `52020423`, 4 seed `52021424`, 5 seed `52021425`, 6 seed `52021426` | 4 | `docs/asset-evidence/before/wood_console.png` | `public/assets/ui/wood_console.png` | 1920x160 | all-opaque, preserved | all RGB values are canonical palette colours |
| `seal_slot` | 1 seed `52031470`, 2 seed `52031471`, 3 seed `52031472` | 2 | `docs/asset-evidence/before/seal_slot.png` | `public/assets/ui/seal_slot.png` | 64x64 | present, preserved | all nonzero-alpha RGB values are canonical palette colours |
| `parchment_texture` | 1 seed `52040441`, 2 seed `52040442`, 3 seed `52040443`, 4 seed `52041444`, 5 seed `52041445`, 6 seed `52041446` | 4 | `docs/asset-evidence/before/parchment_texture.png` | `public/assets/ui/parchment_texture.png` | 512x512 | all-opaque, preserved | all RGB values are canonical palette colours |
| `illumination_corner` | 1 seed `52050451`, 2 seed `52050452`, 3 seed `52050453`, 4 seed `52051454`, 5 seed `52051455`, 6 seed `52051456` | 5 | `docs/asset-evidence/before/illumination_corner.png` | `public/assets/ui/illumination_corner.png` | 128x128 | present, preserved | all nonzero-alpha RGB values are canonical palette colours |

## Candidate paths

Paths are relative to the private candidate root supplied to the verifier.
Prompt execution IDs are deliberately retained only in the external QA bundle.

Initial candidates:

- Candidate `scroll_frame/candidate_1_seed_52010411.png`
- Candidate `scroll_frame/candidate_2_seed_52010412.png`
- Candidate `scroll_frame/candidate_3_seed_52010413.png`
- Candidate `wood_console/candidate_1_seed_52020421.png`
- Candidate `wood_console/candidate_2_seed_52020422.png`
- Candidate `wood_console/candidate_3_seed_52020423.png`
- Candidate `seal_slot/candidate_1_seed_52031470.png`
- Candidate `seal_slot/candidate_2_seed_52031471.png`
- Candidate `seal_slot/candidate_3_seed_52031472.png`
- Candidate `parchment_texture/candidate_1_seed_52040441.png`
- Candidate `parchment_texture/candidate_2_seed_52040442.png`
- Candidate `parchment_texture/candidate_3_seed_52040443.png`
- Candidate `illumination_corner/candidate_1_seed_52050451.png`
- Candidate `illumination_corner/candidate_2_seed_52050452.png`
- Candidate `illumination_corner/candidate_3_seed_52050453.png`

Refinement candidates:

- Candidate `wood_console/candidate_4_seed_52021424.png`
- Candidate `wood_console/candidate_5_seed_52021425.png`
- Candidate `wood_console/candidate_6_seed_52021426.png`
- Candidate `parchment_texture/candidate_4_seed_52041444.png`
- Candidate `parchment_texture/candidate_5_seed_52041445.png`
- Candidate `parchment_texture/candidate_6_seed_52041446.png`
- Candidate `illumination_corner/candidate_4_seed_52051454.png`
- Candidate `illumination_corner/candidate_5_seed_52051455.png`
- Candidate `illumination_corner/candidate_6_seed_52051456.png`

## Asset Notes

- `scroll_frame`: candidate 3 has the best parchment-frame silhouette and usable central space. Defects: it has ruled-line marks in the center and the keyed alpha leaves some background-colour edge pixels, though alpha is present and preserved after quantisation.
- `wood_console`: refined candidate 4 is the only convincing continuous wood/gold band. Defects: the final crop is busy and carved, not a quiet console with three clean recessed zones.
- `seal_slot`: the original shrine/page-like candidates were superseded and removed from the active top-level candidate set. Replacement candidate 2 is selected because it reads most like a smaller wax-rim UI recess with an empty center. Defects: candidate 1 is too large and platter-like, candidate 3 reads more like a radial dial, and the selected final still has concentric line detail rather than a perfectly quiet icon well.
- `parchment_texture`: refined candidate 4 removes the frames and heraldic structure from the first batch. Defects: it is noisy, high-key, all-opaque, and includes visible blue flecks, so it is not a perfect low-contrast seamless parchment.
- `illumination_corner`: refined candidate 5 has the clearest vine/flower language; the top-left crop recovers the 128x128 corner asset. Defects: the model resisted single-corner composition and produced full-frame tendencies, so this is a cropped salvage from a larger panel.

## Reproduction

From the repository root, with the ComfyUI environment available locally:

```bash
python3 scripts/generateUiAssets.py --generate
python3 scripts/generateUiAssets.py --generate-refinement
python3 scripts/generateUiAssets.py --prepare-selected
mkdir -p public/assets/ui
for key in scroll_frame wood_console seal_slot parchment_texture illumination_corner; do
  npx tsx scripts/quantisePalette.ts docs/asset-evidence/before/$key.png public/assets/ui/$key.png
done
npx tsx scripts/verifyUiAssets.ts /path/to/phase2_ui docs/asset-evidence/uiAssetManifest.json
```

`generateUiAssets.py` defaults to a `ComfyUI` directory under the current
user's home directory. `COMFYUI_ROOT`, `COMFYUI_OUTPUT`, `COMFYUI_WORKFLOW`, and
`COMFYUI_URL` may be set when the workstation layout differs.

Verification output recorded all five exact dimensions, alpha preservation for every before/final pair, at least three candidates per asset, and canonical-palette RGB membership for every pixel with alpha greater than zero.

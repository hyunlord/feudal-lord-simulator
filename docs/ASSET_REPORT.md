# Phase 2.5 UI Asset Report

Generated on a local DGX workstation with ComfyUI `0.19.1`, Python `3.12.3`,
workflow `building_pixelate.json`, checkpoint `sd_xl_base_1.0.safetensors`, and
LoRA `pixel-art-xl.safetensors`. Machine identity, private prompt IDs, and
workstation-specific roots stay in the external QA evidence rather than the
release repository.

The original Phase 2 batch used `CheckpointLoaderSimple -> LoraLoader ->
CLIPTextEncode positive/negative -> EmptyLatentImage -> KSampler -> VAEDecode ->
Pixelization -> SaveImage`. Phase 2.5 replaces only `scroll_frame` and
`wood_console` with guide-controlled ComfyUI generation. Both guides are
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
| `scroll_frame` | 19 seed `52017411`, 20 seed `52017412`, 21 seed `52017413` | 19 | `docs/asset-evidence/before/scroll_frame.png` | `public/assets/ui/scroll_frame.png` | 512x512 | present, preserved | expected release gate: all nonzero-alpha RGB values are canonical palette colours |
| `wood_console` | 10 seed `52024421`, 11 seed `52024422`, 12 seed `52024423` | 12 | `docs/asset-evidence/before/wood_console.png` | `public/assets/ui/wood_console.png` | 1920x160 | all-opaque, preserved | expected release gate: all RGB values are canonical palette colours |
| `seal_slot` | 1 seed `52031470`, 2 seed `52031471`, 3 seed `52031472` | 2 | `docs/asset-evidence/before/seal_slot.png` | `public/assets/ui/seal_slot.png` | 64x64 | present, preserved | all nonzero-alpha RGB values are canonical palette colours |
| `parchment_texture` | 1 seed `52040441`, 2 seed `52040442`, 3 seed `52040443`, 4 seed `52041444`, 5 seed `52041445`, 6 seed `52041446` | 4 | `docs/asset-evidence/before/parchment_texture.png` | `public/assets/ui/parchment_texture.png` | 512x512 | all-opaque, preserved | all RGB values are canonical palette colours |
| `illumination_corner` | 1 seed `52050451`, 2 seed `52050452`, 3 seed `52050453`, 4 seed `52051454`, 5 seed `52051455`, 6 seed `52051456` | 5 | `docs/asset-evidence/before/illumination_corner.png` | `public/assets/ui/illumination_corner.png` | 128x128 | present, preserved | all nonzero-alpha RGB values are canonical palette colours |

## Candidate paths

Paths are relative to the private candidate root supplied to the verifier.
Prompt execution IDs are deliberately retained only in the external QA bundle.

Active Phase 2.5 guided candidates:

- Candidate `scroll_frame/candidate_19_seed_52017411.png`
- Candidate `scroll_frame/candidate_20_seed_52017412.png`
- Candidate `scroll_frame/candidate_21_seed_52017413.png`
- Candidate `wood_console/candidate_10_seed_52024421.png`
- Candidate `wood_console/candidate_11_seed_52024422.png`
- Candidate `wood_console/candidate_12_seed_52024423.png`

Unchanged Phase 2 candidates:

- Candidate `seal_slot/candidate_1_seed_52031470.png`
- Candidate `seal_slot/candidate_2_seed_52031471.png`
- Candidate `seal_slot/candidate_3_seed_52031472.png`
- Candidate `parchment_texture/candidate_1_seed_52040441.png`
- Candidate `parchment_texture/candidate_2_seed_52040442.png`
- Candidate `parchment_texture/candidate_3_seed_52040443.png`
- Candidate `illumination_corner/candidate_1_seed_52050451.png`
- Candidate `illumination_corner/candidate_2_seed_52050452.png`
- Candidate `illumination_corner/candidate_3_seed_52050453.png`

Unchanged Phase 2 refinement candidates:

- Candidate `parchment_texture/candidate_4_seed_52041444.png`
- Candidate `parchment_texture/candidate_5_seed_52041445.png`
- Candidate `parchment_texture/candidate_6_seed_52041446.png`
- Candidate `illumination_corner/candidate_4_seed_52051454.png`
- Candidate `illumination_corner/candidate_5_seed_52051455.png`
- Candidate `illumination_corner/candidate_6_seed_52051456.png`

## Asset Notes

- `scroll_frame`: selected candidate 19 is the most balanced warm parchment
  border with four quiet curled-corner medallions. The release contract is
  hollow geometry, not merely “has alpha”: at least 70% of the central 50%
  rectangle must be exact alpha zero, and every pixel in the axis-specific outer
  `ceil(4%)` perimeter bands must be exact alpha zero. Text-only candidates 1-9
  retained page/center artifacts; guided candidates 10-15 skewed red; candidates
  16-18 were pale and generic. Candidates 19-21 correct the colour handling and
  restore the guide's light/dark accent masks after pixelization.
- `wood_console`: selected candidate 12 is the cleanest continuous band from the
  guided 10-12 set. Its structural contract is exactly three large dark wells in
  one row, separated by two plain timber posts, with no decorative fragments or
  extra recesses. Earlier text-only/refinement candidates 1-9 were too busy or
  did not preserve the exact well count.
- `seal_slot`: the original shrine/page-like candidates were superseded and removed from the active top-level candidate set. Replacement candidate 2 is selected because it reads most like a smaller wax-rim UI recess with an empty center. Defects: candidate 1 is too large and platter-like, candidate 3 reads more like a radial dial, and the selected final still has concentric line detail rather than a perfectly quiet icon well.
- `parchment_texture`: refined candidate 4 removes the frames and heraldic structure from the first batch. Defects: it is noisy, high-key, all-opaque, and includes visible blue flecks, so it is not a perfect low-contrast seamless parchment.
- `illumination_corner`: refined candidate 5 has the clearest vine/flower language; the top-left crop recovers the 128x128 corner asset. Defects: the model resisted single-corner composition and produced full-frame tendencies, so this is a cropped salvage from a larger panel.

## Reproduction

From the repository root, with the ComfyUI environment available locally:

```bash
python3 scripts/generateUiAssets.py --generate-guided --target scroll_frame --target wood_console
python3 scripts/generateUiAssets.py --prepare-selected --target scroll_frame --target wood_console
mkdir -p public/assets/ui
for key in scroll_frame wood_console; do
  npx tsx scripts/quantisePalette.ts docs/asset-evidence/before/$key.png public/assets/ui/$key.png
done
npx tsx scripts/verifyUiAssets.ts /path/to/active-release-candidates docs/asset-evidence/uiAssetManifest.json
```

`generateUiAssets.py` defaults to a `ComfyUI` directory under the current
user's home directory. `COMFYUI_ROOT`, `COMFYUI_OUTPUT`, and `COMFYUI_URL` may be
set when the workstation layout differs.

Final verification passed with
`npx tsx scripts/verifyUiAssets.ts /tmp/feudal-phase2-5/release-candidates.nQoG12 docs/asset-evidence/uiAssetManifest.json`.
It proved all five exact dimensions, alpha preservation for every before/final
pair, exact active candidate/manifest alignment, canonical-palette RGB
membership for every pixel with alpha greater than zero, and the `scroll_frame`
hollow-transparency contract. The exactly-three-well `wood_console` contract was
measured and visually verified as a separate release gate rather than as a
verifier-native assertion.

# Phase 4A Building Art Style Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce and review 18 reproducible, palette-constrained building sprite candidates without changing the game renderer or determinism.

**Architecture:** Keep generation, deterministic post-processing, and review composition outside runtime code. Expand the canonical palette into material ramps, preserve semantic UI/terrain mappings through aliases derived only from those ramps, and enforce every sprite contract with automated verification.

**Tech Stack:** TypeScript 7, Node test runner, ffmpeg RGBA/PNG transport, Python 3 + Pillow, ComfyUI, SDXL 1.0.

---

### Task 1: Lock the palette contract

**Files:**
- Modify: `tests/palette.test.ts`
- Modify: `tests/quantisePalette.test.ts`
- Modify: `src/content/palette.ts`
- Modify: `src/styles/paletteVariables.ts`
- Modify: existing `src/**/*.ts` and `src/**/*.tsx` references that use retired palette names
- Modify: `scripts/quantisePalette.ts`

1. Write tests asserting eight named six-step ramps, four accent/ink entries, unique canonical colours, no pure black/white, and semantic mappings whose values are canonical entries.
2. Run `npm test -- tests/palette.test.ts tests/quantisePalette.test.ts` and confirm failure against the 19-colour system.
3. Implement `RAMPS`, the four-entry `PALETTE`, a flattened canonical entry list, and semantic mappings to the nearest material-ramp entries.
4. Replace retired palette references and preserve existing CSS variable names through the semantic mapping.
5. Rewrite canonical quantisation to use every flattened ramp and palette entry; remove the four-colour wood-console profile.
6. Re-run the focused tests and typecheck until green.

### Task 2: Lock and implement sprite processing

**Files:**
- Create: `tests/processBuildingSprite.test.ts`
- Create: `scripts/processBuildingSprite.ts`
- Create: `scripts/verifyBuildingSprites.ts`

1. Write failing tests for chroma removal, opaque-bounds detection, aspect-fit geometry, one-pixel outside ink outline, alpha preservation, exact target dimensions, fully transparent rows below the base line, and rejection of non-canonical RGB values.
2. Run the focused test and confirm each new contract fails for the missing module.
3. Implement pure RGBA transforms first, then the CLI boundary using existing ffmpeg PNG helpers and Lanczos scaling.
4. Implement the manifest-driven verifier for all 18 expected files and exact house 96x112, mill 96x160, and granary 160x144 geometry.
5. Re-run focused tests and typecheck until green.

### Task 3: Make generation reproducible

**Files:**
- Create: `tests/test_generate_building_candidates.py`
- Create: `scripts/generateBuildingCandidates.py`

1. Write failing Python tests for the exact three subjects, six seeds each, 1024x1024 empty latents, one shared base prompt, subject-only prompt variation, upper-left light, explicit 2:1 projection, chroma background, and shadow prohibitions.
2. Run `python3 -m unittest tests/test_generate_building_candidates.py` and confirm failure for the missing module.
3. Implement a bounded ComfyUI API client using `sd_xl_base_1.0.safetensors`, no LoRA, deterministic seeds, DPM++ 2M Karras, and portable manifest paths.
4. Re-run the Python tests until green.

### Task 4: Generate and process the candidate set

**Files:**
- Create: `public/assets/buildings/candidates/house_01.png` through `house_06.png`
- Create: `public/assets/buildings/candidates/mill_01.png` through `mill_06.png`
- Create: `public/assets/buildings/candidates/granary_01.png` through `granary_06.png`
- Create: `public/assets/buildings/candidates/manifest.json`

1. Run generation on the DGX and record elapsed time and source manifest.
2. Inspect all 18 source images at 1024x1024; record angle, shadow, silhouette, and chroma defects without silently discarding failures.
3. Run the same processing CLI settings for each subject at its target dimensions and base line.
4. Run the sprite verifier and inspect edge alpha/halo statistics; adjust only uniform pipeline parameters if needed.

### Task 5: Build review artifacts

**Files:**
- Create: `docs/assets/building_candidates.png`
- Create: `docs/assets/building_in_context.png`
- Create: `docs/PHASE4A_BUILDING_ART_REPORT.md`

1. Capture an actual default-zoom game terrain image from the running port-3200 application.
2. Select one candidate per subject only after comparing angle, silhouette, palette response, and terrain integration.
3. Build the labelled 3x6 neutral-grey candidate sheet offline using final-size sprites.
4. Composite the three selected candidates at bottom-centre tile anchors into the real terrain capture.
5. Record model/settings, generation duration, picks, candidate-specific failures, ramp gaps, and the honest in-context visual verdict.

### Task 6: Prove non-integration and release safety

**Files:**
- Verify only: `src/render/drawBuildings.ts`
- Verify only: `src/render/renderer.ts`

1. Compare renderer hashes and Git diffs to the untouched baseline; reject any runtime sprite loading or `drawImage` change.
2. Run `npm run typecheck`, `npm run build`, `npm test`, `python3 -m unittest tests/test_generate_building_candidates.py`, `npm run harness`, and the sprite verifier.
3. Confirm the harness still reports `4d92c66f9408a603`, all 257 pre-existing tests remain green in addition to new tests, and the dev app still serves on port 3200.
4. Inspect both PNG review artifacts at full resolution.

### Task 7: Commit and deliver

**Files:** all Phase 4A code, tests, processed candidates, manifests, plans, report, and review images.

1. Inspect the full diff and confirm no unrelated or renderer changes.
2. Run `git remote -v` and `git branch --show-current`; require `origin` to be `https://github.com/hyunlord/feudal-lord-simulator.git` and branch `main`.
3. Commit with the repository's Lore-format decision record, including `Tested` and `Not-tested` trailers.
4. Push `main`, run `git ls-remote origin refs/heads/main`, and require the remote SHA to equal local `HEAD`.

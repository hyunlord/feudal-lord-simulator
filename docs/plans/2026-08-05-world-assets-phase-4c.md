# Phase 4C World Assets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate, process, verify, review, and deliver the complete Phase 4C building, foliage, and seamless terrain asset family without wiring sprites into the renderer.

**Architecture:** A deterministic Python ComfyUI generator emits 59 raw jobs and a portable run manifest. Small TypeScript modules own typed contracts, sprite preparation, periodic terrain preparation, manifest validation, and release verification; a Python evidence builder creates the family and packed-village sheets. Existing PNG/palette helpers are reused, while building, foliage, and terrain rules remain separate.

**Tech Stack:** Python 3.11, Pillow, ComfyUI HTTP API, SDXL/IPAdapter, TypeScript, Node test runner, existing PNG codec and canonical palette, Vite.

---

### Task 1: Lock the 59-job generator contract

**Files:**
- Create: `tests/test_generate_world_assets.py`
- Create: `scripts/generateWorldAssets.py`

**Step 1: Write the failing test**

Assert exact building keys and six unique seeds each, exact six foliage and five terrain keys, exact canvas/source settings, verbatim geometry clauses, no banned functional shorthand in geometry clauses, IPAdapter model names, portable manifest paths, 59 queued jobs, and timing fields.

**Step 2: Run test to verify it fails**

Run: `python3 tests/test_generate_world_assets.py`

Expected: FAIL because `scripts/generateWorldAssets.py` does not exist.

**Step 3: Implement the minimal generator boundary**

Add typed dataclasses for jobs and categories, fixed seed maps, prompt builders, reference-atlas/guide creation, Comfy workflow construction, queue/history helpers, target filtering, and portable timed manifest writing. Use the installed SDXL IPAdapter Plus and CLIP Vision paths and preserve the existing safe output-path containment checks.

**Step 4: Run focused tests**

Run: `python3 tests/test_generate_world_assets.py`

Expected: all generator contract tests PASS without queuing a live job.

**Step 5: Commit**

Stage the generator and its test with a Lore-format commit that records the 59-job and no-LoRA constraints.

### Task 2: Define typed release contracts and manifest validation

**Files:**
- Create: `scripts/worldAssetContracts.ts`
- Create: `scripts/worldAssetManifest.ts`
- Create: `tests/worldAssetManifest.test.ts`

**Step 1: Write failing manifest tests**

Specify exact 11 building, six foliage, and five terrain keys; exact dimensions; bottom-centre anchors; footprints; portable repo-relative paths; source seed/candidate; palette/alpha policy; foliage variation metadata; and terrain seam metrics. Reject duplicate/missing keys, wrong dimensions, path traversal, nonexistent files, and category-policy mismatch.

**Step 2: Verify RED**

Run: `npx tsx --test tests/worldAssetManifest.test.ts`

Expected: module-not-found failure.

**Step 3: Implement contracts and parser**

Use literal-key maps and discriminated category types. Parse unknown JSON once into typed values and expose exact-key and on-disk validation helpers.

**Step 4: Verify GREEN**

Run: `npx tsx --test tests/worldAssetManifest.test.ts && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

Commit the typed release boundary and tests together.

### Task 3: Generalise sprite processing for Phase 4C buildings and foliage

**Files:**
- Create: `scripts/worldSpritePipeline.ts`
- Create: `tests/worldSpritePipeline.test.ts`
- Modify: `scripts/processBuildingSprite.ts`

**Step 1: Write failing processing tests**

Test exact final dimensions/baselines, 64–90px and 115–141px visible-width bands, strictly increasing house bbox heights, alpha-179 exterior outline, lower-third omission, no internal-hole outline, transparent rows below baseline, wheat-field earth dominance, building roof policy, foliage interior restricted to foliage/timber, and ink allowed only for alpha-179 foliage outline.

**Step 2: Verify RED**

Run: `npx tsx --test tests/worldSpritePipeline.test.ts`

Expected: missing exports/contracts failure.

**Step 3: Implement minimal reusable pipeline**

Reuse PNG codec, chroma removal, Lanczos resize, canonical quantisation, bounds, and outline helpers from `processBuildingSprite.ts`. Add category-specific material policies and validators in `worldSpritePipeline.ts`; do not expand renderer source.

**Step 4: Verify GREEN and regression**

Run: `npx tsx --test tests/processBuildingSprite.test.ts tests/worldSpritePipeline.test.ts && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

Commit the sprite preparation boundary and tests.

### Task 4: Build and test periodic terrain processing

**Files:**
- Create: `scripts/terrainTexturePipeline.ts`
- Create: `tests/terrainTexturePipeline.test.ts`

**Step 1: Write failing terrain tests**

Test 256x256 opaque output, type-specific ramp membership, wrap-aware edge blending, exact opposing-edge compatibility, 2x2 tiling, horizontal/vertical join-band delta, internal-band reference delta, and rejection of synthetic visible seams.

**Step 2: Verify RED**

Run: `npx tsx --test tests/terrainTexturePipeline.test.ts`

Expected: module-not-found failure.

**Step 3: Implement periodic processing and metrics**

Quantise to each terrain policy, offset the source to move original borders inward, apply symmetric wrap-aware blending, write the periodic PNG, construct a 2x2 RGBA buffer, and calculate reportable seam metrics.

**Step 4: Verify GREEN**

Run: `npx tsx --test tests/terrainTexturePipeline.test.ts && npm run typecheck`

Expected: PASS.

**Step 5: Commit**

Commit the terrain pipeline and tests.

### Task 5: Prepare selected assets and write the release manifest

**Files:**
- Create: `scripts/prepareWorldAssets.ts`
- Create: `scripts/verifyWorldAssets.ts`
- Create: `tests/worldAssetRelease.test.ts`

**Step 1: Write failing release tests**

Require stable byte-identical Phase 4B promotions, exact selected output set, complete manifest, all declared files present, exact PNG dimensions, category validators, and no unexpected PNGs in release directories.

**Step 2: Verify RED**

Run: `npx tsx --test tests/worldAssetRelease.test.ts`

Expected: missing scripts/assets failure.

**Step 3: Implement preparation and verification CLIs**

Accept raw roots and explicit candidate selections. Process buildings, foliage, and terrain; copy Phase 4B references byte-identically; record profiles/timing/seam metrics; write `public/assets/world_asset_manifest.json`; verify the complete release.

**Step 4: Run code-only tests**

Use temporary fixture images to make the focused tests PASS before live generation.

**Step 5: Commit**

Commit preparation, verifier, and tests.

### Task 6: Build evidence tooling

**Files:**
- Create: `scripts/buildPhase4cEvidence.py`
- Create: `tests/test_build_phase4c_evidence.py`

**Step 1: Write failing evidence tests**

Lock exact output names, category grouping, final-size rendering, required village occupants, bottom-centre anchor placement, tight adjacency, house-level order, real-terrain input, and terrain swatch tiling.

**Step 2: Verify RED**

Run: `python3 tests/test_build_phase4c_evidence.py`

Expected: missing module failure.

**Step 3: Implement evidence builder**

Create `asset_family_sheet.png` and `village_composite.png` from final assets and an actual default-zoom terrain screenshot. Emit a JSON placement ledger used to audit adjacency and contents.

**Step 4: Verify GREEN**

Run: `python3 tests/test_build_phase4c_evidence.py`

Expected: PASS.

**Step 5: Commit**

Commit evidence tooling and tests.

### Task 7: Run the live DGX batch

**Files:**
- Generate under: `/tmp/feudal-phase4c-world-assets-*`
- Generate: `docs/asset-evidence/phase4c_generation_manifest.json`

**Step 1: Revalidate the runtime**

Confirm exact repo, branch, remote, HEAD, free space, model hashes/paths, IPAdapter node schemas, and ownership of tmux sessions. Start an owned `phase4c-comfy` tmux only if port 8188 is down.

**Step 2: Run a one-job IPAdapter preflight**

Generate one non-release probe, inspect history/errors and style conditioning, then discard the probe. Do not begin the batch until node wiring is proven.

**Step 3: Generate all 59 jobs**

Run the generator with a unique `/tmp` raw root. Preserve the portable timed manifest and do not commit raw 1024px files.

**Step 4: Verify counts and process candidates**

Require 48 building candidates, six foliage sources, five terrain sources, then run category preparation. Automatically reject contract failures.

**Step 5: Record batch evidence**

Save total elapsed time, per-job status, failed/retried jobs, model/settings, and portable source paths.

### Task 8: Select assets and assemble final evidence

**Files:**
- Generate: `public/assets/buildings/*.png`
- Generate: `public/assets/foliage/*.png`
- Generate: `public/assets/terrain/*.png`
- Generate: `public/assets/world_asset_manifest.json`
- Generate: `docs/assets/asset_family_sheet.png`
- Generate: `docs/assets/village_composite.png`
- Create: `docs/PHASE4C_WORLD_ASSET_REPORT.md`

**Step 1: Review six-candidate building sheets**

Rank each subject against geometry, material, scale, adjacency role, and style reference. Give wheat farm its own field-dominance review.

**Step 2: Process explicit selections**

Run `prepareWorldAssets.ts` with the selected candidate map and verify the release manifest.

**Step 3: Capture live terrain and build evidence**

Use the running app at default zoom, keep real procedural road/terrain/tree context, and produce both required PNGs plus the placement ledger.

**Step 4: Write the report**

Include settings/time, every pick and rejection, adjacency verdict, ramp proportions across all buildings, five seam results, tests/hashes, Git delivery fields, and an honest score against 91/100.

### Task 9: Run dual visual QA and correction loops

**Files:**
- Update selected assets/evidence/report as findings require.
- Persist: `.omx/state/phase4c/ralph-progress.json`

**Step 1: Run design-system/family-integrity review**

Check real files/manifest/contracts, no pasted mock substitution, alpha, adjacency, progression, and feature completeness.

**Step 2: Run focused visual review in parallel**

Open both evidence PNGs and all selected assets. Check each named requirement and identify merges, busy terrain, family-breaking foliage, or weak farm semantics.

**Step 3: Fix every blocking finding**

Regenerate or reselect the affected asset, rebuild evidence, and rerun both reviews until both PASS on the same revision.

### Task 10: Complete the release audit and Git delivery

**Files:**
- Modify report with final evidence.

**Step 1: Run the complete verification matrix**

Run Python discovery, `npm test`, focused world verifier, `npm run typecheck`, `npm run build`, `npm run harness`, `git diff --check`, exact asset counts, palette/alpha/scale/seam checks, protected renderer hashes, and scoped secret/path scans.

**Step 2: Run independent code review and verifier**

Resolve all Critical/Important findings and rerun affected gates.

**Step 3: Inspect and stage exact scope**

Exclude `.omx` runtime state and `/tmp` raw generation. Review the full staged diff and generated file list.

**Step 4: Commit using Lore trailers**

Record constraints, rejected alternatives, verification, Phase 4D integration boundary, and remaining visual risk.

**Step 5: Push and prove remote landing**

Confirm `origin` and `main`, push, compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/main`, verify the commit tree, and report the GitHub URL.

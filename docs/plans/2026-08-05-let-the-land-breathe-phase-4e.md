# Phase 4E Let the Land Breathe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make open grass visually dominant with sparse protected ground cover, softer deterministic terrain texture, and a uniquely readable sawmill while preserving simulation behavior and hash `4d92c66f9408a603`.

**Architecture:** Keep placement as pure deterministic render data, but precompute one two-tile exclusion set per frame and feed it into the unified object queue. Extend the existing asset-contract pipeline only for four ground-cover sprites and the sawmill; composite cached terrain patterns over flat palette bases with hash-selected quarter turns.

**Tech Stack:** React 19, TypeScript 7 strict mode, Canvas 2D, Vite, Node test runner, Python/ComfyUI on DGX, Playwright/real Chrome.

---

### Task 1: Lock sparse placement and two-tile clearing

**Files:**
- Modify: `src/render/treeLayout.ts`
- Modify: `src/render/objectRenderOrder.ts`
- Modify: `tests/treeLayout.test.ts`
- Modify: `tests/worldObjectDepth.test.ts`

1. Add failing tests that sample at least 10,000 eligible grass coordinates and require an occupied ratio in a documented tolerance around 8 percent.
2. Add failing table tests for water, forest, roads, buildings, and Chebyshev distances 0, 1, and 2 from every road/building footprint; add a distance-3 control that remains eligible.
3. Add a repeated-run test asserting equal descriptor arrays for equal tile/seed/protected-set inputs, and a variant-distribution test covering `shrub_a`, `shrub_b`, `grass_tuft`, and `field_stone`.
4. Run `npx tsx --test tests/treeLayout.test.ts tests/worldObjectDepth.test.ts`; require the old 38-percent/two-key behavior to fail.
5. Extend `GroundCoverSpriteKey`, change the empty gate to `roll < 0.92`, and accept a precomputed protected-tile predicate or set without coupling the pure hash function to game state.
6. Build the protected set once from every building footprint and road tile with a two-tile Chebyshev apron; reject forest before descriptor construction and cull invisible candidates before hashing.
7. Rerun the focused tests and `npm run typecheck`; require PASS.
8. Commit the placement behavior and tests with Lore trailers.

### Task 2: Measure Part 1 before asset or terrain work

**Files:**
- Create: `scripts/phase4eRenderBenchmark.mjs`
- Create: `docs/asset-evidence/phase4e_part1_performance.json`

1. Write the benchmark fixture against the real render path with a fixed viewport, seed, camera, at least 40 buildings, 400 trees, 20 walkers, and a stable road count.
2. Record warm-up policy, sample count, average, p95, and worst frame time plus exact building/road/tree/cover/walker counts.
3. Run the fixture on DGX at 1x and at 5x simulation competition before any sprite or terrain change; save machine-readable results.
4. If worst 5x exceeds 12 ms, profile the ground-cover pass and make only measured rendering optimizations: earlier culling, protected-set reuse, or safe batching that preserves depth.
5. Rerun focused tests and the benchmark after any optimization; commit the harness and Part 1 evidence.

### Task 3: Extend exact asset contracts with tests first

**Files:**
- Modify: `scripts/worldAssetContracts.ts`
- Modify: `scripts/worldSpritePipeline.ts`
- Modify: `scripts/worldAssetManifest.ts`
- Modify: `scripts/verifyWorldAssets.ts`
- Modify: `tests/worldSpritePipeline.test.ts`
- Modify: `tests/worldAssetManifest.test.ts`
- Modify: `tests/worldAssetRelease.test.ts`
- Modify: `tests/test_generate_world_assets.py`

1. Add failing contract tests for shrub canvases 40x28 and 32x22, grass tuft 28x18, field stone 24x16, and wider-than-tall alpha bounds for both shrubs.
2. Add failing tests proving every non-target building/foliage/terrain release file stays byte-identical and the final manifest adds exactly two foliage keys while preserving all existing paths.
3. Add failing palette tests that every selected cover and sawmill opaque pixel belongs to the declared `RAMPS`/`PALETTE` policies.
4. Run the focused TypeScript and Python tests; confirm contract failures.
5. Extend only the foliage key/spec unions, release parser, verification rows, and generation prompt/geometry data required by the new assets and sawmill selection.
6. Rerun focused tests and typecheck; keep tests RED only for not-yet-generated target files.
7. Commit the contract changes separately from generated PNGs.

### Task 4: Generate, select, and release the five target sprites on DGX

**Files:**
- Modify: `scripts/generateWorldAssets.py`
- Modify: `scripts/prepareWorldAssets.ts`
- Create: `docs/asset-evidence/phase4e_generation_manifest.json`
- Create: `docs/asset-evidence/phase4e_selection_ledger.json`
- Create: `docs/assets/phase4e_ground_cover_candidates.png`
- Create: `docs/assets/phase4e_sawmill_candidates.png`
- Modify: `public/assets/foliage/shrub_a.png`
- Modify: `public/assets/foliage/shrub_b.png`
- Create: `public/assets/foliage/grass_tuft.png`
- Create: `public/assets/foliage/field_stone.png`
- Modify: `public/assets/buildings/sawmill.png`
- Modify: `public/assets/world_asset_manifest.json`

1. Start an owned ComfyUI process on DGX only if port 8188 is not already owned; record checkpoint, LoRA, workflow, prompts, seeds, and candidate indices without exposing credentials.
2. Generate four candidates per ground-cover key and six sawmill candidates. Require low/trunkless/wide shrubs and the sawmill's roof-breaking vertical frame, open work face, plank stacks, and sawdust.
3. Build contact sheets, inspect every candidate at native size and in a representative isometric tile, and write explicit accept/reject reasons in the selection ledger.
4. Process selected raws through the existing transparency, palette quantization, baseline, and exact-canvas pipeline.
5. Assert SHA-256 equality for storehouse, wheat farm, and every other non-target release file before and after preparation.
6. Run `npx tsx scripts/verifyWorldAssets.ts`, focused release/pipeline tests, and the Python generator tests; require PASS.
7. Commit the generator/pipeline evidence and targeted release artifacts with Lore trailers.

### Task 5: Composite terrain over flat bases with deterministic rotation

**Files:**
- Modify: `src/render/drawTerrain.ts`
- Modify: `src/render/terrainPatterns.ts`
- Modify: `tests/terrainRendering.test.ts`
- Modify: `tests/terrainPatterns.test.ts`

1. Add failing canvas-call tests proving the flat terrain base is painted before texture, ordinary texture alpha is approximately 0.45, and water texture alpha is faint and lower.
2. Add failing tests proving the stable tile hash returns only 0/90/180/270 degrees, equal tile/seed inputs repeat, and at least two rotations occur in a fixed grass sample.
3. Add tests for camera-independent choice, transform restoration, per-context/per-quarter-turn cache bounds, and missing-pattern fallback.
4. Run focused tests and confirm RED against the full-strength unrotated pattern.
5. Implement clipped quarter-turn transforms around tile centres without changing terrain geometry, road connectivity, or procedural fallback.
6. Rerun focused tests, render-contract tests, and typecheck; require PASS.
7. Commit terrain composition separately.

### Task 6: Integrate the four cover variants and preserve render scope

**Files:**
- Modify: `src/render/treeLayout.ts`
- Modify: `src/render/objectRenderOrder.ts`
- Modify: `src/render/worldAssets.ts`
- Modify: `tests/renderSourceGuards.test.ts`
- Modify: `tests/worldObjectRendering.test.ts`
- Modify: `DESIGN.md`

1. Add failing integration tests proving all four ground-cover keys can enter the shared depth queue only at full detail and never on forest or inside protected tiles.
2. Add source guards proving no economy, balance, simulation, or UI modules changed and no non-target asset is referenced by the new path.
3. Wire the two new manifest keys through the existing registry/blitter and document the sparse-cover/rotated-terrain pass in `DESIGN.md`.
4. Rerun all render tests, typecheck, and the determinism assertion; require PASS and `4d92c66f9408a603`.
5. Commit integration and documentation.

### Task 7: Final performance and real-browser visual QA

**Files:**
- Create: `docs/asset-evidence/phase4e_final_performance.json`
- Create: `docs/assets/phase4e_default_open_ground.png`
- Create: `docs/assets/phase4e_settlement_clearing.png`
- Create: `docs/assets/phase4e_sawmill_storehouse.png`
- Create: `docs/assets/phase4e_squint_terrain.png`
- Create: `docs/PHASE4E_LAND_BREATHE_REPORT.md`

1. Run the exact Part 1 benchmark fixture on the final DGX tree at 1x and 5x; record average/p95/worst and all entity counts in a before/Part-1/final table.
2. Build and serve the production app in real Chrome under React StrictMode; capture console and page errors.
3. Capture default/open ground, settlement two-tile clearing, sawmill-versus-storehouse, and zoomed-out squint terrain from the live game.
4. Inspect each screenshot at native resolution. Reject shrub/tree ambiguity, cover clutter, hidden road/building edges, strong water noise, obvious grass tiling, or sawmill/storehouse silhouette confusion; iterate within scope.
5. If final worst 5x remains above 12 ms, include the measured bottleneck and attempted optimizations in the report rather than hiding the miss.
6. Complete the report with implementation by part, grass-repeat approach/result, performance table, exact tests/hash before and after, asset provenance, URLs, and an honest visual read.

### Task 8: Independent final verification and DGX delivery

**Files:**
- Update: `docs/PHASE4E_LAND_BREATHE_REPORT.md`

1. Run `npm test`, verify at least 340 existing plus all new tests pass, then run `npm run typecheck`, `npm run build`, `npm run harness`, `git diff --check`, Python tests, asset verification, scoped secret scan, and determinism hash.
2. Compare SHA-256 for storehouse, wheat farm, and every non-target world asset against baseline `dfa6f8205f659ec9f9e343358191466174dbb2ce`.
3. Review the full branch diff for scope, fallback behavior, deterministic iteration, canvas-state restoration, generated provenance, and report accuracy.
4. Commit remaining report/evidence changes with Lore trailers and verify a clean branch.
5. Push the feature branch, fast-forward authoritative `main` only after all gates pass, push `main`, and compare local HEAD, DGX HEAD, `origin/main`, and `git ls-remote` SHA/tree.
6. Restart only the owned `feudal-sim` tmux service on DGX port 3200 from the new commit; verify HTML plus every referenced JS/CSS asset, browser console, and all four live screenshots.
7. Report commit, branch, GitHub URL, `http://100.70.109.50:3200`, performance evidence, test totals, determinism, changed files, simplifications, and remaining risks.

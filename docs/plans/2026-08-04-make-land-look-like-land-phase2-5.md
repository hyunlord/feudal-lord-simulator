# Phase 2.5: Make the Land Look Like Land - Implementation Plan

**Goal:** Replace coordinate-patterned terrain, cloned forest props, and noisy
console surfaces with a deterministic coherent landscape and a quiet
three-recess command console without changing simulation rules.

**Architecture:** Seeded value noise and fBm feed a pure row-major terrain
builder followed by deterministic component cleanup. Pure tree descriptors keep
woodland composition testable while Canvas remains responsible for drawing and
sway. Existing asset quantisation and verification remain the only path from
ComfyUI candidates into public UI files.

**Constraints:** No new dependencies, no colour literals outside
`src/content/palette.ts`, no gradients, blur, or shadowBlur, no hidden runtime
randomness, and no release until remote main and the running server identify the
same verified commit.

---

## Task 1: Lock coherent-noise contracts

**Files:**
- Create: `src/world/noise.ts`
- Create: `tests/noise.test.ts`

1. Write failing tests for deterministic lattice noise, smooth bounded output,
   seed divergence, and deterministic normalized fBm.
2. Run `npx tsx --test tests/noise.test.ts` and retain the expected red result.
3. Implement integer hashing, smoothstep interpolation, and normalized octaves.
4. Re-run the focused test and `npm run typecheck`.

## Task 2: Generate and clean seeded land

**Files:**
- Modify: `src/world/terrain.ts`
- Modify: `src/world/world.types.ts` if the builder options require it
- Modify: `src/state/gameStore.ts`
- Modify: `tests/terrain.test.ts`
- Modify: `tests/gameState.test.ts`
- Create: `scripts/previewTerrain.ts`

1. Add failing tests for explicit seed reproducibility, different-seed
   divergence, minimum component sizes, and absence of enclosed lone grass.
2. Implement independent elevation and moisture fields and the documented
   starting thresholds.
3. Implement deterministic orthogonal flood-fill cleanup while preserving
   row-major indexing.
4. Pass the store seed into world generation.
5. Implement the ASCII preview and tune only from measured component statistics
   and the two full fixed-seed previews.
6. Run focused tests, the preview, typecheck, and the complete regression suite.

## Task 3: Make terrain paint coherent

**Files:**
- Modify: `src/world/terrain.ts`
- Modify: `src/render/drawTerrain.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/GameCanvas.tsx` if backdrop placement requires it
- Modify: `tests/terrain.test.ts`
- Modify: `tests/renderContracts.test.ts`

1. Add failing range and adjacent-delta tests for seeded low-frequency
   `terrainVariation`.
2. Add failing render contracts for grass-side shoreline, forest tufts, rock
   pebbles, and palette-derived stepped exterior bands.
3. Implement variation and material-specific orthogonal seams.
4. Fill the off-map canvas with ink and draw three outward stepped bands around
   the map footprint without gradients.
5. Run focused tests, typecheck, and palette or style scans.

## Task 4: Compose deterministic woodland clusters

**Files:**
- Create: `src/render/treeLayout.ts`
- Modify: `src/render/drawBuildings.ts`
- Modify: `src/render/objectRenderOrder.ts` only if descriptor integration
  requires it
- Create: `tests/treeLayout.test.ts`
- Modify: `tests/objectRenderOrder.test.ts`
- Modify: `tests/renderContracts.test.ts`

1. Add failing tests for tree count, offset bounds, scale bounds, silhouette
   membership, stable phase, sorting, determinism, seed divergence, and denser
   interiors.
2. Implement the pure descriptor generator.
3. Draw narrow, broad, and rounded palette-only silhouettes in local y order,
   retaining deterministic sine sway.
4. Verify forest-edge and interior fixtures plus all render regressions.

## Task 5: Regenerate the two weak UI assets

**Files:**
- Modify: `scripts/generateUiAssets.py`
- Modify: `public/assets/ui/wood_console.png`
- Modify: `public/assets/ui/scroll_frame.png`
- Modify: `docs/asset-evidence/uiAssetManifest.json`
- Modify: `docs/ASSET_REPORT.md`
- Modify tests only when a stronger alpha contract needs coverage

1. Inspect the existing generation, quantisation, and manifest contracts.
2. Add a target filter so only wood and scroll candidates are generated.
3. Generate multiple ComfyUI candidates for only the wood and scroll surfaces.
4. Inspect every candidate and select the strongest match honestly.
5. Quantise selected candidates with alpha preservation.
6. Verify palette membership, dimensions, scroll interior transparency above
   fifty percent, and fully transparent exterior.
7. Record before and after evidence using repository-relative references only.

## Task 6: Clarify the three-recess console

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/App.tsx` only if semantic grouping needs correction
- Modify: `tests/courtConsoleContracts.test.ts`

1. Add or update a failing contract that forbids far-edge illumination fragments
   and confirms minimap, build, and ledger or speed ownership.
2. Remove the cut-off edge pseudo-elements and apply the selected quiet assets.
3. Verify desktop, tablet, and 320 or 375 pixel layouts without overflow.

## Task 7: Integrated quality gate

**Files:**
- Modify: `docs/PHASE2_QA.md`
- Modify: `docs/DEV_LOG.md`
- Modify: `README.md` only where Phase 2.5 operation differs

1. Run `npm test`, `npm run typecheck`, `npm run build`,
   `npx tsx scripts/verifyUiAssets.ts <candidate-root>`, and `npm audit`.
2. Run the no-hex, no-gradient, no-blur, no-shadow, and secret scans.
3. Run ephemeral React diagnostics without adding dependencies.
4. Capture default, forest-edge zoom, shoreline zoom, full-console, and
   responsive screenshots with zero browser-console errors.
5. Compare against the Phase 2 baseline and document honest residual risks.
6. Request independent spec, code, visual, performance, and security review;
   resolve every blocking finding and repeat gates.

## Task 8: Deliver the verified revision

1. Squash or otherwise sanitize operational generation history before public
   delivery if required by the security review.
2. Integrate onto the latest remote `main` without discarding unrelated work.
3. Run the full release gate on the exact candidate commit.
4. Push `main`, verify `git ls-remote`, and confirm tree identity.
5. Restart the named development server from the exact main checkout.
6. Confirm HTTP health, the visible Phase 2.5 changes, and server or Git commit
   identity before reporting completion.

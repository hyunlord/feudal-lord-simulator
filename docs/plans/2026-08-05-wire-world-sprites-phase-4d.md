# Phase 4D Wire World Sprites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all Phase 4C building, foliage, and terrain assets into the live isometric renderer with deterministic fallbacks, correct depth, and measured performance.

**Architecture:** A singleton manifest registry owns browser image lifecycle, while a device-space blitter owns anchor math and canvas-state restoration. One typed object queue composes buildings, individual foliage, and walkers; terrain remains clipped procedural geometry filled by cached world-anchored patterns.

**Tech Stack:** React 19, TypeScript 7 strict mode, Canvas 2D, Vite, Node test runner, Playwright/real Chrome from the workspace runtime.

---

### Task 1: Lock the browser asset registry

**Files:**
- Create: `src/render/worldAssets.ts`
- Create: `tests/worldAssets.test.ts`

1. Write failing Given/When/Then tests for one-load caching, concurrent preload sharing, all-missing convergence, lookup status, exact manifest parsing, and served URL conversion.
2. Run `npx tsx --test tests/worldAssets.test.ts`; confirm the missing-module RED failure.
3. Implement the typed manifest registry and the required public API: `preloadWorldAssets`, `getSprite`, and `spriteMeta`.
4. Rerun the focused test and `npm run typecheck`; require PASS.

### Task 2: Lock sprite placement and fallback

**Files:**
- Create: `src/render/worldSprite.ts`
- Create: `tests/worldSprite.test.ts`

1. Write failing tests for missing-image false/no-draw, 1x1 and 2x2 forward anchors, device-pixel rounding under DPR/pan/zoom, destination-rect culling, alpha/scale, smoothing disable, and complete state restoration.
2. Run the focused test and confirm RED.
3. Implement `drawWorldSprite` plus one internal world-anchor variant used by foliage.
4. Rerun focused tests and typecheck; require PASS.

### Task 3: Build the unified object queue

**Files:**
- Modify: `src/render/objectRenderOrder.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/drawBuildings.ts`
- Modify: `src/render/drawTrees.ts`
- Modify: `src/render/drawWalkers.ts`
- Modify: `src/render/treeLayout.ts`
- Modify: `tests/renderContracts.test.ts`
- Modify: `tests/treeLayout.test.ts`
- Create: `tests/worldObjectDepth.test.ts`

1. Write failing tests proving stable `tx + ty`, `tx`, identity ordering; forwardmost 2x2 anchors; walkers behind and in front of buildings; deterministic foliage keys/roles; shrub ground-cover exclusivity; and unchanged clearing.
2. Run the focused tests and confirm contract failures.
3. Extend the queue with building, foliage, and walker variants. Map all building kinds and house levels to manifest keys, and preserve primitive draws for missing/loading sprites and block LOD.
4. Keep walker minimum screen size and foliage scale/offset/sway rules.
5. Rerun all render/tree/walker tests and typecheck; require PASS.

### Task 4: Fill terrain and roads with cached patterns

**Files:**
- Modify: `src/render/drawTerrain.ts`
- Modify: `src/render/drawTerrainDetails.ts`
- Create: `src/render/terrainPatterns.ts`
- Modify: `tests/drawTerrain.test.ts`
- Create: `tests/terrainPatterns.test.ts`

1. Write failing tests for per-context/per-type pattern caching, missing-pattern fallback, stable world phase across camera transforms, clipped diamond fills, brightness overlay, and packed-earth road arms.
2. Run focused tests and confirm RED.
3. Implement lazy `CanvasPattern` caching and world-anchored fills while retaining all procedural geometry and transition logic.
4. Rerun focused tests and typecheck; require PASS.

### Task 5: Integrate preload and preserve LOD contracts

**Files:**
- Modify: `src/render/GameCanvas.tsx`
- Modify: `src/render/renderLod.ts` or the existing LOD owner
- Modify: `tests/renderSourceGuards.test.ts`
- Modify: `tests/phase4bArtifacts.test.ts`
- Modify: `DESIGN.md`

1. Write or update tests for non-blocking preload, exact full/simplified/block thresholds, procedural fallback retention, no forbidden colours/effects, and permitted Phase 4D image wiring.
2. Confirm the historical no-image guard fails for the intended reason.
3. Start preload from the canvas lifecycle without delaying first paint; update the design-system render-pass contract.
4. Rerun the complete test suite, typecheck, build, harness, and determinism hash; require `4d92c66f9408a603`.

### Task 6: Browser QA and performance evidence

**Files:**
- Create: `scripts/phase4dBrowserQa.mjs` only if the browser harness cannot remain a `/tmp` artifact.
- Create: `docs/PHASE4D_SPRITE_INTEGRATION_REPORT.md`
- Generate: `docs/assets/phase4d-default-settlement.png`
- Generate: `docs/assets/phase4d-close-adjacency.png`
- Generate: `docs/assets/phase4d-lod-050.png`
- Generate: `docs/assets/phase4d-walker-depth.png`

1. Build and serve the production app in real Chrome; capture console/page errors under React StrictMode.
2. Capture the four requested actual-game screenshots, inspect them visually, and fix all anchor, overlap, clearing, LOD, or pattern-phase defects.
3. Run the same synthetic render fixture on baseline `903f435...` and the final tree with at least 40 buildings, 400 trees, and 20 walkers; record average/worst at 1x and five-tick competition.
4. Run desktop plus 768px and 375px smoke screenshots without changing the established UI.

### Task 7: Final verification and DGX delivery

**Files:**
- Update: `docs/PHASE4D_SPRITE_INTEGRATION_REPORT.md`

1. Run `npm test`, `npm run typecheck`, `npm run build`, `npm run harness`, `git diff --check`, no-excuse checks, source guards, asset-count/manifest checks, and scoped secret scan.
2. Review every modified file for single responsibility, strict types, fallback preservation, and the 250-pure-LOC ceiling; split defects before commit.
3. Reconnect to DGX, verify exact remote/branch/status, transfer or pull the final tree, restart owned tmux `feudal-sim` on port 3200, and rerun live screenshots/console/performance checks there.
4. Commit with Lore trailers, push `main`, compare local HEAD, DGX HEAD, `origin/main`, and `git ls-remote`, then report the GitHub commit URL and `http://100.70.109.50:3200`.

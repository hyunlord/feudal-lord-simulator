# Living Manuscript Phase 2 Implementation Plan

**Goal:** Turn the Phase 1 scaffold into a playable, full-viewport isometric
placement slice whose world and command console look like one living illuminated
manuscript, without implementing the economy simulation.

**Architecture:** Keep transient camera, picking, hover, preview, and ambient
motion in `render/`; keep terrain, road, and placement rules pure in `world/`;
route accepted domain changes through `engine/` and `state/`. Use a single
Canvas 2D renderer with ground, object, and overhang passes, plus one React
console overlay.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Canvas 2D, Node test runner via
tsx, existing DGX ComfyUI SDXL/pixel-art workflow. Add no project dependencies.

---

## Task 1: Freeze Palette, Shared Contracts, and Mechanical Gates

**Files:**
- Create: `src/content/palette.ts`
- Modify: `src/content/buildingConfig.ts`
- Modify: `src/economy/economy.types.ts`
- Create: `src/render/style.ts`
- Create: `tests/palette.test.ts`
- Create: `tests/style.test.ts`

1. Write tests asserting the exact nineteen listed palette entries, no source
   hex literals outside `palette.ts`, integer snapping, deterministic shading,
   and ink outline application.
2. Run those tests on DGX and capture the expected RED result.
3. Add the canonical palette and style helpers. Move canonical building types to
   `content/` and re-export them from economy for boundary compatibility.
4. Run focused tests, typecheck, and architecture greps until green.

## Task 2: Implement Picking and Camera as Pure Render Utilities

**Files:**
- Create: `src/render/camera.ts`
- Create: `src/render/picking.ts`
- Create: `tests/camera.test.ts`
- Create: `tests/picking.test.ts`

1. Write tests for zoom clamps, pan transforms, client/canvas conversion,
   centres, four edge-inside points, sampled grids, negative coordinates, and
   camera-transformed points.
2. Run focused tests for RED.
3. Implement camera transforms/clamping and analytic-plus-containment picking.
4. Run focused tests and typecheck for GREEN.

## Task 3: Implement Deterministic World, Placement, and Roads

**Files:**
- Modify: `src/world/world.types.ts`
- Modify: `src/world/grid.ts`
- Modify: `src/world/placement.ts`
- Modify: `src/world/roadGraph.ts`
- Create: `src/world/terrain.ts`
- Create: `tests/terrain.test.ts`
- Create: `tests/placement.test.ts`
- Create: `tests/roads.test.ts`

1. Write tests for deterministic terrain and variation, negative hash inputs,
   every `PlacementFailure`, orthogonal road adjacency, continuous horizontal
   and vertical drag paths, and buildable road tiles.
2. Run focused tests for RED.
3. Implement a deterministic 64-by-64 initial map, grid lookup, placement
   validation, and dominant-axis road lines.
4. Run focused tests and typecheck for GREEN.

## Task 4: Route Domain Changes Through Engine and State

**Files:**
- Modify: `src/engine/engine.types.ts`
- Modify: `src/engine/tick.ts`
- Create: `src/engine/gameActions.ts`
- Modify: `src/state/gameStore.types.ts`
- Modify: `src/state/gameStore.ts`
- Create: `tests/gameState.test.ts`

1. Write tests proving the initial world is populated, building and road actions
   are immutable and validated, timber is spent but never produced, advancing a
   tick changes only `tick`, and camera/ambient fields are absent.
2. Run focused tests for RED.
3. Implement the domain actions and reducer without economy, walker, population,
   housing, season, wall, or overlay behaviour.
4. Run focused tests and typecheck for GREEN.

## Task 5: Generate, Select, and Quantise Five UI Surfaces on DGX

**Files:**
- Create: `scripts/quantisePalette.ts`
- Create: `scripts/generateUiAssets.py`
- Create: `docs/ASSET_REPORT.md`
- Create: `public/assets/ui/scroll_frame.png`
- Create: `public/assets/ui/wood_console.png`
- Create: `public/assets/ui/seal_slot.png`
- Create: `public/assets/ui/parchment_texture.png`
- Create: `public/assets/ui/illumination_corner.png`

1. Export/adapt the existing ComfyUI API workflow and generate at least three
   candidates per surface with fixed seeds and recorded prompts.
2. Select one candidate per asset by transparency/seam/layout fitness and record
   honest strengths and defects.
3. Write a dependency-free TypeScript quantiser that parses the generated PNG
   through an installed DGX image utility boundary, computes perceptual nearest
   palette entries, and preserves alpha. If that boundary cannot meet the
   contract, keep the TypeScript algorithm and call it from a reproducible
   conversion wrapper rather than adding a project dependency.
4. Quantise the five finals to their required dimensions and scan every opaque
   pixel against the canonical palette.
5. Record workflow, seeds, candidate paths, before/after paths, dimensions,
   palette membership, and quality assessment in `docs/ASSET_REPORT.md`.

## Task 6: Implement the Three-Pass Procedural Renderer

**Files:**
- Modify: `src/render/drawTerrain.ts`
- Modify: `src/render/drawBuildings.ts`
- Modify: `src/render/drawWalkers.ts`
- Modify: `src/render/overlays.ts`
- Create: `src/render/renderer.ts`
- Modify: `src/render/GameCanvas.tsx`
- Create: `tests/renderContracts.test.ts`

1. Write contract tests for deterministic variation, pass order, culling bounds,
   direct-style prohibition, and the exact ambient sine equation.
2. Run focused tests for RED.
3. Draw terrain diamonds, four-neighbour transitions, water boundaries, forest
   tufts, connection-aware roads, distinct isometric buildings, placement
   previews, hover outline, and independently swaying trees.
4. Integrate camera controls, pointer picking, click placement, road drag, DPR
   resizing, and explicit ground/object/empty-overhang passes.
5. Run focused tests and typecheck for GREEN.

## Task 7: Replace the Web Shell with One Manuscript Console

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/ui/BuildMenu.tsx`
- Modify: `src/ui/InfoPanel.tsx`
- Modify: `src/ui/OverlayControls.tsx`
- Modify: `src/ui/SpeedControls.tsx`
- Modify: `src/styles/global.css`

1. Replace floating panels with a single `court-console` overlay containing a
   shield minimap, four-column icon-seal grid, and recessed ledger.
2. Draw the build glyphs with procedural SVG paths, adding accessible labels,
   focus states, and tooltips while keeping visible controls label-free.
3. Apply generated wood, seal, parchment, and illumination assets and exact
   palette CSS variables imported from the application boundary.
4. Make 375, 768, and 1280 pixel layouts overflow-free without scroll regions.
5. Run typecheck, tests, build, and React static checks.

## Task 8: Browser, Visual, and Boundary Verification

**Files:**
- Create: `docs/PHASE2_QA.md`
- Create screenshots under `/tmp/feudal-phase2-evidence/`

1. Restart the DGX dev server from the current candidate commit and load the
   Tailscale URL.
2. Use browser automation to exercise middle drag, space drag, keyboard pan,
   zoom limits, hover accuracy, valid placement, invalid reason, road drag, and
   independent tree sway.
3. Capture default, zoomed, valid-preview, invalid-reason, and full-console
   screenshots; verify zero console errors and zero document overflow at 375,
   768, and 1280.
4. Run two independent read-only visual oracle passes and iterate on every
   high-impact defect.
5. Record commands, screenshots, browser observations, and explicit unknowns in
   `docs/PHASE2_QA.md`.

## Task 9: Final Gates, Commit, Push, and Runtime Restart

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/DEV_LOG.md`

1. Update the documentation for Phase 2 architecture, controls, generated asset
   provenance, scope exclusions, and verification evidence.
2. Run fresh `npm test`, `npm run typecheck`, `npm run build`, palette/style
   greps, axis-boundary greps, asset scans, and browser smoke checks on DGX.
3. Review the complete diff, run an independent code review, and fix all
   actionable issues.
4. Verify remote URL, `main`, ancestry, and clean intended diff; create a Lore
   commit and push `main`.
5. Verify `git ls-remote` equals local HEAD, restart tmux `feudal-sim` at that
   exact commit, and re-run final URL/console/overflow smoke checks.
6. Report commit, branch, remote, GitHub URL, evidence paths, asset quality, and
   separate honest assessments of game-vs-web-app character and one-hand visual
   consistency.

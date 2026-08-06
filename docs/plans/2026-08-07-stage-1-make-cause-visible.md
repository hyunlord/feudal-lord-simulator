# Stage 1: Make Cause Visible Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a presentation-only diagnostic layer that makes house decline, Walker routes, population changes, road connectivity, and exact production blockers visible without changing simulation behavior.

**Architecture:** Pure TypeScript models derive diagnoses, road sets, Walker facts, and population events from immutable `GameState`. `GameCanvas` owns selection and presentation history, passes immutable overlay input into the renderer, and composes manuscript-style DOM cards and the population log. Existing simulation modules keep their public behavior and determinism.

**Tech Stack:** React 19, TypeScript 7, Canvas 2D, Node test runner through `tsx`, Vite 8.

---

### Task 1: Lock the presentation-only boundary and shared geometry

**Files:**
- Create: `src/world/buildingDistance.ts`
- Modify: `src/population/housing.ts`
- Modify: `src/world/roadGraph.ts`
- Test: `tests/diagnosticRoadGraph.test.ts`
- Test: `tests/housing.test.ts`

1. Write failing tests proving footprint distance matches current 1x1/2x2 housing behavior and proving multi-source road-component BFS against an independent queue implementation.
2. Run `npx tsx --test tests/diagnosticRoadGraph.test.ts tests/housing.test.ts`; expect missing helper failures.
3. Extract the existing footprint distance calculation without changing its algorithm and add `existingRoadComponent(grid, starts)` with deterministic NESW traversal and duplicate filtering.
4. Re-run the focused tests; expect all pass.
5. Run `npm run typecheck` and `git diff --check`.
6. Commit the helper, housing reuse, and direct tests with a Lore-format intent message.

### Task 2: Build the complete House cause chain

**Files:**
- Create: `src/ui/houseDiagnosisModel.ts`
- Test: `tests/houseDiagnosisModel.test.ts`

1. Write fixtures for: bread present, no granary, empty granary, disconnected granary, connected-but-unserviced house, serving well, no well, and too-distant well with exact distance.
2. Assert the exact Korean strings from the approved brief and that the input state is deep-equal before and after every model call.
3. Run `npx tsx --test tests/houseDiagnosisModel.test.ts`; expect module-not-found failure.
4. Implement the ordered diagnosis using building road access points, `existingRoadComponent`, shared building distance, and immutable searches only.
5. Re-run the test and `npm run typecheck`; expect pass.
6. Commit model plus tests.

### Task 3: Build Walker diagnosis and actual-path projection

**Files:**
- Create: `src/ui/walkerDiagnosisModel.ts`
- Create: `src/render/diagnosticPathOverlay.ts`
- Test: `tests/walkerDiagnosisModel.test.ts`
- Test: `tests/diagnosticPathOverlay.test.ts`

1. Write Carter and Distributor fixtures covering role, cargo, source/home, destination, phase, remaining distance, adjacent houses, and all four cancellation reasons.
2. Write a recorder test asserting the renderer receives and traces exactly `walker.path.slice(walker.pathIndex)` in order.
3. Run both tests; expect missing module failures.
4. Implement the Korean model and a thin token-coloured path tracer with no path recomputation.
5. Re-run focused tests, typecheck, and `git diff --check`.
6. Commit model, renderer, and tests.

### Task 4: Build population history, grouping, and the 200-event cap

**Files:**
- Create: `src/ui/populationEventModel.ts`
- Create: `src/ui/PopulationEventPanel.tsx`
- Test: `tests/populationEventModel.test.ts`
- Test: `tests/populationEventPanel.test.ts`

1. Write failing tests for per-house growth/starvation diffs, multi-delta expansion, no initial backfill, consecutive same-cause grouping, cause-boundary separation, unique group house IDs, and truncation to the newest 200.
2. Assert no `PopulationEvent` or presentation-history field exists on `DEFAULT_GAME_STATE`.
3. Run the focused tests; expect missing module failures.
4. Implement pure diff/append/group functions, then render an always-visible accessible panel whose group buttons report exact cause summaries.
5. Re-run focused tests and typecheck.
6. Commit model, panel, and tests.

### Task 5: Add exact distribution and road-component overlays

**Files:**
- Modify: `src/engine/engine.types.ts`
- Create: `src/ui/diagnosticOverlayModel.ts`
- Create: `src/render/diagnosticOverlays.ts`
- Modify: `src/render/overlays.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/gameCanvasFrame.ts`
- Modify: `src/ui/EconomyOverlayControls.tsx`
- Test: `tests/diagnosticOverlayModel.test.ts`
- Test: `tests/economyUi.test.ts`

1. Write an independent brute-force BFS oracle and assert exact distribution tiles at distances 0, 1, 39, 40, and exclusion at 41, plus exact selected-building component tiles.
2. Add control/keyboard-contract tests for both new modes without colliding with camera keys.
3. Run focused tests; expect missing modes/model failures.
4. Implement presentation-only overlay derivation and token-only Canvas drawing; pass selected building ID separately from `GameState`.
5. Re-run focused tests, typecheck, palette tests, and render source guards.
6. Commit modes, derivation, drawing, controls, and tests.

### Task 6: Add persistent click selection and manuscript cards

**Files:**
- Create: `src/render/worldSelection.ts`
- Create: `src/render/DiagnosticCard.tsx`
- Modify: `src/render/GameCanvas.tsx`
- Modify: `src/render/useGameCanvasRuntime.ts`
- Modify: `src/render/gameCanvasEvents.ts`
- Modify: `src/render/gameCanvasFrame.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/styles/global.css`
- Test: `tests/worldSelection.test.ts`
- Test: `tests/diagnosticCard.test.ts`
- Test: `tests/renderInteractions.test.ts`

1. Write failing tests for Walker-over-building hit priority, building selection, empty-world dismissal, alternate selection, Escape dismissal, placement-tool isolation, and card bounds that never overlap the selected target rectangle.
2. Add static markup tests for the complete House and Walker card rows and accessibility labels.
3. Run focused tests; expect failures.
4. Implement immutable selection state in `GameCanvas`, exact current Walker/building lookup, viewport-clamped card placement, and selection overlay inputs.
5. Style with existing palette variables and parchment texture only; add 1280px, 768px, and 375px confinement contracts.
6. Re-run focused tests, typecheck, CSS/style/palette tests, and render source guards.
7. Commit selection, cards, styles, and tests.

### Task 7: Surface exact problem-icon causes and event highlights

**Files:**
- Create: `src/ui/problemCauseModel.ts`
- Modify: `src/render/BuildingInspector.tsx`
- Modify: `src/render/buildingInspectorModel.ts`
- Modify: `src/render/GameCanvas.tsx`
- Modify: `src/render/diagnosticOverlays.ts`
- Test: `tests/problemCauseModel.test.ts`
- Test: `tests/phase35HoverInspector.test.ts`
- Test: `tests/diagnosticOverlayModel.test.ts`

1. Write failing tests distinguishing idle labour from no available labour, empty required input from missing route, and full output storage from no eligible store/no route.
2. Write a click-group test proving only involved house footprints are highlighted.
3. Run focused tests; expect failures.
4. Implement exact cause branches, expose them through marked-building hover/selection, and forward selected event-group house IDs to the highlight renderer.
5. Re-run focused tests, typecheck, and palette/render guards.
6. Commit exact cause labels and event highlighting.

### Task 8: Prove no simulation drift and pass automated gates

**Files:**
- Modify as needed only for defects exposed by verification.
- Create: `docs/asset-evidence/stage1_automated_verification.json`

1. Record pre-change hash `4d92c66f9408a603` and confirm no diagnostic fields appear in `GameState` or `DEFAULT_GAME_STATE`.
2. Run `npm run typecheck`, `npm run build`, `npm run harness`, and all focused Stage 1 tests locally.
3. Push the feature branch temporarily only if needed for DGX checkout, then run the complete suite on DGX where `ffmpeg` is installed; require every original and new test to pass.
4. Run `git diff --check`, palette/source guard tests, and inspect the full diff for simulation changes.
5. Save command, count, hash, and timing evidence in the JSON artifact.
6. Commit only verification artifacts or fixes justified by a failing gate.

### Task 9: Run real-browser visual and functional QA

**Files:**
- Create: `docs/assets/stage1_house_cause_chain.png`
- Create: `docs/assets/stage1_walker_route.png`
- Create: `docs/assets/stage1_population_log.png`
- Create: `docs/assets/stage1_distribution_overlay.png`
- Create: `docs/assets/stage1_road_component_overlay.png`
- Create: `docs/assets/stage1_responsive_768.png`
- Create: `docs/assets/stage1_responsive_375.png`
- Create: `docs/PHASE5_STAGE1_CAUSE_VISIBLE_REPORT.md`

1. Start the built app from the feature worktree and inspect 1280x720, 768px, and 375px with a real browser.
2. Exercise clicking a house, every House cause branch available in fixtures/dev harness, a Carter, a Distributor, both diagnostic overlays, population groups, empty-world dismissal, and Escape.
3. Capture the five required diagnostic screenshots plus responsive evidence.
4. Run three 5x frame-time samples; require normal frame time below 12ms and report worst sample honestly.
5. Start a timed acceptance test only after a live house loses a resident. Record whether the tester identifies the house and exact cause within thirty seconds using only the screen.
6. Record uncovered cause gaps and an honest Korean legibility assessment in the report.
7. Commit QA evidence and any narrowly justified fixes after re-running affected gates.

### Task 10: Deliver to GitHub and DGX

**Files:**
- No planned source changes.

1. Run final `git status`, inspect every commit and full branch diff, and verify all required report sections and screenshots exist.
2. Fast-forward `main` only after verification; do not rewrite shared history.
3. Push `main` to `https://github.com/hyunlord/feudal-lord-simulator.git` and verify local SHA equals `git ls-remote origin refs/heads/main`.
4. On DGX, fetch/reset only the named repository to the verified main SHA while preserving unrelated `.omo/` and `.omx/` entries, reinstall only if the lockfile changed, build, and restart tmux session `feudal-sim` on port 3200.
5. Fetch the live root and every HTML-referenced JS/CSS asset; require HTTP 200 and correct content types.
6. Re-run the final smoke interaction against `http://100.70.109.50:3200/`.
7. Report implementation by part, screenshot paths, timed acceptance result, cause gaps, before/after tests and hash, frame time, commit, branch, remote, GitHub URL, runtime URL, and honest legibility result.

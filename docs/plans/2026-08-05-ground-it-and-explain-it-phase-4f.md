# Phase 4F Ground It and Explain It Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ground every building and tree visually, explain the settlement goal and blockers on the normal screen, make build choices understandable, restore illuminated console art, and retain the deterministic simulation and sub-12ms frame budget.

**Architecture:** Keep `GameState` untouched and derive all new guidance through pure presentation selectors. Build the unified render queue once, reuse it for a cheap ground-contact pass and the object pass, derive two-layer shadows from manifest sprite height, and cache deterministic tree tint variants. Extend the existing console and seeded DGX asset pipeline rather than adding a tutorial state machine or new UI layer.

**Tech Stack:** React 19, TypeScript, Canvas 2D, Vite, Node test runner through `tsx`, Python `unittest`, seeded ComfyUI/SDXL on DGX, Playwright Chromium.

---

### Task 1: Establish the Phase 4F baseline and invariant ledger

**Files:**
- Modify: `DESIGN.md`
- Create: `docs/asset-evidence/phase4f_baseline.json`

**Step 1: Extend the design contract**

Replace the old single hard-shadow language with a two-layer, earth-tinted
height-scaled contact shadow; document the persistent objective/status line,
right-recess overlay legend, grouped explanatory build seals, and one-to-two
tree density. Keep the no-gradient, no-blur, no-hex, and upper-left-light rules.

**Step 2: Create a DGX worktree and run the untouched baseline**

Run from `/home/hyunlord/work/feudal-lord-simulator`:

```bash
git fetch origin main
git worktree add --detach /tmp/feudal-phase4f-baseline origin/main
cd /tmp/feudal-phase4f-baseline
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run typecheck
npm run build
npm run harness
```

Expected: 361 Node tests pass, all Python tests pass, and the determinism hash is
`4d92c66f9408a603`.

**Step 3: Record baseline browser evidence**

Use `scripts/phase4eRenderBenchmark.mjs` against the exact baseline revision at
1× and 5×, record entity counts and frame statistics in
`phase4f_baseline.json`, and capture the four required pre-change views.

**Step 4: Commit**

Commit only `DESIGN.md` and baseline evidence with a Lore message describing the
presentation-only constraints and exact baseline verification.

### Task 2: Derive and draw manifest-height shadows and ground contact

**Files:**
- Create: `src/render/grounding.ts`
- Modify: `src/render/style.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/drawBuildings.ts`
- Modify: `src/render/drawTrees.ts`
- Modify: `src/render/objectRenderOrder.ts`
- Modify: `src/render/worldAssets.ts`
- Test: `tests/style.test.ts`
- Test: `tests/renderContracts.test.ts`
- Test: `tests/worldObjectRendering.test.ts`
- Test: `tests/worldObjectDepth.test.ts`

**Step 1: Write failing pure-geometry tests**

Add assertions equivalent to:

```ts
const hut = objectShadowGeometry({ spriteHeight: 112, scale: 1 });
const manor = objectShadowGeometry({ spriteHeight: 192, scale: 1 });
assert.ok(manor.halo.radiusX > hut.halo.radiusX);
assert.ok(manor.halo.centerX < manor.core.centerX);
assert.equal(manor.core.alpha, 0.32);
assert.equal(manor.halo.color, PALETTE.earthDark);
```

Also assert integer-snapped two-ellipse call order and no `shadowBlur`.

**Step 2: Run the focused tests and confirm RED**

```bash
npx tsx --test tests/style.test.ts tests/worldObjectRendering.test.ts tests/renderContracts.test.ts
```

Expected: missing geometry/helper and old one-diamond expectations fail.

**Step 3: Implement the pure grounding model**

`grounding.ts` returns bounded halo/core/contact geometry from manifest height,
scale, and anchor. Use `spriteMeta(key)` even if the image is not ready. Both
layers use canonical earth tokens with halo alpha below core alpha; core alpha
is 0.32. Offset the halo lower-left, opposite the upper-left light.

**Step 4: Reuse the object queue in both ground and object passes**

Move queue construction to `renderFrame`, paint narrow cached contact diamonds
after terrain and before objects, then pass the same items to `drawBuildings`.
Do not sort or derive tree descriptors twice per frame.

**Step 5: Draw the same shadow before every sprite or fallback**

Building and tree paths compute geometry from the active sprite key and display
scale before attempting `drawWorldSprite`. Remove the ready-tree early-return
hole that currently skips all shadows.

**Step 6: Run GREEN and commit**

Run the focused suites plus `tests/renderSourceGuards.test.ts` and
`tests/phase3Architecture.test.ts`; commit grounding implementation and direct
tests together.

### Task 3: Thin and vary woodland deterministically

**Files:**
- Modify: `src/render/treeLayout.ts`
- Modify: `src/render/drawTrees.ts`
- Modify: `src/render/worldSprite.ts`
- Test: `tests/treeLayout.test.ts`
- Test: `tests/worldSprite.test.ts`
- Test: `tests/worldObjectDepth.test.ts`

**Step 1: Write failing density and tint tests**

Assert all forest counts are `1 | 2`, exposed edges are always one, fully
connected interiors deterministically choose one or two, and equal tile/seed
inputs yield identical tint slots across the full six-step foliage ramp.

Assert the sprite blitter accepts a tint slot without leaking canvas state and
reuses a cached tinted bitmap for identical image/key/slot inputs.

**Step 2: Verify RED**

```bash
npx tsx --test tests/treeLayout.test.ts tests/worldSprite.test.ts tests/worldObjectDepth.test.ts
```

Expected: existing three-tree and two-tone expectations contradict the spec.

**Step 3: Implement**

Replace `TreeTone` with a stable `tintIndex` from 0 through 5. Interior density
uses a stable hash to return one or two; zero/one-neighbor edge tiles return one.
Tint ready sprites through a cache keyed by image identity, sprite key, and tint
index; never place a `drawImage` call outside `worldSprite.ts`.

**Step 4: Run GREEN, source guards, and commit**

Include deterministic repeat assertions and update exact object counts where the
fixture legitimately changes.

### Task 4: Derive objective, blocker status, and problem glyph truth

**Files:**
- Create: `src/ui/settlementGuidanceModel.ts`
- Modify: `src/render/buildingVisualState.ts`
- Modify: `src/render/drawBuildingDetails.ts`
- Test: `tests/settlementGuidanceModel.test.ts`
- Test: `tests/buildingEconomyRendering.test.ts`
- Test: `tests/gameState.test.ts`

**Step 1: Write failing selector tests for every priority**

Construct independent `GameState` fixtures and assert exact Korean messages in
this order: dry house, bread overdue by at least 200 ticks, idle plus
understaffed, no granary, treasury timber below 30, stable. Add a combined state
that proves the first matching condition wins.

**Step 2: Write failing objective purity tests**

Assert populations 10, 50, 119, and 120 produce `{target: 50|120,
complete: boolean}` as specified and that the input object is deep-equal before
and after every selector call.

**Step 3: Write failing icon tests**

Construct dry/stale houses and `no_workers`, `no_input`, `storage_full`
production states. Assert only water, bread, worker, or crate geometry is drawn,
at a larger radius/extent than the old 3px dot, with deterministic tick pulse.

**Step 4: Implement pure selectors and typed glyphs**

Use `BALANCE.BREAD_HUNGER_WINDOW`, building requirements, and actual state fields.
Do not add goal, status, banner, or icon fields to `GameState`.

**Step 5: Run GREEN and commit**

```bash
npx tsx --test tests/settlementGuidanceModel.test.ts tests/buildingEconomyRendering.test.ts tests/gameState.test.ts
```

### Task 5: Make build choices readable and cancellable

**Files:**
- Modify: `src/ui/buildMenuModel.ts`
- Modify: `src/ui/BuildMenu.tsx`
- Modify: `src/App.tsx`
- Modify: `src/render/GameCanvas.tsx`
- Modify: `src/world/placement.ts`
- Modify: `src/styles/global.css`
- Test: `tests/buildMenuContracts.test.ts`
- Test: `tests/renderInteractions.test.ts`
- Test: `tests/courtConsoleContracts.test.ts`

**Step 1: Write failing option-model tests**

Assert exact Korean name, timber cost, one-line purpose, category, road/forest
requirement, affordability, and shortfall for all nine tools. Extract the same
spendable-timber rule used by placement; do not use ledger totals that include
walker cargo.

**Step 2: Write failing React contract tests**

Render grouped seals and assert four labelled groups, pressed state, focusable
`aria-disabled` unaffordable options, shortfall tooltip, requirement text, and
selected appearance. Add a pure key handler or component test proving `Escape`
sets a nullable presentation selection and `GameCanvas` produces no placement
preview/click action while cancelled.

**Step 3: Implement model, grouping, and cancellation**

Keep buttons focusable for tooltip access. Use palette variables only, visible
group gaps without new panels, and a pressed translation/ink treatment. Restore
selection only when a seal is explicitly chosen.

**Step 4: Run GREEN, 375/768 contract tests, and commit**

### Task 6: Put objective, status, and overlays in the console

**Files:**
- Create: `src/ui/SettlementGuidance.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ui/InfoPanel.tsx`
- Modify: `src/ui/EconomyOverlayControls.tsx`
- Modify: `src/styles/global.css`
- Test: `tests/economyUi.test.ts`
- Test: `tests/courtConsoleContracts.test.ts`

**Step 1: Write failing composition tests**

Assert the persistent goal renders as `목표: 인구 50명 현재 10명`, status is
the only persistent element immediately above the console, overlay controls are
descendants of `.ledger-recess`, and no `.economy-overlays` element is positioned
over the map. Assert only tooltips, inspector, and status may overlap the canvas.

**Step 2: Write failing 60-tick/banner tests**

Extract a presentation controller hook or pure transition helper. Prove status
changes only at 60-tick buckets and population crossing 50 produces a quiet
banner while the persistent goal advances to 120 without dispatching.

**Step 3: Implement and style**

Compose objective, compact ledger, overlays, and speed controls inside the right
recess. Use token colors, Georgia, opacity/transform-only banner motion, no card
or floating sticky-note vocabulary.

**Step 4: Run GREEN and commit**

### Task 7: Regenerate illuminated scroll and material console on DGX

**Files:**
- Modify: `scripts/generateUiAssets.py`
- Modify: `scripts/uiAssetManifest.ts`
- Modify: `scripts/verifyUiAssets.ts`
- Modify: `tests/test_generate_ui_assets.py`
- Modify: `tests/verifyUiAssets.test.ts`
- Modify: `docs/asset-evidence/uiAssetManifest.json`
- Modify: `docs/asset-evidence/before/scroll_frame.png`
- Modify: `docs/asset-evidence/before/wood_console.png`
- Modify: `public/assets/ui/scroll_frame.png`
- Modify: `public/assets/ui/wood_console.png`
- Create: `docs/asset-evidence/phase4f_ui_generation_manifest.json`
- Create: `docs/assets/phase4f_scroll_frame_before.png`
- Create: `docs/assets/phase4f_scroll_frame_after.png`
- Create: `docs/assets/phase4f_wood_console_before.png`
- Create: `docs/assets/phase4f_wood_console_after.png`

**Step 1: Add RED generator/verifier contracts**

Require scroll prompts and guides to include gold, ultramarine, and vermilion
medallions while center/perimeter alpha remains valid. Require final scroll art
to contain all three canonical accent families. Require console evidence for
three recesses, multiple plank-grain transitions, and raised top-edge/lower-edge
contrast. Preserve exact dimensions.

**Step 2: Reuse building-style reference wiring**

Port the tested IPAdapter/reference upload pattern from
`generateWorldAssets.py`; reference the accepted house, mill, and granary art.
Remove the current negative-prompt conflict that bans the requested accents.

**Step 3: Generate candidates on owned DGX ComfyUI**

Start only the owned `phase4f-comfy` tmux, generate at least three candidates per
target with recorded seeds, and preserve all raw outputs under a unique `/tmp`
root. Do not overwrite release assets until tests and visual review choose one.

**Step 4: Prepare, quantise, verify, and visually select**

Run the exact active-candidate verifier, scoped secret scan, palette and alpha
checks, and two independent native-resolution visual reviews. Commit source,
tests, selected PNGs, manifests, hashes, and before/after evidence together.

### Task 8: Browser interaction, visual, and performance QA

**Files:**
- Create: `docs/asset-evidence/phase4f_final_performance.json`
- Create: `docs/PHASE4F_GROUND_EXPLAIN_REPORT.md`
- Create: `docs/assets/phase4f_building_shadow_closeup.png`
- Create: `docs/assets/phase4f_tree_shadow_closeup.png`
- Create: `docs/assets/phase4f_full_guidance.png`
- Create: `docs/assets/phase4f_build_tooltip.png`
- Create: `docs/assets/phase4f_console_overlay_legend.png`

**Step 1: Run full DGX verification**

```bash
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run typecheck
npm run build
npm run harness
npx tsx scripts/verifyUiAssets.ts <active-candidate-root> docs/asset-evidence/uiAssetManifest.json
npx tsx scripts/verifyWorldAssets.ts . public/assets/buildings/candidates_v2
```

Expected: all tests pass; determinism remains `4d92c66f9408a603`.

**Step 2: Exercise the real UI**

With Playwright at 1280, 768, and 375 widths, verify hover/focus tooltips,
unaffordable shortfall, Escape cancellation, objective/status, overlay toggles,
no overflow, and no persistent world floater beyond status. Record console,
page, request, and response errors.

**Step 3: Run dual visual QA every correction iteration**

Review building/tree grounding close-ups, the full information hierarchy,
tooltip clarity, console legend integration, scroll border illumination, console
material, forest color/count, and terrain readability. Any FAIL returns to the
owning implementation task before recapture.

**Step 4: Benchmark three 1×/5× runs**

Use 20 warm-up and 120 measured frames. Require every average 5× result below
12ms; report p95, worst, and over-budget frames without filtering.

**Step 5: Perform the five-minute fresh-game read**

Start without code context, follow only visible guidance, record every action,
uncertainty, and guess in the final report. Do not turn the honest read into a
PASS assertion; it is product evidence for the next slice.

### Task 9: Final audit, main delivery, and DGX restart

**Files:**
- Modify: `docs/PHASE4F_GROUND_EXPLAIN_REPORT.md`

**Step 1: Audit every numbered requirement**

Build an evidence table for all nine testing requirements, every Definition of
Done item, all requested screenshots, before/after assets, performance values,
and the seven report fields. Missing or indirect evidence is incomplete.

**Step 2: Run fresh final verification on the exact tip**

Repeat full tests, typecheck, build, harness, asset verifiers, browser resource
checks, and Git diff/source guards. Request independent code and visual review;
resolve every blocker.

**Step 3: Commit the evidence-only report update**

Use a Lore commit naming the exact implementation revision measured and any
honest remaining caveat.

**Step 4: Verify and push**

Confirm `origin=https://github.com/hyunlord/feudal-lord-simulator.git`, current
branch, clean scope, remote `main` SHA, and fast-forward ancestry. Push the
feature branch and then exact HEAD to `main`; verify both with `git ls-remote`.

**Step 5: Deploy exact main to DGX**

Fast-forward `/home/hyunlord/work/feudal-lord-simulator`, preserve unrelated
`.omx/`, restart only owned `feudal-sim`, and verify port 3200 HTML plus every
referenced JS/CSS, UI/world manifest, and PNG response including MIME types.
Stop owned ComfyUI/temporary benchmark sessions.

**Step 6: Report**

Return implementation by part, clickable screenshots, UI asset before/after,
performance, test/hash evidence, commit/branch/remote/GitHub/live URL, and the
five-minute honest read.

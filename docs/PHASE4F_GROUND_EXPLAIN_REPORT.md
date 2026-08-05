# Phase 4F — Ground It and Explain It

Phase 4F keeps the Phase 4E economy and deterministic simulation intact while making the world feel grounded and the normal play screen explain the settlement.

## What changed

### Part 1 — Ground contact

- Building shadows now use a warm earth tint, a 0.32-alpha core plus a softer halo, and dimensions derived from each manifest sprite's height.
- Trees use the same two-layer treatment.
- A separate ground pass adds narrow contact darkening before sprites are drawn, so the cue remains visible around each base.

### Part 2 — Objective and blockers

- The right console recess persistently shows `목표: 인구 50명`, current population, and advances quietly to 120 after completion.
- A single status line samples the highest-priority blocker every 60 ticks without mutating `GameState`.
- Water, bread, labour, and full-storage problems use larger, gently pulsing condition-specific glyphs.
- A late QA regression fix replaced an effect-driven guidance-state update with a 60-tick ref snapshot. The original accelerated-play scenario produced four React update-depth warnings; the fixed scenario reached Tick 181 twice with zero console or page errors.

### Part 3 — Build menu

- The nine tools are grouped into 주거, 생산, 저장, and 서비스.
- Korean hover/focus tooltips explain timber cost, purpose, requirements, affordability, and shortfall.
- Selected tools expose a pressed state and `Escape` cancels selection.
- Each group now reserves the full width of its two seals. Runtime center-point testing confirms 9/9 buttons target themselves on desktop; mobile uses a 2×2 group layout with no horizontal overflow.

### Part 4 — Console and regenerated UI assets

- Water and labour overlay controls sit below the ledger inside the right recess; only tooltips and the status line float above the world.
- `scroll_frame.png` restores gold, ultramarine, and vermilion border illumination while preserving its transparent centre and perimeter.
- `wood_console.png` restores three recesses, plank grain, and a raised upper edge.
- A request-free data favicon removes Chromium's otherwise automatic `/favicon.ico` 404, leaving final browser QA free of console and network errors.

### Part 5 — Terrain and foliage

- Tree tint walks the full foliage ramp deterministically by tree hash.
- Forest interiors contain one or two trees; exposed edges thin further so woodland fades into grass.
- Ground-cover, depth ordering, terrain seams, and the existing world asset release remain protected by their source and image contracts.

## Screenshots

| Evidence | Capture |
| --- | --- |
| Full screen: objective and status | [phase4f_full_guidance.png](assets/phase4f_full_guidance.png) |
| Build tooltip | [phase4f_build_tooltip.png](assets/phase4f_build_tooltip.png) |
| Overlay legend inside console | [phase4f_console_overlay_legend.png](assets/phase4f_console_overlay_legend.png) |
| Building contact shadow close-up | [phase4f_building_shadow_closeup.png](assets/phase4f_building_shadow_closeup.png) |
| Tree contact shadow close-up | [phase4f_tree_shadow_closeup.png](assets/phase4f_tree_shadow_closeup.png) |
| 375px mobile layout | [phase4f_mobile_375.png](assets/phase4f_mobile_375.png) |

The 1280×720 Phase 4E/4F image comparison reports matching dimensions and alpha, 61/100 similarity, and a 0.3857 diff ratio. The changed console, guidance, foliage, and grounding dominate the diff: [phase4f_visual_diff_1280x720.png](assets/phase4f_visual_diff_1280x720.png).

## Regenerated UI assets

| Asset | Before | After |
| --- | --- | --- |
| Scroll frame | [phase4f_scroll_frame_before.png](assets/phase4f_scroll_frame_before.png) | [phase4f_scroll_frame_after.png](assets/phase4f_scroll_frame_after.png) |
| Wood console | [phase4f_wood_console_before.png](assets/phase4f_wood_console_before.png) | [phase4f_wood_console_after.png](assets/phase4f_wood_console_after.png) |

The selected candidates and seeds are recorded in [phase4f_ui_generation_manifest.json](asset-evidence/phase4f_ui_generation_manifest.json); palette, alpha, dimensions, candidate membership, and report alignment all pass the active-candidate verifier.

## Performance

The DGX Chromium benchmark used 20 warm-up frames and 120 measured frames for each of three runs.

| Speed | Run averages | Mean | p95 range | Worst observed |
| --- | --- | --- | --- | --- |
| 1× | 11.358, 11.393, 11.372 ms | 11.374 ms | 12.7–14.1 ms | 30.5 ms |
| 5× | 11.399, 11.521, 11.557 ms | 11.492 ms | 13.4–13.7 ms | 19.1 ms |

Every 5× average remains below the 12 ms gate. The mean is 5.26% above the Phase 4E 10.918 ms baseline. Raw evidence: [phase4f_final_performance.json](asset-evidence/phase4f_final_performance.json).

## Verification

| Gate | Result |
| --- | --- |
| Node tests | 383 passed, 0 failed; 12 suites |
| Python tests | 52 passed, 0 failed |
| Typecheck | passed |
| Production build | passed; 85 modules transformed |
| Economy harness | all five metrics passed |
| Determinism | before `4d92c66f9408a603`; after `4d92c66f9408a603` |
| UI asset verifier | passed for all five UI assets; regenerated candidates 3/3 each |
| World asset verifier | passed |
| Browser interaction | tooltip visible; pressed state `true` then `false` after Escape; 9/9 seal hit tests; no 1280px or 375px horizontal overflow |
| Browser health | 0 console errors, page errors, failed requests, and HTTP error responses |

## Honest five-minute read

I started a fresh 1440×900 browser context and followed only what the screen communicated for 5:01.

The objective and water warning immediately gave the session a direction, and the overlay legend made the `1`/`2` shortcuts understandable. The ledger also suggested the food and timber chains. However, the first interaction still required a genre guess: the screen never explicitly says “select a seal, then click the map.” Placement success or rejection is mostly visual, so after trying a well, houses, food buildings, and timber buildings I was often unsure whether the intended building had been placed or why it had not. The water overlay was useful but visually subtle.

The run reached Tick 495 with population 7, timber 195, and the water warning still active; I did not recover the settlement. During that playtest, accelerated time also exposed a React update-depth loop and overlapping build-button hit areas. Those two technical defects were fixed afterward and verified with an explicit bad/fixed runtime toggle. They do not change the product-learning result: the next pass should add a short placement instruction, clear placement success/rejection feedback, and more actionable wording or emphasis for persistent blockers.

## Scope and delivery

- No economy or balance code changed.
- The release code revision measured by the final evidence is `b2253459541fa54725607882a4ced6129486de21`; the final evidence commit adds only this report, captures, and the reusable QA capture script.
- Delivery target: `main` at `https://github.com/hyunlord/feudal-lord-simulator` and DGX `http://100.70.109.50:3200/`.

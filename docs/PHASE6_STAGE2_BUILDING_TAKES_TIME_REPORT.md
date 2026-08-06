# Phase 6 Stage 2: Building Takes Time Report

## 1. What was implemented, by part
Part 1: `placeBuilding` now creates occupied `ConstructionSite` state instead of finished buildings/houses. Sites track `required`, `delivered`, `reserved`, builder ticks, assigned builders, exact stall reason, deterministic ids, and `startedTick`.

Part 2: existing Carter logistics now route to tagged construction-site destinations before normal store balancing, reserve exact source stock, deliver into site `delivered`, and preserve bootstrap treasury timber through the starting house anchor.

Part 3: stall diagnosis distinguishes `awaiting_materials`, `no_material_source`, `no_route`, and `no_builders`, with exact Korean site labels and a clicked site card that keeps separate rows for `부지`, `자재 확보`, `자재 배달`, and `건축 작업`.

Part 4: builders come from the existing labour pool after finished production allocations, are capped at three per site, sorted by site id, and render as stationary builder walkers without entering Carter/distributor stepping.

Part 5: construction progress is deterministic builder ticks plus a 60-wall-tick minimum visibility floor. Procedural site rendering shows plot, foundation, frame, and roof states at the 25/55/85 percent boundaries, with a short presentation-only completion pop/dust effect.

Part 6: right-click cancellation removes only the pointed site, releases in-flight reservations through the existing manual-cancel return path, returns assigned labour, and refunds floor(60%) of delivered materials to the nearest compatible store with the documented timber treasury fallback.

Part 7: the economy harness serializes construction state and now reports four construction health metrics: stall duration, builder starvation, material deadlock, and scripted completion rate.

## 2. Screenshots
- Plot stage, focused: [stage2_plot_focused.jpg](assets/stage2_plot_focused.jpg)
- Foundation stage, focused: [stage2_foundation_focused.jpg](assets/stage2_foundation_focused.jpg)
- Frame stage with visible builders, focused: [stage2_frame_focused.jpg](assets/stage2_frame_focused.jpg)
- Roof stage, focused: [stage2_roof_focused.jpg](assets/stage2_roof_focused.jpg)
- `no_route` stalled site and label: [stage2_no_route.jpg](assets/stage2_no_route.jpg)
- Four-track construction card: [stage2_four_track_card.jpg](assets/stage2_four_track_card.jpg)
- Right-click cancellation after targeted site removal: [stage2_right_click_cancellation.jpg](assets/stage2_right_click_cancellation.jpg)
- 375px focused responsive card: [stage2_responsive_375_focused.jpg](assets/stage2_responsive_375_focused.jpg)
- 768px responsive card: [stage2_responsive_768_card.jpg](assets/stage2_responsive_768_card.jpg)

Raw browser capture evidence: [stage2_precise_stage_captures.json](asset-evidence/stage2_precise_stage_captures.json), [stage2_browser_responsive_verdict.json](asset-evidence/stage2_browser_responsive_verdict.json).

## 3. New determinism hash, with the old one for comparison
Old Stage 1 hash: `4d92c66f9408a603`.

New Stage 2 hash: `5a393f13af3e61be`.

The new hash is expected because construction sites, wall ticks, tagged Carter destinations, builder walkers, and harness construction traces are now part of deterministic state. Two DGX harness runs matched the new hash in [stage2_dgx_typecheck_build_harness.log](asset-evidence/stage2_dgx_typecheck_build_harness.log).

## 4. Harness output including the new construction metrics
DGX `npm run harness` output:

```text
Metric               Value                                 Status
Determinism hash     5a393f13af3e61be == 5a393f13af3e61be  PASS
Food stability       9.5% starving                         PASS
Cargo thrashing      0 cancellations/1200                  PASS
Labour deadlock      0 consecutive ticks                   PASS
Housing oscillation  1 changes/2000                        PASS
Stall duration       152 consecutive ticks                 PASS
Builder starvation   0 consecutive ticks                   PASS
Material deadlock    0 consecutive ticks                   PASS
Completion rate      2/2 scripted sites (100%)             PASS
```

Evidence: [stage2_dgx_typecheck_build_harness.log](asset-evidence/stage2_dgx_typecheck_build_harness.log), [stage2_task10_harness.txt](asset-evidence/stage2_task10_harness.txt), and [stage2_economy_harness_report.json](asset-evidence/stage2_economy_harness_report.json).

## 5. Whether MIN_VISIBLE_TICKS actually holds at 5x
Measured on DGX with speed `5` and `3` builders: `frames=60`, `wallTicks=60`, `simTicks=300`, `elapsedMs=13.676`, completed kind `house`, and `remainingSites=0`.

The result proves the 60-wall-tick floor holds even though simulation substeps advanced to 300 at 5x. Evidence: [stage2_lifecycle_speed5_builders3.json](asset-evidence/stage2_lifecycle_speed5_builders3.json).

## 6. Test output, typecheck/build results, frame time at 5x
DGX `npm test`: `548` tests passed, `0` failed. Evidence: [stage2_dgx_npm_test.log](asset-evidence/stage2_dgx_npm_test.log).

DGX `npm run typecheck`: passed. DGX `npm run build`: passed with Vite production output `dist/assets/index-CIMnXIcl.css` and `dist/assets/index-Cw4-VtsX.js`. Evidence: [stage2_dgx_typecheck_build_harness.log](asset-evidence/stage2_dgx_typecheck_build_harness.log).

DGX ffmpeg-backed asset tests and release verifiers: `22` tests passed, building sprite verification passed, and world asset release verification passed. Evidence: [stage2_dgx_ffmpeg_gate.log](asset-evidence/stage2_dgx_ffmpeg_gate.log).

5x frame-time samples at 1280x720 stayed under the 12 ms gate:

| Sample | 5x average | 5x p95 | 5x worst | Over-budget frames |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4.957 ms | 5.5 ms | 8.2 ms | 0 |
| 2 | 4.914 ms | 5.5 ms | 8.6 ms | 0 |
| 3 | 4.888 ms | 5.5 ms | 8.3 ms | 0 |

Evidence: [stage2_frame_benchmark_1.json](asset-evidence/stage2_frame_benchmark_1.json), [stage2_frame_benchmark_2.json](asset-evidence/stage2_frame_benchmark_2.json), [stage2_frame_benchmark_3.json](asset-evidence/stage2_frame_benchmark_3.json).

## 7. Commit hash, branch, remote-landing confirmation, GitHub URL, dev server URL
Code candidate commit: `6b59f152632d431156b3ab3d4d2e0091aac0f57a`.

Code candidate tree: `8d1df12d9255f771b27f436a93f946ef94292a6e`.

Branch used for implementation: `codex/stage2-building-takes-time`.

Remote: `https://github.com/hyunlord/feudal-lord-simulator.git`.

Candidate remote landing: `git push origin HEAD:main` succeeded and `git ls-remote origin refs/heads/main` returned `6b59f152632d431156b3ab3d4d2e0091aac0f57a` before this report/evidence commit.

GitHub URL: `https://github.com/hyunlord/feudal-lord-simulator`.

DGX dev server URL: `http://100.70.109.50:3200/`.

Final docs/evidence commit: verified in external delivery evidence after commit creation. A commit cannot self-report its own final hash in the file it contains.

## 8. Your honest read, two questions kept separate
Question 1, is waiting for construction plan time or dead time?

It is closer to plan time when a site is connected and the player can watch materials arrive, workers appear, and stage silhouettes change. In isolated QA, I did use 5x to skip waiting after I already knew the state path was correct; that is a signal that the timing can become dead time if the player has no parallel decision to make. The 60-wall-tick floor still did its job: at 5x it prevented the build from disappearing instantly and kept the staged visual event observable.

Question 2, when a site stalled, did the label tell you what to do, or did you still have to reason it out?

`no_route`, `no_material_source`, and `no_builders` were actionable from the label alone: build/connect road, create/supply storage, or free labour. `awaiting_materials` is the weakest actionability because it tells me the materials are coming but not which source/carter is responsible or the ETA. That is honest but less diagnostic than the other labels, and a future improvement should expose source/carter/ETA without collapsing the four-track card into one progress bar.

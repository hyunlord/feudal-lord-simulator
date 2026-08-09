# Phase 13 Report

Status: Part 2 is complete with 6 world +2 UI accepted, 29 world+3 UI preserved, and full hash/evidence plus after-counts recorded; DGX world/UI generation stopped and the owned Comfy session was cleaned. Part 3 completed the required full16 DGX attempt for `builder/farmer/logger/carter x NE/SE/SW/NW`; all generated walkers failed visual review, no generated walker was integrated, and the procedural fallback remains the chosen shipping path. Publication and final browser screenshots remain pending.

Legend:
- `PENDING - do not treat as completion evidence` means the current artifact set does not yet prove the claim.
- Interim evidence uses absolute `/tmp/...` paths.
- Durable repository links stay relative to this checkout.

Source anchors:
- Plan: [docs/plans/2026-08-09-phase13-full-colour-village.md](plans/2026-08-09-phase13-full-colour-village.md)
- Design system: [DESIGN.md](../DESIGN.md)
- Review objections: `/tmp/feudal-phase13/review-objections.md`
- Part 4 debug journal: `/tmp/feudal-phase13/debug-journal.md`

## 1. Part Status

| Part | Status | Evidence | Skip / pending note |
| --- | --- | --- | --- |
| Part 1 | Implemented and pushed | `7ca3b55d2233d81c6e095854e796d0626f9b486e` | Generated art now bypasses palette quantisation, but the after-count artifact bundle is still `PENDING`. |
| Part 2 | Complete with accepted release evidence | `/tmp/feudal-phase13/part2-after-colours.json`, `/tmp/feudal-phase13/world-release-evidence/`, `/tmp/feudal-phase13/ui-release-evidence/`, `/tmp/feudal-phase13/part2-evidence-contact-sheet.png` | 6 world +2 UI are accepted, 29 world+3 UI are preserved, and full hash/evidence plus after-counts are recorded; DGX world/UI generation stopped and the owned Comfy session was cleaned. |
| Part 3 | Full16 DGX attempt complete; fallback retained | `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.png`, `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.json`, `docs/asset-evidence/phase13/walker_generation_full16_visual_verdict.json` | Exact 16 `builder/farmer/logger/carter x NE/SE/SW/NW` raw jobs completed and prepared successfully, but every visual verdict is `FAIL`; integration decision is `none`, so the procedural fallback is the honest shipping path. |
| Part 4 | Implemented and pushed | `0958cf9ce2971279b75d5d914d28dbe423efeda5` | Profile evidence is verified; the fixed frame-work tail is still comfortably under 20 ms, but the improvement is modest. |
| Part 5 | Implemented and pushed | `d1ab7db2c0278d817ff217cf53d6559c08bcab64` | Camera controls landed on the tracked branch. |
| Part 6 | Implemented and pushed | `c50475084665308a9af8abf8589e560e0e05c627` | Construction visibility and layering landed on the tracked branch. |
| Part 7 | Implemented and pushed | `ca1f941945ecada1a9d4bc06e1d8a2a9391b8e07` | Desktop build-menu width fix landed on the tracked branch; the second-round 901-936 px objection is retained verbatim below. |
| Publication | Pending | `origin/codex/phase13-full-colour pre-Part3 -> 881d2f8` | Final publication proof and final browser screenshot proof have not been captured yet. |

## 2. Colour Counts

Before counts are verified in `/tmp/feudal-phase13/before-color-counts.json`. They show the old ceiling clearly:

| Category | Sample asset | Before unique visible RGB | After unique visible RGB |
| --- | --- | --- | --- |
| Terrain | `forest_floor.png` | 6 | `PENDING` |
| Terrain | `grass.png` | 6 | `PENDING` |
| Terrain | `packed_earth_road.png` | 6 | `PENDING` |
| Terrain | `rock.png` | 8 | `PENDING` |
| Terrain | `water.png` | 4 | `PENDING` |
| Foliage | `grass_tuft.png` | 5 | `PENDING` |
| Foliage | `shrub_a.png` | 7 | `PENDING` |
| Foliage | `tree_oak_large.png` | 10 | `PENDING` |
| Foliage | `tree_pine_tall.png` | 11 | `PENDING` |
| Buildings | `stone_wall_segment.png` | 13 | `PENDING` |
| Buildings | `well.png` | 14 | `PENDING` |
| Buildings | `quarry.png` | 17 | `PENDING` |
| Buildings | `storehouse.png` | 19 | `PENDING` |
| Buildings | `keep.png` | 22 | `PENDING` |
| Buildings | `house_l0.png` | 31 | `PENDING` |
| UI | `scroll_frame.png` | 7 | `PENDING` |
| UI | `parchment_texture.png` | 19 | `PENDING` |
| UI | `wood_console.png` | 29 | `PENDING` |

After counts are recorded in `/tmp/feudal-phase13/part2-after-colours.json`. The accepted generated world assets now have the following visible RGB counts:
- `forest_floor`: 60,626
- `rock`: 48,978
- `church`: 2,924
- `mill`: 2,004
- `house_l1`: 1,622
- `logging_camp`: 573

The non-accepted rows above remain preserved-existing assets. UI accepted-state evidence is tracked separately in `/tmp/feudal-phase13/ui-release-evidence/uiAssetManifest.json`: `scroll_frame` and `wood_console` are accepted-generated, while `parchment_texture` remains preserved-existing.

## 3. Part 4 Profile

The verified Part 4 profiles are stored under `/tmp/feudal-phase13/part4-profile/`.

| Metric | Before | After |
| --- | --- | --- |
| Wall clock | 30.001 s | 30.001 s |
| Tick delta | 601 | 603 |
| Population | 87 | 87 |
| Buildings | 11 | 11 |
| Walkers | 4 | 4 |
| Frame-work count | 301 | 299 |
| p50 | 3.5 ms | 3.6 ms |
| p75 | 3.8 ms | 3.8 ms |
| p90 | 4.0 ms | 4.1 ms |
| p95 | 4.2 ms | 4.4 ms |
| p99 | 6.0 ms | 4.8 ms |
| max | 6.2 ms | 6.4 ms |
| Over 20 ms | 0 | 0 |

Named cause:
- Root cause: world-space snap before transform in `drawWalkers.ts`.
- Why it mattered: at zoom 2, one world-pixel rounding step becomes a two-device-pixel jump.
- Result: the fix moved snapping after the full canvas transform and preserved fractional world coordinates.

Important reading:
- The profile target was about visible jerkiness, not reducing callback cost at all costs.
- The post-change tail is still below the 20 ms threshold, but the numbers do not show a dramatic callback-time drop.

## 4. Walker Generation

Current verified state:
- The owned DGX ComfyUI session attempted the exact full16 matrix: `builder`, `farmer`, `logger`, and `carter` across `NE`, `SE`, `SW`, and `NW`.
- `/tmp/feudal-phase13/part3-walker-attempt-full16/full16-manifest.json` records 16 raw jobs and 16 prepared jobs.
- Raw validation: `/tmp/feudal-phase13/part3-walker-attempt-full16/raw-validation.json` records 16 validated `1024x1024` RGB PNGs.
- Prepared validation: `/tmp/feudal-phase13/part3-walker-attempt-full16/prepared-validation.json` records 16 validated `32x48` RGBA PNGs with alpha extrema `[0, 255]`.
- Settings and receipts:
  - checkpoint: `sd_xl_base_1.0.safetensors`
  - raw size: `1024x1024`
  - prepared size: `32x48` RGBA
  - background policy: `alpha-or-cyan-key`
  - candidate per role/direction: `1`
  - receipts: `/tmp/feudal-phase13/part3-walker-attempt-full16/receipts/`
  - SHA256 receipts: `/tmp/feudal-phase13/part3-walker-attempt-full16/artifact-sha256.txt` and `/tmp/feudal-phase13/part3-walker-attempt-full16/relative-sha256.txt`
  - cleanup proof: `/tmp/feudal-phase13/part3-walker-attempt-full16/receipts/final-cleanup-proof.txt`

What worked:
- The generation pipeline produced and validated all 16 role/direction artifacts.
- Durable repository evidence is present:
  - `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.png`
  - `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.json`
  - `docs/asset-evidence/phase13/walker_generation_full16_visual_verdict.json`

What did not work:
- The independent visual verdict marks every role as `FAIL`.
- The verdict records `generatedWalkerWired: false`, `integrationDecision: none`, and `fallbackDecision: procedural fallback preserved`.
- The outputs still do not form a coherent, isolated, direction-stable 32x48 game cycle.
- Because of that, the report keeps the procedural fallback as the honest current shipping path.

Contact sheet:
- Durable PNG: `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.png`
- Durable JSON: `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.json`
- Visual verdict: `docs/asset-evidence/phase13/walker_generation_full16_visual_verdict.json`
- Verdict result: all visual review rows failed; integrate none.

## 5. Autonomous Decisions

- Removed generated-art palette quantisation because the design system says generated PNG interiors keep full colour depth and the palette only governs code, DOM surfaces, and procedural canvas fallback.
- Kept the ink outline rule after generation because it preserves family resemblance without remapping interior RGB values.
- Profiled Part 4 before tuning anything else because the symptom was presentation-side and the interpolation path already existed.
- Chose the world-space snap fix only after the profile named the cause.
- Selected the procedural humanoid fallback for walkers because the full16 generated attempt failed the identity/isolation/direction-stability requirement even though all 16 jobs technically completed and validated.
- Treated the unrelated `origin/main` mutation `ce650c8` as an autonomous incident, reverted it with `4faf46eee54b4c1abafae59ab0e7468584454511`, and left the Phase 13 branch untouched.
- Stopped short of claiming final publication or active DGX world/UI runtime proof because those durable proofs are not yet in the artifact set.

## 6. Review Objections

Part 1 final spec objection, quoted verbatim from `/tmp/feudal-phase13/review-objections.md`:

> `copyOrProcessWorldSprite()` reads the generated PNG and, if its dimensions already match `FOLIAGE_SPECS[key]`, writes it directly to release output without calling `processWorldSprite()`.
>
> This violates the Part1 constraint that generated sprites retain full RGB but still receive the final 1px ink silhouette after generation. The direct-copy branch can publish exact-size generated foliage without the normalized alpha / ink outline pass.

Note:
- Part 2 later fixes this, but the objection stays here verbatim because it was part of the review history.

Part 2 final code-review objections, quoted verbatim from `/tmp/feudal-phase13/review-objections.md`, are fixed but retained as review history:

> [HIGH] UI `before` evidence is overwritten by accepted release output, and final assets are not bound to selected candidate hashes
>
> [HIGH] Runtime world asset manifest is stale relative to the public release manifest

Note:
- Later Part 2 implementation fixed the before-evidence/hash binding and runtime-manifest drift, but the objections remain retained because they shaped the final evidence gates.

Part 7 final code-review objection, quoted verbatim from `/tmp/feudal-phase13/review-objections.md`:

> [HIGH] Desktop responsive boundary clips stone-town build controls between 901px and 936px.  
> File: `src/styles/global.css:627`, `src/styles/global.css:632`, `src/styles/global.css:701`, `src/styles/global.css:714`, `src/styles/global.css:715`, `src/styles/global.css:747`  
> Issue: Just above the `max-width: 900px` compact media query, the base console still reserves `140px` minimap and `300px` ledger tracks. At 920px viewport the middle build track is only `399.04px` before `.build-seals` padding/border, while the stone-town production group needs `414px` (`6 * 64px + 5 * 6px`). Because `.build-group` is `flex: 0 0 auto` and `.build-seals` has `overflow-x: hidden`, the production group is clipped instead of remaining accessible. The new proof only covers 1280px, so it does not catch this responsive boundary.  
> Fix: Move the compact layout breakpoint up to cover this range, reduce/reclaim side-track/padding width there, or allow production seals to wrap safely in the base layout. Add browser proof at 901px or 920px verifying no horizontal/vertical scroll or clipping.

Note:
- Later implementation fixed the 920 px path, but the objection remains quoted exactly because the report is preserving review history.

Part 3 round2 final review objections are fixed and retained exactly in `/tmp/feudal-phase13/review-objections.md`:

> [HIGH] contract must have exactly two gait frames 0|1, not four; update stride rendering and observable tests.
>
> [HIGH] repair brittle Part6 deferred-walker ordering test so it detects the new procedural walker via stable tagged/draw evidence and still proves walkers after buildings.

## 7. Screenshot Inventory

Current verified screenshots and image artifacts in `/tmp/feudal-phase13/`:

- `/tmp/feudal-phase13/part4-profile/before-town-1.png`
- `/tmp/feudal-phase13/part4-profile/after-town-1.png`
- `/tmp/feudal-phase13/part4-profile/baseline-1.png`
- `/tmp/feudal-phase13/part4-profile/baseline-2.png`
- `/tmp/feudal-phase13/part4-profile/contended-town-1.png`
- `/tmp/feudal-phase13/part2-ui-preview/candidate_31_seed_71310411.png`
- `/tmp/feudal-phase13/part2-terrain-final/forest_floor.png`
- `/tmp/feudal-phase13/part2-terrain-final/forest_floor_2x2.png`
- `/tmp/feudal-phase13/part2-terrain-final/grass.png`
- `/tmp/feudal-phase13/part2-terrain-final/grass_2x2.png`
- `/tmp/feudal-phase13/part2-terrain-final/packed_earth_road.png`
- `/tmp/feudal-phase13/part2-terrain-final/packed_earth_road_2x2.png`
- `/tmp/feudal-phase13/part2-terrain-final/rock.png`
- `/tmp/feudal-phase13/part2-terrain-final/rock_2x2.png`
- `/tmp/feudal-phase13/part2-terrain-final/water.png`
- `/tmp/feudal-phase13/part2-terrain-final/water_2x2.png`

Required screenshot set from the plan:
- Terrain close up: `PENDING`
- Forest: `PENDING`
- Walker close up: `PENDING`
- Building at each construction stage: `PENDING`
- Full screen: `PENDING`

The inventory above is only the current artifact set. It is not the final required publication bundle.

## 8. Test / Profile / Hash Evidence

Already verified in the baseline bundle under `/tmp/feudal-phase13/baseline/`:
- `npm test`: `981/981` passing
- `npm run typecheck`: passing
- `npm run build`: 191 modules transformed and build passing
- `npm run harness -- --workers=8`: all fourteen canonical metrics passing

Part 4 supporting evidence:
- Baseline profile artifact: `/tmp/feudal-phase13/part4-profile/before-town-summary.json`
- After profile artifact: `/tmp/feudal-phase13/part4-profile/after-town-summary.json`
- After raw profile: `/tmp/feudal-phase13/part4-profile/after-town.json`
- After screenshot: `/tmp/feudal-phase13/part4-profile/after-town-1.png`

Determinism and hash evidence recorded in the debug journal:
- Determinism hash: `b82a6e26498392c5`
- Stage 3 hash: `2338ddb7b73d987b`

Current limits:
- DGX world/UI runtime activation proof is `PENDING`.
- Final publication proof is `PENDING`.
- Final browser screenshot proof is `PENDING`.
- Part 3 full16 generated walker integration is intentionally `none` because all visual verdicts failed.

## 9. Commits and Publication

Already pushed Phase 13 commits:
- Part 1: `7ca3b55d2233d81c6e095854e796d0626f9b486e`
- Part 4: `0958cf9ce2971279b75d5d914d28dbe423efeda5`
- Part 5: `d1ab7db2c0278d817ff217cf53d6559c08bcab64`
- Part 6: `c50475084665308a9af8abf8589e560e0e05c627`
- Part 7: `ca1f941945ecada1a9d4bc06e1d8a2a9391b8e07`

Branch state at report time:
- `HEAD -> codex/phase13-full-colour`
- `origin/codex/phase13-full-colour pre-Part3 -> 881d2f8`

Incident recovery:
- `origin/main` received an unrelated mutation `ce650c8`, then returned to the prior tree via revert `4faf46eee54b4c1abafae59ab0e7468584454511`.
- The Phase 13 branch was untouched by that recovery.

Publication:
- `PENDING - do not treat as completion evidence`
- No durable publication SHA, deployment proof, or final browser screenshot proof is captured in the current artifact set.

## 10. Honest Assessment

- The palette removal is directionally correct. The baseline counts prove the old assets were far too flat: terrain at 4-8 unique RGB values, foliage at 5-12, buildings at 13-32, and UI at 7-29. The accepted Part 2 world assets now have verified post-change colour counts in `/tmp/feudal-phase13/part2-after-colours.json`.
- This report can claim Part 2 accepted world/UI evidence completion and Part 3 exact full16 DGX attempt completion. It cannot claim final publication, active DGX world/UI runtime proof, final browser screenshots, or any generated walker integration.
- The Part 4 fix addressed the real motion defect, but the frame-work distribution did not collapse dramatically. The visible jerk cause is fixed; the callback-cost numbers remain small but similar in magnitude.
- Walker generation is the least convincing part of the current evidence. The exact 16 role/direction DGX path completed technically, produced 16 raw `1024x1024` PNGs and 16 prepared `32x48` RGBA PNGs, but every visual verdict failed. The procedural fallback is the current honest answer.
- The strongest verified win so far is that the work is now evidence-aligned instead of assumption-driven.

## 11. DGX Safety and Cleanup

- Keep image generation and tests sequential.
- Keep ComfyUI batch size at 1 and unload models between groups.
- Keep harness concurrency at 8 workers maximum.
- Preserve `/tmp/feudal-phase13/debug-journal.md` until the durable report is complete; do not delete it.
- Clean up temporary artifacts only after their evidence has been transferred into durable files.
- Leave `.omo/` and `.omx/` alone.
- Do not reuse foreign DGX sessions or servers.

# Phase 13 Report

Status: PARTIAL overall. The deployed merge is `cdb831a4546658a439d1aed96733e4021b04c741`, the public release passed fresh browser QA, and Parts 1, 4-7 are verified. Part 2 asset regeneration is honest partial work under the failure-workaround policy: 6 world assets and 2 UI assets were accepted-generated, 29 world assets and 3 UI assets were preserved-existing, all 12 foliage attempts failed visual gate, and the procedural fallback remains the shipping walker path.

Published product capture head: `cdb831a4546658a439d1aed96733e4021b04c741`.

Source anchors:
- Plan: [docs/plans/2026-08-09-phase13-full-colour-village.md](plans/2026-08-09-phase13-full-colour-village.md)
- Design system: [DESIGN.md](../DESIGN.md)
- Review objections: `/tmp/feudal-phase13/review-objections.md`
- Part 4 debug journal: `/tmp/feudal-phase13/debug-journal.md`

## 1. Part Status

| Part | Status | Evidence | Note |
| --- | --- | --- | --- |
| Part 1 | Implemented and pushed | `7ca3b55d2233d81c6e095854e796d0626f9b486e` | Removed the generated-art quantisation constraint and kept only the 1px silhouette outline. |
| Part 2 | PARTIAL with accepted release evidence | `/tmp/feudal-phase13/part2-after-colours.json`, `/tmp/feudal-phase13/world-release-evidence/`, `/tmp/feudal-phase13/ui-release-evidence/` | Asset regeneration is partial under the failure-workaround policy: 6 world + 2 UI accepted, 29 world + 3 UI preserved. All 12 foliage attempts failed the visual gate and were preserved. |
| Part 3 | Full16 DGX attempt complete; fallback retained | `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.png`, `docs/asset-evidence/phase13/walker_generation_full16_contact_sheet.json`, `docs/asset-evidence/phase13/walker_generation_full16_visual_verdict.json` | All 16 generated walkers failed the integration visual gate; the procedural humanoid fallback ships. Cleanup proof exists, but I did not find a standalone unload receipt artifact. |
| Part 4 | Implemented and pushed | `0958cf9ce2971279b75d5d914d28dbe423efeda5` | World-space snap moved after transform in `drawWalkers.ts`. The final browser profile is below. |
| Part 5 | Implemented and pushed | `d1ab7db2c0278d817ff217cf53d6559c08bcab64` | Camera drag, momentum, edge pan, and cursor zoom are on the tracked branch. |
| Part 6 | Implemented and pushed | `c50475084665308a9af8b8589e560e0e05c627` | Construction stages and walker layering landed on the tracked branch. |
| Part 7 | Implemented and pushed | `ca1f941945ecada1a9d4bc06e1d8a2a9391b8e07` | Responsive proof passes at 1280/920/768/375 with no clipping. |
| Publication | Complete | `cdb831a4546658a439d1aed96733e4021b04c741` | GitHub Pages deployment is live at `https://hyunlord.github.io/feudal-lord-simulator/`. |

## 2. Colour Counts

Before counts come from `/tmp/feudal-phase13/before-color-counts.json`. World after counts come from `/tmp/feudal-phase13/part2-after-colours.json`. UI after counts come from the released PNGs in `public/assets/ui/` and match the current files in this worktree.

Part 2 summary:
- Accepted world assets: `church`, `forest_floor`, `house_l1`, `logging_camp`, `mill`, `rock`
- Preserved world assets: 29
- Accepted UI assets: `scroll_frame`, `wood_console`
- Preserved UI assets: `seal_slot`, `parchment_texture`, `illumination_corner`
- Generated-art interiors keep full RGB now; the only post-pass is the 1px silhouette outline. The quality gap is still generation, not quantisation.

| Category | Asset | Before unique visible RGB | After unique visible RGB | Note |
| --- | --- | --- | --- | --- |
| Terrain | `forest_floor.png` | 6 | 60626 | accepted-generated |
| Terrain | `grass.png` | 6 | 6 | preserved-existing |
| Terrain | `packed_earth_road.png` | 6 | 6 | preserved-existing |
| Terrain | `rock.png` | 8 | 48978 | accepted-generated |
| Terrain | `water.png` | 4 | 4 | preserved-existing |
| Foliage | `grass_tuft.png` | 5 | 5 | preserved-existing |
| Foliage | `shrub_a.png` | 7 | 7 | preserved-existing |
| Foliage | `tree_oak_large.png` | 10 | 10 | preserved-existing |
| Foliage | `tree_pine_tall.png` | 11 | 11 | preserved-existing |
| Buildings | `church.png` | 24 | 2924 | accepted-generated |
| Buildings | `house_l1.png` | 24 | 1622 | accepted-generated |
| Buildings | `logging_camp.png` | 28 | 573 | accepted-generated |
| Buildings | `mill.png` | 29 | 2004 | accepted-generated |
| Buildings | `keep.png` | 22 | 22 | preserved-existing |
| UI | `scroll_frame.png` | 7 | 50476 | accepted-generated |
| UI | `wood_console.png` | 29 | 59547 | accepted-generated |
| UI | `seal_slot.png` | 16 | 16 | preserved-existing |
| UI | `parchment_texture.png` | 19 | 19 | preserved-existing |
| UI | `illumination_corner.png` | 19 | 19 | preserved-existing |

Notes:
- The remaining foliage rows in `/tmp/feudal-phase13/before-color-counts.json` stay equal to their before counts because every foliage attempt failed the visual gate and was preserved.
- The UI after counts are now real current-file counts, not placeholders.

## 3. Part 4 Profile

The final browser QA bundle is `docs/asset-evidence/phase13/final/browser_qa.json`.

| Metric | Value |
| --- | --- |
| Browser QA verdict | PASS |
| Screenshots | 12 exact captures |
| Responsive proof | PASS at 1280 / 920 / 768 / 375 |
| Clipping | none |
| Construction | 0 / 240, 125 / 240, 188 / 240, complete |
| Walker motion | moved and centered |
| Frame window | 30 s actual browser run at 1x |
| Frame p50 | 3.1 ms |
| Frame p95 | 3.7 ms |
| Frame p99 | 5.3 ms |
| Frame max | 6.2 ms |
| Over 20 ms | 0 |
| Errors | none |

Walker detail:
- `walker.kind` is `carter`
- Start position: `(48.88, 41)`
- End position: `(47, 39.24)`
- Focus target: tile `(47, 39)`
- Center offset: `0.22 px`
- The capture is centered on the walker and the walker moved during the proof run.

Construction detail:
- `construction-lte25` records `0/240`
- `construction-around55` records `125/240`
- `construction-around85` records `188/240`
- `construction-complete` records a completed house at tile `(45, 40)`
- All construction states and the completed building share the ID `construction-site-000001`

## 4. Walker Generation

Current verified state:
- The owned DGX ComfyUI session attempted the exact full16 matrix: `builder`, `farmer`, `logger`, and `carter` across `NE`, `SE`, `SW`, and `NW`.
- `/tmp/feudal-phase13/part3-walker-attempt-full16/full16-manifest.json` records 16 raw jobs and 16 prepared jobs.
- Raw validation records 16 validated `1024x1024` RGB PNGs.
- Prepared validation records 16 validated `32x48` RGBA PNGs with alpha extrema `[0, 255]`.
- The generation pipeline completed, but the visual gate rejected every generated walker candidate.
- The procedural humanoid fallback is the shipping path and is allowed by the attachment.

What worked:
- The generation pipeline produced and validated all 16 role/direction artifacts.
- Durable repository evidence is present:
  - [walker_generation_full16_contact_sheet.png](asset-evidence/phase13/walker_generation_full16_contact_sheet.png)
  - [walker_generation_full16_contact_sheet.json](asset-evidence/phase13/walker_generation_full16_contact_sheet.json)
  - [walker_generation_full16_visual_verdict.json](asset-evidence/phase13/walker_generation_full16_visual_verdict.json)

What did not work:
- The independent visual verdict marks every role as `FAIL`.
- The verdict records `generatedWalkerWired: false`, `integrationDecision: none`, and `fallbackDecision: procedural fallback preserved`.
- The outputs still do not form a coherent, isolated, direction-stable `32x48` game cycle.
- Cleanup proof exists in `/tmp/feudal-phase13/part3-walker-attempt-full16/receipts/final-cleanup-proof.txt`.
- A standalone unload receipt artifact was not found.

Walker motion proof:
- `docs/asset-evidence/phase13/final/browser_qa.json` records `walker.moved=true`, the stable carter ID, start/end positions, and the movement snapshot.
- `walker.focus` and `walker.capture` record the actual camera target, center offset, and screenshot used to isolate the moving walker.
- Durable screenshot: [procedural-walker-close-up.png](asset-evidence/phase13/final/procedural-walker-close-up.png)

## 5. Autonomous Decisions

- Removed generated-art palette quantisation because the design system says generated PNG interiors keep full colour depth and the palette only governs code, DOM surfaces, and procedural canvas fallback.
- Kept the ink outline rule after generation because it preserves family resemblance without remapping interior RGB values.
- Selected the accepted world assets and UI assets by visual gate, then preserved the rest byte-for-byte to keep the release auditable.
- Chose the procedural humanoid fallback for walkers because the full16 generated attempt failed the identity, isolation, and direction-stability requirement.
- Treated the fixed walker profile as presentation-only work and verified the live browser trace instead of relying on synthetic timing alone.
- Kept the DGX cleanup proof separate from the report so the artifact set stays auditable.

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
- Later implementation fixed the 920 px path, but the objection remains quoted exactly because the report preserves review history.

Part 3 round2 final review objections, quoted verbatim from `/tmp/feudal-phase13/review-objections.md`, are fixed and retained:

> [HIGH] contract must have exactly two gait frames 0|1, not four; update stride rendering and observable tests.
>
> [HIGH] repair brittle Part6 deferred-walker ordering test so it detects the new procedural walker via stable tagged/draw evidence and still proves walkers after buildings.

Responsive round2 spec note:
- The `5-column` objection is rejected because `DESIGN.md` explicitly mandates a compact four-column build-seal matrix.
- The final responsive proof at 1280/920/768/375 keeps the intended four-column layout within the console and shows no overflow at the checked breakpoints.
- On the narrow layout, the console compresses to the intended three-row mobile arrangement described in `DESIGN.md`.

## 7. Screenshot Inventory

Current verified screenshots and image artifacts in `docs/asset-evidence/phase13/final/`:

| Screenshot | SHA256 | Note |
| --- | --- | --- |
| `opening-1280x720.png` | `a165312cf45de49e6dad3f002a67075997efcb039e7ad300720bc45d9037261e` | Fresh Hamlet/default state capture at 1280x720; no clipping. |
| `responsive-920x720.png` | `20432c24fe1d469324f8f28cae8397d2f84d8575672f3ae0dfe03b4ff760389d` | Responsive default-state capture at 920x720; no clipping. |
| `responsive-768x1024.png` | `eb82102e7e641f080b87e366a7de18e15dceb15b0f275328711c17f184cf3db4` | Responsive default-state capture at 768x1024; no clipping. |
| `responsive-375x812.png` | `dbf906c6088ffa439efa390a9411550edc8e908374fe92c227b204b4326334f7` | Responsive default-state capture at 375x812; no clipping. |
| `terrain-close-up-high-zoom.png` | `9c5507fa8aa9e587228c5fad7dc22b484ff824055eea7430cbe7f31ca8ae293e` | Terrain close-up proof. |
| `forest-scene.png` | `1a340e947b4d65a82716801d51e087bbf8a33fdab0bcbf1a582616476e2b6bf0` | Forest scene proof. |
| `procedural-walker-close-up.png` | `7a3f798d1b31e6880dc6cf65dee0622c6fd8aadb48fbfd6583b8a66bcb8a0fbb` | Walker close-up proof. |
| `construction-lte25.png` | `be7c8afd20516c3dfc954fb3932322638f5c66130363180c43aa1bd9c87d2604` | Construction stage at 0/240. |
| `construction-around55.png` | `6f999285ea3304d02309ae9a8f0886a354b4516b3340ba90571f5de33653a662` | Construction stage at 125/240. |
| `construction-around85.png` | `40a94896d75da55b7c5594f20c76a949b44f21df82c796b42b6ebae765a244f5` | Construction stage at 188/240. |
| `construction-complete.png` | `ac895d23a1808401bbba177da1f5e0ab5660f896242cfec87a020a1b76b24cbb` | Construction complete proof. |
| `frame-profile-1x-end.png` | `cb6e932f5cc48b88019d7eaffdcddbcca3ba1c1fb3e06e82c8fa662d77a5f140` | End-of-run frame profile proof. |

Final browser QA verdict:
- PASS at 1280 / 920 / 768 / 375.
- Construction evidence is synchronized at `0/240`, `125/240`, `188/240`, and complete on the same site.
- The walker close-up and movement evidence are captured in the durable JSON and PNG bundle above.

## 8. Publication and Live Resources

Deployment proof:
- workflow_dispatch run: `31313422735`
- build job: `93245507172`
- deploy job: `93246078375`
- deployment: `5818784532`
- deployment status: `16574872928`
- deployed SHA: `cdb831a4546658a439d1aed96733e4021b04c741`
- public URL: `https://hyunlord.github.io/feudal-lord-simulator/`

Public asset hashes from `docs/asset-evidence/phase13/final/browser_qa.json`:

| Type | URL | SHA256 |
| --- | --- | --- |
| CSS | `https://hyunlord.github.io/feudal-lord-simulator/assets/index-DLgGTr4s.css` | `487ca0c510df8ef21198b24fca09004c90c4702b53cdd73ec853ef5a0db794fb` |
| JS | `https://hyunlord.github.io/feudal-lord-simulator/assets/index-DatgZ4j-.js` | `ad3185f843abf2066a475b63e6ce74a1a9f9efe8c5af0e21d989af8ba62f1bb1` |

## 9. Test and Verification Evidence

Final verification set:

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | `1005/1005` passing | `/tmp/feudal-phase13/final-postpublish/npm-test-final.log` |
| `npm run typecheck` | PASS | `/tmp/feudal-phase13/final-postpublish/typecheck.log` |
| Pages-base build | PASS, 191 modules transformed | `/tmp/feudal-phase13/final-postpublish/build.log` |
| `npm run harness -- --workers=8` | PASS, all rows PASS | `/tmp/feudal-phase13/final-postpublish/harness-workers8.log` |
| World asset release verification | PASS | `/tmp/feudal-phase13/final-postpublish/verify-world-assets.log` |
| UI asset release verification | PASS | `/tmp/feudal-phase13/final-postpublish/verify-ui-assets.log` |
| Python UI generator tests | `35/35` passing | `/tmp/feudal-phase13/final-postpublish/test-generate-ui-assets.log` |
| Final browser QA | PASS | `docs/asset-evidence/phase13/final/browser_qa.json` |

Frame and hash evidence:
- Frame profile: p50 3.1 ms, p95 3.7 ms, p99 5.3 ms, max 6.2 ms, over 20 ms = 0, average 3.1956488583834117 ms.
- Determinism hash: `b82a6e26498392c5`
- Stage 2 hash: `5a393f13af3e61be`
- Stage 3 hash: `2338ddb7b73d987b`

## 10. Commits and Publication

Phase 13 commit list:
- Part 1: `7ca3b55d2233d81c6e095854e796d0626f9b486e`
- Part 2 assets: `d3bb6a5e0c23f9ece4bb5c6bea52529fa2ccacf8`
- Part 2 code: `881d2f8419bccccfe5d71c1177c996971e0125ee`
- Part 3: `dfb081303c3055b2d193b0986963e15fed110a3a`
- Part 4: `0958cf9ce2971279b75d5d914d28dbe423efeda5`
- Part 5: `d1ab7db2c0278d817ff217cf53d6559c08bcab64`
- Part 6: `c50475084665308a9af8b8589e560e0e05c627`
- Part 7: `ca1f941945ecada1a9d4bc06e1d8a2a9391b8e07`
- Responsive and accessibility follow-up: `1860af5594250f2ad6459d1a84d1e4e0950746de`
- CI Chrome path fix: `33c75efd9b2c152dbe13efc1549c31e45df15407`
- Final browser QA tooling: `8a1339ff7cc3bd4ecd99375b624cbdb68a828f6a`
- Cleanup race fix: `fdfb5ebc4b56a52888af67f84107252d65e848f4`
- Deployed merge: `cdb831a4546658a439d1aed96733e4021b04c741`

Branch and release state:
- The deployed merge is the final public state.
- Publication proof is captured by the workflow run, build job, deploy job, deployment, and deployment status above.

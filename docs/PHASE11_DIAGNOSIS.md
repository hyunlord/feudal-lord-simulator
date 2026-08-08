# Phase 11 Published Render Diagnosis

## Scope and evidence

This diagnosis was completed before any renderer or UI fix. The observed build was the published GitHub Pages site at <https://hyunlord.github.io/feudal-lord-simulator/> after diagnostic commit `16eb1c4aee02dece62c76be26c19c4fecc70d1e7` deployed successfully. A fresh, isolated, headed Chrome context was used with service workers blocked.

Raw evidence is retained outside the repository:

- `/tmp/feudal-phase11/published-diagnosis.json`
- `/tmp/feudal-phase11/published-opening.png`
- `/tmp/feudal-phase11/published-trace.zip`

The capture began at `2026-08-08T17:55:30.912Z`. Navigation returned HTTP 200 and `text/html`. There were 35 console resource errors, no page exceptions, and no request-level connection failures.

## Root causes

### 1. Every world sprite URL escapes the GitHub Pages repository base

`servedUrl()` in `src/render/worldAssets.ts` strips `public/` and prefixes `/`. The published application lives under `/feudal-lord-simulator/`, but every world image is therefore requested from the site root, for example:

```text
requested: https://hyunlord.github.io/assets/foliage/tree_oak_small.png
required:  https://hyunlord.github.io/feudal-lord-simulator/assets/foliage/tree_oak_small.png
```

All 35 world image requests returned HTTP 404 with `text/html`. The loader consequently reported every manifest entry as `missing`. Actual tree draw attempts used valid sprite keys but returned `false` with reason `image_missing`, so the renderer correctly fell back to procedural shapes. This is the primary reason the authored sprites appeared not to render.

### 2. Onboarding paints 1,901 opaque target diamonds

The starting logging-camp guidance asks `buildableForestAdjacentOrigins()` for every valid origin in the 64×64 world. The fresh default state produced 1,901 origins. `drawOnboardingGuidanceOverlay()` fills every one with 72%-alpha parchment, then applies gold and ink strokes.

This pass is independent of the normal terrain overlay selector, whose startup value is `none`. The repeated opaque fill covers most of the visible map and resembles a pale debug grid. It explains the washed-out terrain and visual noise seen together with the sprite fallback.

### Separate visible defects

The published controls contain direct English literals, including `Royal Demesne`, `Royal Ledger`, resource names, and overlay labels. The bottom ledger also uses fixed heights with `overflow: hidden`, and its content is visibly clipped. These defects reduce readability but do not cause sprite loading to fail.

## Required six-point runtime investigation

### Browser console and network

- 35 world image responses: HTTP 404, MIME `text/html`.
- 1 unrelated seal image response: HTTP 200, MIME `image/png`.
- 35 console `Failed to load resource` errors.
- No `pageerror` events and no failed network connections.

### Loader status for every manifest key

| Key | Category | Loader status | Resolved URL |
| --- | --- | --- | --- |
| `house_l0` | building | `missing` | `/assets/buildings/house_l0.png` |
| `house_l1` | building | `missing` | `/assets/buildings/house_l1.png` |
| `house_l2` | building | `missing` | `/assets/buildings/house_l2.png` |
| `house_l3` | building | `missing` | `/assets/buildings/house_l3.png` |
| `mill` | building | `missing` | `/assets/buildings/mill.png` |
| `barn` | building | `missing` | `/assets/buildings/barn.png` |
| `well` | building | `missing` | `/assets/buildings/well.png` |
| `storehouse` | building | `missing` | `/assets/buildings/storehouse.png` |
| `wheat_farm` | building | `missing` | `/assets/buildings/wheat_farm.png` |
| `logging_camp` | building | `missing` | `/assets/buildings/logging_camp.png` |
| `sawmill` | building | `missing` | `/assets/buildings/sawmill.png` |
| `tree_oak_large` | foliage | `missing` | `/assets/foliage/tree_oak_large.png` |
| `tree_oak_small` | foliage | `missing` | `/assets/foliage/tree_oak_small.png` |
| `tree_pine_tall` | foliage | `missing` | `/assets/foliage/tree_pine_tall.png` |
| `tree_pine_short` | foliage | `missing` | `/assets/foliage/tree_pine_short.png` |
| `tree_birch` | foliage | `missing` | `/assets/foliage/tree_birch.png` |
| `tree_dead` | foliage | `missing` | `/assets/foliage/tree_dead.png` |
| `stump_fresh` | foliage | `missing` | `/assets/foliage/stump_fresh.png` |
| `stump_old` | foliage | `missing` | `/assets/foliage/stump_old.png` |
| `shrub_a` | foliage | `missing` | `/assets/foliage/shrub_a.png` |
| `shrub_b` | foliage | `missing` | `/assets/foliage/shrub_b.png` |
| `grass_tuft` | foliage | `missing` | `/assets/foliage/grass_tuft.png` |
| `field_stone` | foliage | `missing` | `/assets/foliage/field_stone.png` |
| `grass` | terrain | `missing` | `/assets/terrain/grass.png` |
| `forest_floor` | terrain | `missing` | `/assets/terrain/forest_floor.png` |
| `water` | terrain | `missing` | `/assets/terrain/water.png` |
| `rock` | terrain | `missing` | `/assets/terrain/rock.png` |
| `packed_earth_road` | terrain | `missing` | `/assets/terrain/packed_earth_road.png` |
| `quarry` | building | `missing` | `/assets/buildings/quarry.png` |
| `masonry` | building | `missing` | `/assets/buildings/masonry.png` |
| `market` | building | `missing` | `/assets/buildings/market.png` |
| `church` | building | `missing` | `/assets/buildings/church.png` |
| `keep` | building | `missing` | `/assets/buildings/keep.png` |
| `house_l4` | building | `missing` | `/assets/buildings/house_l4.png` |
| `stone_wall_segment` | building | `missing` | `/assets/buildings/stone_wall_segment.png` |

### Actual tree draw path

The runtime probe records the renderer's real return points rather than inferring from a nonblank canvas. Representative events were:

```json
{ "key": "tree_pine_short", "drawn": false, "reason": "image_missing" }
{ "key": "tree_pine_tall",  "drawn": false, "reason": "image_missing" }
{ "key": "tree_oak_large",  "drawn": false, "reason": "image_missing" }
{ "key": "tree_dead",       "drawn": false, "reason": "image_missing" }
{ "key": "tree_birch",      "drawn": false, "reason": "image_missing" }
{ "key": "tree_oak_small",  "drawn": false, "reason": "image_missing" }
```

### Camera zoom and LOD

The startup camera zoom was `1.1111111111111112`; the selected asset LOD was `full`. The procedural fallback was therefore not selected by the LOD threshold. Startup framing is a red herring for the missing sprites.

### Authored default state

`DEFAULT_GAME_STATE` contains four occupied cottages, one well, and population 12. The first fresh published runtime snapshot contained the same four houses with three residents each, the well, and population 12.

### Runtime bootstrap and persistence

The application initializes directly from `DEFAULT_GAME_STATE`. The fresh browser contained no persisted gameplay snapshot; the only storage entry was the welcome-dismissal sentinel `feudal-lord-simulator:welcome-dismissed:v1 = "1"`. A missing or overwritten starting village was not reproduced and is not the cause of the observed render failure.

## Why previous gates passed

- Local development is hosted at `/`, so root-absolute `/assets/...` accidentally resolves correctly there.
- Existing asset contract tests asserted root-absolute URLs, preserving the bug instead of exercising a repository base path.
- Canvas/hash checks accepted a nonblank procedural fallback as successful rendering; they did not require a sprite draw to return `true`.
- The previous published asset check treated transferred bytes as success. GitHub's 404 HTML body still transfers bytes, so it did not establish HTTP status, image MIME, decode success, loader state, or draw success.
- Unit tests used controlled image objects and did not reproduce GitHub Pages path resolution.

## Diagnosis conclusion

The published build is current and the simulation starts with the intended village. The primary failure is URL construction that discards Vite's deployment base. The independent onboarding overlay then masks most of the terrain with 1,901 opaque diamonds. The next implementation part must fix both causes, lock the published-base URL and real foliage draw path with tests, and separately repair localization and clipping without changing game-state determinism.

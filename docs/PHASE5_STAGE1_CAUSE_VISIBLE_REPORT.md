# Phase 5 Stage 1 — Make Cause Visible

## 1. What was implemented, by part

1. **House card.** Clicking a house opens a persistent parchment card with water,
   bread, and population diagnosis derived from the current `GameState`. Water
   distinguishes active service, no well, and an out-of-range well with distance.
   Bread distinguishes stock in the house, no granary, empty granaries,
   disconnected roads, and a connected but unserved house. The card clamps back
   inside the viewport after a resize and remains fully legible at 768px and 375px.
2. **Walker card.** Clicking the tile under a moving Walker's rendered feet shows
   role, cargo, source, destination, status, remaining distance, ETA, houses
   passed, and exact cancellation reason. Its current `walker.path` is drawn on
   the map. Selection uses the same rendered foot anchor as drawing.
3. **Population log.** Presentation state records at most 200 population-change
   events, groups consecutive equal causes, prints the exact tick or tick range,
   and highlights the involved houses when a group is clicked.
4. **Cause overlays.** Distribution reach is the canonical road BFS capped at the
   distributor range. Road component shades only the selected building's actual
   connected road component; its ultramarine fill was strengthened so it remains
   visible over road and ground textures.
5. **Problem explanations.** Existing problem markers now distinguish no labour
   from disconnected idle labour, absent/empty/unreachable/waiting input, and
   missing/full/disconnected/waiting output storage. These remain hover
   explanations rather than persistent production-building cards.

All changes are presentation/diagnostic reads. Simulation rules, balance,
tick order, `GameState`, and pathfinding are unchanged.

## 2. Screenshots

- Starving house and full cause chain:
  [`stage1_house_cause_chain.png`](assets/stage1_house_cause_chain.png)
- Moving carter card and live route:
  [`stage1_walker_route.png`](assets/stage1_walker_route.png)
- Population decline log:
  [`stage1_population_log.png`](assets/stage1_population_log.png)
- Distribution reach overlay:
  [`stage1_distribution_overlay.png`](assets/stage1_distribution_overlay.png)
- Selected road-component overlay:
  [`stage1_road_component_overlay.png`](assets/stage1_road_component_overlay.png)
- Responsive evidence:
  [`375px`](assets/stage1_responsive_375.png),
  [`768px`](assets/stage1_responsive_768.png)

The screenshots were produced through visible game controls in real browser
sessions. They are not synthetic canvas fixtures. The responsive files are true
PNG images at `375x667` and `768x720`.

## 3. The acceptance test, run honestly

A fresh game ran at 5× until the first visible decline: `인구 1명 감소 — 굶주림
(틱 350)`. Using only the screen, the interaction path was:

1. read the visible population event;
2. click that event group;
3. click the highlighted house;
4. read `곡창이 없습니다` and `감소 중 — 식량 없음` in its card.

The repeated interaction-only clock was **5.218 seconds**, inside the 30-second
budget. No source or runtime state was inspected during that timed path. The
first end-to-end artifact capture took **31.572 seconds**, because it included
two automation round trips and PNG encoding; it is not presented as a sub-30s
result. This was an automated screen-only proxy by an agent already familiar
with the project, not an independent first-time human usability study. The exact
record is in
[`stage1_acceptance_test.json`](asset-evidence/stage1_acceptance_test.json).

## 4. Cause-chain gaps

- When a connected granary contains bread but its roaming distributor took a
  different branch, the card says the house is unserved because the route is far
  or outside the roam range. It does not reconstruct the distributor's historical
  branch choices. The live Walker path and distribution overlay help, but the
  sentence is less actionable than the no-granary/empty/disconnected branches.
- The current simulation uses starvation for negative population change; lack of
  water blocks growth rather than directly decreasing population. The UI can
  render a `no_water` event, but normal current play does not produce that decline
  cause. Stage 1 did not change the economy to manufacture it.

## 5. Verification, determinism, and 5× frame time

| Gate | Result |
| --- | --- |
| Candidate code revision | `e2685e6cbf36ec0e85fb8cf28b99fcef76917e87` |
| DGX full tests | **480/480 PASS** |
| DGX typecheck | PASS |
| DGX production build | PASS, 114 modules |
| Focused diagnostic tests | 28/28 PASS |
| Determinism before / after | `4d92c66f9408a603` / `4d92c66f9408a603` |
| DGX 5× sample 1 | avg 4.941ms, p95 5.5ms, worst 8.2ms, 0 over 12ms |
| DGX 5× sample 2 | avg 4.868ms, p95 5.6ms, worst 9.0ms, 0 over 12ms |
| DGX 5× sample 3 | avg 4.890ms, p95 5.5ms, worst 8.3ms, 0 over 12ms |
| Browser console | 0 errors, 0 warnings in the final local scenarios |
| Korean/CJK visual review | PASS at 1280, 768, and 375 widths |

The local full suite is **476/480** because local `ffmpeg` is unavailable; the
same four established asset-pipeline boundary tests report `spawnSync ffmpeg
ENOENT`. On DGX, where `/usr/bin/ffmpeg` exists, the exact code revision passes
all 480 tests. Machine-readable evidence is in
[`stage1_automated_verification.json`](asset-evidence/stage1_automated_verification.json).

## 6. Delivery

- Code commit: `e2685e6cbf36ec0e85fb8cf28b99fcef76917e87`
- Branch delivered: `main` (from local `codex/stage1-cause-visible`)
- Remote: `https://github.com/hyunlord/feudal-lord-simulator.git`
- GitHub: <https://github.com/hyunlord/feudal-lord-simulator>
- DGX dev server: <http://100.70.109.50:3200/>

The final evidence commit, remote SHA equality, DGX restart, and live asset health
are recorded after this report is committed.

## 7. Honest read

The opening population drop is now legible: the event names starvation, points
to the affected house, and the house card names the missing granary and elapsed
decline. That path no longer requires code knowledge.

The remaining weak point is the connected-but-unserved distribution case. A
player can see the reach overlay and a currently selected Walker path, but still
has to infer why a roaming distributor chose one branch instead of another. The
next useful diagnostic slice is route-history/coverage explanation for roaming
distributors, not another economy system. Dense per-house labels in the
distribution overlay can also overlap in a crowded settlement, although they did
not block this Stage 1 evidence.

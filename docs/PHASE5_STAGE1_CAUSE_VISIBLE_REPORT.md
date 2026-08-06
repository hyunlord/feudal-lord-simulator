# Phase 5 Stage 1 — Make Cause Visible

## Result

Stage 1 is complete as a presentation-only diagnostic layer. It does not alter
simulation rules, balance constants, pathfinding, or persisted `GameState`.
The deterministic economy hash remains `4d92c66f9408a603`.

The opening decline is now explainable from the running game: selecting a
house shows its exact water and bread cause chain, while the population ledger
records a unit delta and immediate cause such as `인구 3명 감소 — 굶주림`.
Selecting that ledger entry highlights only the involved house footprints.

## Delivered surfaces

- Persistent house, production-building, and Walker diagnosis cards.
- Exact Korean water and bread cause chains with stable precedence.
- Walker role, cargo, source, destination, status, distance, ETA, route, houses
  passed, and distinct cancellation labels.
- Capped population event history with consecutive grouping and related-house
  selection.
- Exact selected-building road-component overlay.
- Exact distributor-range overlay using the canonical range of 40 road tiles.
- Selected Walker route drawn from the live `walker.path` object.
- Production problems distinguish absent labour, disconnected available labour,
  missing input, disconnected available input, and full output storage.

## Verification

| Gate | Result |
| --- | --- |
| DGX full tests | 473/473 PASS |
| DGX typecheck | PASS |
| DGX production build | PASS, 114 modules |
| Deterministic harness | PASS, `4d92c66f9408a603` |
| DGX 5× frame benchmark | 3/3 runs, 0 frames over 12ms |
| DGX 5× average / p95 / worst | 4.62–4.725 / 5.2–5.4 / 7.4–8.0ms |
| Local full tests | 469/473; four known `ffmpeg ENOENT` infrastructure failures |
| Responsive browser QA | PASS at 1280, 768, and 375 widths |
| Korean/CJK visual review | PASS, no clipping or tofu glyphs |
| Browser console | 0 errors, 0 warnings in the Stage 1 scenarios |

The four local failures are unchanged asset-pipeline file-boundary tests. Each
reports `spawnSync ffmpeg ENOENT`; the same exact candidate revision passes all
473 tests on DGX where `/usr/bin/ffmpeg` is available.

Machine-readable results are in
[`stage1_automated_verification.json`](asset-evidence/stage1_automated_verification.json).

## Browser evidence

- [`stage1_house_cause_chain.png`](assets/stage1_house_cause_chain.png)
- [`stage1_population_log.png`](assets/stage1_population_log.png)
- [`stage1_road_component_overlay.png`](assets/stage1_road_component_overlay.png)
- [`stage1_responsive_375.png`](assets/stage1_responsive_375.png)
- [`stage1_responsive_768.png`](assets/stage1_responsive_768.png)
- [`stage1_post_dismiss.png`](assets/stage1_post_dismiss.png)

The 1280 before/after visual comparison reports a 5.12% diff, 95 similarity,
and intact alpha. Review attributed the change hotspots to the intended
diagnostic card and small animation fringes; no unrelated layout drift was
found.

## Acceptance coverage and honest limits

Automated tests cover all three water outcomes, all five ordered bread outcomes,
four Walker cancellation labels, population grouping/highlighting, exact road
component traversal, the bounded distributor reach, and path-object identity.
The live browser run exercised the opening `우물이 없습니다` / `곡창이 없습니다`
chain and the subsequent starvation event.

The opening state does not immediately produce a selectable Walker or a live
granary distribution route, so dedicated `stage1_walker_route.png` and
`stage1_distribution_overlay.png` screenshots were not fabricated. Those
branches are proven by focused runtime/model/render tests. `housesPassed` is
derived from the Walker's current path; the simulation does not persist a
separate historical route, and Stage 1 deliberately did not add one.

The automated browser recognized the selected house and its exact Korean cause
within one second after selection, and recognized the population cause within
one second after the event appeared. This is instrumentation evidence, not a
claim that an independent human timed the 30-second comprehension exercise.

# Phase 10 Make It Actually Run Report

## 1. Implemented scope by part and skipped work

Implemented and pushed in six product commits before this report gate:

- Part 1 `5cc8b1f5c2978aad9d5198fd08bcee84d8b43ef6` — live game clock baseline; fixed-timestep `requestAnimationFrame` store loop, stale-commit protection, speed model, and reducer purity preserved.
- Part 2 `ece059ea700555adffc20ba53741d3fab3453a8e` — render-layer walker interpolation; smooth current/previous render state without persisted interpolation fields.
- Part 3 `fc3dc601b390e4b678b32d0063901c68faba4099` — valid buildings can be placed before road access; roadless service idles instead of silently producing.
- Part 4 `2e355e8d611b8f46ea1c95b39348d91b1c1109ff` — readable opening zoom, rectangular parchment panels, responsive build controls.
- Part 5 `4d6fe5a02507c183c1db087cdef7212b24835e29` — DGX-generated tree and terrain surfaces integrated into the runtime map.
- Part 6 `504b0b16e90c94995fada38d2ae38cb0cb54b784` — real-browser playthrough proof and frame-budget proof.

Skipped work: no additional gameplay systems, no alternate scheduler, no new dependencies, no committed raw Comfy scratch output, and no mutation of protected orchestration state. The final report/gate commit adds only documentation, release-proof scripts, and tests.

## 2. Why the missing tick loop was not caught

The old test shape could prove reducers and harness transitions while missing the user-facing browser path. The browser could render a valid static scene and tests still passed because no acceptance gate required wall-clock `requestAnimationFrame` advancement through the store provider. Part 1 closed this by proving the live store clock directly, and Part 6 closed the end-to-end gap by driving the real browser at 1x for 3000+ ticks instead of calling reducer helpers.

Prevention now in place:

- live clock tests cover store-owned ticking and stale commit protection;
- browser proof rejects direct tick bypasses in the exposed proof port;
- final evidence requires real Chrome screenshots, canvas hash, nonblank asset loading, moving walker hashes, resource transfer, and frame timing.

## 3. Owner decisions

- Human approval waits are waived for Phase 10; execution proceeded part-by-part with evidence and push verification.
- Reviews are capped at two rounds per part; remaining dissent is recorded instead of blocking functional completion.
- Missing road is service state, not terrain invalidity.
- Final movement speeds are intentionally modest to make normal-speed movement readable while keeping simulation pacing stable.
- DGX ownership boundaries are strict: only owned Comfy/temp sessions are cleaned; foreign `feudal-sim` is not killed or reused.

## 4. Review objections overridden

Recorded unresolved Part 6 bounded objection, accepted under the two-review-round cap:

fresh no-road flow proves construction sites persist with roadRevision 0→0 and idle economy for 600+ actual 1x ticks; exact `🚧 길이 필요합니다` marker is proven in a separate completed-then-disconnected flow, not the same fresh flow.

Reason for continuing: the functional acceptance criteria are separately proven by actual browser evidence: fresh no-road placement persists and idles for 601 ticks with no road revision, no goods movement, no production movement, and no carters; the exact road-needed marker is proven in a completed-then-disconnected service state.

## 5. Final walker speeds

- `CARTER_SPEED: 0.14`
- `DISTRIBUTOR_SPEED: 0.11`

These values were chosen because Part 2 visual tests and Part 6 browser proof make movement observable at 1x without storing interpolation in `GameState`. The result is a discrete simulation with render-only smoothing.

## 6. Part 6 browser screenshots and playthrough

Evidence root: `/tmp/feudal-phase10/task-6-playthrough/`

Step screenshots:

- `screens/fresh.png` — fresh game after welcome dismissal.
- `screens/road.png` — road chain placed by real browser input.
- `screens/placement.png` — logging camp, sawmill, and storehouse construction sites placed.
- `screens/walker.png` — same logs-carrying carter observed moving.
- `screens/goods.png` — goods transfer checkpoint.
- `screens/final.png` — final state after 3001 observed ticks.
- `screens/omitted-road/omitted-road-fresh.png`
- `screens/omitted-road/omitted-road-placement.png`
- `screens/omitted-road/omitted-road-idle.png`
- `screens/omitted-road/marker-proof/disconnected-road-marker.png`

Recorded Part 6 facts from `playthrough.json`:

- actual 1x ticks: `3001`
- same moving carter: `carter:construction-site-000002:411`, hash `41.14,39.00` to `41.42,39.00`
- logs transferred: `3`
- timber accumulated: `3`
- population changed: `12` to `0`
- omitted road flow: `601` ticks, roadRevision `0→0`, construction sites persisted, goods delta `0`, production delta `0`, carter count `0`
- marker proof: `🚧 길이 필요합니다`
- render hash: `d7ce2313`
- missing assets: `[]`
- blank canvas: `false`

## 7. Tree and terrain candidate selections

Each required group generated six DGX candidates. Selected assets:

| Group | Pick | Seed | Release path | Rationale |
| --- | ---: | ---: | --- | --- |
| `tree_oak_large` | 1 | 71000101 | `public/assets/foliage/tree_oak_large.png` | broad canopy, readable trunk, good internal gaps |
| `tree_oak_small` | 1 | 71000201 | `public/assets/foliage/tree_oak_small.png` | compact oak read with visible trunk |
| `tree_pine_tall` | 2 | 71000302 | `public/assets/foliage/tree_pine_tall.png` | strongest tall conifer silhouette |
| `tree_pine_short` | 6 | 71000406 | `public/assets/foliage/tree_pine_short.png` | clearest short-pine triangle and trunk |
| `tree_birch` | 4 | 71000504 | `public/assets/foliage/tree_birch.png` | most birch-like pale trunk and sparse leaves |
| `tree_dead` | 5 | 71000605 | `public/assets/foliage/tree_dead.png` | best bare-branch silhouette |
| `grass` | 6 | 71010106 | `public/assets/terrain/grass.png` | uniform coverage without focal patch |
| `forest_floor` | 2 | 71010202 | `public/assets/terrain/forest_floor.png` | dense leaves with fewer oversized focal forms |
| `water` | 2 | 71010302 | `public/assets/terrain/water.png` | consistent low-opacity ripple read |
| `rock` | 6 | 71010406 | `public/assets/terrain/rock.png` | even stone distribution and seamable edges |
| `packed_earth_road` | 5 | 71010505 | `public/assets/terrain/packed_earth_road.png` | readable packed-earth texture without oversized cracks |

Part 5 generated `66/66` candidates across `11` groups and integrated `11` selected assets. Manifest count is `35`; manifest SHA256 is `7892c33c531c614379855ae5d27c9cd3508172721581bc8b0fe34f5a39ef22e3`; runtime manifest SHA256 is `603a7104bba56f37b59907c93720b388b653b0f824228d2b165bbe2ca568472c`.

## 8. Determinism hashes

- Current Phase 10 deterministic hash: `e33eda222a38da4a`
- Legacy comparison hash: `5a393f13af3e61be`
- Stage 3 comparison hash: `007c206047131a97`

The hash changed because live timing, service idling, readable movement, and asset integration changed externally visible behavior. Reducer purity and RNG boundaries remain protected by tests and source guards.

## 9. Test output and frame budget

Final release seal:

- focused browser/report proof tests: `37/37` pass after RED failures were fixed
- clean GitHub Actions suite: `854/854` pass in workflow `31268711913`
- typecheck: `tsc --noEmit` pass
- build: `tsc --noEmit && vite build` pass
- harness: `npm run harness -- --workers=8` pass

Frame budget from `/tmp/feudal-phase10/task-6-playthrough/frame-budget.json`:

- speed: `5x`
- duration: `30000ms`
- p95: `6.0ms`, under the `12ms` budget
- average: `5.509746962880686ms`
- worst: `27ms`
- measured frames: `1067`
- over-budget frames: `2`
- canvas: `1280x720`, visible pixels `921600`, hash `df1a210e`

Final F3 rerun additionally recorded `/tmp/feudal-phase10/final/final-all.json`: all three viewports were nonblank with zero missing assets, and its fresh 30-second 5x sample measured p95 `4.3ms` across `2302` frames.

## 10. Commit hashes and publication proof

Pushed product commits:

- `5cc8b1f5c2978aad9d5198fd08bcee84d8b43ef6`
- `ece059ea700555adffc20ba53741d3fab3453a8e`
- `fc3dc601b390e4b678b32d0063901c68faba4099`
- `2e355e8d611b8f46ea1c95b39348d91b1c1109ff`
- `4d6fe5a02507c183c1db087cdef7212b24835e29`
- `504b0b16e90c94995fada38d2ae38cb0cb54b784`
- `250de757a50c4bb34f8e1546989d900ab0d53984` — Part 7 report and release gates
- `ca07fd535b2bea8495a761870ed9166dea7647f2` — exact public placement and complete `final-all` remediation
- `830dd6200254eb678bb8f354f24a97cfbf35c7ce` — hermetic CI evidence-fixture remediation

Publication target: `https://hyunlord.github.io/feudal-lord-simulator/`

Release revision `830dd6200254eb678bb8f354f24a97cfbf35c7ce` was remote-equal and published by successful Pages workflow `31268711913` ([run](https://github.com/hyunlord/feudal-lord-simulator/actions/runs/31268711913)). `/tmp/feudal-phase10/task-7-release/deploy-proof.json` records HTTP `200`, `text/html`, the root mount, production JS/CSS references, and exact local/remote SHA equality. Two preceding failed workflows exposed and then removed a non-hermetic test dependency on developer `/tmp` evidence; neither failed revision is used as publication proof.

## 11. Public URL honest-read proof

Public URL honest-read command:

```text
node scripts/phase10BrowserProof.mjs --scenario public-honest-read --url https://hyunlord.github.io/feudal-lord-simulator/ --speed 1 --watch-ms 120000 --place-buildings 2 --out /tmp/feudal-phase10/task-7-release/public-honest-read.json --screenshot-dir /tmp/feudal-phase10/task-7-release/screens --revision 830dd6200254eb678bb8f354f24a97cfbf35c7ce
```

Real Chrome completed this proof against the published revision. It created and state-verified exact `logging_camp` and `sawmill` construction sites, then observed `120967ms` at 1x and `2401` actual store ticks. Canvas hashes changed `a5c5976c → 207277f5 → cc95ce37 → 0af841e6`; the final `1280x720` canvas had `921600` visible pixels and no missing asset resources. Screenshots are `public-opening.png`, `public-first-building.png`, `public-two-buildings.png`, and `public-after-two-minutes.png` under `/tmp/feudal-phase10/task-7-release/screens/`. The final visible population was honestly `0/60`; the two roadless construction sites remained present rather than being reported as completed production.

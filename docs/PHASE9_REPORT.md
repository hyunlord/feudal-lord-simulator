# Phase 9 Stone Town Report

## 1. Implemented by part and skipped work

- Part 1 landed the Phase 8 presentation baseline at `c63709e`.
- Part 2 added rock-adjacent quarry placement and the real raw-stone to masonry delivery chain (`4bfb91f`).
- Part 3 added reserve-aware deterministic markets, coin income, market housing access, and the Stone Town requirement surface (`86c72e2`).
- Part 4 added Stone Town proclamation, gate-outward stone-wall replacement without an unwalled tick, civic buildings, level-four housing, and the four-second presentation-only material wave (`dc7eee2` through `b204221`).
- Part 5 generated 42 DGX candidates, selected and integrated seven sprites, and retained procedural fallbacks (`f98aa40`, `eebefbd`).
- Part 6 added live material carrier/source/ETA diagnosis and presentation-only last-five distributor route history (`9ccc0f6`).
- Part 7 adds the Phase 9 harness, bounded balance evidence, acceptance ledger, and this report.
- Browser automation for the Part 6 diagnostic interaction was skipped after the installed Browser Playwright module failed to import. Functional model/render wiring, full tests, typecheck, and build passed; public browser verification is retried in the final release gate.

## 2. Owner decisions and rationale

- Continued without approval pauses because the owner explicitly authorized unattended completion and push.
- Kept distributor history outside `GameState`, saves, and deterministic hashes because it explains presentation history but must not influence simulation.
- Selected one viable sprite for each of the seven groups instead of skipping a group; every selected candidate passed dimension, alpha, palette, manifest, and fallback gates.
- Preserved the exact Stone Town gameplay thresholds unless bounded tuning evidence justified a Phase 9-only change; older systems and baselines were treated as protected.
- Treated the Part 6 Browser-module failure as a capped external tooling skip, then used the repository CDP scripts at the final gate. Those scripts passed four responsive viewports, the population-title check, a reversible pan interaction, and the 5x benchmark.
- Declined to disguise the 25-minute balance miss by offsetting the harness clock or lowering the population threshold. The shipped constants remain the owner-specified values and the measured early/unstable outcomes are reported below.

## 3. Review objections overridden under the two-round cap

No functional code-review objection was overridden. The Part 4 visual review recorded these non-blocking cosmetic observations verbatim and delivery proceeded:

> Mobile bottom UI is tight and the ledger/control text is cramped, but controls are still visible and this is cosmetic under the stated gate.

> Mobile camera starts with the village relatively high/left and a large forest area in view, but the settlement remains readable.

The Part 6 review raised two functional findings (missing real-card wiring and tile-index ETA). Both were fixed and the second review returned `APPROVE`.

The Todo 14 second review returned `REQUEST CHANGES` with this objection:

> Failure-mode tests still spoof acceptance fields instead of using broken gameplay fixtures

> This violates Todo14’s “deliberate broken fixture” requirement and the “Do not mock production, road routing, market sales, or wall lifecycle” constraint. The green focused test is therefore proving the report-field override behavior, not metric sensitivity to real broken gameplay states.

The two-round cap prevented another Todo 14 review round, but the objection was not ignored: all result-field overrides were removed, each mutant now changes actual scenario state, returned trace fields agree with final gameplay state, and the focused real-mutant test passes.

A final independent release review then found that two mutants still restored or fabricated state outside the normal tick observation window. The release was held and one final remediation pass removed the harness `failureMode` API entirely. The five negative cases now provide persistent broken `GameState` fixtures to the same `trackPhase9Run` loop used by the passing scenario: missing rock, disconnected market access, service-starved population, disconnected wall supply, and a segment with no material. The same gate also identified oversized newly added TypeScript modules. Era-specific harness metrics, route-miss diagnosis, and stone-wall tests were split by responsibility; every newly added Phase 9 TypeScript file is now at most 217 pure LOC, and the programming no-excuse scan reports zero violations across the eleven remediation files.

## 4. Constants tuned and measurements

The machine-readable ledger is `/tmp/feudal-phase9/task-15/tuning-ledger.json` with CSV alongside it. Iteration 0 measured the specified constants unchanged: population 140, one market, one masonry, spendable stone 400, and coin 200. It reached proclamation at tick 11,450, 18,550 ticks before the 30,000 target. No tuning constant was committed. A separate unseeded stress run reached coin 200 at tick 4,560 but never reached spendable stone 400 or Stone Town by tick 30,000; population fell to zero and the maximum stone-chain stall was 7,351 ticks. Lowering the population gate or offsetting the scenario clock would have hidden the fixture sustainability problem, so both were rejected and the bounded final miss was shipped transparently.

## 5. Harness output and era-3 metrics

Todo 14 introduced exactly five Phase 9 rows. Two full `--phase9 --workers=8` runs were identical:

| Metric | Final value | Status |
| --- | ---: | --- |
| Stone chain continuity | 0 ticks with access | PASS |
| Market coin by 5000 | 61 elapsed ticks | PASS |
| Stone Town reachability | tick 11,450 | PASS against the <=30,000 ceiling |
| Stone wall completion | 3,169 ticks after proclamation | PASS |
| Segment material continuity | 0 segment-gap ticks | PASS |

The complete table also preserved every earlier metric as PASS. `--workers=9` exited nonzero with `--workers safety ceiling is 8`. Five actual broken-state fixtures individually failed rock access, early market coin, timely era reachability, wall supply, and segment continuity.

## 6. Time from start to Stone Town proclamation

Proclamation occurred at absolute tick 11,450: 9.54 minutes from game start at 20 ticks/second. The Phase 9 fixture begins after the Stage 3 trace at tick 1,859, so its Phase 9-only elapsed time is 9,591 ticks, or 7.99 minutes. This misses the 25-minute intersection target by 18,550 ticks on the early side. The unseeded stress variant did not proclaim by 30,000, so the fixture brackets a real pacing/sustainability problem rather than proving the intended 25–45 minute experience.

## 7. Sprite candidates, picks, and skips

DGX generated six candidates for each group (42 total), sequentially at batch size one, with zero restarts and no skipped group. Picks were: `quarry_02`, `masonry_03`, `market_04`, `church_01`, `keep_03`, `house_l4_04`, and `stone_wall_segment_03`. Unselected raw candidates were removed after their contact sheets and selection evidence were retained.

## 8. Determinism hashes old and new

- Legacy Stage 2 hash: `5a393f13af3e61be`.
- Stage 3 repeated hash: `5fe591bd641918bd`.
- Phase 9 repeated harness hash: `dd34b71581453994 == dd34b71581453994`.
- The detailed seed-9 Phase 9 trace through stone-wall completion hashed to `ceb5c2c53ff8b179`.

## 9. Test output and 5x frame time

- Final suite: 779 passed, 0 failed; typecheck PASS; production build PASS; `git diff --check` PASS.
- Focused remediation suite: 33 passed, 0 failed. The five real broken-state traces each fail exactly their intended Phase 9 row while the passing trace fails none.
- Programming/no-excuse scan: 0 violations across the eleven remediation files; runtime dependency audit: 0 vulnerabilities.
- The 17-row acceptance ledger at `/tmp/feudal-phase9/task-16/acceptance-ledger.json` records 17 PASS and no hidden skip.
- Five browser benchmark samples at 5x averaged 3.392–3.891ms per frame, with p95 3.7–4.5ms and 0 of 600 frames over 12ms.
- Responsive browser QA passed 375x812, 640x375, 768x1024, and 1280x720; the 1280 population title had no clipping failure. The compact-camera regression test preserved the >=18px 1x1 building floor.
- The canvas pan proof changed `a61e7c8d` to `a88d4cf0` and restored exactly to `a61e7c8d`.

## 10. Pushed commits and published update

Pushed Part commits before this release: `4bfb91f`, `86c72e2`, `dc7eee2`, `1847639`, `9b8c64d`, `e7373a1`, `b204221`, `f98aa40`, `eebefbd`, and `9ccc0f6`. GitHub Pages successfully deployed Part 6 (`9ccc0f6`) in run `31246220677`. The Part 7 commit is the Lore commit containing this report; its exact local/remote SHA and tree, deploy workflow run, MIME probes, missing-hash negative probe, and public browser proof are recorded in `/tmp/feudal-phase9/task-17/` after push because a commit cannot contain its own SHA.

All test and harness processes owned by the Phase 9 worktree were allowed to exit and were absent at the final process inventory. A pre-existing Vite server under the separate `stage3-palisade-age` worktree on port 33717 was explicitly classified as foreign and left untouched.

## 11. Honest full-run read

The stone phase reads as a different place once it arrives: quarry/masonry traffic adds a new industrial chain, the church and keep break the low timber skyline, level-four stone homes are visibly taller, and the gate-outward wall replacement gives the transition a clear spatial sweep. It is not merely a larger build menu.

The flat part is pacing credibility. The seeded deterministic fixture reaches Stone Town far too early, while the unseeded stress variant loses its population and never reaches the stone threshold. That means the feature set and wall lifecycle are proven, but a natural start-to-era-3 campaign is not yet proven to inhabit the intended 25–45 minute band. Food/service resilience is the first follow-up, not cheaper stone or a lower population gate. The mobile bottom console also remains visually tight, though the final browser geometry checks found no functional overlap or clipping failures.

# A″ code review: `dc49d0e..10813cb`

Review target: `/Users/rexxa/github/feudal-lord-simulator-playable`, final committed range `dc49d0e..10813cb`, with target commit `10813cbc361c3b17cec1fb42aebddb65b415bbae` (`Make construction road guidance start at material-bearing buildings`). This updates the prior `259cb78` review and includes the narrow construction-access source eligibility hotfix after the strict efficiency acceptance correction.

Scope checked: the complete A″ product delta through current HEAD, with focused re-review of the latest construction-access delta (`src/ui/constructionAccessModel.ts`, `tests/constructionAccessModel.test.ts`). I did not edit product source or tests; this report is the only updated artifact.

Skill-perspective check: ran. I loaded/consulted the code-review skill plus `omo:remove-ai-slops` and `omo:programming` before judging test relevance and maintainability, including the TypeScript programming reference. Under those lenses, I did not find deletion-only tests, tautological tests, tests that merely assert a requested removal, implementation constants copied without behavior value, new `any`/`as any` escape hatches, needless production validation/parsing layers, or new abstractions that rise to HIGH. The new construction-access test is behavior-relevant: applying only the new test hunk to `259cb78` fails red because the old guidance starts from the closer empty storehouse road, and current `10813cb` passes green.

## CRITICAL

None.

## HIGH

None.

## MEDIUM

None.

## LOW

None.

## Latest delta review: construction-access source eligibility

The `10813cb` hotfix is consistent with delivery/material/treasury contracts. `src/ui/constructionAccessModel.ts:47-53` now derives the site's outstanding delivery need with `constructionDeliveryNeed(site)`, starts road guidance only from buildings that have `availableStock` for a needed resource, and preserves treasury timber hints through houses when timber is still needed and `state.treasuryTimber > 0`. That matches the actual delivery source exposure in `src/agents/deliveryConstruction.ts:53-90`, the dispatch candidate filtering in `src/agents/deliveryConstruction.ts:101-123`, and the treasury-home dispatch path in `src/agents/deliveryConstruction.ts:126-163`.

The material availability check is reserve-aware. `src/economy/construction.ts:104-115` subtracts delivered and site-reserved amounts from construction need, and `src/economy/storage.ts:191-199` subtracts `stockReserved` from building inventory. The UI hint now uses those same concepts instead of the old broad road-planner helper, whose contract explicitly treated all storehouses and any timber/stone inventory as anchors regardless of site need or delivery availability (`src/engine/autoplayConstructionSources.ts:4-8`).

I did not find an unintended loss of user guidance. Empty storehouses no longer seed the proposed road path, which is intended because they cannot dispatch materials. Treasury timber still exposes source roads through houses, matching delivery's treasury-home carrier path. Reserve-held wall cases remain a separate non-suggested stall state: `constructionAccessModel` maps `site.stall === 'reserve_held'` to `reserve_held` (`src/ui/constructionAccessModel.ts:103-105`) and only returns suggested roads for `road_disconnected` or `no_route` (`src/ui/constructionAccessModel.ts:124-125`). The additional wall-reserve floor in `src/domain/wallReserve.ts:16-25` and `src/engine/constructionReserve.ts:75-97` can suppress wall delivery under balanced policy, but those cases should surface as reserve-held rather than as a road hint.

The new regression test is appropriately scoped. `tests/constructionAccessModel.test.ts:55-78` builds a disconnected fixture with a real timber storehouse and a nearer empty storehouse, asserts the proposed path starts at `{ tx: 2, ty: 3 }` on the material-bearing side, then verifies that adding the proposed roads creates a real construction route from the actual timber source. The red check on `259cb78` fails at this assertion with actual `{ tx: 5, ty: 3 }`, proving the test catches the reported bug rather than mirroring the new implementation.

## Severity vs product-gate assessment

No severity finding in the committed code requires a code fix before approving the review delta. The known failures below are product acceptance gate failures under the stricter validator, not evidence that the `259cb78` validation code or the `10813cb` UI hint fix is wrong.

Rechecking available source-pinned seed summaries from `output/playtest-a-double-prime/seeds/final-689bda7/` with the current strict rules shows that the existing `689bda7` product behavior fails the efficient-city gate:

- seed 1: strict acceptance fails `idleWorkers` (`0.3203125`) and `zeroWheatMills` (`0.2222222222222222`).
- seed 2: strict acceptance fails `idleWorkers` (`0.3138020833333333`).
- seed 4: strict acceptance fails `idleWorkers` (`0.3190104166666667`).
- seed 5: strict acceptance fails `idleWorkers` (`0.3138020833333333`) and `zeroWheatMills` (`0.3333333333333333`).
- seed 3: still has no summary/exit file in that source-pinned directory at this review pass.

Those failures should block any claim that A″ has passed the strict efficient-growth product gate. They do not create a code-review blocker against `10813cb`, because the latest committed delta only changes construction-access guidance and remains consistent with delivery/material/treasury behavior.

## Prior A″ conclusions retained

The strict efficiency correction at `259cb78` matches the stated validation contract. `scripts/efficientGrowthAcceptance.ts:14` computes `zeroWheatMillRatio`, and `scripts/efficientGrowthAcceptance.ts:22-25` requires raw starvation `< 20%`, zero-wheat mill share `< 20%`, warnings `< 10%`, and idle workforce between `5%` and `25%` inclusive. The returned diagnostics still expose `zeroWheatMillRatio` and `highIdleDiagnostic` (`scripts/efficientGrowthAcceptance.ts:27-29`). Its test hunk failed red on the old permissive validator and passes on current code.

The previous UI hotfix remains correctly wired. The status line renders from the sampled guidance state (`src/App.tsx:251`), and `App` passes that same sampled state to `OnboardingTasks` as `warningState` while still passing current `state` for outcome handling (`src/App.tsx:269`). `OnboardingTasks` keeps victory tied to current state (`src/ui/InfoPanel.tsx:207`) and hides open-goal completion copy if either current or sampled state reports water/bread problems (`src/ui/InfoPanel.tsx:208-209`). The regression covers sampled-warning/current-clear and current-warning/sampled-clear (`tests/onboardingUi.test.ts:306-331`).

The earlier A″ wall/autoplay/economy conclusions still stand. The seed2 mismatch fix uses `palisadeCoreProposalForState(state)` only to decide whether the prospective placement guard is active (`src/engine/autoplayWallSpace.ts:35-43`), while actual proclamation still uses the broader shortest proposal plus service-space acceptor (`src/engine/autoplayEra.ts:19-24`). The shortest palisade candidate cache re-evaluates caller `acceptPath` predicates on every call (`src/engine/palisadeFootprints.ts:189-197`) and does not cache service decisions across consumers. Placement spendability, wall reserve delivery limits, and housing promotion holds remain scoped to the accepted A″ changes (`src/world/placement.ts:212-227`, `src/agents/deliveryConstruction.ts:111-113`, `src/agents/deliveryConstruction.ts:145-147`, `src/domain/wallReserve.ts:16-25`, `src/content/housingConfig.ts:20-39`, `src/population/housing.ts:125-153`).

## Verification performed

- `git rev-parse HEAD` -> `10813cbc361c3b17cec1fb42aebddb65b415bbae`.
- `git diff --stat 259cb78..HEAD` -> `2 files changed, 35 insertions(+), 6 deletions(-)`.
- `git diff --name-status 259cb78..HEAD` -> only `src/ui/constructionAccessModel.ts` and `tests/constructionAccessModel.test.ts`.
- Escape/slop scan over `259cb78..10813cb` TypeScript diff for new `as any`, `as unknown`, ts-ignore/expect-error, `: any`, console/debugger/TODO/FIXME additions -> no matches.
- Pure LOC after the latest delta: `src/ui/constructionAccessModel.ts` = `123`; `tests/constructionAccessModel.test.ts` = `96`.
- Focused current HEAD: `./node_modules/.bin/tsx --test tests/constructionAccessModel.test.ts tests/constructionDelivery.test.ts tests/constructionReserve.test.ts tests/constructionModel.test.ts` -> `36` pass, `0` fail.
- Additional focused current HEAD: `./node_modules/.bin/tsx --test tests/constructionAccessModel.test.ts tests/constructionDeliveryBusySource.test.ts tests/constructionRouteCache.test.ts tests/problemCauseModel.test.ts tests/diagnosticCard.test.ts tests/constructionMaterialDiagnosis.test.ts` -> `39` pass, `0` fail.
- Current HEAD: `npm run typecheck` -> pass.
- Current HEAD: `npm run build` -> pass (`tsc --noEmit && vite build`); Vite still prints the existing >500 kB chunk-size warning.
- Root-provided pre-artifact validation for `10813cb`: full suite `2218/2218` including Phase9, plus typecheck/build pass. I recorded this as external validation evidence; my independently reproduced checks are the focused suites/typecheck/build above.
- Red check: clean detached `259cb78` with only the committed `tests/constructionAccessModel.test.ts` hunk from `10813cb` applied -> `3` pass, `1` fail. Failure is the new empty-storehouse regression, with actual first road `{ tx: 5, ty: 3 }` versus expected material-source road `{ tx: 2, ty: 3 }`.
- Strict seed summary recheck: `node --import tsx` using current `scripts/efficientGrowthAcceptance.ts` over `output/playtest-a-double-prime/seeds/final-689bda7/seed{1,2,4,5}/summary.json` -> all four available summaries fail current strict acceptance as listed above; seed 3 summary is missing.

## Unverified boundaries / watch items

- I did not complete an independent full `npm test` rerun during this final review. An optional full-suite smoke reached the long Phase9 harness after build had passed and was interrupted after several minutes; the focused construction/delivery/reserve/UI suites above are the verification I reproduced for `10813cb`. Root subsequently reported full `10813cb` regression `2218/2218` including Phase9 with typecheck/build pass; I treat that as external validation evidence rather than independently reproduced evidence.
- The source-pinned 5-seed `1200000` replay under `output/playtest-a-double-prime/seeds/final-689bda7/` was generated from source revision `689bda7`, before the strict validator change and before `10813cb`. Seeds 1, 2, 4, and 5 completed under the old permissive checks, but their stored metrics fail the current strict gate. Seed 3 was still missing a summary/exit file when checked.
- The current report approves the committed validation and construction-access corrections. It does not claim the product has passed the strict efficient-growth gate; that needs a new source-pinned run/capture after product behavior meets the corrected contract.
- `10813cb` does not add a dedicated treasury-only construction-access test. I inspected the implementation against the delivery treasury path and found it aligned, but a future regression in treasury-home hinting would be caught more directly by a small test if that path changes again.
- The palisade candidate caches still rely on the repo's normal immutable `GameState`/`tiles` update contract. I found no in-scope caller mutating those in place.

## Review decision

`codeQualityStatus`: WATCH

`recommendation`: APPROVE

`blockers`: []

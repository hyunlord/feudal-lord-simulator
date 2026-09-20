# Stage 0 food maintainability split code review

`codeQualityStatus`: CLEAR
`recommendation`: APPROVE

## Scope reviewed

Reviewed the current tracked diff and relevant untracked source/test files in `/Users/rexxa/github/feudal-lord-simulator-playable` for the final maintainability split:

- Food observation and delivery attribution: `src/engine/autoplayFoodThroughput.ts`, `src/engine/tick.ts`, `src/agents/roamingStep.ts`, `src/agents/roamingTypes.ts`, `src/agents/roaming.ts`, new `src/agents/roamingService.ts`.
- Food tests split: `tests/autoplayFoodThroughput.test.ts`, new `tests/autoplayFoodGranaryAttribution.test.ts`, new `tests/autoplayFoodObservation.test.ts`, new `tests/helpers/autoplayFoodFixtures.ts`.
- Adjacent Stage 0 changes present in the tree, including water recovery and harness checks: `scripts/phase19NaturalGrowth.ts`, `src/engine/autoplayActions.ts`, `src/engine/autoplayExpansion.ts`, `src/engine/autoplayFood.ts`, `src/engine/autoplayWater.ts`, `src/engine/constructionLifecycle.ts`, `src/engine/engine.types.ts`, `src/state/gameStore.ts`, `src/state/gameStore.types.ts`, new `tests/autoplayWaterRecovery.test.ts`, `tests/autoplaySustainability.test.ts`, `tests/phase20GrowthHarness.test.ts`.

This review does not claim the full five-seed Stage 0 simulation gate is complete. It only reviews the code-quality and behavior-preservation status of the current final split/refactor and adjacent checked-in changes.

## Correction to prior review note

A previous version of this report overstated the escape-hatch scan by saying no non-null assertions were found in all reviewed changed/new files. That statement was not supported: the scan pattern missed bracket-index non-null assertions such as `state.houses[0]!`, and a broader `rg` still finds pre-existing non-null assertions in older tests.

The current corrected file `tests/autoplayWaterRecovery.test.ts` no longer uses `DEFAULT_GAME_STATE.houses[0]!`; it now narrows through `openingHouseFixture()` with `assert.ok(openingHouse)` before returning the fixture. Corrected source hash:

- `tests/autoplayWaterRecovery.test.ts`: `d0354cbef03d334a2efc770dcf4d1be195377c89bee13b3f7a38957139ca16a2`

The targeted non-null assertion scan over the newly split food tests and corrected water recovery test produced no matches:

```bash
rg -n --pcre2 '(?<![=!])!(?=\s*(?:[.;,\)\]\}:]|\?|\.))|\[[^\]\n]+\]!' \
  tests/autoplayWaterRecovery.test.ts \
  tests/autoplayFoodThroughput.test.ts \
  tests/autoplayFoodGranaryAttribution.test.ts \
  tests/autoplayFoodObservation.test.ts \
  tests/helpers/autoplayFoodFixtures.ts
```

A broader repo scan still reports existing non-null assertions in older test files, including `tests/autoplaySustainability.test.ts:89`, `:147`, `:148`, and `:164`; the current diff for `tests/autoplaySustainability.test.ts` only adds a blank line, so those are not introduced by this correction. I am not treating the broader repo as clean for non-null assertions.

## Skill-perspective check

The required `remove-ai-slops` and `programming` perspectives were loaded and applied before judging tests and maintainability. I specifically checked for deletion-only/tautological tests, tests that only mirror implementation constants, unnecessary production extraction/parsing/normalization, needless abstraction, implementation-mirroring tests, untyped escape hatches, and oversized modules.

The corrected water fixture is acceptable under those perspectives: it replaces a non-null assertion with explicit narrowing, is used by three tests, and does not add production code or implementation-mirroring assertions.

Codegraph was attempted for source/call-path review, but `/Users/rexxa/github/feudal-lord-simulator-playable` is not indexed (`.codegraph/` is absent), so this review used direct file inspection and test execution.

## Findings by severity

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

- Existing non-null assertions remain in older tests outside the corrected water recovery file and outside the new food split files. Example current matches include `tests/autoplaySustainability.test.ts:89`, `tests/autoplaySustainability.test.ts:147`, `tests/autoplaySustainability.test.ts:148`, and `tests/autoplaySustainability.test.ts:164`. They are not newly introduced by this correction because that file's current diff only adds a blank line. They are a future cleanup candidate, not a blocker for this scoped review.

## Review notes

- The `roamingService.ts` extraction preserves the prior `serviceHouses` behavior while adding a narrow delivery-event result. The moved logic still computes distance, capacity, ration, remaining cargo, house bread, and `lastServicedTick` the same way; the new event payload carries `homeBuildingId`, `houseBuildingId`, and delivered amount for later attribution.
- `stepDistributors` now accumulates `deliveryEvents` while leaving route interruption, return, restored-cargo, and walker retention paths unchanged except for returning an empty event list on non-delivery paths.
- `tick.ts` credits observed granary delivery only when the delivery event came from the observed `homeBuildingId` and the recipient house was affected before the tick. This preserves the earlier fix for the old-granary false-positive case.
- The split tests are behavior-focused. They assert public outcomes through `advanceTick`, `foodAction`, reducers, and advisor decisions rather than asserting private helper internals.
- The new helper fixture file is small and shared by multiple tests; it removes duplicate setup without hiding the tested outcomes.
- No changed or new TS file exceeds the 250 pure-LOC ceiling. The largest reviewed files were `src/engine/constructionLifecycle.ts` at 239 pure LOC, `src/engine/tick.ts` at 227 pure LOC, and `src/agents/roamingStep.ts` at 211 pure LOC.

## Verification run

Independent verification commands run from `/Users/rexxa/github/feudal-lord-simulator-playable`:

- `npx tsx --test tests/autoplayWaterRecovery.test.ts tests/autoplaySustainability.test.ts`
  - Result after water fixture correction: exit 0; 19 tests passed, 0 failed.
- `npm run typecheck`
  - Result after water fixture correction: exit 0.
- Targeted non-null assertion scan over corrected/new split test files listed above.
  - Result after water fixture correction: no matches.
- Pure LOC counter over all tracked changed TS files plus relevant untracked TS files.
  - Result: all reviewed files below 250 pure LOC.

Earlier final split verification before the water fixture correction also ran `npx tsx --test tests/autoplayFoodThroughput.test.ts tests/autoplayFoodGranaryAttribution.test.ts tests/autoplayFoodObservation.test.ts tests/autoplayWaterRecovery.test.ts tests/autoplaySustainability.test.ts tests/phase20GrowthHarness.test.ts` with 52 passing tests, plus `npm run build` and `git diff --check` with exit 0. I did not repeat that full 52-test/build set after the narrow water fixture correction because the follow-up request only required affected 19 tests plus typecheck.

## Blockers

None.

# Free city Stage0 bounded placement code review

Review date: 2026-09-21

Scope:

- `src/engine/autoplayExpansion.ts`
- `src/engine/autoplayWater.ts`
- `tests/autoplaySustainability.test.ts`

codeQualityStatus: WATCH

recommendation: APPROVE

This verdict applies only to the bounded placement/water repair. It does not approve the full Stage0 user goal, food-throughput recovery, five-seed 1,200,000 tick simulation, curves, 3D, migration, or deployment.

## Skill perspective

`omo:remove-ai-slops`, `omo:programming`, and `code-review` were loaded/consulted earlier in this review thread and applied here. The updated placement tests no longer depend on sibling `output/phase21` files, and the reviewed placement tests are behavioral rather than deletion-only or implementation-mirroring. The placement diff does not violate the remove-ai-slops or programming perspectives within this bounded scope.

## CRITICAL

None.

## HIGH

None.

## MEDIUM

None.

## LOW

1. `src/engine/autoplayWater.ts:56` delegates terrain eligibility to `canPlaceBuilding`, which allows any non-water terrain through `src/world/placement.ts:63`. I confirmed an all-rock variant of the forest fixture returns a well placement. This appears consistent with the reducer-legality direction, but if the pending terrain policy rejects rock wells, this needs a separate product decision and test.

2. `tests/autoplaySustainability.test.ts:21` introduces local fixture helpers inside an already broad sustainability test file. The helpers are small and deterministic, so this is acceptable for the current bounded regression, but further growth should move scenario construction to a named test fixture module.

## Verification

- PASS: `./node_modules/.bin/tsx --test tests/autoplaySustainability.test.ts` — 19 pass, 0 fail.
- PASS: `./node_modules/.bin/tsx --test tests/wallRoutingIntegration.test.ts tests/roadComponentLabels.test.ts` — 11 pass, 0 fail.
- PASS: `npm run typecheck`.
- PASS: `npm run build` — build completed; existing Vite chunk-size warning remains.
- PASS: `git diff --check -- src/engine/autoplayExpansion.ts src/engine/autoplayWater.ts tests/autoplaySustainability.test.ts`.
- PASS: external-reference scan had no matches for `phase21FinalState|readFileSync|output/phase21|feudal-lord-simulator/output|final-state.json` in the three placement files.

I also inspected `.omo/evidence/stage0-placement-portable-tests-20260921-024817/README.md`, red/green logs, and the latest three-file diff. The clean-HEAD red proof fails on the intended portable regression cases, and the current focused suite passes.

## Blockers

None for bounded placement.

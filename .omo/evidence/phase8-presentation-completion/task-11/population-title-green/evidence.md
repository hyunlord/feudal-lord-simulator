# Phase 8 Task 11 Population Drawer Title Fix Evidence

## Scope

- Owned code: `src/ui/InfoPanel.tsx`, `src/styles/global.css`.
- Owned QA: `scripts/phase8Task11MobileLedgerQa.mjs`.
- Unrelated dirty camera/runtime files were left unstaged.

## Root Cause

The opened population drawer was rendered as a child of `.court-ledger`, whose
parchment surface uses `overflow: hidden` and `clip-path`. At 1280x720 that
clipped the drawer at the court-console/ledger seam, placing the Korean title
inside the clipped ledger region instead of above it.

## Browser TDD

- RED scenario: `LEDGER_QA_URL=http://127.0.0.1:3200 LEDGER_QA_OUTPUT_DIR=.omo/evidence/phase8-presentation-completion/task-11/population-title-red node scripts/phase8Task11MobileLedgerQa.mjs`
- RED observable: process exit `1`; `populationTitleScenario.failures` contained `title overlaps court-console seam by 35px` and `title overlaps ledger seam by 12px`.
- RED artifacts:
  - `.omo/evidence/phase8-presentation-completion/task-11/population-title-red/browser-ledger-readability.json`
  - `.omo/evidence/phase8-presentation-completion/task-11/population-title-red/desktop-population-title-1280x720.png`
  - `.omo/evidence/phase8-presentation-completion/task-11/population-title-red/qa.stderr.log`

- GREEN scenario: `LEDGER_QA_URL=http://127.0.0.1:3200 LEDGER_QA_OUTPUT_DIR=.omo/evidence/phase8-presentation-completion/task-11/population-title-green node scripts/phase8Task11MobileLedgerQa.mjs`
- GREEN observable: process exit `0`; `populationTitleScenario.failures` is empty.
- GREEN 1280x720 measurement:
  - console top: `570`
  - ledger top: `593`
  - drawer rect: `top=526.7 right=1159.59 bottom=585 left=859.59`
  - title rect: `top=537.7 right=1146.59 bottom=554.7 left=872.59`
  - title inside drawer inset: `top=11 right=13 bottom=30.3 left=13`
  - title inside panel inset: `top=11 right=13 bottom=30.3 left=13`
- GREEN artifacts:
  - `.omo/evidence/phase8-presentation-completion/task-11/population-title-green/browser-ledger-readability.json`
  - `.omo/evidence/phase8-presentation-completion/task-11/population-title-green/desktop-population-title-1280x720.png`

## Regression Gates

- Focused tests: `./node_modules/.bin/tsx --test tests/economyUi.test.ts tests/populationEventPanel.test.ts tests/mobileConsoleResponsive.test.ts`
  - observable: exit `0`, `23` pass
  - artifact: `.omo/evidence/phase8-presentation-completion/task-11/population-title-green/focused-tests.log`
- Full tests: `npm test`
  - observable: exit `0`, `699` pass
  - artifact: `.omo/evidence/phase8-presentation-completion/task-11/population-title-green/npm-test.log`
- Typecheck: `npm run typecheck`
  - observable: exit `0`
  - artifact: `.omo/evidence/phase8-presentation-completion/task-11/population-title-green/typecheck.log`
- Build: `npm run build`
  - observable: exit `0`
  - artifact: `.omo/evidence/phase8-presentation-completion/task-11/population-title-green/build.log`

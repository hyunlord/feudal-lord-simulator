# Phase 8 Task 11 Mobile Ledger Fix Evidence

## Scope

- Scenario: mobile and short landscape court-console ledger/overlay presentation.
- Owned code paths: `src/ui/InfoPanel.tsx`, `src/ui/EconomyOverlayControls.tsx`, `src/styles/global.css`.
- Owned tests and harness: `tests/economyUi.test.ts`, `tests/courtConsoleContracts.test.ts`, `scripts/phase8Task11MobileLedgerQa.mjs`.

## Baseline Inspection

- Browser screenshot inspected: `.omo/evidence/phase8-presentation-completion/task-11/final-32b-browser/viewport-375x812-dpr1.png`.
- Browser screenshot inspected: `.omo/evidence/phase8-presentation-completion/task-11/final-32b-browser/regression-640x375-dpr1.png`.
- DGX screenshot inspected: `.omo/evidence/phase8-presentation-completion/task-11/final-32b-dgx/remote/screenshots/07-responsive-375x812.png`.
- DGX screenshot inspected: `.omo/evidence/phase8-presentation-completion/task-11/final-32b-dgx/remote/screenshots/08-camera-safe-640x375.png`.
- Observable: constrained consoles showed long ledger and overlay labels degrading into fragments.

## Verification

- Scenario: DOM/CSS compact-label contracts.
- Invocation: `npx tsx --test tests/economyUi.test.ts tests/courtConsoleContracts.test.ts`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/logs/focused-contracts.log`

- Scenario: real browser geometry and readability across 375x812, 640x375, 768x1024, 1280x720.
- Invocation: `LEDGER_QA_URL=http://127.0.0.1:4321 LEDGER_QA_OUTPUT_DIR=.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix LEDGER_QA_CHROME_PORT=9231 node scripts/phase8Task11MobileLedgerQa.mjs`
- Observable: `verdict` is `PASS`; compact layouts have no failures, no horizontal overflow, visible compact labels, and zero visible secondary ledger rows.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/browser-ledger-readability.json`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/mobile-375x812.png`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/short-640x375.png`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/tablet-768x1024.png`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/desktop-1280x720.png`

- Scenario: build/type safety.
- Invocation: `npm run typecheck`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/logs/typecheck.log`

- Scenario: production build.
- Invocation: `npm run build`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/logs/build.log`

- Scenario: whitespace hygiene.
- Invocation: `git diff --check`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/logs/git-diff-check.log`

- Scenario: full suite against shared worktree.
- Invocation: `npm test`
- Observable: exit 0; `697/697` tests passed.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-ledger-fix/logs/full-npm-test.log`

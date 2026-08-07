# Phase 8 Task 11 df9 Remediation Evidence

## Scope

- Scenario: remediate df9 mobile/tablet ledger and overlay blockers.
- Owned code paths: `src/ui/InfoPanel.tsx`, `src/styles/global.css`.
- Owned tests and harness: `tests/economyUi.test.ts`, `tests/courtConsoleContracts.test.ts`, `scripts/phase8Task11MobileLedgerQa.mjs`.

## Red Evidence

- Scenario: compact ledger semantic full names while visible compact labels are `aria-hidden`.
- Invocation: `npx tsx --test tests/economyUi.test.ts`
- Observable: exit 1 before production edit; `CourtLedger keeps full semantic term names when compact labels are aria-hidden` failed.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/red-economy-ui.log`

- Scenario: browser runtime ledger/overlay geometry against df9.
- Invocation: `LEDGER_QA_URL=http://127.0.0.1:4321 LEDGER_QA_OUTPUT_DIR=.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/red LEDGER_QA_CHROME_PORT=9232 node scripts/phase8Task11MobileLedgerQa.mjs`
- Observable: exit 1 before production edit; failures included `ledger text boxes overlap: [["Tim.","Idle"]]`, missing compact ledger accessible names, and tablet full overlay label overflow.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/red-browser-ledger-readability.log`

## Green Verification

- Scenario: DOM accessibility and console contract tests.
- Invocation: `npx tsx --test tests/economyUi.test.ts tests/courtConsoleContracts.test.ts`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/focused-contracts.log`

- Scenario: real browser bounding/no-overlap, compact-overlay, text-fit, and accessible-name checks at 375x812, 640x375, 768x1024, and 1280x720.
- Invocation: `LEDGER_QA_URL=http://127.0.0.1:4321 LEDGER_QA_OUTPUT_DIR=.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/browser LEDGER_QA_CHROME_PORT=9232 node scripts/phase8Task11MobileLedgerQa.mjs`
- Observable: exit 0; `verdict` is `PASS`; 375/640 have zero ledger text overlaps, 768 has compact overlay labels `[Water, Work, Reach, Roads]`, and ledger accessible names include `[Timber, Population, Idle]`.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/browser/browser-ledger-readability.json`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/browser/mobile-375x812.png`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/browser/short-640x375.png`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/browser/tablet-768x1024.png`
- Screenshot: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/browser/desktop-1280x720.png`

- Scenario: full test suite.
- Invocation: `npm test`
- Observable: exit 0; `698/698` tests passed.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/full-npm-test.log`

- Scenario: type safety.
- Invocation: `npm run typecheck`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/typecheck.log`

- Scenario: production build.
- Invocation: `npm run build`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/build.log`

- Scenario: whitespace hygiene.
- Invocation: `git diff --check`
- Observable: exit 0.
- Artifact: `.omo/evidence/phase8-presentation-completion/task-11/df9-remediation/logs/git-diff-check.log`

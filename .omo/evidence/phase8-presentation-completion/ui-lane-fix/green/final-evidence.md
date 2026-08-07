# Phase 8 UI Minimap Fix Evidence

- Scenario: RED broken 375 compact minimap grid rejects zero-width minimap.
  Invocation: `node - <<'NODE' > .omo/evidence/phase8-presentation-completion/ui-lane-fix/red/minimap-column-red.log 2>&1`
  Observable: `compactColumnsMatched=false`, expected failure recorded for `0 252px minmax(0, 1fr)`.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/red/minimap-column-red.log`

- Scenario: Source contract for compact console CSS and DOM.
  Invocation: `npx tsx --test tests/courtConsoleContracts.test.ts`
  Observable: 10 tests passed; mobile court grid requires `40px minmax(0, 1fr) 96px`, positive minimap column, stretched ledger stack, and 48px control contract.
  Artifact: terminal run plus committed test diff in `tests/courtConsoleContracts.test.ts`

- Scenario: Real browser UI QA at 1280x720, 768x1024, and 375x812.
  Invocation: `QA_BASE_URL=http://127.0.0.1:5179 QA_OUT_DIR=.omo/evidence/phase8-presentation-completion/ui-lane-fix node .omo/evidence/phase8-presentation-completion/ui-lane-fix/playwright-ui-qa.cjs`
  Observable: `playwrightVerdict=PASS`; 375 metrics `mapRecess=40x206`, `mapShield=28x34`, `buildSeals clientWidth=233 scrollWidth=524 afterScroll=64`, `bodyScrollWidth=375`, failures `0`.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/status.txt`
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/browser-geometry.json`
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/mobile-375.png`

- Scenario: Focused UI regression suite.
  Invocation: `npx tsx --test tests/appPresentationClock.test.ts tests/palette.test.ts tests/contrastGate.test.ts tests/onboardingUi.test.ts tests/courtConsoleContracts.test.ts tests/economyUi.test.ts tests/populationEventPanel.test.ts`
  Observable: current suite reports 48 tests passed.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/focused-44.log`

- Scenario: Contrast gate.
  Invocation: `npx tsx --test tests/contrastGate.test.ts`
  Observable: 3 tests passed.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/contrastGate.log`

- Scenario: TypeScript typecheck.
  Invocation: `npm run typecheck`
  Observable: `tsc --noEmit` passed.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/typecheck.log`

- Scenario: Production build.
  Invocation: `npm run build`
  Observable: `tsc --noEmit && vite build` passed.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/build.log`

- Scenario: Diff whitespace check.
  Invocation: `git diff --check`
  Observable: exit code 0 with empty log.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/diff-check.log`

- Scenario: Owned server cleanup.
  Invocation: Ctrl-C sent to owned Vite session on port 5179, then `lsof -nP -iTCP:5179 -sTCP:LISTEN`.
  Observable: no listener on port 5179.
  Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane-fix/green/vite-5179.log`

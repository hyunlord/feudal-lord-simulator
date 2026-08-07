Phase 8 UI lane DoneClaim

Scope: Todos 2-4 only.

Todo 2 acceptance:
- Scenario: contrast-audited parchment readability gate.
- Invocation: `npx tsx --test tests/contrastGate.test.ts`.
- Observable: contrast ratios print for audited selectors, ledger numeric text uses darker `--palette-ink`, and no repeated parchment text surfaces are accepted.
- Artifact: `.omo/evidence/phase8-presentation-completion/ui-lane/focused-ui-tests.log`.
- Red artifact: `.omo/evidence/phase8-presentation-completion/task-2/red/contrastGate-red.log`.

Todo 3 acceptance:
- Scenario: welcome dismissal persists locally, right information rail stays above court console, and population history opens only from ledger drawer.
- Invocation: Playwright Chromium against `http://127.0.0.1:5178/` at 600x800 and 900x800.
- Observable: `dismissedPersisted` is `"1"`, `welcomeCountAfterClick` is `0`, `rightRailAboveConsole` is `true`, `eraRequirementCount` is `4`, and `populationAfter` is `1`.
- Artifacts: `.omo/evidence/phase8-presentation-completion/task-3/browser-qa.json`, `.omo/evidence/phase8-presentation-completion/task-3/welcome-600.png`, `.omo/evidence/phase8-presentation-completion/task-3/welcome-900.png`.

Todo 4 acceptance:
- Scenario: labeled build seals remain accessible 48px targets at narrow and tablet widths.
- Invocation: Playwright Chromium against `http://127.0.0.1:5178/` at 600x800 and 900x800.
- Observable: `allSealHitTargetsAtLeast48` is `true`, labels include `오두막`, `우물`, and `길`; road seal is 100x48 at 600px and 204x48 at 900px.
- Artifacts: `.omo/evidence/phase8-presentation-completion/task-4/browser-qa.json`, `.omo/evidence/phase8-presentation-completion/task-4/console-600.png`, `.omo/evidence/phase8-presentation-completion/task-4/console-900.png`.

Verification:
- Focused UI suite: `npx tsx --test tests/appPresentationClock.test.ts tests/palette.test.ts tests/contrastGate.test.ts tests/onboardingUi.test.ts tests/courtConsoleContracts.test.ts tests/economyUi.test.ts tests/populationEventPanel.test.ts` => pass, 46 tests.
- Typecheck: `npm run typecheck` => pass.
- Build: `npm run build` => pass.
- Full test: `npm test` => fail only four ffmpeg-dependent asset tests because local `ffmpeg` is unavailable (`spawnSync ffmpeg ENOENT`).
- Diff check: `git diff --cached --check` => pass.

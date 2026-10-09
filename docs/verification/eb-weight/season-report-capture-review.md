# Season-report helper independent review (source only)

Initial verdict: **HOLD for canonical/source-pinned acceptance; useful diagnostic UI path identified.** No browser, clock execution, simulation or source edit was performed. Implementation owner is addressing the two acceptance distinctions below; this report will be updated when the revised file is stable.

## Findings sent to implementation owner

1. Initial `main` checks local checkout HEAD/cleanliness and src changes, but accepts an arbitrary URL without proving that listener serves the checked tree. A source-revision field in output alone does not bind the browser to that revision. Require an owned Vite launcher with recorded/verified PID, listener port and checkout cwd/root, or equivalent served-source identity. `scripts/remote/devServers.sh` provides existing `fls_serve` process ownership and cleanup; `engineBVisibleCapture.sh` shows strict-port local-server use. A note that the caller must supply the correct server is a limitation, not verified server provenance.
2. Expected tick output is optional, while initial row.valid/aggregate.valid could pass with no independent output comparison. Preserve useful diagnostic one-tick UI/report evidence, but give canonical tick-presentation verification a separate flag requiring the expected output. Do not call presentation equality raw-store equality. Bind each independent output to the input preclose state hash and replay manifest, not only an entry/tick/source string, to prevent wrong-timeline input substitution.

## Source-verified timing and UI path

- Save admission uses the original codec envelope and SHA checks, exact four source occurrence identities/choices and actual stewardReport membership. Pre-input presentation equality rejects load-time state drift rather than silently normalizing it.
- Browser proof state is presentation state: `useGameCanvasRuntimeRefs.ts:20,36` applies presentedState; `phase10ProofRuntime.ts:231` exposes that ref. `withResidentWalkers` is the expected projection. No raw-store claim is possible from this port alone.
- `BALANCE.TICKS_PER_SECOND` is10 (`balanceConfig.ts:7`), so fixedTickLoop needs100ms accumulated normal-speed time per tick. Its paused frames clear accumulator (`fixedTickLoop.ts:64–70`), and its loop can advance multiple ticks if enough time accumulates (`:83–90`). Helper16ms clock increments inspect every resulting frame and reject overshoot/reversal; it stops at+1, pauses and checks no additional tick across800ms settling. Speed is a separate ref, not a GameState edit (`gameStore.ts:268,283–286`). These support the intended one-tick experiment; Playwright clock behavior itself remains unexecuted here.
- Season closure publishes UI immediately (`gameStore.ts:305–309`). App derives the actual most-recent closed season and either opens its modal or increments its notice (`App.tsx:296–324`); helper uses only that actual modal/notice path. It checks ledger interval, rendered season key, exact occurrence row, expanded detail and bounded screenshot rectangle.
- Clicks are synthetic DOM events through existing handlers, with visibility/enabled/center coverage checks. This is not native-pointer QA, live10x QA, long-running visibility, or user usability proof. Disclosure is scrolled before expansion; if expanded bounds exceed viewport it fails closed rather than claiming full-row visibility.
- Global clean checkout and changed-src restriction allow UI/App/styles changes while rejecting engine/presentation drift from2485. Dependency lock equality was added during review. This complements but does not replace server binding.

Initial helper gap is in acceptance labeling/provenance, not a demonstrated wrong engine tick. Actual UI execution can still fail from existing seen marks, normal modal ordering, optional assets, clock scheduling or expanded-row clipping. Such failures must remain evidence gaps, not be bypassed by modifying save state.

## Revised implementation review

The237-line revision resolves initial acceptance findings: it starts its own Vite child on127.0.0.1 with strictPort, verifies listener socket inode ownership through that child's `/proc/PID/fd` and exact cwd, records PID/cwd/URL/command, and checks child/source stability before completion. It requires independent expected outputs and pins the exact replay manifest plus each preclose input compressed/state hash. It distinguishes `uiReportVerified` from `canonicalTickPresentationVerified`; both are necessary for a valid row. This is still presentation equality, not raw-store identity.

Read the appended `.omo/evidence/eb-answer-replay-command.sh` reference stage (SHA256 `2e86b26b82338e7a3220e3ac08ea3a5072e284334e011572da8c4692e32aa32a`): source/Node/lock pin, all three validated replay manifests and annual-report linkage precede reference generation. All four preclose saves are validated before computing any outputs. Each reference is one `advanceTick(state)` with no lord commands, input nonmutation asserted, then exact input/output hashes written. This is a separate four-tick expected computation, not an additional125-year replay; it has not been run by this reviewer.

Additional lifecycle defect found independently and also identified by parent: initial startOwnedServer catch only sends SIGTERM without waiting/force escalation, leaving main's `owned` unset; initial main finally awaits browser.close before cleanup, so its rejection can skip server shutdown and manifest persistence. Requested one bounded stop helper for both startup failure and normal exit, with independent/nested cleanup and failed validity on cleanup error. Final verdict waits for this revision.

## Final lifecycle revision verdict

**PASS WITH LIMITS — source review complete.** Reviewed final249-line helper SHA256 `3c77eed2f71905d07fe998ee9632368fd04cda0b0af398d4dd6caf24d0fb9143`. This supersedes the earlier HOLD: the provenance/input-binding changes remain present, and both reported lifecycle defects are fixed.

`stopOwnedServer:153–166` returns for an already-exited or spawn-failed child, waits for exit after SIGTERM, escalates SIGKILL at3s and rejects at6s, clearing timers/listener on settlement. Startup catch awaits this helper and preserves startup+cleanup failures (`:188–190`). Main catches browser-close failure independently, still stops Vite, and writes the manifest in nested finally; cleanup errors force invalid evidence and exit1 (`:239–245`). No further blocking finding in these paths.

Prior reference-generation review still applies. Actual browser clock behavior, visible Korean report layout, four canonical presentation comparisons and operational shutdown remain unexecuted in this review. The intended result is one-tick presentation equivalence plus four actual report rows, not raw-store identity or whole-game UI acceptance. Parent owns repository lint/runtime checks. No process, simulation, browser or test was launched by this reviewer in this final review.

## Mandatory server launcher integration review

Reviewed SHA256 `61debae4c0a92aeebcd69bc2ba0da58aeecba416cbc74e4fe7e227b05f99c3be` after parent replaced raw spawn with `spawnServer` from `scripts/serverProcess.ts`, as required by AGENTS.md160. The shared launcher installs process exit/SIGINT/SIGTERM/SIGHUP hooks and puts the Linux server in its own process group. It still returns the same Vite child, so PID/cwd/socket-inode provenance checks remain correct.

**Actionable remaining lifecycle issue:** local `stopOwnedServer` sends both TERM and forced KILL via `server.kill`, targeting only the leader. `spawnServer` removes that child from its running set on leader exit; its later exit hook therefore cannot clean up surviving descendants. A forced leader kill can leave a child in the detached server process group. Change the owned helper's signal target to that owned process group (`process.kill(-server.pid, signal)` on this Linux-only path), preserving bounded wait/escalation and accurate failures. No change to shared serverProcess.ts is required. This is a cleanup integration finding, not a source/tick-evidence defect; prior canonical input/clock findings remain unchanged. No server or test was run.

## Final process-group cleanup review

**PASS WITH LIMITS restored; no remaining blocking source finding.** Reviewed helper SHA256 `8fd69d915e4f51e53624a4cfb217ddc03a75efef8f3c54d562cfde8ed9411e01` and cleanup-test SHA256 `4046fa4699b11f7004987e3b6d67f6ff5d5993961f48695b2476e6c56cc99ef3`.

`stopOwnedServer` now sends TERM/KILL to the owned detached group (`-server.pid`), sends a final group KILL when the leader exits, and also clears a surviving group when the leader was already exited. Only ESRCH is ignored; permission or other failures remain errors and reach failed cleanup evidence. Existing bounded3s escalation/6s deadline and startup/main cleanup wiring remain intact. This resolves the raw-spawn→spawnServer integration issue without changing the shared launcher or engine.

Read all four meaningful regression tests: normal leader exit with descendant cleanup; already-exited leader;3s forced whole-group escalation under fake timers; harmless missing-group versus rejected permission failure. Tests mock process.kill and create no real processes/ticks. Parent reported all4 tests and repository lint passing; this reviewer inspected source only and did not rerun them. The6s no-exit timeout branch is source-inspected rather than directly covered by these four tests.

Prior source provenance, expected-input/output binding and presentation-only proof limitations still apply. Actual DGX browser/clock/rendering and operational process exit remain pending runtime evidence, not inferred from this source PASS.

## DGX Playwright metadata preflight correction

The runner imports `scripts/remote/playwright-chrome-shim.mjs` and supplies `FLS_PLAYWRIGHT_CORE`; the shim directory has no package.json. The prior sibling-package lookup reproduced ENOENT. Only the canonical standard shim now follows the backing-core path. Direct core entries require index.mjs and playwright-core identity; an explicit matching version is mandatory. Captured provenance records module/core/package paths and hashes. Shim loading and Chromium channel mapping are unchanged.

Five metadata regressions plus four lifecycle regressions passed with `tsx --test`; repository ESLint passed for the changed harness and new test. These checks use temporary metadata fixtures and mocked lifecycle events, not a browser or real process cleanup. Actual season UI verification remains pending after the existing guardrail and verified answer replay.

Todo 5 adversarial probes

- malformed_input: N/A. Todo 5 adds typed internal constants and no input parser.
- prompt_injection: N/A. No untrusted text is interpreted as instruction.
- stale_state: PASS. Manual artifact `manual/opening-state-camera.json` reads live `DEFAULT_GAME_STATE`, `STARTING_LANDMARKS`, camera runtime, and serializers after implementation.
- dirty_worktree: PARTIAL PASS. Scoped `git diff --check -- <owned paths>` passed. Shared non-owned dirty files remain: asset/UI lanes (`scripts/worldAssetContracts.ts`, `scripts/checkContrast.ts`, `src/styles/global.css`, `src/content/palette.ts`, related tests).
- hung_or_long_commands: PASS. Focused tests and manual scripts completed in bounded local commands; no persistent process was started for Todo 5.
- flaky_tests: PASS. Opening/camera/onboarding focused tests were run after RED and again after regression fixes; final pass was 30/30.
- misleading_success_output: PASS. Assertions inspect data fields, exact coordinates, IDs, roads, camera math, and pinned hashes, not log text alone.
- cancel_resume: PASS. Evidence directories contain baseline, RED, GREEN, manual, adversarial checkpoints.
- repeated_interruptions: PASS. State was resumed from durable git diff plus `.omo/evidence/phase8-presentation-completion/task-5/`.

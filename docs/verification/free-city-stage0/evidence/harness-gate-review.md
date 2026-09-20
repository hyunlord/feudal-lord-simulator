# Free City Stage 0 Harness Gate Review

recommendation: APPROVE

blockers:
- None for the bounded two-file harness gate.

originalIntent:
- Continue Stage 0 work without starting curves or 3D. For this bounded gate, verify only the current dirty harness changes in `/Users/rexxa/github/feudal-lord-simulator-playable`: `scripts/phase19NaturalGrowth.ts` and `tests/phase20GrowthHarness.test.ts`.
- Confirm earlier harness objections are fixed: optional capacity recovery is reported outside acceptance, rock preflight hard-fails only when `rockTiles === 0`, CLI exits nonzero for unmet acceptance, seed 2 no-rock preflight stops at tick 0, preflight diagnostic treasury does not enter actual state, nonempty output guard preserves existing evidence, and the stability window remains 24,000 consecutive ticks.
- Do not approve full Stage 0. Stage 0 remains NOT MET and terrain choice remains pending.

desiredOutcome:
- Bounded harness behavior is reviewable and truthful: failing Stage 0 runs must fail closed, no-rock terrain must be called out as an invalid run, diagnostic-only placement counts must not masquerade as proof of impossibility, and optional capacity observations must not be part of the required acceptance gates.
- Evidence must distinguish this harness approval from product simulation completion.

userOutcomeReview:
- The latest code behavior matches the bounded harness outcome requested by the parent task. `runPhase19NaturalGrowth` now returns `acceptance-unmet` unless all required acceptance gates pass, and the CLI exits 1 for both seed 1 unmet acceptance and seed 2 no-rock invalid run.
- Seed 2 no-rock preflight fails closed before advancing ticks. My CLI run produced exit 1, `resourcePreflight.rockTiles: 0`, `final.tick: 0`, `stopReason: "invalid-run"`, and `acceptance.validRun: false`.
- The legal quarry footprint count is diagnostic-only. The code hard-fails on `rockTiles === 0` and the regression test covers a synthetic state with `rockTiles: 1`, `legalQuarryFootprints: 0`, and no failures.
- Capacity episode summary is now top-level optional reporting, while `acceptance` contains only `targetReached`, `victory`, `fullServiceStable`, and `validRun`.
- Stability completion remains `sustainedTicks >= 24_000` in `scripts/phase19GrowthRunControl.ts`.
- I found no direct slop blocker in the diff itself: no new `any`, `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`, non-null assertion, catch swallowing, debug logging, or oversized touched file. The changed files measure 185 and 149 pure LOC respectively.

checkedArtifactPaths:
- `/Users/rexxa/github/feudal-lord-simulator-playable/scripts/phase19NaturalGrowth.ts`
- `/Users/rexxa/github/feudal-lord-simulator-playable/tests/phase20GrowthHarness.test.ts`
- `/Users/rexxa/github/feudal-lord-simulator-playable/scripts/phase19GrowthRunControl.ts`
- `/Users/rexxa/github/feudal-lord-simulator-playable/tests/phase21OpeningTranslation.test.ts`
- `/Users/rexxa/github/feudal-lord-simulator-playable/.omo/evidence/stage0-harness-capacity-summary-verify4-20260921/report.md`
- `/Users/rexxa/github/feudal-lord-simulator-playable/.omo/evidence/stage0-harness-capacity-summary-verify4-20260921/verification-judgment.json`
- `/Users/rexxa/github/feudal-lord-simulator-playable/.omo/evidence/stage0-harness-gate-review-hook-verify3-20260921/report.md`
- `/Users/rexxa/github/feudal-lord-simulator-playable/.omo/evidence/stage0-harness-gate-review-verify2-20260921/report.md`
- `/Users/rexxa/github/feudal-lord-simulator-playable/output/free-city-stage0/placement-review/README.md`
- `/Users/rexxa/github/feudal-lord-simulator-playable/output/free-city-stage0/placement-review/bounded-placement-rereview.md`
- `/Users/rexxa/github/feudal-lord-simulator/output/free-city-stage0/harness-code-review.md`
- `/Users/rexxa/github/feudal-lord-simulator-playable/.omo/evidence/free-city-stage0-harness-gate-review-code-review.md`

directEvidence:
- Worktree HEAD: `ec80d31470c6357c0b051efd68194756b0b98eac`
- Current file hashes:
  - `scripts/phase19NaturalGrowth.ts`: `bd1502936de5a3da2e5568e1b7faca077ca16f1e`
  - `tests/phase20GrowthHarness.test.ts`: `bb2c04b99a6afb2b1a926fd3db1fdca473462b3d`
  - Target diff SHA256: `872a858e66a20cf99f47ff2f45c62ad664e5b3d72a9b6ccb26ff15aac2035430`
- Required upstream code-review report is now present and mirrored:
  - `/Users/rexxa/github/feudal-lord-simulator/output/free-city-stage0/harness-code-review.md`: `ba11290ece4b84de41ef1c31dc47be8ee0d7bf557ef656b4c447302bfa024a49`
  - `/Users/rexxa/github/feudal-lord-simulator-playable/.omo/evidence/free-city-stage0-harness-gate-review-code-review.md`: `ba11290ece4b84de41ef1c31dc47be8ee0d7bf557ef656b4c447302bfa024a49`
- The code-review report explicitly reports no critical/high/medium/low findings in scope, `blockers: []`, `recommendation: APPROVE`, `omo:programming` TypeScript coverage, and `omo:remove-ai-slops` overfit/slop coverage.
- Commands rerun from `/Users/rexxa/github/feudal-lord-simulator-playable`:
  - `./node_modules/.bin/tsx --test tests/phase20GrowthHarness.test.ts tests/phase21OpeningTranslation.test.ts` => exit 0, 16 pass, 0 fail.
  - `npm run typecheck` => exit 0.
  - `git diff --check -- scripts/phase19NaturalGrowth.ts tests/phase20GrowthHarness.test.ts` => exit 0.
  - `./node_modules/.bin/tsx scripts/phase19NaturalGrowth.ts 24 1 <tmp>/seed1-output 1` => exit 1; JSON status `acceptance-unmet`; final tick 1; acceptance `{ targetReached: false, victory: false, fullServiceStable: false, validRun: true }`.
  - `./node_modules/.bin/tsx scripts/phase19NaturalGrowth.ts 24 1 <tmp>/seed2-output 2` => exit 1; JSON status `acceptance-unmet`; final tick 0; `rockTiles: 0`; `legalQuarryFootprints: 0`; `validRun: false`.
  - Nonempty output guard smoke with existing `<tmp>/nonempty-output/summary.json` => exit 1, error mentions `Use an empty output directory`, sentinel JSON preserved.
- Temporary CLI artifacts were generated under `/tmp/stage0-harness-review.2JfoVu`.
  - seed1 stdout SHA256: `705ed20e4ff4aed2b07f94eea252b0cf924ba598bcd42c22b0e1ea8230e9471e`
  - seed2 stdout SHA256: `68c12e801c079c2d73e1cf66f1277db61ee4abfc9bb2c89b51f2ce989fc0139c`
  - treasury preflight probe SHA256: `7271f3e361922a469cae42cdd48c025cab7504bf07b0bb14eef87a6a5f5beb5c`
  - preserved nonempty summary SHA256: `017ca9416314acbb63f52774b271e768a5eefa5129c2a5ee7866e712dcac9639`

exactEvidenceGaps:
- No remaining evidence gap for the bounded two-file harness gate. I treated the bounded CLI probes above as independent manual/CLI QA for this harness-only scope.
- `output/free-city-stage0/placement-review/README.md` is stale and only covers placement/food-throughput review history; it is not evidence for this latest harness diff.
- Full Stage 0 remains explicitly unapproved: no five-seed 1,200,000-tick natural-growth success, no 24-lot victory/stability proof, and terrain selection is still pending.

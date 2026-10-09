# Independent answer replay report review

Verdict: **PASS WITH LIMITS after the manifest-shape correction.** No remaining blocking issue found in the reviewed report and tests. This review does not establish actual replay success or produce measured annual results.

Reviewed SHA256:
- `scripts/engineBAnswerReplayReport.mjs`: `5cb0215bcfbf5c14d7ddaea5a1c4f7714410f5e9e3445b9a6987ba24e41a9905`
- `tests/engineBAnswerReplayReport.test.mjs`: `46c09aa7189019624c47d14a10ec0a11dcd14a7bd0bddbaaba8c22a01e642a78`

## Finding resolved during review

The initial report required a final checkpoint inside `manifest.checkpoints`, but the actual replay stores it separately as `manifest.final` (`engineBAnswerReplay.ts`, construction of result.checkpoints/result.final and final.hit assignment). The initial fixture repeated that incorrect shape, so every real valid replay would have failed. Independently reported this blocker to the implementation owner and parent. Current report checks answer/consequence checkpoints plus separate final at tick500000/hit=true; regression rejects missing, unhit and wrong-tick final. The parent independently identified the same defect.

## Checks

- Input is exact manifest and validity bytes; recorded manifest SHA must match, successful eligibility required, unique seeds1/2/3 enforced, pinned engine/Node/clean-source allowance and matching tool/dependency fingerprints verified. Final expected/actual SHA and checksum must agree. Context, original checkpoint/raw, command-stream and registry-sidecar fingerprints are present. Registry verified-set count must equal classified registry command answers.
- Actual replay classification shape matches consumption: `rows` plus classified/unclassified/excluded/unresolved partitions, command ordinal, history ID, answer tick, source/kind, weights and cameHeavyToLord. Duplicate identities/ordinals, out-of-window ticks, unresolved evidence and inconsistent partitions reject.
- Annual grouping uses each answer's tick/4000, years1300–1424, including all zero years. Counts only classified cameHeavyToLord rows. Whole includes all pinned-taxonomy commands that qualify; registry includes legacy registry sources as well as canonical entries; priorB11 is the exact eleven IDs in `engineBWeightAuditSummary.ts:9–12`. No matter-root transfer or occurrence-count substitution.
- Median, maximum, zero years and above-four-years calculations agree with existing annual-statistics semantics. Pooled population is375 seed-years, not125 years or an averaged seed. Unclassified/excluded totals remain explicit. Endpoint500000 cannot enter annual answer counts.
- CLI uses exclusive `wx` creation, preventing silent report overwrite. Added CLI fixture independently passed successful output creation and refusal to overwrite either output or input evidence.

Independent verification executed: `node --test tests/engineBAnswerReplayReport.test.mjs` — **8 passed, 0 failed** (fixture-only; no simulation). Read the real producer manifest assignments and both complete report/test files.

## Limits

The report checks recorded replay assertions and byte integrity, not the referenced context/checkpoint files themselves, and does not recompute classifier semantics from raw contexts. Tool hashes are required to match across inputs rather than hardcoded to this review; retain reviewed run provenance alongside the report. These are explicitly disclosed limitations, not an independent replay verifier.

Unclassified commands are excluded from heavy density, not asserted nonheavy. Counts are actual command answers under the pinned trace taxonomy; they are not all-history coverage, visible UI proof, root counts, or overall P-T1 completion. Successful real three-seed replay inputs remain necessary before measured totals can be claimed.

No tracked file was edited by this reviewer; only this ignored review artifact was written.

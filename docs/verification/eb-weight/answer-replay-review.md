# Independent answer-replay implementation review

Verdict: **PASS WITH LIMITS for the bounded recorder/replay implementation. No blocking defect found in the reviewed source.** This is read-only implementation review, not completed runtime acceptance, finished annual accounting, or browser verification. No simulation or tests were executed by this reviewer. Inspected all 7 evidence tests and 9 replay tests; their passing execution was reported by the implementation owners/parent, not independently rerun here.

Reviewed SHA256:

| File | SHA256 |
| --- | --- |
| scripts/engineBAnswerEvidence.ts | 3b0fa0721319d9a323e33d3bb76fad73a5d0e5825593d336263314903a4ed706 |
| scripts/engineBAnswerReplay.ts | 04bbb1f6cb0564e5ad72aa786f7f8b92470163fbff13e9f549d514c2131d0094 |
| tests/engineBAnswerEvidence.test.ts | 2a4431d9705de8357b6580f2e6d494730172e9f6e6f44d164f0f9290787c873e |
| tests/engineBAnswerReplay.test.ts | c8f3ae37f357c04a2f1985779b3229219a71ee79fa22e224ea2eefc8a91e24e1 |

## Verified against source

- Compared classifier to `git show 2485af40046793f1856829fa1161dc4431942aa7:src/engine/decisionTrace.ts` lines 133–218. Command allowlist, command-local history-length scan, registry occurrence weights, AFTER estate escalation mapping, chapter BEFORE-state weighing/fallback, source strings and initiative exclusions match. Estate before/after records and chapter before-state are cloned into external evidence (`AnswerEvidence:44–64`). New own-root classifications are checked; merged answers use their own captured context, never the earlier root's weight (`:95–137`). The real reducer fixture explicitly exercises merged rights then large_sum estate answers.
- Command batch is evaluated once, applied in order, then preclose and advanceTick. Original collector observes initial state and every attempt/tick. Candidate collector is registered before initial game creation and compared too (`AnswerReplay:194–252`); this resolves the earlier candidate-omission caveat. Offline `weighOffer` runs only after all state/checkpoint/collector comparisons and observer unregistration (`:241–257`).
- Checkpoint selector mirrors original `engineBWeightAuditCheckpoints.ts:67–92`: reference skips, first eligible pair by entry, own history validation, strict later receipt, original three-year bound, history tick/ID sort. Selection is keyed by entry+answer/consequence phase+history identity, and matched on observed tick (`AnswerReplay:214–215`), preserving same-tick phase and shared-receipt distinctions. Every expected checkpoint must be consumed, unexpected selections reject, complete final serialized state and checksum must match.
- Shared-receipt question: inspected all three archived raw checkpoint manifests. Each has **zero** duplicate consequence `(observedTick, historyId)` groups. Nevertheless `because[]` can cite multiple decisions, so sharing is permitted by the original contract. The corrected pair-specific matcher and the dedicated shared-receipt fixture cover that general case.
- Original collector reuse preserves latest immutable same-ID decision updates, first report witnesses, occurrence/presentation archives and retained pre-pruning roots. Comparison uses all eight snapshot fields rather than reconstructed final history. Candidate totals and changed-command count are separately checked. Known raw observations are seed1 502118, seed2 502115, seed3 501850; changed commands 500/501/562. No heavy-answer totals were inferred from those values.
- Source/runtime/lock/raw/manifest and every compressed/encoded checkpoint integrity check fail closed; decode normalization is rejected. Mismatch state/context evidence is retained. Seed1 preclose captures remain ineligible until checkpoint/final/projection/classification acceptance completes. Registry classified answer identities/weights are crosschecked against the independently pinned sidecar.

## Limits to preserve in reporting

1. `classified.unresolved` blocks acceptance, while commands outside the pinned trace taxonomy are deliberately retained as `unclassified` (`AnswerEvidence:85`; `AnswerReplay:266`). Thus `valid=true` does **not** mean every history command received a weight. Report these counts/categories explicitly; never silently count them as nonheavy. Exact P-T1 answer counts should be labeled under the pinned trace taxonomy. This is consistent with the requested boundary and not a blocker to the recorder.
2. Classification output provides per-answer tick/source/weight, not a completed annual report. Group actual answers by their own tick only after a successful replay; exclude initiatives using the recorded predicate. Tick stewardship/lapses are separate from command answers. Root counts must remain separately labeled.
3. The new command-stream digest has no original digest comparator. Source/controller pinning plus all checkpoint states, full final state, full original collector/candidate projections and counts provide the implemented replay acceptance evidence; the digest alone does not prove original trajectory equality.
4. Fixture tests cover key failure branches but do not exercise a full 500000-tick replay or operational memory/time behavior. Browser eligibility denotes verified preclose saves, not successful visible season-report navigation. No long run or launch was performed by this reviewer.

Only this ignored review artifact was written; implementation files were not changed.

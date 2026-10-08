# Whole-game actual heavy answers — offline accounting boundary

**Verdict: exact whole-game per-answer P-T1 totals cannot be recovered for all answers from the retained archives alone.** Root statistics 91 (seed 1) / 128 (seed 2) are confirmed by summing summary.annual.wholeGameHeavyResolved; they are root-matter statistics, not actual answer counts. Registry occurrence answers are now separately covered. Other merged commands have mixed recoverability.

Read-only inputs: `docs/verification/eb-weight/kept-2485af4/seed-{1,2}.json.gz`, source review of current engine/collector with unchanged engine semantics for this follow-up. Interval [0,500000). Graft first: `graft ask 'cameHeavyToLord merged trace decisions recordCommand history weights heavy actual answers' --source`, then direct source verification. Graft refreshed two ignored cache files and reported ~38,225 tokens saved. No simulation, runner/source changes, or new game.

## Why root records cannot be expanded into answer weights

`src/engine/decisionTrace.ts:154–170` joinMatter merges a subsequent command into an earlier matching-kind matter. It grows targets, deduplicates source aliases in `also`, and sets lastTick. It does not store the new history ID, its tick, its per-command weights, or an ordered membership list. `traceCommand` computes answer weights at :191–216, but the join return at :232–235 discards those per-answer weights. The earlier root's original weights/source remain. Root aliases are neither a count nor canonical answer membership, and final target unions are not historical target snapshots.

`src/engine/history.ts:255–281` records state-changing card commands individually, with command, subjectId, chosen and history id/tick. It does not record weights or escalation. The collector preserves these records (`scripts/engineBWeightAuditCollector.ts:46–52`), but updates each trace ID to its latest merged value (:42–44). Full before/after states are not archived for every answer. No rule licenses copying a root's weights to its aliases.

## Actual archive evidence

| Evidence | seed 1 | seed 2 |
| --- | ---: | ---: |
| All retained in-range history kind=decision (includes steward/initiative, not a heavy denominator) | 1140 | 1109 |
| answer_estate_petition history records | 138 | 140 |
| Those without their own retained trace ID | 120 | 121 |
| Of those, no matching petition reportLine | 120 | 121 |
| Own-ID estate answer trace weights: none / rights / large_sum | 1 / 10 / 7 | 1 / 13 / 5 |
| answer_audit records / without own trace | 41 / 26 | 47 / 25 |
| answer_counter records / without own trace | 1 / 1 | 1 / 1 |

Concrete unknown-weight history: seed 1 `h-003648@55069`, command answer_estate_petition, subjectId estate-petition-36, chosen refused. Seed 2 `h-003509@44071`, same command, subjectId estate-petition-26, chosen refused. Both lack their own trace ID and a corresponding reportLine. Their presentation rows only provide identity/kind and first/last observed tick: seed 1 [55000,55069], seed 2 [44000,44071]. These do not provide the escalation or answer-time weight.

## Feasible rigorous offline algorithm (partial classification, no fabricated total)

1. Deduplicate history by ID, retain actual in-range answer records, exclude steward/lapsed records from the lord-answer denominator; retain each answer's own tick for year allocation. A history decision is evidence of a recorded action, not automatically a successfully answered registry occurrence: use the existing exact occurrence join for registry answers and keep invalid/unresolved joins separate.
2. Registry: use `summarizeRegistryAnswers` and its exact occurrence→history join, weights from the actual occurrence, preserving its unresolved list. Do not add inferred root receipts to direct causal counts.
3. Non-registry answer with **its own exact retained trace ID**: use that root's original weights/source for that original answer only. Do not count it again in the reconstructed registry set. Check history/trace tick identity and lord/lapsed status.
4. Non-registry answer lacking own trace: recover only where source proves an answer-independent weight. `src/content/stewardPolicyConfig.ts:95–119` and `decisionTrace.ts:191,213–216` give answer_audit=land, answer_counter=marriage, answer_will_change=inheritance and famine_response=crisis. Audit choice changes source naming, not its weight; both audit/punish sources are not initiative prefixes. `LORD_INITIATIVES` (:81–85) excludes explicit direct suit/marriage setup/oversight/policy/dues/timber commands from “came to lord” even when weighted. Apply the same exclusion to each actual command's reconstructed source, not the earlier root source. This recovers the merged answer_counter and audit rows above without transferring weights.
5. **answer_estate_petition without own trace remains unknown**, because `decisionTrace.ts:199–204` uses actual answered petition.escalated: amount→large_sum, rights→rights, otherwise []. History command/subject/chosen do not determine it. These 120/121 rows cannot be assigned heavy/light rigorously. A current policy, root's escalation, petition kind, due presence, or presentation presence is insufficient.
6. petition_response normally starts with crisis but `decisionTrace.ts:205–209` can override weights from a bound chapter-registry occurrence and pre-answer weighOffer. In these two archives all 19 such answers per seed have own trace IDs, so rule 3 works; a general algorithm must mark any missing-own-trace dynamic case unknown unless its exact pre-answer weighing is independently retained.
7. Aggregate per year into **known heavy answers / known nonheavy answers / unknown classification**, separately retain root counts. Do not publish the known-heavy subtotal as the complete whole-game answer total. If reporting a numeric upper bound, label it explicitly as known-heavy plus unknown answers, not a measured result. No partial total was computed here.

## Missing fields / engine-owner handoff

The blocking minimum for these archives is the immutable answer-time `weights` (or exact petition.escalated for the estate branch) bound to each answerHistoryId and subjectId/settledTick. A complete general audit record should retain `{answerHistoryId, tick, by, command/source, subjectId, weights, lapsed/success status}` before root merging. Canonical `{answerHistoryId, rootDecisionId}` membership is separately needed if later root receipts are to be attributed to each actual answer; final also/targets inference does not supply that causal contract.

`engineBWeightAuditCollector.ts:59–67` archives stewardReport **handled** petition/event lines, not the full `brought`/escalated rows or all lord petitions. `scripts/engineBWeightAuditRun.ts:80` already states whole-game arrival collection does not classify non-registry weights. The raw presentations and lordDueArrivals are identity/exposure/due observations, not weight snapshots. A handful of saved checkpoints cannot fill all answer-time states.

Finally, “all player decisions” is wider than the existing P-T1 command taxonomy: seed 2 also has decision.market_town (`h-006167@84163`) and decision.stone_town (`h-028971@393043`) without trace roots, and their commands are not in decisionTrace.COMMAND_KIND (:142–149). Their heavy classification cannot be invented from UI prominence. Preserve existing P-T1 scope or request an explicit engine-owned classification contract before claiming every game decision is covered.

No whole-game exact per-answer completion claim is supported by the current archive. The registry-specific correction remains valid and must stay separate from this unresolved non-registry accounting.

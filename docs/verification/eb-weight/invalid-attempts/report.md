# Invalid-only registry observations:010/051/059

**Verified:** requested three IDs have four occurrences total, all invalid and zero successful answers. All five invalid occurrences in the three runs are seed1:051; seed2:053 and010; seed3:059 and010. 053 also has other successfully answered occurrences, so it is not an invalid-only ID. Raw pins and exact retained records are in [evidence.json.gz](evidence.json.gz).

**Correction to UI-gap wording:** these three IDs lack successful answer/consequence UI evidence because no successful answer occurred in these runs. They are not missing captures of successful answers. However each invalid occurrence DOES have a retained `decision.card` history record for the attempted answer. “No actual answer-history record exists” would also be false.

| Seed / ID | Offer→invalid tick | Bound target | Precursor history | Attempt history / choice |
|---|---|---|---|---|
| 1 / ck_evt_051 | 184000→184003 | claim-26 | h-012153 file_suit | h-012167 / file_with_deed |
| 2 / ck_evt_053 | 1000→1015 | suit-1 | see same-tick evidence JSON | h-000050 / roll |
| 2 / ck_evt_010 | 168000→168013 | claim-25 | h-011893 file_suit | h-011895 / b |
| 3 / ck_evt_059 | 48000→48049 | estate-neighbour-3 | h-002125 set_estate_oversight | h-002131 / loyal_candidate |
| 3 / ck_evt_010 | 184000→184003 | claim-21 | h-008754 file_suit | h-008761 / c |

## Evidence-backed mechanism

`lordBotCommands` builds the whole weekly command list from ONE state, ordering marriage → suit → stewardship → registry → town (`src/engine/lordBot.ts:60`, especially:67). `registryMoves` checks enabled choices in that original state (:72), but the runner applies each returned command sequentially (`scripts/engineBWeightAuditRun.ts:44`). Consequently an earlier ordinary command can invalidate a registry answer that was legal when the list was constructed.

010/051 require their fixed claim to remain `status=open`, claimant lord, fishery piece and non-lord titleholder; treasury≥60 is an additional entry condition (`src/content/registry/v4Entries.generated.ts:4`, select IDs). In each of the three fishery cases, archived same-tick history contains an earlier successful `file_suit` on the EXACT bound claim: h-012153→h-012167 (seed1), h-011893→h-011895 (seed2), h-008754→h-008761 (seed3). fileSuit changes that claim to `suing` (`src/engine/estateSuits.ts:100–114`). This is a sufficient reason the fixed open-claim binding must fail. This is stronger than a generic timing hypothesis: the actual precursor command/target/order is retained. The precise first failed expression and any simultaneous treasury change remain unrecorded.

059 requires direct oversight and the fixed current steward plus distinct able/loyal alternatives. In seed3, actual earlier history h-002125 records `set_estate_oversight` on the same estate with chosen `steward`, before attempt h-002131 at48049. The setter applies that mode (`src/engine/stewardship.ts:415–425`); the bot explicitly delegates direct estates (`src/engine/lordBot.ts:161–165`). Mode steward contradicts the entry direct-mode condition, independently of whether a changed currentSteward also breaks fixed binding. Thus underlying bot handling supplies a sufficient revalidation blocker. No own adapter defect is demonstrated by this invalidation.

The fifth invalid, seed2 053 at1015, is now resolved by the retained original checkpoint at9049, not a new replay. [Exact cash/evidence proof](053-retained-ledger.json.gz): empty ledger rollups and all five cash entries through1015 give60−60+55−30−24=1d. Claim1 has deed and witnesses at1015, but no court_roll. The entry requires a still-missing affordable deed OR court_roll: deed is already present, and the remaining court_roll needs20d while cash is1d. Both alternatives are false. Original h-000049 registry.invalid follows deed h-000047 and witnesses h-000048 and precedes attempted roll h-000050. Therefore the entry cannot rebind before the choice adapter executes. This proves a sufficient predicate failure, not the first expression visited or a newly captured pre-command state. Witnesses is never treated as court_roll.

`answerV4Offer` rebinds fixed identities and invalidates only when entry absent/bindEntry returns null (`src/engine/registry.ts:505–508`); disabled choice or command failure instead returns unchanged state. `bindEntry` checks candidate identity and full entry conditions (`src/engine/registryV4.ts:302–346`). Entries exist and are enabled; normal stale-context rejection matches the supported source behavior. No replay or pre-command state was reconstructed.

## Separate history-recording inconsistency

All five invalid occurrences nevertheless have attempted `decision.card` history and zero own decision trace. This is observed, not hypothetical. `gameStore.ts:125` calls recordDecision before traceCommand. `history.ts:255–257` skips only unchanged state, so changing an occurrence to invalid passes; :278–282 writes the selected-choice card without verifying answered status. `decisionTrace.ts:193–196` correctly skips non-answered registry occurrences. This is a concrete history/trace semantic inconsistency (an attempted choice looks like a decision in history), distinct from an own adapter binding bug. Any UI rendering or remediation is outside this task; no screenshot claim is made. The exact stored alternatives/choice text are in JSON, not counted as successful choice coverage.

Existing bounded test anchors, inspected not executed: `tests/engineBBatch1Answers.test.ts:101–113` verifies invalidation with no command effects after causal-source removal; `tests/engineBBatch2Context.test.ts:159` verifies invalidation; `tests/registryStewardSuccessionContext.test.ts:127` checks stale-context refusal. Those do not establish this bot batch sequence is covered by a regression.

No simulation, browser or source changes; no regeneration of committed coverage. Remaining UI language should distinguish unobserved IDs, successful answers not yet rendered, and offered→invalid attempts that have history but no successful outcome.

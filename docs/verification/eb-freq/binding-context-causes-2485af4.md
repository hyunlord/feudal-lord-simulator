# EB-FREQ: binding/context follow-up for 12 of the remaining29

Read-only source/evidence review; no simulation, state construction, tests or UI run. Historical40 stays the original56ee1d9 cohort. This follow-up concerns clean2485af4 seeds1/2/3, not retroactive proof of historical causes. Current source inspected at 956620988621afcc899182dbc9bdd7e9a0e26683. Inspected main adapter/context/stewardship/marriage/bot/generated entry files have no committed diff from2485af4.

Input inventory SHA256 8dcd78803dbd1fa2b73f68ddb6d510d441ecb3f39d1f5cb9d6bc77dca4390412; tracked three-seed gzip SHA256 4d910eb38db2049fc6293f354473447f9d5443404ed79f7b74a67560e65a2659. Aggregator inspected: .omo/evidence/eb-freq-three-seed.mjs (pins raw reports, exact40 and support counts). Inventory40 and remaining29 verified; every requested12 belongs to the remaining29.

**Correction:** 033 accepted once in seed2 despite zero offers. The remaining eleven have no accepted candidate in these recorded calls. “binding” includes missing targets, authored-context rejection and entry-condition rejection; it is not synonymous with absent engine fact.

Shared execution contract: registryV4.ts:268 orders binding dependencies; :282 evaluates/filter/sorts candidates; :302 bindEntry traverses combinations; :323 invokes petitionContext; :330 tests entry conditions. Missing counts count dead-end traversals and can exceed evaluations. Context failure censors entry conditions; missing targets censor both. All reviewed binder groups have truncation0. Observer records no rejected individual condition/context conjunct. Calls cover488/485/483 candidate evaluations perID;12/15/17 other seasonal opportunities have no candidate call and are not attributed. No source-backed missing producer or own adapter binding defect established here. Existing test anchors below are inspected, NOT freshly executed and not natural-run prevalence proofs.

## ck_evt_002

Binding chain is held off-map estate → matching oversight → current steward → estate person. Entry conditions require alive/serving, steward mode, accounts audit, summer/autumn, attention load ≥ capacity ≥2, and no visit within4000ticks. Complete combinations fail entry conditions; the observer does not name the failed conjunct. Held estates are selected by both lord title and possession (stewardship.ts:55); oversight/candidates are automatically made (129), attention is calculated (64), modes are normal setEstateOversight/setAuditMode commands (415/503; registryV4.ts:101/110). Bot delegates direct estates and switches audit mode (lordBot.ts:161), a source-supported policy interaction, not per-call proof of which conjunct failed. Anchor: tests/stewardship.test.ts:40 (actual oversight producer), tests/registryCandidateObservation.test.ts:32 (binder diagnostic). Strongest classification: measured missing estate early and measured unsatisfied entry condition thereafter, not missing producer.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_002; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_002.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":245,"season":243} | 220 | 0 | 220 | {"estate":25} |
| 2 | 0 | {"binding":247,"season":238} | 226 | 0 | 226 | {"estate":21} |
| 3 | 0 | {"binding":246,"season":237} | 222 | 0 | 222 | {"estate":24} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `bound.estate`, `bound.oversight`, `bound.currentPerson.alive`, `bound.currentSteward.status`, `bound.oversight.mode`, `bound.oversight.auditMode`, `selectors.attention.load`, `selectors.attention.capacity`, `state.tick`, `nextMichaelmas`, `state.stewardship.visitTick`, `subtract`.

## ck_evt_011

Binding selects state.diplomacy.negotiations with status countered and deadline≥tick. All observed calls have no qualifying negotiation; counter presence, ≥80ticks left and affordable COUNTER_CASH conditions were never reached. Normal propose_marriage reaches proposeMarriage, which creates accepted/rejected/countered negotiation and deadline (marriage.ts:140); answer_counter consumes it (157), bot answers counters (554; lordBot.ts:86), reducer routes both (gameStore.ts:168). Therefore the fact is produced by engine and commands. Absence at candidate-call times does not prove counters never existed between calls or that the bot caused every absence. Anchor: tests/humanPathMarriage.test.ts:12 and tests/negotiation.test.ts. Strongest classification: missing currently eligible countered negotiation at sampled calls.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_011; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_011.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 0 | 0 | 0 | {"negotiation":488} |
| 2 | 0 | {"binding":485} | 0 | 0 | 0 | {"negotiation":485} |
| 3 | 0 | {"binding":483} | 0 | 0 | 0 | {"negotiation":483} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `bound.negotiation`, `bound.negotiation.counter`, `bound.negotiation.deadline`, `state.tick`, `COUNTER_CASH`, `treasuryBalance`, `state`.

## ck_evt_013

Binding requires pending unexpired audit, its held estate, oversight/current living serving steward, and a distinct alive candidate/serving successor on the same estate. Missing audit or successor prevents every complete combination; revealedKept≥1, loyalty<100, valid connection faction and oversight/steward agreement conditions were never evaluated. makeCandidates creates three dispositions (stewardship.ts:86); ensureOversight installs them (129); replaceDeadStewards creates a new round only when the current dies with no living candidates (151). annual audit creates pending records from revealed theft/errors (366); answerAudit consumes them (543). This allows long intervals without an eligible alternate; it is not an impossible binding. Anchor: tests/stewardship.test.ts:124 (pending audit producer), :187 (dead candidate exclusion). Strongest classification: measured target availability failures, not missing audit/candidate producer.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_013; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_013.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 0 | 0 | 0 | {"audit":471,"successor":17} |
| 2 | 0 | {"binding":485} | 0 | 0 | 0 | {"audit":454,"successor":31} |
| 3 | 0 | {"binding":483} | 0 | 0 | 0 | {"audit":467,"successor":16} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `bound.audit`, `bound.estate`, `bound.oversight.stewardId`, `bound.audit.stewardId`, `bound.currentSteward.status`, `bound.currentPerson.alive`, `bound.successor`, `bound.audit.revealedKept`, `bound.currentSteward.loyalty`, `FACTION_EXISTS`, `bound.currentSteward.connection`, `bound.oversight.mode`.

## ck_evt_018

Groom comes from marriageGrooms, constrained to marriageCandidates(state).groom.id; bride comes from estatesOf.people, constrained to marriageCandidates(state,groom.id).bride.id. Home estate is required; jointurePiece is choice-d only and cannot block entry binding. marriageCandidates actually returns one groom/bride pair object (marriage.ts:104; registryDsl.ts:255 handles project), so project(...,'groom.id'/'bride.id') is not an array/scalar mismatch. Full combinations fail conditions requiring agency, treasuryCoin≥120, VALID_MARRIAGE_PAIR, zero active negotiations and no existing diplomacy.marriage. marriageGrooms (marriage.ts:85) and household/dynasty evolution supply eligible people; proposeMarriage (137) creates marriage/negotiation state. Counter/contract bot policy may consume windows, but no individual failed conjunct is recorded. Anchor: tests/humanPathMarriage.test.ts:12; tests/registryV4.test.ts (DSL binding integration). Strongest classification: measured unavailable groom/bride plus unsatisfied full entry predicate; no demonstrated adapter binding bug.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_018; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_018.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 57 | 0 | 57 | {"bride":148,"groom":283} |
| 2 | 0 | {"binding":485} | 137 | 0 | 137 | {"groom":211,"bride":137} |
| 3 | 0 | {"binding":483} | 119 | 0 | 119 | {"groom":346,"bride":18} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `state.agency`, `state.treasuryCoin`, `VALID_MARRIAGE_PAIR`, `bound.groom.id`, `bound.bride.id`, `ACTIVE_MARRIAGE_NEGOTIATION_COUNT`, `state.diplomacy.marriage`.

## ck_evt_019

Binding requires held estate/oversight/current person and BOTH alive alternate peasantCandidate and merchantCandidate, each different from the current steward. Conditions additionally require serving current person, direct oversight and attention.load>capacity. The producer makes one candidate per disposition (stewardship.ts:86); a serving merchant/peasant therefore removes that same person from the required alternate pool unless a later round supplies another. This is a concrete source constraint, not proof of the sampled current person's disposition. Bot picks non-greedy steward and delegates (lordBot.ts:161), which can also conflict with the direct-mode requirement. MissingBindings below proves which search pools were empty, not why each person was absent. Anchor: tests/stewardship.test.ts:40 and :187. Strongest classification: measured alternate-target scarcity and any recorded condition failures; engine does produce all dispositions.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_019; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_019.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 0 | 0 | 0 | {"estate":49,"merchantCandidate":409,"peasantCandidate":30} |
| 2 | 0 | {"binding":485} | 0 | 0 | 0 | {"estate":39,"merchantCandidate":438,"peasantCandidate":8} |
| 3 | 0 | {"binding":483} | 7 | 0 | 7 | {"estate":46,"merchantCandidate":402,"peasantCandidate":28} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `bound.estate`, `bound.oversight`, `bound.currentPerson.alive`, `bound.currentSteward.status`, `bound.oversight.mode`, `bound.peasantCandidate`, `bound.merchantCandidate`, `selectors.attention.load`, `selectors.attention.capacity`.

## ck_evt_033

Binding requires lord-plaintiff filed/evidence suit and its lord claim. Conditions require at least one unsubmitted deed (treasury≥30) or witnesses (≥24). Normal file_suit creates filed suit (estateSuits.ts:100); add_suit_evidence changes evidence and costs (118). Bot evidence action can close this condition window (lordBot.ts:108), but aggregated observation does not prove that timing. Critically seed2 has an ACCEPTED evaluation; this ID is not binding-only. The no-offer result in that seed remains downstream selection/outer scheduling attribution unresolved. Anchor: tests/suitActions.test.ts; tests/registryV4.test.ts. Strongest classification: missing suit/failed predicate on recorded failures; accepted-but-unoffered in seed2.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_033; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_033.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 18 | 0 | 18 | {"suit":470} |
| 2 | 0 | {"accepted":1,"binding":484} | 14 | 0 | 14 | {"suit":470} |
| 3 | 0 | {"binding":483} | 16 | 0 | 16 | {"suit":467} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `bound.suit`, `bound.claim`, `bound.suit.stage`, `CLAIM_EVIDENCE_KINDS`, `treasuryBalance`, `state`.

## ck_evt_052

Same audit→held estate→oversight→current steward/person→distinct alive successor prerequisite as013; loyalty≤99 instead of<100. All observed branches terminate before complete combination, so condition failure is not proven. Audit and successor producers/commands are stewardship.ts:86,129,151,366,543; no unavailable engine fact demonstrated. Anchor: tests/stewardship.test.ts:124 and :187. Strongest classification: measured missing eligible audit or successor.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_052; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_052.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 0 | 0 | 0 | {"audit":471,"successor":17} |
| 2 | 0 | {"binding":485} | 0 | 0 | 0 | {"audit":454,"successor":31} |
| 3 | 0 | {"binding":483} | 0 | 0 | 0 | {"audit":467,"successor":16} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `selectors.stateCalendar.season`, `bound.audit`, `bound.estate`, `bound.oversight.stewardId`, `bound.audit.stewardId`, `bound.currentSteward.status`, `bound.currentPerson.alive`, `bound.successor`, `bound.audit.revealedKept`, `bound.currentSteward.loyalty`, `FACTION_EXISTS`, `bound.currentSteward.connection`, `bound.oversight.mode`.

## ck_evt_061

After held estate/current steward/person/estateOversight bind, small_rights context (registryPetitionContextEstates.ts:16) requires rights=false, non-null amountAtLeast, an actual granted/refused rights/non-marriage petition below threshold decidedBy=steward, matching held estate, delegated oversight and alive adult serving steward. Every complete combination fails context, BEFORE entry agency condition. Normal set_exception_rules changes rules (stewardship.ts:429); seasonal petition producer sets rights/marriage from kind and records steward answers (301–324). Bot explicitly restores rights=true and amountAtLeast=null once oversight exists (lordBot.ts:158), incompatible with this context after that command. That policy conflict is source-proven; aggregate counters do not identify which context return fired per call. Anchor: tests/engineBBatch1Weights.test.ts:43 and tests/engineBBatch1Answers.test.ts:75 (prepared-state positive adapter tests). Strongest classification: measured context failure plus earlier missing estate; policy-limited prerequisite, not missing producer.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_061; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_061.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 439 | 439 | 0 | {"estate":49} |
| 2 | 0 | {"binding":485} | 446 | 446 | 0 | {"estate":39} |
| 3 | 0 | {"binding":483} | 437 | 437 | 0 | {"estate":46} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `state.agency`.

## ck_evt_075

Suit/claim binding matches033, then old_possession context (registryPetitionContextEstates.ts:28) requires claim.basis=old_possession and a living adult manor household person with role steward. All complete combinations fail context; observer does not split wrong claim basis from missing representative. Engine raises old_possession claim after long possession by someone other than titleholder (estates.ts:269), fileSuit supports it (estateSuits.ts:100). Note held off-map estate is NOT a075 binding requirement; lord plaintiff/claim and specific basis are. Anchor: tests/engineBBatch2Context.test.ts:34,54,120 (prepared positive and wrong-basis negative); tests/estates.test.ts:85 (old-possession producer, neighbour example, not proof of lord-specific run). Strongest classification: missing suitable suit or context rejection; no missing claim producer established.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_075; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_075.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 18 | 18 | 0 | {"suit":470} |
| 2 | 0 | {"binding":485} | 15 | 15 | 0 | {"suit":470} |
| 3 | 0 | {"binding":483} | 16 | 16 | 0 | {"suit":467} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `state.agency`.

## ck_evt_076

Entry requires two distinct held off-map estates, each oversight, current steward/person and an alive alternate able steward for first estate. All observed binding traversals have zero complete combinations: estate/estateB/able missing counts below. Thus context and entry conditions were NEVER reached. If reached, parallel_accounts (registryPetitionContextEstates.ts:52) needs alive other steward and latest real summaries at same tick; conditions require both accounts audit, first direct mode, agency. Seasonal estateSeason emits summary (stewardship.ts:349–356), runs held estates together (403); normal oversight/audit commands select modes. Alternate candidates generated by86/129/151. Anchor: tests/engineBBatch2Context.test.ts:53,55,120. Strongest classification: measured target availability failure; blaming accounts timing or mode for these calls would exceed evidence.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_076; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_076.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 0 | 0 | 0 | {"estate":49,"estateB":78,"able":385} |
| 2 | 0 | {"binding":485} | 0 | 0 | 0 | {"estate":39,"estateB":74,"able":391} |
| 3 | 0 | {"binding":483} | 0 | 0 | 0 | {"estate":46,"estateB":116,"able":350} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `state.agency`, `bound.estateOversight.auditMode`, `bound.estateBOversight.auditMode`, `bound.estateOversight.mode`.

## ck_evt_077

No declared bindings; empty combination always reaches small_rights context, and all calls fail there. Same actual petition and rules prerequisites/producers as061 (registryPetitionContextEstates.ts:16; stewardship.ts:301–324,429). The separate entry rights=false and marriage=false conditions are not reached. Bot rights=true/amountAtLeast=null restoration is a concrete incompatible policy (lordBot.ts:158), not an unavailable fact. Anchor: tests/engineBBatch1Weights.test.ts:43 and tests/engineBBatch1Answers.test.ts:75 (prepared-state adapter exercise). Strongest classification: measured context-only rejection; subpredicate not measured.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_077; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_077.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 488 | 488 | 0 | {} |
| 2 | 0 | {"binding":485} | 485 | 485 | 0 | {} |
| 3 | 0 | {"binding":483} | 483 | 483 | 0 | {} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `state.agency`, `state.stewardship.rules.rights`, `state.stewardship.rules.marriage`.

## ck_evt_090

No declared bindings; all calls fail shop_repair context. townPetitionContext first needs agency, living residents and resident-backed trade households (registryPetitionContextTown.ts:8–13); timberSites require undelivered timber (25); shop_repair requires actual carpenter and rebuildOf pointing at a trade household (74). Normal rebuild_house routes to rebuildBurntHouse, which creates actual rebuildOf construction site only for burned house (fire.ts:150–165; gameStore.ts:204). advanceTrades produces/maintains household trades (trades.ts:529); trades without lived household are removed (:547), making conjunction timing relevant. This is not evidence that rebuild sites or carpenters have no producer; which conjunct failed is unresolved. Anchor: tests/engineBBatch1Answers.test.ts:37,56,75,123 (prepared carpenter positive and cooper/wheelwright negative). Strongest classification: measured context rejection, no per-fact attribution or adapter defect demonstrated.

Spec: src/content/registry/v4Entries.generated.ts:4, select id=ck_evt_090; full exact bindings/conditions also preserved at docs/verification/eb-freq/inventory.json entry ck_evt_090.

| Seed | Offers | Actual first-gate counts | Completed combinations | Context rejects | Condition rejects | Missing binding traversals |
|---|---:|---|---:|---:|---:|---|
| 1 | 0 | {"binding":488} | 488 | 488 | 0 | {} |
| 2 | 0 | {"binding":485} | 485 | 485 | 0 | {} |
| 3 | 0 | {"binding":483} | 483 | 483 | 0 | {} |

Exact entry-condition field/call/derived paths: `selectors.stateCalendar.year`, `state.agency`.

## Limits and bounded next evidence

No recommendation to relax conditions follows. Positive prepared fixtures establish adapter paths are exercisable for their fixture only. To distinguish the remaining rejected conjuncts would require recorded per-predicate/state evidence at the same actual candidate call; stored aggregate counts alone cannot reconstruct that state. A new instrumented run is outside this read-only task. For033 seed2, tracing downstream candidate choice is the relevant separate gap. No complete historical or three-seed gameplay/UI acceptance claim is made.

# Seed3 weight and trace review

Read-only original seed3 evidence; no simulation or tracked changes. Source2485af40046793f1856829fa1161dc4431942aa7, clean, Nodev24.21.0. Raw SHA256: 2973df33958f226900d1dcc219c890f4635488b725e88316bbfc7932fc28eb99. Companion JSON retains exact occurrence IDs, commands, raw histories and late receipts.

## The five-heavy-root year is real

Year1349 ([196000,200000)) contains5 answered heavy roots, no lapse, exactly1 registry root and no prior-batch B11 root:

| Root | Tick | Kind | Source | Weights |
| --- | ---: | --- | --- | --- |
| h-009433 | 196000 | chapter_petition | petition:wages:accept | crisis |
| h-009492 | 196015 | registry | registry:ck_evt_211:a | rights |
| h-009585 | 198000 | chapter_petition | petition:land_redistribution:accept_with_price | crisis |
| h-009598 | 198355 | audit | audit:tolerate:audit-38 | land |
| h-009628 | 199057 | estate_petition | estate_petition:estate-neighbour-3:repair:granted | large_sum |

All five have later linked outcomes in the original3-year window. The annual1–4 target is already exceeded by this root-based measurement, despite unresolved whole-game per-answer undercount. Do not discard an answer, lower its weight or invent a registry-only denominator to pass.

Registry layerOffer (registry.ts:434–438) only suppresses a new heavy registry offer when existing rolling heavyLoad>=3 (stewardPolicyConfig registryCrowded=3). heavyLoad counts existing roots within4000 ticks, not actual merged answers, calendar totals or future reservations. At the196000 offer boundary, prior rolling heavy roots were h-009162@192037 (209b) and h-009255@194000 (vacant_priest). The wages response is a command at196000 after the tick's offer;211a answered196015. Later land redistribution, audit and estate answers are outside this registry admission gate. This is a whole-game scheduling/budget limitation, not evidence that211 bypassed its existing registry gate. No core budget edits were made or proposed as an automatic scope expansion.

## Fourteen mature registry-root gaps

Every listed occurrence is answered, with exact own decision history. All have zero strictly later non-decision because links within12000 ticks. Seven209d holds plus one211c hold make8 relation-only immediate effects; the remaining6 choices change market dues.

| Root | Tick | Source | Actual authored command / recorded hold | Later links outside3years |
| --- | ---: | --- | --- | ---: |
| h-001950 | 44149 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-003343 | 72073 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-006163 | 132055 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-006845 | 147031 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-016265 | 329005 | registry:ck_evt_092:a | [{"type":"set_market_dues","args":{"permille":1000}}] | 0 |
| h-016689 | 337039 | registry:ck_evt_211:b | [{"type":"set_market_dues","args":{"permille":{"binding":"bound.higherDues"}}}] | 0 |
| h-018126 | 367069 | registry:ck_evt_083:c | [{"type":"set_market_dues","args":{"permille":800}}] | 10 |
| h-018758 | 380017 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-020257 | 411061 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-022500 | 452011 | registry:ck_evt_209:d | {"faction":"commons","delta":-2} | 0 |
| h-022849 | 458017 | registry:ck_evt_083:c | [{"type":"set_market_dues","args":{"permille":800}}] | 0 |
| h-023214 | 465037 | registry:ck_evt_211:b | [{"type":"set_market_dues","args":{"permille":{"binding":"bound.higherDues"}}}] | 0 |
| h-023632 | 473071 | registry:ck_evt_211:c | {"faction":"merchant_house_1","delta":-2} | 0 |
| h-024144 | 483055 | registry:ck_evt_211:a | [{"type":"set_market_dues","args":{"permille":{"binding":"bound.lowerDues"}}}] | 0 |

**209d (seven rows):** actual hold commons−2, target faction:commons, no timber command. registry.ts:512, registryV4.applyHold, history.ts:1285 and factions.applyFactionRecords provide the penalty/memory path. Future faction acts need threshold/direction/cooldown conditions; raw archive lacks full faction snapshots to isolate the failing gate. No evidence of adapter no-op or dropped target. Numeric relation movement can clamp, so the receipt alone does not prove an unclamped−2 before/after change.

**092a:** changes dues to1000. **083c (two):** changes dues to800. **211b (two):** uses real bound higherDues1100 at337039 and900 at465037. **211a:** uses bound lowerDues800 at483055. Actual answered status and dues target agree with setMarketDues and the adapter; choice predicates reject equal settings. The authored context at092329000 and083367000/458000 reports prior1100, but is an offer-context snapshot, not a substitute for answer-time state. No failed command adapter is demonstrated.

**211c at473071:** keeps the rate and records merchant_house_1−2. Its dues target is additionally installed by traceCommand for every choice of an event that has any set_market_dues option (decisionTrace.ts:223–227), even though this chosen branch has no rate-setting command. This is existing shared target semantics, not evidence of a newly changed rate.

Dues payment_flow wiring exists: decisionFlowConfig maps dues→stall_fee; decisionTrace.ts:467–481 inspects fresh nonzero ledger postings and every eligible decision target. The last archived dues stall-fee receipt is h-014831@302400 (income30), earlier than all seven dues-target gaps. The observer archive is not the full ledger; this supports absence of recorded qualifying flow links, not a claim that all later trading/tax vanished. Later rate overrides alone do not explain the absence, since payment_flow loops all eligible live target decisions rather than only the latest.

## Separate stale-cause concern:083c gets late receipts for a later1100 rate

h-018126@367069 set800. It has10 later faction.relation receipts at449000–453000, first h-022297/h-022298 at449000. They say dues_held:1100:1000 and name h-018126 as because. The actual intervening direct rate-setting root h-020065@407083 is set_market_dues:1100 with empty weights.

duesMind.ts:61 feeDecision selects the latest **retained** decision whose targets include dues, without checking which decision set the current rate. decisionTrace.prune retains weighted lord roots indefinitely but removes unweighted settings after40000 ticks, at annual boundaries. Static inference: h-020065 becomes older than40000 at448000 and can be pruned, exposing older retained083c; next seasonal receipts at449000 then point to083800 while describing1100. Raw ordering/amounts align exactly with this source mechanism. No boundary snapshot was decoded here, so label the precise prune transition as source-consistent inference, not a separately replayed transition.

This is a concrete engine causal-ownership risk exposed by long-term retention, distinct from an083 adapter bug or missing economic effect. The late links must NOT be credited to the original3-year coverage. They also must not be presented as proof that083 caused the later1100 dissatisfaction.

## Disposition

Retain5-root annual violation and14 mature missing-future rows. No own-B adapter failure is proven for these14 choices. Route whole-game admission guarantees and stale latest-retained-dues ownership to engine-owner review; keep conditional immediate-effect choices visible as such. All56 runtime/visual acceptance and exact whole-game actual-answer budget remain separate gates. Graft orientation was checked against live source; relevant registry/trace/budget code compared equal to2485.

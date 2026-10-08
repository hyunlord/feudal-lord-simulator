# Seed2: two mature registry-root gaps

Read-only source/raw diagnosis; no simulation or tracked edits. Input `.omo/evidence/weight125-kept-partial/seed-2.json`, SHA256 `9e3737c46b4825564510f1748f36d0abef4376824cf34bf57237d89ba50663be`, clean original source `2485af40046793f1856829fa1161dc4431942aa7`. Relevant engine/registry content files were compared with2485 and had no diff.

**Neither case demonstrates a broken choice adapter.** Both choices have intended immediate effects and the recorded targets agree with source wiring. Their missing future because links concern the consequence contract: cancellation has no future delivery to report, while a small relationship penalty does not guarantee a later faction act. These findings do not close the user's every-answer future-trace requirement.

## 046 cancel: real cancellation, then a different later order

- Occurrence `registry:ck_evt_046:timber.order|:98`, offered98000, settled98047, answered `cancel`, weight large_sum.
- Own history/trace `h-007126`, command answer_registry_offer, source `registry:ck_evt_046:cancel`, target `timber`; no merged alias.
- Authored cancel command is `order_timber(amount=0)`. `registryV4.ts:81` runs the existing handler and requires timberOrder to change. `timberTrade.ts:19` removes timberOrder on cancellation, leaves already-owned timber and money unchanged, and returns unchanged state if already zero. The answered occurrence plus changed timber target is evidence of an actual order change, not an accepted no-op. Exact prior remaining quantity is not in this archive.
- Copy explicitly promises no further purchases under the canceled order, no refund, and no loss of already-delivered timber. A delivery after cancellation is not the expected positive outcome.
- `decisionTrace.ts:486` emits goods_delivered when an advance-tick timber order decreases, attributed to the latest live timber decision. The command-time cancellation is outside this future-tick comparison. There is no authored cancellation/avoided-spend future receipt in this path.
- Actual raw later decision `h-007263` at100855 is `order_timber:400`, target timber. First archived later delivery is `h-007264` at100880, brought2, because `h-007263`. There are115 archived goods_delivered records strictly within (98047,110047], first100880 and last110000; they name the later order rather than046. This is evidence that later ordering supersedes cancellation's timber attribution, not evidence the046 adapter silently failed.
- No future non-decision history because names h-007126 within its12000-tick mature window. Do not manufacture a delivery link or claim a measured amount of avoided expenditure. If every answer must have a later receipt, this requires an explicit engine/UI contract for canceled orders or a distinction between immediate fulfillment and conditional future outcomes—not a registry command remap.

## 209 d: deliberate hold with immediate commons penalty

- Occurrence `registry:ck_evt_209:v41.N4|103:103`, offered103000, settled103039, answered `d`, weight large_sum, recorded `hold={faction:commons,delta:-2}`.
- Own history/trace `h-007455`, command answer_registry_offer, source `registry:ck_evt_209:d`, target `faction:commons`. No timber target is appropriate because this choice keeps the current order unchanged.
- Authored d has no engine commands and `noOpIsConsequential=true`. This does NOT mean zero effect in the implemented adapter: `registry.ts:512` invokes applyHold; `registryV4.ts:185` resolves the sender relation cost. `history.ts:1285` emits faction.relation with the exact registry reason, and `factions.ts:434` applies relation/memory records. `gameStore.ts:125` performs recordDecision before traceCommand, whose linkMemories (`decisionTrace.ts:302`) associates matching new memory with the decision and gains the faction target. The observed hold and faction target agree with that path.
- The wording promises order maintenance and commons relationship−2, not a guaranteed future order/delivery or scheduled reconsideration. The immediate relation-history/memory objects are not fully archived here: this collector retains decision history or records with because. We therefore verify intended immediate penalty plus recorded hold/target, not a measured before/after final relation value (which could also be clamped).
- Future faction acts are conditional: season boundaries, relation magnitude30/60, small-act annual cooldown, large-act ten-year cooldown, and same-direction relation movement10 since the previous same-direction act (`factionActs.ts:147`; factionActConfig). actCauses further selects live memories of the act's direction. A−2 penalty does not guarantee a qualifying negative act or inclusion in a later positive act.
- No future non-decision history because names h-007455 in (103039,115039]. The one archived because-bearing faction.act in that window is merchant_house_2 at105000 (`h-007562`, because h-006757), unrelated to commons. This does NOT prove commons performed no act: acts without because are outside this archive's retention contract. Raw snapshots of commons relation, prior acts and memories at each boundary are absent, so the exact unmet runtime gate cannot be singled out honestly.
- Later209 b at111073 (`h-008042`) changes timber; later209 a at115051 (`h-008300`) changes timber and commons. Neither supplies a missing causal link to the earlier d answer. The latter is also12 ticks beyond d's12000-tick window.

## Disposition

046: expected immediate cancel effect, later independent reorder; future cancellation receipt not implemented in the inspected path. High confidence that this is not a failed order_timber adapter; future-feedback design gap remains.

209 d: expected hold cost with correct faction target, conditional future act not observed as linked. High confidence the target/hold wiring exists; insufficient state evidence to identify which faction-act gate prevented an attributed outcome. No evidence supporting an adapter bug or a guaranteed no-op.

Keep both in the actual mature answered denominator and missing-future list. Do not suppress them, relabel them lapsed, invent because links, or infer engine-wide absence from this observer archive.038 merged-followup accounting is a separate issue and is not used to explain these two independent roots.

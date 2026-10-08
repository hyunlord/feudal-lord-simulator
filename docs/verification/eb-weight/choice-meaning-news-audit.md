# Supported56: bounded choice-meaning/news audit

Static, read-only audit of canonical choices with empty command arrays or noOpIsConsequential. No canonical, engine, policy, weight, or news classification changes; no simulations. Graft map/callers used for orientation, then live source and existing tests inspected. The first map invocation used an unsupported --tokens flag; plain graft map succeeded. Graph claims were checked against source.

**Result: no supported event is proven meaningless across all branches by this slice; no justified whole-event news demotion was found.** That does not establish the existing empty news list as a fully audited design verdict. Meaningful alternatives, preserving resources, rejecting terms and accepting risk are decisions even when they do not initiate a positive flow. Future trace visibility is a separate requirement.

## Exact candidate inventory

Enumerated registryV4Support().filter(runs):56 events. Their canonical choices contain18 candidates:17 supported empty-command choices and one unsupported empty-command choice. Five have noOpIsConsequential=true; all five nevertheless incur an implemented relation hold. No flagged command-bearing choice was found in this scope.

| Event | Choice | Supported choice | noOpIsConsequential | Implemented hold |
| --- | --- | --- | --- | --- |
| ck_evt_005 | c | true | false | {"kind":"relation","faction":"merchant_house_1"} |
| ck_evt_009 | defer | true | false | {"kind":"claim"} |
| ck_evt_010 | b | true | false | {"kind":"claim"} |
| ck_evt_011 | c | true | false | {"kind":"deadline","binding":"negotiation"} |
| ck_evt_015 | b | true | false | {"kind":"relation","faction":"town"} |
| ck_evt_024 | keep | true | false | {"kind":"relation","faction":"town"} |
| ck_evt_032 | defer | true | false | {"kind":"claim"} |
| ck_evt_033 | defer | true | false | {"kind":"claim"} |
| ck_evt_035 | wait | true | false | {"kind":"relation","faction":"town"} |
| ck_evt_038 | defer | true | false | {"kind":"claim"} |
| ck_evt_046 | stock | false | false | none |
| ck_evt_051 | leave | true | false | {"kind":"claim"} |
| ck_evt_053 | defer | true | false | {"kind":"claim"} |
| ck_evt_201 | c | true | true | {"kind":"relation","faction":"town"} |
| ck_evt_204 | c | true | true | {"kind":"relation","faction":"town"} |
| ck_evt_206 | d | true | true | {"kind":"relation","faction":"commons"} |
| ck_evt_209 | d | true | true | {"kind":"relation","faction":"commons"} |
| ck_evt_211 | c | true | true | {"kind":"relation","faction":"merchant_house_1"} |

## Implemented effect paths and limitations

- **Seven claim holds:**009/defer,010/b,032/defer,033/defer,038/defer,051/leave,053/defer. registryV4.ts:168 selects claim/suit bindings; applyHold at185 resolves the real claim and decreases strength by5, floor0. registry.ts:512 settles the answer with its hold receipt. Refusing a filing/evidence/enforcement expense preserves cash and leaves the existing legal situation; it is not a neutral news acknowledgement. At strength0 the numeric reduction is0 and applyHold still returns a hold; v4EnabledChoices:367 checks non-null application, not positive numeric change. This is a saturation/meaningfulness edge requiring state-aware review, not proof every branch is ineffective. In particular a post-verdict038 hold need not reverse an existing verdict or move possession, and future effect of reducing that claim's strength is not guaranteed.
- **Nine relation holds:**005/c→merchant_house_1;015/b,024/keep,035/wait,201/c,204/c→town;206/d,209/d→commons;211/c→merchant_house_1. applyHold:196 requires the faction exists and records delta−2. history.ts:1285 creates the faction.relation receipt; factions.ts:434 applies clamped relation and appends memory; decisionTrace.ts:302 links the memory/target. Thus commands=[] and even noOpIsConsequential=true do not imply no effect. At relation−100 the displayed relation cannot fall further, but memory is still appended with its signed delta; do not claim either a guaranteed−2 numeric movement or zero effect. Later faction acts remain conditional on thresholds/direction/cooldowns.
- **One deadline hold:**011/c binds an actual countered negotiation whose deadline has not passed; canonical conditions require at least80 ticks remaining. applyHold's deadline branch returns the same underlying world state plus a deadline identity receipt; answerV4Offer still settles the occurrence. It does not consume ticks, shorten the deadline or schedule reconsideration. Existing negotiation expiry continues in marriage.ts:179. This is a deliberate refusal to accept now with ongoing risk and preserved cash, not demonstrated incremental time consumption. Wording that implies the click itself spends a fixed amount of time would overclaim. It is the clearest candidate for verifying presentation of preservation/uncertainty, not an automatic event-to-news conversion: other choices act on the proposal.
- **Unsupported046/stock:** holdCost is null; choiceSupport at213 rejects it as hold without a time cost; v4EnabledChoices checks supported before use. Its authored preservation tradeoff (keep remaining deliveries and future spending) is meaningful in principle, but that branch is not currently executable. This is a capability mismatch/held-choice question, not an exposed meaningless button.046 remains a supported event because trim/cancel change its standing order. Do not silently activate stock or demote the entire event.

## Concrete copy mismatch

024/keep and035/wait have enabled town−2 hold effects, but the canonical choice tradeoff strings inspected do not mention that penalty.024 discusses keeping current tax and not promising visitors;035 discusses keeping cash and missing a purchase opportunity. registryCanon.test.ts:47 explicitly asserts both sender holds resolve to town. This is a choice-cost disclosure gap. Neither should be described as a pure preservation/no-cost choice merely because its commands array is empty. No copy was edited in this pass.

## Existing tests inspected, not rerun

- tests/registryV4.test.ts:116 covers claim strength reduction,005 relation hold through recordDecision, and046 stock unsupported. It tests representative mechanism behavior, not all17 enabled choice contexts or floor cases.
- tests/registryCanon.test.ts:47 asserts sender mapping for024/035 (and held008), and only003/046 have unsupported no-time-cost holds across the broader canon.003 is outside this supported56 candidate set.
- tests/engineBBatch1Weights.test.ts around64–67 checks individual enabled monetary/hold choices can still promote weight. This does not prove every hold produces a future receipt.

## Runtime/acceptance gaps

No exhaustive all-choice live execution or boundary-state exploration was performed. Numeric floors, deadline-only preservation, claim relevance after verdict, later overrides, report readability and future receipts need separate evidence. The already-observed seed2 209/d hold has a commons−2 receipt and target but no linked future outcome within3years, illustrating why immediate meaning and future visibility must stay separate.

Recommendation: retain supported weights and existing classifications; record no proven whole-event news candidates **within this narrow static slice**, plus explicit024/035 cost-copy gaps,046 unsupported preservation branch,011 deadline wording/receipt limitation, and floor-state qualifications. Empty news recommendations should be qualified by scope, not promoted into proof that every supported choice is meaningful in every possible state.

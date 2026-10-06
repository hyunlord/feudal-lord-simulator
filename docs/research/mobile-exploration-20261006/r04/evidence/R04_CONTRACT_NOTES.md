# R04 finite diplomacy model

Scope: only `prototype/model/contracts.ts`, `contracts.types.ts`, `tests/contracts.test.ts`, this note. Existing model City/economy book API reused. No original game edits, dependencies, DGX, random draws, clock reads, or holdout seeds.

## Integration contract

- `createDiplomacy(enabled=true)` is serializable world state separate from City. Save/replay it with cities.
- Context `{ cities: Record<seatId,City>, diplomacy, now: externalRound }`. Use stable **seat** IDs with externally rotated processing order. Never strategy IDs. All functions mutate accumulators intentionally.
- `proposeContract(ctx,terms)` takes `id,from,to,give:Stocks,take:Stocks,offerUntil,deliverAt,pactUntil`. Amounts nonnegative integers; both parties must give something. Future offer deadline <= delivery < pact expiry <= now+8. ID deduplicated permanently in that world. Baseline one proposal/round, up to four with actual paid envoy labor's `services.influence`; exported `diplomacyCapacity(city)` reports this.
- `autoOffer(ctx,from,to)` searches finite 15%-stock barter candidates, max20 offered units, public ratios .5/1/2; requires both utilities positive and proposer pays envoy1. Returns `ContractResult` union `{ok:true,contract}` or `{ok:false,reason}`. It does **not** accept automatically.
- `answerContract(ctx,id,accept)` supports manual consent and utility-driven AI. Consent alone cannot bypass negative recipient utility/inventory. Utility is recalculated at acceptance after possible economic changes. Proposal-time estimates retained in contract; acceptance receipt records live total.
- `advanceContracts(ctx)` expires pending offers and atomically delivers accepted shipments at due time. Call every external/recovery round; shipments settle even if polling jumps over deadline. Ownership swaps once. Pact remains until explicit expiry and is never permanent.
- `hasPact(state,{from,to,now})` governs scheduler attack eligibility, not defense stats. `recordAvoidedRaid(ctx,from,to)` only call when a raid otherwise would have been selected. Repeated identical attacker/round call records once.
- `breachContract(ctx,id,actor)` lets scheduler/player break paid pact before attack; explicit confirmation is caller UI concern. Costs any remaining bond plus up to2 available coin as compensation and public reputation -4. Successful delivery reputation +1. No invented debt if broke city cannot pay2. Breach cancels pact and returns unexchanged goods.
- `ownedEscrow(state,seat)` returns that city's goods + bond. Add once to free City stocks for V. Zero receivables/debts are invented. No promised profit in V. On delivery physical goods move owner exactly once; bond returns, so escrow drops to0.

## Public provisional equations and costs

Scarcity price r = base[r]×(.5 + 2×need[r]/(need[r]+freeStock[r])). Bases food1/material2/tools4/coin1; needs max(10,population×2)/30/12/40. Utilities use each party's own prices, so mutually useful trade arises from different real inventories, not labels.

Utility = received scarcity value − given scarcity value − shipping + expected avoided raid − counterparty risk. Shipping=max(1,4-floor(transportService/10)); each pays from finite coin at acceptance. Avoided raid=min(8,other.training×.04,own exposed stock value×.02), an **explicit approximate expectation**, not actual measured damage or direct defense bonus. Risk=max(0,-counterpartyReputation)×.5. Proposer also pays envoy1 even if rejected/expired. No refund of consumed envoy/shipping.

Bond2 each, reserved separately. A party cannot reserve more than25% of an individual free resource in one offer. One live contract per pair, max8 rounds, count/cargo capacity limit. Cargo combined bundles <=40+floor((both transportService)/5). Multiple simultaneous counterparties can reserve more than25% citywide: this prototype per-offer cap is **not** the R02 commercial raid-wide reservation cap; attack reservations are a separate subsystem. Proposals already charged still count toward round envoy capacity even if rejected.

Breach before delivery transfers offender bond2 plus paid penalty to partner; returns both bundles and remaining bonds. After delivery bonds already returned, so breach costs coin+reputation only. Peace is a choice with forgone possible raids, fees, and reciprocal goods; it does not improve combat unit stats. Deterministic shipments have no random shipping loss in this minimum model. Real alliance/voting/server transaction isolation are not implemented here.

## Evidence and review

Node test suite covers owned reservation conservation/net envoy cost; delivery+retry no duplication; finite deadline; exploitative offer refusal despite diplomacy policy100; symmetric breach compensation; duplicate/overreservation; diplomacy ON/OFF and actual avoided-raid receipt; current-scarcity reevaluation; late acceptance. Fixtures use seed1 only. Initial API test failed before implementation, then lifecycle tests passed. Final strict TypeScript and test result reported to parent; full UI/league ON/OFF measurement belongs to integration and must not be claimed from unit tests.

Architecture: contract lifecycle accumulator in one module; value/types in separate module; no casts/any/non-null assertions. Context is a reusable simulation domain with explicit time, city registry, diplomacy accumulator. No unknown input crosses this internal API; UI/replay parsing remains caller boundary. File stays below250 code lines. All resource changes go through actual economy `book`.

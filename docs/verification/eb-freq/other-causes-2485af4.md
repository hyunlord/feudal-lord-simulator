# EB-FREQ: remaining 15 historical-zero IDs — three-seed causal review

Read-only review of existing measurements and source. No simulation, changed conditions, code changes, or new runtime tests. This is a subset of the exact historical 40-ID cohort; it neither replaces that cohort nor adds a fourth sample. All 15 IDs below have **zero accepted candidate evaluations and zero offers in each of seeds 1, 2, and 3**. Thus there are no accepted-but-unoffered cases in this subset to attribute to downstream budget/conflict selection.

## Provenance and interpretation

Measurement: `.omo/evidence/eb-freq-three-seed.json`; original inputs: `.remote-runs/engineB-weight125-kept-clean-2485af4/eb-weight-kept/seed-{1,2,3}.json`. Source revision `2485af40046793f1856829fa1161dc4431942aa7`, 125-year window `[1300,1425)`, ticks below 500000. Source/test files cited below were checked against that revision; no differences in the reviewed files.

Raw SHA-256:

- Seed 1: `3cf11889398f36ac8dc8c0230dc509d5e46cbaa8abdcd1f568d7a0744600dbfd`
- Seed 2: `9e3737c46b4825564510f1748f36d0abef4376824cf34bf57237d89ba50663be`
- Seed 3: `2973df33958f226900d1dcc219c890f4635488b725e88316bbfc7932fc28eb99`

Each ID has 488 / 485 / 483 actual candidate observations respectively. Counts are **first failed gates**, not independent predicates tested at every season. The remaining 12 / 15 / 17 seasons lack candidate calls; this report does not infer why. Early rejection censors later gates. Missing-binding counters count attempted binding failures and can exceed the number of rejected candidate calls.

## Exact per-ID results

| ID | Seed 1 first gates | Seed 2 first gates | Seed 3 first gates | Strongest supported classification |
|---|---|---|---|---|
| 025 | binding=33, pace=455 | binding=24, pace=461 | binding=23, pace=460 | Narrow live context: pending audit / successor absent at binding; earlier pace suppression. |
| 029 | binding=13, enabled_choices=112, season=363 | binding=11, enabled_choices=114, season=360 | binding=12, enabled_choices=113, season=358 | Consequential-choice bottleneck: exactly one enabled choice at every bound evaluation; seasonal restriction. |
| 035 | binding=20, pace=219, season=249 | binding=13, pace=223, season=249 | binding=13, pace=221, season=249 | Narrow conjunctive entry conditions: every binding attempt fails entry conditions; earlier season / pace suppression. |
| 037 | binding=33, pace=455 | binding=24, pace=461 | binding=23, pace=460 | Narrow conjunctive entry conditions, plus occasional missing estate; earlier pace suppression. |
| 057 | chapter_preparation=33, pace=455 | chapter_preparation=24, pace=461 | chapter_preparation=23, pace=460 | Chapter preparation context not met at every pace-open attempt; precise subreason not logged. |
| 124 | binding=31, enabled_choices=2, pace=455 | binding=19, enabled_choices=5, pace=461 | binding=21, enabled_choices=2, pace=460 | Marriage context / executable-choice bottleneck: missing groom or bride, or zero enabled choices; earlier pace suppression. |
| 128 | binding=31, enabled_choices=2, pace=455 | binding=19, enabled_choices=5, pace=461 | binding=21, enabled_choices=2, pace=460 | Marriage context / executable-choice bottleneck: missing groom or bride, or zero enabled choices; earlier pace suppression. |
| 131 | binding=31, enabled_choices=2, pace=455 | binding=19, enabled_choices=5, pace=461 | binding=21, enabled_choices=2, pace=460 | Marriage context / executable-choice bottleneck: missing groom or bride, or zero enabled choices; earlier pace suppression. |
| 132 | binding=31, enabled_choices=2, pace=455 | binding=19, enabled_choices=5, pace=461 | binding=21, enabled_choices=2, pace=460 | Marriage context / executable-choice bottleneck: missing groom or bride, or zero enabled choices; earlier pace suppression. |
| 133 | binding=31, enabled_choices=2, pace=455 | binding=19, enabled_choices=5, pace=461 | binding=21, enabled_choices=2, pace=460 | Marriage context / executable-choice bottleneck: missing groom or bride, or zero enabled choices; earlier pace suppression. |
| 139 | binding=31, enabled_choices=2, pace=455 | binding=19, enabled_choices=5, pace=461 | binding=21, enabled_choices=2, pace=460 | Marriage context / executable-choice bottleneck: missing groom or bride, or zero enabled choices; earlier pace suppression. |
| 143 | binding=72, draw=412, enabled_choices=4 | binding=72, draw=411, enabled_choices=2 | binding=74, draw=409 | Draw suppression plus missing eligible suit / insufficient executable choices. |
| 147 | draw=2, pace=30, year=456 | draw=2, pace=30, year=453 | draw=2, pace=28, year=453 | Measured year / pace / draw suppression only; downstream context never evaluated. |
| 150 | binding=66, draw=422 | binding=83, draw=399, enabled_choices=3 | binding=67, draw=414, enabled_choices=2 | Draw suppression plus missing eligible suit / insufficient executable choices. |
| 157 | binding=2, draw=31, pace=455 | binding=3, draw=21, pace=461 | binding=2, draw=21, pace=460 | Pace / draw suppression plus missing required merchant candidate at every binding attempt. |

## What the gates actually establish

`src/engine/registryV4.ts:438`–460 evaluates year, season, once-used, pace, annual cap, cooldown, draw, chapter preparation, binding, dedup, new-context and enabled choices in that order. All reviewed entries require at least two executable consequential choices.

- **Pace** (`registryV4.ts:411`–424): a shared deterministic seasonal draw against `floor(1000 * remaining supported unused one-shots / seasons until the latest remaining window end)`, capped at 1000. Remaining one-shots count entries whose end year has not passed; this is not a check of current contextual eligibility. A pace rejection proves no binding or choice evaluation occurred for that entry in that call.
- **Draw** (`registryV4.ts:447`): the entry-specific deterministic hash of seed, entry ID and season index must fall below `chancePermille`. 143, 147, 150 and 157 use 150; other reviewed IDs use 1000. This is a seasonal threshold, not a guaranteed per-year occurrence rate.
- **Binding** (`registryV4.ts:298`–355): required targets, authored context and entry conditions must resolve in a valid combination. Optional `requiredForChoices` bindings disable their affected choices rather than invalidate the entry. Aggregated condition-failure counts do not name the predicate that failed.
- **Enabled choices** (`registryV4.ts:360`–369, `145`–159): support, scoped binding, choice conditions and actual existing-handler consequences all matter. Every command in an atomic sequence must change state and satisfy its adapter consequence check. An unchanged audit mode, duplicate evidence, or refused marriage is not an executable consequential choice. Serialized editorial labels such as `blocked_until_atomic_adapter` must not be mistaken for current runtime unsupported status; runtime support and the implemented atomic adapter govern.
- **Cooldown/conflict**: none of these 15 has a measured first gate of cooldown, annual cap, dedup or new_context. No accepted evaluations means downstream winner-budget/conflict loss cannot explain this subset. Semantic availability conflicts inside a handler remain possible, but they are different from registry cooldown and are not identified by the aggregate logs.

## Per-family source explanation and limits

### 025 — audit context

Generated entry `ck_evt_025` binds an actual pending audit and successor, then requires a living serving steward on the estate, revealed kept amount at least 2, loyalty at most 90, population/faction/tenant constraints and a substantively different successor. Binding diagnostics show missing audit/successor counts of 30/3, 22/2, and 23/0, with no entry-condition failures. The strongest claim is absence of a required live target at those sampled attempts. Existing audit handling and successor selection are implemented (`src/engine/stewardship.ts:519`–567); this is not evidence of a missing audit producer.

### 029 — two choices required, only one executable

At all 112 / 114 / 113 enabled-choice rejections the available-choice count is exactly one (aggregate totals equal counts; each rejection is below the threshold of two). The entry is eligible only in season index 1. Its `accounts` and `visit` choices explicitly exclude the current mode; a replacement-plus-accounts option additionally requires an eligible better-ability/lower-loyalty candidate, clean current steward, no pending audit, and the authored hiding comparison. The source explains why the nominal three choices need not provide two executable choices. Diagnostics do not identify which replacement prerequisite failed. `setAuditMode` exists at `stewardship.ts:503`; optional binding and atomic execution are implemented. Classify as measured executable-choice scarcity, not a missing adapter.

### 035 — timber need and liquidity conjunction

All 20 / 13 / 13 binding-gate observations report entry-condition failure and no missing binding/context failure. Generated `ck_evt_035` requires season 2 or 3, a real timber trade market, no outstanding timber order, treasury at least 72, available timber below 12, waiting timber need above available stock, and population at least 1. `src/engine/registryDsl.ts:54` and `:59` dispatch the actual timber demand/market selectors. The measurement supports failure of this conjunction; it does not prove which component was absent or that the scenario cannot produce it.

### 037 — attention and stewardship conjunction

Binding diagnostics: seed 1 has 31 condition failures plus 2 missing-estate failures; seed 2 has 24 condition failures; seed 3 has 22 condition failures plus 1 missing estate. The generated entry requires living serving steward, steward oversight with accounts audit, attention load at least capacity with capacity at least 2, a future Michaelmas, and no visit within 4000 ticks. Direct/visit choices use existing oversight handlers. These are narrow simultaneous conditions; no exact failed conjunct or missing producer is established.

### 057 — chapter preparation, not an unimplemented chapter scenario

All 33 / 24 / 23 pace-open calls stop at `chapter_preparation`, before binding. `src/engine/registryChapterPetitions.ts:35`–60 checks agency/year, politics, no market-charter right or unanswered stock market-charter petition, minimum existing stall fee above 750 and at most 1000, dues 250–2000, a built market within footprint distance 4 of a church/chapel, no previous same-ID petition/occurrence, and at least 80 ticks before deadline. The two registry definitions are intentionally outside the normal calendar scheduler (`:26`–28) and candidate preparation creates a copy only. That architecture does not make 057 unsupported. Aggregate observations lack a preparation subreason, so geometry, charter conflict, fee and other causes must remain alternatives. Existing tests cover eligibility/conflict (`tests/registryChapterPetitions.test.ts:70`), actual footprint boundary (`:91`), minimum right fee (`:121`) and winner persistence (`:176`).

### 124, 128, 131, 132, 133, 139 — actual marriage availability

Each of the six IDs has identical first-gate counts: missing groom/bride contexts dominate the binding calls, and the 2 / 5 / 2 calls that reach choice checking have zero enabled choices. Generated entries bind actual `marriageGrooms`, the counterpart estate and `marriageCandidates`; their authored offers call `propose_marriage` with terms and choice-specific prerequisites (128 also has choice-scoped estate bindings). The existing groom/bride producers are `src/engine/marriage.ts:85`–111. `marriageRefusal` (`:114`–122) rejects missing groom/bride, an existing marriage or pending counteroffer, invalid terms, or insufficient treasury; `proposeMarriage` (`:138`) then leaves state unchanged. The registry adapter (`registryV4.ts:95`–96) requires an actual added negotiation. Source therefore establishes a functioning route with state-dependent gates, not a generally unsupported scenario. A specific under-way marriage conflict, liquidity shortage, or term rejection is **not** proved by the aggregate zero-choice counts.

### 143 and 150 — eligible suit and admissible evidence

Missing eligible suit counts are 72 / 72 / 74 for 143 and 66 / 83 / 67 for 150. Required suit belongs to the lord and is at filed/evidence stage, with a matching lord claim. 143 has witnesses and charter choices requiring absent evidence and treasury 24 / 40; its 4 / 2 / 0 enabled-choice failures all have zero choices. 150 has atomic witnesses-plus-court-roll, court-roll alone, and dues reduction to 900; evidence and liquidity gates apply and dues must exceed 900. Its 0 / 3 / 2 failed choice checks have enabled-choice sums 0 / 2 / 2, respectively: fewer than two choices each. `registryV4.ts:83`–88 checks actual evidence addition. Existing binding/atomic tests (`tests/registryV4.test.ts:70`, `:82`, `:93`, `:142`) demonstrate supported suit paths in fixtures. They do not establish a naturally eligible suit at the rejected campaign calls.

### 147 — narrow historical window entirely censored before context

147 is eligible in 1348–1355, which is inside the measured campaign; it is not an outside-run era case. In-window observations split into pace=30/30/28 and draw=2/2/2. No binding, chapter-context or choice attempt occurs. Thus neither missing succession context nor unsupported scenario can be inferred from this run. The actual predecessor-to-successor transition adapter has fixture coverage (`tests/registryStewardSuccessionContext.test.ts:38`, `:56`, `:72`, `:88`), including save/compaction stability and executed choices. Its authored stewardship/attention/visit conditions remain untested by these campaign candidate observations. Strongest causal label: measured scheduling suppression within a narrow in-run window; downstream eligibility unknown.

### 157 — merchant candidate binding

After pace and draw, every binding attempt fails to find `merchantCandidate` (2 / 3 / 2). The generated entry additionally requires actual estate/current steward, living serving status, peasant and merchant candidate roles, steward/accounts mode, attention pressure, season 1 or 2, pre-Michaelmas timing and no recent visit. Candidate generation exists in `src/engine/stewardship.ts:85`–110; initialization and successor replacement are at `:128`–170. A missing eligible role at sampled calls is not proof that the engine has no producer. The first failed gate does not reveal which filter removed the merchant candidate or whether later conjunctions would pass.

## Classification boundary for the historical 40 contract

For this 15-ID subset, use **measured narrow live context / consequential-choice gates** for 025, 029, 035, 037, 057, 124, 128, 131, 132, 133, 139, 143, 150 and 157, with the specific sublabels above; use **measured pace/draw suppression inside a narrow window; downstream unknown** for 147. Retain raw first-gate counts alongside those interpretive labels. No reviewed ID has sufficient evidence here for a categorical missing-producer, scenario-unsupported, impossible-condition, or registry cooldown/conflict diagnosis. This does not establish that every conjunction is naturally reachable: fixture support and existing producers are narrower evidence than natural campaign reachability.

The source tests were inspected, not rerun for this read-only task. No exact failed-predicate attribution, counterfactual rate, balance recommendation, or runtime condition relaxation is claimed.

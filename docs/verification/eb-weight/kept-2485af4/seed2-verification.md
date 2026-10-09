# Seed2 offline verification

Single-seed preliminary verification; NOT the final three-seed gate. This verification did not run a simulation. The completed original and verification are archived here.

Input: `.omo/evidence/weight125-kept-partial/seed-2.json`
SHA-256: `9e3737c46b4825564510f1748f36d0abef4376824cf34bf57237d89ba50663be`
Source: `2485af40046793f1856829fa1161dc4431942aa7`; dirtyPaths empty; original runtime v24.21.0.

Checks: {"source2485":true,"clean":true,"nodeOriginal":true,"period":true,"complete":true,"candidateFailuresZero":true,"support56":true,"summaryExact":true,"summaryMismatches":[]}. Entire recomputed summarizeWeightAudit object compared with cached summary using isDeepStrictEqual. Observation: {"observations":502115,"firstTick":0,"lastTick":500000,"maxGap":1,"reversals":0,"cadence":"initial_and_every_command_attempt_and_tick","retention":"runner_owned_id_maps_before_engine_retention"}. Support56 exactly matches seed1; candidate observer failures 0.

| Metric | Total | Median/year | Max/year | Zero years |
| --- | ---: | ---: | ---: | ---: |
| whole | 128 | 1 | 3 | 41 |
| registry | 68 | 0 | 2 | 67 |
| b11 | 7 | 0 | 1 | 118 |
| registryHeavyOffers | 77 | 1 | 2 | 62 |

Root-thread mature answered coverage (lapsed excluded; original12000-tick window):

- matureLord: 175/191
- matureRegistryLord: 63/65
- matureB11Lord: 6/6

Steward actual archived report witness coverage: 608/608; registry 2/2. These are model witnesses, not rendered UI proof.

Occurrence accounting: {"occurrences":79,"answeredOccurrences":77,"lordAnswered":75,"stewardAnswered":2,"invalid":2,"lapsed":0,"unresolvedAnswers":0,"excludedAnsweredSettlements":0}. Weighted lord answers annual: {"total":75,"countedYears":125,"median":0,"maximum":2,"zeroYears":63,"aboveFourYears":0}. Direct versus inferred merged-root coverage remains separate: {"matureLord":{"counted":72,"directWithFuture":63,"inferredRootWithFuture":3,"ambiguousRootCandidates":0},"censoredLord":{"counted":3,"directWithFuture":2,"inferredRootWithFuture":0,"ambiguousRootCandidates":0}}. Root statistics above must not be called actual answer counts. Complete per-answer identity, unresolved rows and missing-root lists are in the companion JSON.

## Exact historical40 frequencies

Inventory-derived exact40 set; current seed2 observed 6/40. Historical seed1 counts are context, not a controlled seed2 causal comparison.

| ID | Historical observed | Current seed2 occurrences |
| --- | ---: | ---: |
| ck_evt_002 | 0 | 0 |
| ck_evt_010 | 0 | 1 |
| ck_evt_011 | 0 | 0 |
| ck_evt_013 | 0 | 0 |
| ck_evt_018 | 0 | 0 |
| ck_evt_019 | 0 | 0 |
| ck_evt_024 | 0 | 0 |
| ck_evt_025 | 0 | 0 |
| ck_evt_029 | 0 | 0 |
| ck_evt_031 | 0 | 0 |
| ck_evt_033 | 0 | 0 |
| ck_evt_034 | 0 | 1 |
| ck_evt_035 | 0 | 0 |
| ck_evt_037 | 0 | 0 |
| ck_evt_042 | 0 | 1 |
| ck_evt_052 | 0 | 0 |
| ck_evt_057 | 0 | 0 |
| ck_evt_059 | 0 | 0 |
| ck_evt_061 | 0 | 0 |
| ck_evt_075 | 0 | 0 |
| ck_evt_076 | 0 | 0 |
| ck_evt_077 | 0 | 0 |
| ck_evt_080 | 0 | 0 |
| ck_evt_083 | 0 | 3 |
| ck_evt_090 | 0 | 0 |
| ck_evt_124 | 0 | 0 |
| ck_evt_128 | 0 | 0 |
| ck_evt_130 | 0 | 1 |
| ck_evt_131 | 0 | 0 |
| ck_evt_132 | 0 | 0 |
| ck_evt_133 | 0 | 0 |
| ck_evt_139 | 0 | 0 |
| ck_evt_140 | 0 | 1 |
| ck_evt_143 | 0 | 0 |
| ck_evt_144 | 0 | 0 |
| ck_evt_147 | 0 | 0 |
| ck_evt_150 | 0 | 0 |
| ck_evt_157 | 0 | 0 |
| ck_evt_163 | 0 | 0 |
| ck_evt_174 | 0 | 0 |

Unobserved IDs are not evidence of missing engine facts or adapter bugs. No source-causal or whole56 visual acceptance is inferred.

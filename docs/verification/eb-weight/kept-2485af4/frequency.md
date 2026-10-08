# EB-FREQ latest checkpointed seed 1 versus earlier seed-1 control

**Partial: seed 1 only. Seeds 2/3 and the three-seed gate remain pending.**

## Provenance

| Input | Source revision | Raw SHA-256 |
|---|---|---|
| Latest checkpointed125: `.omo/evidence/weight125-kept-partial/seed-1.json` | `2485af40046793f1856829fa1161dc4431942aa7` (clean) | `3cf11889398f36ac8dc8c0230dc509d5e46cbaa8abdcd1f568d7a0744600dbfd` |
| Earlier corrected125 control: `.omo/evidence/weight125-partial/seed-1.json` | `de3d9e224636c5e69bc18e2ea7ccb7d7bd97c69d` (clean) | `ad340b87763c4a44975b536fd2786df5b343e6d128581e1bb42bef174a9c9a69` |

Both runs: seed 1, 125 years, 1300 ≤ year < 1425, endTick 500000, Node v24.21.0. Latest adds actual checkpoint retention; the historical 40-ID cohort remains sourced from `docs/verification/eb-freq/inventory.json`, originally unobserved in historical source `56ee1d9d`. The older comparison input above is the corrected seed-1 control, not that original historical run.

## Comparison result

The entire parsed `candidateObservation` object is exactly equal between inputs, including all per-gate counts, first/last primitive witnesses, binding diagnostics, enabled-choice totals, limits, and observer-failure count. The entire parsed `support` object is also exactly equal, including per-ID occurrence counts and decision IDs. This is stronger than aggregate-count agreement, but it does not assert complete final GameState equality.

Both inputs have 27,328 candidate observations across all supported IDs, 19,520 observations across the exact historical 40 (488 per ID), and zero observer failures. Historical-cohort offers remain 8 IDs / 8 occurrences; 32 IDs remain unoffered. Nine IDs reached `accepted`; `ck_evt_010` was accepted at tick 184000 with three enabled choices but never offered. No per-ID gate or binder diagnostic changed in the latest run.

## Exact historical 40 comparison

`offers old→new`; gates list current actual first-gate evaluation counts. Binder column shows combinations/contextFailures/conditionFailures, missing binding counters, and truncation count on `binding` rejections only. All rows have identical complete group objects and support entries between runs.

| ID | Offers old→new | Actual gates | Binding diagnostics | Exact evidence delta |
|---|---:|---|---|---|
| `ck_evt_002` | 0→0 | binding=245; season=243 | 220/0/220; missing={"estate":25}; truncated=0 | none |
| `ck_evt_010` | 0→0 | accepted=1; binding=487 | 0/0/0; missing={"claim":487}; truncated=0 | none |
| `ck_evt_011` | 0→0 | binding=488 | 0/0/0; missing={"negotiation":488}; truncated=0 | none |
| `ck_evt_013` | 0→0 | binding=488 | 0/0/0; missing={"audit":471,"successor":17}; truncated=0 | none |
| `ck_evt_018` | 0→0 | binding=488 | 57/0/57; missing={"bride":148,"groom":283}; truncated=0 | none |
| `ck_evt_019` | 0→0 | binding=488 | 0/0/0; missing={"estate":49,"merchantCandidate":409,"peasantCandidate":30}; truncated=0 | none |
| `ck_evt_024` | 1→1 | accepted=2; binding=3; once_used=96; pace=148; season=239 | 3/0/3; missing={}; truncated=0 | none |
| `ck_evt_025` | 0→0 | binding=33; pace=455 | 0/0/0; missing={"audit":30,"successor":3}; truncated=0 | none |
| `ck_evt_029` | 0→0 | binding=13; enabled_choices=112; season=363 | 0/0/0; missing={"estate":13}; truncated=0 | none |
| `ck_evt_031` | 1→1 | accepted=1; binding=15; once_used=217; pace=255 | 1/0/1; missing={"ableCandidate":12,"estate":2}; truncated=0 | none |
| `ck_evt_033` | 0→0 | binding=488 | 18/0/18; missing={"suit":470}; truncated=0 | none |
| `ck_evt_034` | 1→1 | accepted=4; binding=2; once_used=321; pace=161 | 0/0/0; missing={"estate":2}; truncated=0 | none |
| `ck_evt_035` | 0→0 | binding=20; pace=219; season=249 | 20/0/20; missing={}; truncated=0 | none |
| `ck_evt_037` | 0→0 | binding=33; pace=455 | 31/0/31; missing={"estate":2}; truncated=0 | none |
| `ck_evt_042` | 1→1 | accepted=6; annual_cap=2; binding=369; cooldown=21; new_context=90 | 369/0/369; missing={}; truncated=0 | none |
| `ck_evt_052` | 0→0 | binding=488 | 0/0/0; missing={"audit":471,"successor":17}; truncated=0 | none |
| `ck_evt_057` | 0→0 | chapter_preparation=33; pace=455 | not first rejection | none |
| `ck_evt_059` | 0→0 | binding=488 | 126/0/126; missing={"ableCandidate":385,"estate":49}; truncated=0 | none |
| `ck_evt_061` | 0→0 | binding=488 | 439/439/0; missing={"estate":49}; truncated=0 | none |
| `ck_evt_075` | 0→0 | binding=488 | 18/18/0; missing={"suit":470}; truncated=0 | none |
| `ck_evt_076` | 0→0 | binding=488 | 0/0/0; missing={"able":385,"estate":49,"estateB":78}; truncated=0 | none |
| `ck_evt_077` | 0→0 | binding=488 | 488/488/0; missing={}; truncated=0 | none |
| `ck_evt_080` | 0→0 | year=488 | not first rejection | none |
| `ck_evt_083` | 0→0 | binding=484; enabled_choices=4 | 484/484/0; missing={}; truncated=0 | none |
| `ck_evt_090` | 0→0 | binding=488 | 488/488/0; missing={}; truncated=0 | none |
| `ck_evt_124` | 0→0 | binding=31; enabled_choices=2; pace=455 | 0/0/0; missing={"bride":5,"groom":26}; truncated=0 | none |
| `ck_evt_128` | 0→0 | binding=31; enabled_choices=2; pace=455 | 0/0/0; missing={"bride":5,"groom":26}; truncated=0 | none |
| `ck_evt_130` | 1→1 | accepted=3; binding=2; once_used=342; pace=141 | 0/0/0; missing={"estate":2}; truncated=0 | none |
| `ck_evt_131` | 0→0 | binding=31; enabled_choices=2; pace=455 | 0/0/0; missing={"bride":5,"groom":26}; truncated=0 | none |
| `ck_evt_132` | 0→0 | binding=31; enabled_choices=2; pace=455 | 0/0/0; missing={"bride":5,"groom":26}; truncated=0 | none |
| `ck_evt_133` | 0→0 | binding=31; enabled_choices=2; pace=455 | 0/0/0; missing={"bride":5,"groom":26}; truncated=0 | none |
| `ck_evt_139` | 0→0 | binding=31; enabled_choices=2; pace=455 | 0/0/0; missing={"bride":5,"groom":26}; truncated=0 | none |
| `ck_evt_140` | 1→1 | accepted=1; binding=2; once_used=373; pace=112 | 0/0/0; missing={"estate":2}; truncated=0 | none |
| `ck_evt_143` | 0→0 | binding=72; draw=412; enabled_choices=4 | 0/0/0; missing={"suit":72}; truncated=0 | none |
| `ck_evt_144` | 1→1 | accepted=1; draw=19; enabled_choices=3; once_used=80; pace=385 | not first rejection | none |
| `ck_evt_147` | 0→0 | draw=2; pace=30; year=456 | not first rejection | none |
| `ck_evt_150` | 0→0 | binding=66; draw=422 | 0/0/0; missing={"suit":66}; truncated=0 | none |
| `ck_evt_157` | 0→0 | binding=2; draw=31; pace=455 | 0/0/0; missing={"merchantCandidate":2}; truncated=0 | none |
| `ck_evt_163` | 1→1 | accepted=1; draw=6; once_used=11; pace=102; season=368 | not first rejection | none |
| `ck_evt_174` | 0→0 | year=488 | not first rejection | none |

## Attribution that remains valid

- Offered historical IDs: `024,031,034,042,130,140,144,163`, each one occurrence. Once-used/cooldown/annual-cap/new-context records after an offer explain rejected repeats, not a missing first offer.
- `080/174`: year gate 488 each and authored windows beginning 1430 remain outside this run. This is a whole-window era exclusion.
- `010`: its sole accepted evaluation at tick184000 entered the V4 weighted-selection pool, but the actual selected/offered V4 occurrence that season was `ck_evt_051` (`registry:ck_evt_051:old_fishery_claim|:184`, later invalidated at184003). This one opportunity is an observed weighted-selection loss, not universal binding failure. Keep its487 missing-claim rejections and12 outer/unobserved seasons separate; no whole-period single-cause claim follows. Production evidence: `registryV4.ts` pushes accepted candidates before recording acceptance; `registry.ts:offerV4Season` selects one weighted candidate from that returned pool. First/last witnesses prove these two candidates at184000, not the complete candidate set.
- `029`: 112 enabled-choice rejections; `083`: 484 context rejections and four enabled-choice rejections. `124/128/131/132/133/139`: two enabled-choice rejections each, with zero enabled choices; `143`: four at zero. These are measured candidate gates, not proof of an absent fact producer.
- `057`: chapter-preparation rejection 33, pace455. `147`: year456/pace30/draw2; no binding evaluation was reached in retained gate evidence.
- Missing eligible binding candidates, context rejection and false condition conjunctions are actual local failures at evaluated calls. None proves the engine never produces the required fact; no adapter bug is established.

## Remaining limits

Candidate observation records only the first failing gate in actual v4 candidate calls. Outer budget/legacy skips and complete candidate-selection pools are not measured. The single010 accepted evaluation can nevertheless be paired with the actual051 offer at the same tick as described above. The 12 seasons outside the 488 recorded evaluations cannot be assigned a skip reason. Failed condition subexpressions/context branches are not retained; only first/last witnesses per ID/gate survive. No truncation is recorded for this cohort. Do not sum binding traversal counters as independent opportunities.

Latest/checkpointed and earlier/control evidence equality rules out a change in these measured seed-1 outcomes between these artifacts. It does not prove observer noninterference for all possible runs, three-seed frequency closure, automatic UI visibility, or complete state preservation. Full first/last witnesses remain in each raw artifact; the earlier per-ID witness table is `.omo/evidence/weight125-partial/freq-seed1.md`.

Verification: checked latest expected SHA-256, exact40/no duplicates, per-ID support against raw in-range occurrences, all40 group/support equality, whole candidateObservation equality and whole support equality. No simulation/browser/remote job or source edits.

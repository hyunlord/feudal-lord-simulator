# ck_evt_140/a — 멀리 있는 땅을 보는 비용

Status: **FAIL_HARNESS — original failure retained; parent final-JPEG review completed**.

Official run: `engineB-weight140-live-6308a7d`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `6308a7dd3b41475546da378198b46e6bfcff6d8c`.
Selected source observed: `registry:ck_evt_140:a`. Answer: `h-015428`.

| Metric | Observed |
|---|---|
| initialTick | 222067 |
| finalTick | not observed |
| initialYearCount | not observed |
| automaticYearCount | not observed |
| exactReceiptCount | 0 |
| actualEffectReceiptCount | 0 |
| exactNewRowCount | 0 |
| progressAtTen | true |
| manualTargetCaptured | not observed |
| navigationUnchanged | not observed |

Canonical title in actual manual expected fact: false. Fact: not observed.
Manual navigation SHA: `not observed` → `not observed`.
Stop: not observed. Absence: not observed.

Failure cause and compact state comparison:

정상 ‘나중에’가 이전 속도를 복구한 뒤 하네스가 명시적으로 시계를 32ms 진행시켜, 탐색 SHA 비교에 실제 실행 3틱이 섞였다. 저장 비교는 **223153→223156**이며 변한 최상위 키는 tick, buildings, walkers, wallTick, autoplayFoodFlow, autoplayRecurringDelivery, timberProductionWindow, settlement다. 부모가 registry-after-later-1.jpg에서 가려지지 않은 정상 세계 화면을 직접 확인했다. 목표의 정확한 실제 결과는 아직 없으며 카드·탐색 SHA 쌍도 미관측이다. 화면·흔적 결함이 아닌 **하네스 실패**로 분류한다.

비교 SHA: 36858e139dabf96291fdcda4f3c1b65679743c4b8a4699b1bdc32befe8aaad53 → e29a9d65a23e7cfe3a0a9b6f9b2e8f9186b043647352a0b53c86aa4ccb009ee8. 부모의 도구 수정 ce1f4ba8a는 불필요한 시계 진행을 제거했으나 이 실행에는 들어 있지 않다. 재시도가 필요하며 아직 통과를 주장하지 않는다. 원본 보고·archive.json·첫 실패는 모두 보존한다.

Original errors and archive checks:

- AssertionError [ERR_ASSERTION]: Normal Later changed game state + actual - expected  + 'e29a9d65a23e7cfe3a0a9b6f9b2e8f9186b043647352a0b53c86aa4ccb009ee8' - '36858e139dabf96291fdcda4f3c1b65679743c4b8a4699b1bdc32befe8aaad53' 
- official_exit_code:1
- original_report_valid_is_not_true
- original_report_has_errors
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed
- no_new_exact_receipt_with_actual_effect_evidence

State and unchanged JPEG evidence:

- initial@222067: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `92d51690192beb488b37514f46c95a51b669df111b341f3b0671508813f4bd21`; integrity true.
- registry-covered-1@223153: [JPEG](registry-covered-1.jpg), [state](registry-covered-1.state.json.gz), SHA `36858e139dabf96291fdcda4f3c1b65679743c4b8a4699b1bdc32befe8aaad53`; integrity true.
- registry-after-later-1@223156: [JPEG](registry-after-later-1.jpg), [state](registry-after-later-1.state.json.gz), SHA `e29a9d65a23e7cfe3a0a9b6f9b2e8f9186b043647352a0b53c86aa4ccb009ee8`; integrity true.
- failure@223156: [JPEG](failure.jpg), [state](registry-after-later-1.state.json.gz), SHA `e29a9d65a23e7cfe3a0a9b6f9b2e8f9186b043647352a0b53c86aa4ccb009ee8`; integrity true.

Limits:

- Parent personally inspected registry-after-later-1.jpg: the normal world is uncovered. JPEG SHA and the compact state comparison are in human-review.json.
- This is a harness timing failure, not an established screen or trace failure. No exact target receipt, target card, or navigation SHA pair was observed.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

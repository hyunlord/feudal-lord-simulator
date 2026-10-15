# ck_evt_031/able — 청지기를 갈아야 할 때

Status: **FAIL — original failure retained; human JPEG review pending**.

Official run: `engineB-weight031-live-95335f5`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `95335f57aa940375fa399218400aa8dbb4a63f46`.
Selected source observed: `registry:ck_evt_031:able`. Answer: `h-013352`.

| Metric | Observed |
|---|---|
| initialTick | 275029 |
| finalTick | 276000 |
| initialYearCount | 2 |
| automaticYearCount | not observed |
| exactReceiptCount | 0 |
| actualEffectReceiptCount | 0 |
| exactNewRowCount | 0 |
| progressAtTen | true |
| manualTargetCaptured | not observed |
| navigationUnchanged | not observed |

Canonical title in actual manual expected fact: false. Fact: not observed.
Manual navigation SHA: `not observed` → `not observed`.
Stop: substantive_or_unknown_intervention_required. Absence: no_new_exact_because_result_in_observed_window.

Original errors and archive checks:

- official_exit_code:1
- original_report_valid_is_not_true
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed
- no_new_exact_receipt_with_actual_effect_evidence

State and unchanged JPEG evidence:

- initial@275029: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `358cda4573d8cd6ecf78fa02f45e39927c1613e39b6ab2c56b025a800f7e92a5`; integrity true.
- final@276000: [JPEG](final.jpg), [state](final.state.json.gz), SHA `3eb0de7bbd331d260790ce8e13bc22ba0f91907e1db6e07e758d0120e471370e`; integrity true.

Limits:

- No human image review is claimed. Review the original JPEG files before visual acceptance.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

## 원인 분류

부모가 final.jpg를 확인했다.276000틱에 ‘영주를 상대로 한 소송’ 자동 정지 알림이 열렸다. 이 실행은 아직031의 실제 후속 결과에 도달하지 못했으며 trace/표시 실패를 증명하지 않는다. 분류는 하네스 관측 중단이다.

AutoPauseNotice.tsx:54의 정상 ‘계속’은 pauseToggle→setSpeed만 호출하며 소송에 답하지 않는다. 후속 실행은 소송ID·기한·횟수를 남기고 클릭 직전/직후SHA·틱 일치를 검사한 뒤 정상시간을 진행한다. 이는 별도 소송을 답하지 않은 경로이며 단순 정보 확인으로 숨기지 않는다. 원래 실패를 보존하고 재실행은 별도 실행ID로 한다.

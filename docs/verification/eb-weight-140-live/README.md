# ck_evt_140/a — 멀리 있는 땅을 보는 비용

Status: **FAIL_OBSERVATION_INTERRUPTED — original failure retained; parent final-JPEG review completed**.

Official run: `engineB-weight140-live-4a61b4a`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `4a61b4a657249ccccf9722c803710d9e3e6fc8e7`.
Selected source observed: `registry:ck_evt_140:a`. Answer: `h-015428`.

| Metric | Observed |
|---|---|
| initialTick | 222067 |
| finalTick | 223153 |
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
Stop: substantive_or_unknown_intervention_required. Absence: no_new_exact_because_result_in_observed_window.

Observed interruption and cause:

부모가 final.jpg에서 사건 025 「빠진 돈과 회계 담당자의 후원자」 결정 카드가 관측을 막는 것을 직접 확인했다. tick 223153에 멈췄으며, 역사 입력의 첫 감사 결과 예정 tick 230320에 도달하지 않았다. 현재 하네스는 목표의 실제 결과가 나온 뒤에만 정상 ‘나중에’를 처리하므로, 결과 전의 별개 결정 카드에서 관측을 끝냈다. 목표 실제 결과 0건은 짧아진 관측 창의 결과이며 흔적·제품 결함의 증거가 아니다.

부모가 결과 전 정상 ‘나중에’ 경로를 쓰는 후속 관측 도구를 준비 중이다. 재시도 통과 여부는 아직 판정하지 않으며, 원본 실패 보고와 archive.json은 그대로 보존한다.

Original errors and archive checks:

- official_exit_code:1
- original_report_valid_is_not_true
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed
- no_new_exact_receipt_with_actual_effect_evidence

State and unchanged JPEG evidence:

- initial@222067: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `92d51690192beb488b37514f46c95a51b669df111b341f3b0671508813f4bd21`; integrity true.
- final@223153: [JPEG](final.jpg), [state](final.state.json.gz), SHA `36858e139dabf96291fdcda4f3c1b65679743c4b8a4699b1bdc32befe8aaad53`; integrity true.

Limits:

- Parent personally inspected final.jpg; registry event 025 blocks the observation. Its JPEG hash and delegated review record are in human-review.json.
- This is a harness observation limit, not an established trace or product failure. No actual target receipt, target result card, or navigation SHA pair was observed.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

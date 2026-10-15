# ck_evt_130/c — 권리 이야기는 내 책상으로

Status: **FAIL_OBSERVATION_INTERRUPTED — original failure retained; parent final-JPEG review completed**.

Official run: `engineB-weight130-live-4a61b4a`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `4a61b4a657249ccccf9722c803710d9e3e6fc8e7`.
Selected source observed: `registry:ck_evt_130:c`. Answer: `h-005112`.

| Metric | Observed |
|---|---|
| initialTick | 67003 |
| finalTick | 68001 |
| initialYearCount | 1 |
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

부모가 final.jpg에서 권리 청원과 영주 상대 소송이 함께 뜬 자동 정지를 직접 확인했다. tick 68001에 멈췄으며, 역사 입력의 첫 감사 결과 예정 tick 74320에 도달하지 않았다. 현재 관측 하네스는 suit_defence 단독 알림만 정상 계속으로 처리하므로 이 복합 알림에서 관측이 끝났다. 실제 결과 0건은 이 짧아진 관측 창의 결과이며, 흔적 누락이나 제품 결함의 증거가 아니다.

현재 순차 실행 줄이 끝난 뒤 재시도할 계획이며, 재시도 통과 여부는 아직 판정하지 않는다. 원본 실패 보고와 archive.json은 그대로 보존한다.

Original errors and archive checks:

- official_exit_code:1
- original_report_valid_is_not_true
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed
- no_new_exact_receipt_with_actual_effect_evidence

State and unchanged JPEG evidence:

- initial@67003: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `af2c19bf4b82e6fb4f62d01c131dac83ebcf85238574a57d6d37f13eb846537d`; integrity true.
- final@68001: [JPEG](final.jpg), [state](final.state.json.gz), SHA `5a0a3184d1f78d9febaf07e4f5279d751592659b35456f9f196052ffb74138be`; integrity true.

Limits:

- Parent personally inspected final.jpg; the combined rights-petition and suit-against-lord pause is visible. Its JPEG hash and delegated review record are in human-review.json.
- This is a harness observation limit, not an established trace or product failure. No actual receipt, result card, or navigation SHA pair was observed.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

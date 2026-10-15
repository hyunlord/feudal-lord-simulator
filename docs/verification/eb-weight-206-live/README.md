# ck_evt_206/a — 불길 뒤에 남은 서까래

Status: **FAIL_SCREEN_CHIP_CAPACITY — actual results and reader membership confirmed; parent original-JPEG review completed**.

Official run: `engineB-weight206-live-9f769ee`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.
Selected source observed: `registry:ck_evt_206:a`. Answer: `h-020520`.

| Metric | Observed |
|---|---|
| initialTick | 314029 |
| finalTick | 314277 |
| initialYearCount | 4 |
| automaticYearCount | not observed |
| exactReceiptCount | 3 |
| actualEffectReceiptCount | 3 |
| exactNewRowCount | 0 |
| progressAtTen | true |
| manualTargetCaptured | not observed |
| navigationUnchanged | not observed |

Canonical title in actual manual expected fact: false. Fact: not observed.
Manual navigation SHA: `not observed` → `not observed`.
Stop: bounded_original_first_result_plus_200_ticks. Absence: canonical_membership_exists_but_matching_uncovered_chip_not_observed.

Actual results and screen failure classification:

목재가 tick 314080·314160·314240에 각각 2단씩 실제 배송되어 주문 잔량이 10→8→6→4로 줄었다. 결과 h-020521·h-020522·h-020524는 모두 선택 답 h-020520을 정확한 직접 원인으로 기록한다. 최종 tick 314277의 연간 읽기는 7건이며 대상 「1378년 당신의 결정 때문에: 불길 뒤에 남은 서까래」는 기존 관계 효과를 포함해 4건이다.

부모가 최종 원본 JPEG를 직접 검토했으나 대상 연간 칩은 없었다. 영주 상대 소송·불탄 자리·인두세 징수의 세 칩이 자리를 차지한다. 대상 DOM 칩 [], 패널 [], manual=null이며, useStoryPresentation.ts:25 및 :81–96의 MAX_CHIPS=3 표시 우선순위/자리 부족으로 분류한다. 실제 결과와 흔적은 있으므로 흔적 누락이 아니다. 결과 카드·탐색 SHA는 미관측이며 변경 판정이 아니다. 제한된 관측 창의 실패로 보존하고 영구 접근 불가나 전체 56사건 통과를 주장하지 않는다.

Original errors and archive checks:

- official_exit_code:1
- original_report_valid_is_not_true
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed

State and unchanged JPEG evidence:

- initial@314029: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `2210d8500e28ba5323b64c3401e1aee4c8c30e057b9f4acb1e200f036082b6f0`; integrity true.
- first-exact-receipt@314080: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `e9447b34cd09aa8ecd94ac0f88c1b16edf3d757aa6ab5dc2f4d143696cea1987`; integrity true.
- final@314277: [JPEG](final.jpg), [state](final.state.json.gz), SHA `984d82e74ed30b0f6d682759977a239ff5117f3840db679ee64f4887f1cee360`; integrity true.

Limits:

- Parent personally inspected final.jpg: annual target chip absent; suit-against-lord, burnt-plot, and poll-tax chips occupy three slots. Its original JPEG hash is in human-review.json.
- Target card and navigation SHA pair are NOT OBSERVED, not changed. This bounded window does not establish permanent inaccessibility.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

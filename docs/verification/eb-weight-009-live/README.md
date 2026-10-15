# ck_evt_009/c — 수도원 문서함에서 고를 증거

Status: **FAIL — original failure retained; final JPEG reviewed by parent**.

Official run: `engineB-weight009-live-77cbe6b`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `77cbe6be7999c25242e3fba8951bbaf5638ef9f9`.
Selected source observed: `registry:ck_evt_009:c`. Answer: `h-000381`.

| Metric | Observed |
|---|---|
| initialTick | 9049 |
| finalTick | 10196 |
| initialYearCount | 9 |
| automaticYearCount | not observed |
| exactReceiptCount | 1 |
| actualEffectReceiptCount | 1 |
| exactNewRowCount | 0 |
| progressAtTen | true |
| manualTargetCaptured | not observed |
| navigationUnchanged | not observed |

Canonical title in actual manual expected fact: false. Fact: not observed.
Manual navigation SHA: `not observed` → `not observed`.
Stop: bounded_original_first_result_plus_200_ticks. Absence: canonical_membership_exists_but_matching_uncovered_chip_not_observed.

Original errors and archive checks:

- official_exit_code:1
- original_report_valid_is_not_true
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed

State and unchanged JPEG evidence:

- initial@9049: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `9b5c043d0b32fc1babcfc256a7f20ca74ab57730770846c4845662d631b81207`; integrity true.
- first-exact-receipt@10001: [JPEG](first-exact-receipt.jpg), [state](first-exact-receipt.state.json.gz), SHA `381c4d365ea1015182a2c33b4dfd8e0b307b90767677d8b05cd52ff858d3cf14`; integrity true.
- final@10196: [JPEG](final.jpg), [state](final.state.json.gz), SHA `20f6b85b33f36eb4d9004ea58076de63922048dbb38d6200df1ca7fa06ddc70f`; integrity true.

Limits:

- 자동 보관 시 사람 검토는 pending이었다. 이후 부모가 final.jpg를 직접 확인했다. 카드 접근이 없으므로 카드 검토나 SHA 통과는 주장하지 않는다.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

## 원인 분류와 화면 검토

실제 소송 suit-2가 filed→evidence(10000틱)로 바뀌고 h-000474는 선택 c의 답 h-000381을 부분 원인으로 정확히 가리킨다. 초기 칩은9건으로 보였으나 결과 후 연간 reader16건(009 항목1건)과 달리 화면 결과 칩은0개였다. final.jpg에는 화재·불탄 자리·증거 대조 칩 세 개만 보인다.

분류: 화면 칩 수용량/우선순위. src/ui/hud/useStoryPresentation.ts:25의 MAX_CHIPS=3, storyChips:81–96이 고정 칩과 나머지 최신 칩을 세 자리로 자른다. trace 누락은 아니다. 현재 관측 범위에서 자동 칩 미노출로 카드·탐색 SHA는 미검증이며, 늦게 다시 나타날 가능성을 영구 미노출로 확대하지 않는다. 제품 고침은 렌더 A 소유.

# ck_evt_130/c — 권리 이야기는 내 책상으로

Status: **FAIL_HARNESS — original failure retained; parent final-JPEG review completed**.

Official run: `engineB-weight130-live-6308a7d`; exit 1; original valid: false.
Product: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`; historical input: `2485af40046793f1856829fa1161dc4431942aa7`; tool: `6308a7dd3b41475546da378198b46e6bfcff6d8c`.
Selected source observed: `registry:ck_evt_130:c`. Answer: `h-005112`.

| Metric | Observed |
|---|---|
| initialTick | 67003 |
| finalTick | not observed |
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
Stop: not observed. Absence: not observed.

Failure cause and compact state comparison:

정상 ‘나중에’가 이전 속도를 복구한 뒤 하네스가 명시적으로 시계를 32ms 진행시켜, 탐색 SHA 비교에 실제 실행 3틱이 섞였다. 저장 비교는 **69151→69154**이며, 변한 최상위 키는 tick, buildings, walkers, wallTick, autoplayFoodFlow, autoplayRecurringDelivery, timberProductionWindow, settlement, arableFields다. 부모가 registry-after-later-1.jpg에서 모달이 아닌 정상 세계 화면을 직접 확인했다. 따라서 화면·흔적 결함으로 분류하지 않고 **하네스 실패**로 남긴다.

비교 SHA: 6b66b1b440fec70896c47598384e6de90cd8a556366dd718fbee36f878605cd9 → 572eaffb22a3fe8d796b911db8e2e339e91937c8569516efe73deefdba35019e. 별도 정상 알림 계속(68001 권리+소송, 69001 소송)과 68150 연말 보고 계속은 각각 전체 SHA가 같았다. 이 부분 성공을 목표 결과 관문 통과로 확대하지 않는다.

부모가 메인 감사 도구에서 해당 명시적 시계 진행을 제거했으며 후속 재시도가 필요하다. 원본 보고·archive.json·첫 실패는 모두 보존한다.

Original errors and archive checks:

- AssertionError [ERR_ASSERTION]: Normal Later changed game state + actual - expected  + '572eaffb22a3fe8d796b911db8e2e339e91937c8569516efe73deefdba35019e' - '6b66b1b440fec70896c47598384e6de90cd8a556366dd718fbee36f878605cd9' 
- official_exit_code:1
- original_report_valid_is_not_true
- original_report_has_errors
- canonical_title_missing_from_manual_expected_fact
- exact_manual_fact_not_confirmed_exposed
- manual_navigation_state_hash_not_confirmed
- automatic_exact_answer_aggregation_not_confirmed
- no_new_exact_receipt_with_actual_effect_evidence

State and unchanged JPEG evidence:

- initial@67003: [JPEG](initial.jpg), [state](initial.state.json.gz), SHA `af2c19bf4b82e6fb4f62d01c131dac83ebcf85238574a57d6d37f13eb846537d`; integrity true.
- unanswered-notice-1@68001: [JPEG](unanswered-notice-1.jpg), [state](unanswered-notice-1.state.json.gz), SHA `5a0a3184d1f78d9febaf07e4f5279d751592659b35456f9f196052ffb74138be`; integrity true.
- information-1@68150: [JPEG](information-1.jpg), [state](information-1.state.json.gz), SHA `28f72ed28e8a7d80f9ea82d45b514bbf0765fa42621a75b13e3ff58bc1f21417`; integrity true.
- unanswered-notice-2@69001: [JPEG](unanswered-notice-2.jpg), [state](unanswered-notice-2.state.json.gz), SHA `059e7bbcd2980630ff8f9e87234c849ec72e2d3dca587e8e36ab5dc141e8f300`; integrity true.
- registry-covered-1@69151: [JPEG](registry-covered-1.jpg), [state](registry-covered-1.state.json.gz), SHA `6b66b1b440fec70896c47598384e6de90cd8a556366dd718fbee36f878605cd9`; integrity true.
- registry-after-later-1@69154: [JPEG](registry-after-later-1.jpg), [state](registry-after-later-1.state.json.gz), SHA `572eaffb22a3fe8d796b911db8e2e339e91937c8569516efe73deefdba35019e`; integrity true.
- failure@69154: [JPEG](failure.jpg), [state](registry-after-later-1.state.json.gz), SHA `572eaffb22a3fe8d796b911db8e2e339e91937c8569516efe73deefdba35019e`; integrity true.

Limits:

- Parent personally inspected registry-after-later-1.jpg: the normal world is visible, with no blocking modal. JPEG SHA and the compact state comparison are in human-review.json.
- This is a harness timing failure, not an established screen or trace failure. The target result card and its navigation SHA pair remain unobserved.
- This archive performs file and report checks only; it runs no game, browser, or simulation.
- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.
- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.
- Proof snapshots contain presentation walkers, not a raw store snapshot.
- This is one current-product replay from a genuine historical answer, not a fresh 125-year run.
- Automatic yearly aggregation is distinct from automatic opening of a card or a new notification.
- A bounded replay may stop at an unrelated required decision; that is not proof of a trace or display defect.
- The observation bound is the original first consequence tick plus 200 ticks; old and current simulation may diverge.

Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.

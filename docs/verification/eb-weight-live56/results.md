# EB-WEIGHT 56사건 실제 화면 관문

진행 중: 사건별 통과 12/56, 실패·관측미달 6, 미검증 34, 청지기 별도 경로 4. 전체 관문 통과가 아니다.

제품 0eddc146c7d57b4cae091bff62295a1fc16e1f97. 분모 56사건/163지원선택을 유지한다. 한 선택 통과를 다른 선택의 통과로 확대하지 않는다. 056은 이 분모 밖이며 렌더A 소유다.

통과 기준은 실제 결과, 그 뒤 칩 갱신·노출, 정확한 카드 항목, 탐색 SHA 불변, 원본 JPEG 검토다. reader 포함만으로 통과시키지 않는다. 입력이 없는 사건은 제품 결함이나 영구 도달불가로 단정하지 않는다.

| ID | 지원 선택 | 선택(검증/예정) | 현재 판정 | 증거 / 제한 |
|---|---|---|---|---|
| 002 | b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 005 | a, b, c | b | 실패: 탐색 SHA 변경 | [증거1](../eb-weight-005-later/README.md); Actual income23d and exact trace exist. Normal Later triggers deferred year card and mutates seen at unchanged tick36151. FullSHA invariant failed. |
| 009 | a, b, c, defer | c | 실패: 칩 자리 제한 | [증거1](../eb-weight-009-live/README.md); Actual result and exact trace present; annual reader includes item, automatic rail omits results chip within observed window. Card/SHA not observed. |
| 010 | a, b, c | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 011 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 013 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 015 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 018 | a, b, c, d | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 019 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 024 | lower, keep | lower, keep | 통과(두 지원 선택) | [증거1](../eb-weight-024-ls1/README.md) · [증거2](../eb-weight-024-keep/README.md); Original reader inclusion is not screen acceptance. |
| 025 | punish, replace, tolerate | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 029 | accounts, visit, replace_accounts | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 031 | able, loyal, direct | able | 통과(한 선택) | [증거1](../eb-weight-031-live/README.md) · [증거2](../eb-weight-031-result/README.md); able: audit-59 at 282320 (kept759/errors0), h-013700 partial cause h-013352; target0→1 and exact item once, SHA unchanged. Initial results:1368 chip2 and final results:1370 chip2 differ by year; final-year chip absent initially→2, no numeric increase from2 claimed. Earlier suit-notice interruption retained. Other choices not claimed. |
| 032 | charter, roll, both, defer | roll | 통과(한 선택) | [증거1](../eb-weight-032-live/README.md); roll actualsuittransition, chip3→5 target0→1, exactcardonce andnavigationSHA; otherchoicesnotclaimed. |
| 033 | deed, witnesses, both, defer | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 034 | precedent, hear, rights_only | precedent | 별도 청지기 보고 경로 | [증거1](../eb-weight-034-steward/README.md); Historical steward answer h-011244 and season report route verified; band3, canonical title/choice/details visible after normal scroll, navigation SHA unchanged, wronglyIncluded=[]. lord56Pass=false; actual state effect not proved by this report. Canonical result says lord despite actual steward actor; render wording review needed. One occurrence only. |
| 035 | larger, smaller, wait | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 037 | direct, delegate_visit | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 038 | enforce, defer | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 042 | light, firm | firm | 통과(한 선택) | [증거1](../eb-weight-042-live/README.md); firm: actual stall_fee income 23d; chip 2→4, target 1→2; exact card and navigation SHA verified. light is not claimed. |
| 046 | trim, cancel | cancel | 실패: 실제 효과의 trace 없음 | [증거1](../eb-weight-046-cancel/README.md); cancel: genuine UI answer h-019506 at298000 changes timberOrder350→0 (field removed), exact receipt visible; effectTrace=[], chip30→30 and no answer item. Trace failure, not no-effect or receipt failure. Result card/navigation SHA NOT OBSERVED; confirmation SHA is separate. Other choices not claimed. |
| 051 | file, leave, file_with_deed | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 052 | punish, replace, tolerate | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 053 | deed, roll, both, defer | roll | 통과(한 선택) | [증거1](../eb-weight-053-live/README.md); roll: actual suit-4 filed→evidence transition; chip 1→3, target 0→1; exact card and navigation SHA verified. Other choices are not claimed. |
| 057 | light, fee, refuse | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 058 | remit, collect | remit | 별도 청지기 보고 경로 | [증거1](../eb-weight-058-steward/README.md); Historical steward answer h-008107; season report band/title/choice/body/result directly viewed, navigation SHA unchanged, wronglyIncluded=[]. lord56Pass=false; actual state-effect before/after not proved, one occurrence only. Canonical result incorrectly names lord despite steward actor; render wording review. |
| 059 | delegate, direct, loyal_candidate | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 061 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 075 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 076 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 077 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 080 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 083 | a, c | a | 통과(한 선택) | [증거1](../eb-weight-083-live/README.md); a: actual timber order remaining 16→14, delivery 2; chip 7→8, target 0→1; exact card and navigation SHA verified. Other choices are not claimed. |
| 090 | a, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 092 | a, b | b | 통과(한 선택) | [증거1](../eb-weight-092-live/README.md); b: actual stall_fee income 8d, partial cause; chip absent→2 (initial year count null, not displayed 0), target 1; exact card and navigation SHA verified. Other choices are not claimed. |
| 124 | a, b, c | b | 미통과: 하네스 | [증거1](../eb-weight-124-first/README.md) · [증거2](../eb-weight-124-navigation/README.md); Normal boundary Later preserves tick13000/SHA and reaches genuine124; actual b answer h-000725 and receipt observed. Harness then reads absent before.trace.decisions and throws. Result chip/card/navigation SHA gate not completed; optional preanswer trace fix unrun. Prior selector0 failure retained. |
| 128 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 130 | a, b, c | c | 실패: 칩 자리 제한 | [증거1](../eb-weight-130-live/README.md) · [증거2](../eb-weight-130-notices/README.md) · [증거3](../eb-weight-130-result/README.md); c: corrected run observed audit-9 at 74320 (458 kept + 77 errors = 535), exact partial cause h-005537→h-005112 and yearly reader 4/target 1, but target chip absent through 74516; lawsuit/patent/Michaelmas audit occupy MAX_CHIPS=3. Card/navigation SHA pair NOT OBSERVED, not changed. Earlier combined-notice interruption and post-Later 32ms harness failure remain preserved; not permanent inaccessibility or whole-56 acceptance. |
| 131 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 132 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 133 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 139 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 140 | a, b, c | a | 통과(한 선택) | [증거1](../eb-weight-140-live/README.md) · [증거2](../eb-weight-140-notices/README.md) · [증거3](../eb-weight-140-result/README.md); a: corrected run actual audit-48 at 230320 (kept 39, errors 0), exact partial cause h-015888→h-015428; initial chip absent→3 (null, not displayed 0), target 0→1, exact item once and navigation SHA unchanged. Earlier event-025 interruption and post-Later 32ms timing failure retained. Other choices not claimed; decoded state bytes retained but original gzip containers absent from repository archive. |
| 143 | a, b | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 144 | b, c | b | 별도 청지기 보고 경로 | [증거1](../eb-weight-144-steward/README.md); Historical steward answer h-026951; season report band/title/choice/body/result directly viewed, navigation SHA unchanged, wronglyIncluded=[]. lord56Pass=false; actual state-effect before/after not proved, one occurrence only. |
| 147 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 150 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 157 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 163 | a, b, c | b | 별도 청지기 보고 경로 | [증거1](../eb-weight-163-steward/README.md); Historical steward answer h-029251; season report band/title/choice/body/result directly viewed, navigation SHA unchanged, wronglyIncluded=[]. lord56Pass=false; actual state-effect before/after not proved, one occurrence only. |
| 165 | a, b, c | a | 통과(한 선택) | [증거1](../eb-weight-165-live/README.md); a: actual timber delivery 2, order remaining 12→10; chip 1→2 and target 1→2, exact canonical item once fully visible, navigation SHA unchanged. Other choices are not claimed. |
| 174 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 201 | a, b, c | b | 통과(한 선택) | [증거1](../eb-weight-201-live/README.md); b: actual stall_fee income 24d, ledger-000441 at 40800, h-003172 partial cause h-003145; chip 2→3, target 1→2, exact canonical item fully exposed once and navigation SHA unchanged. Other choices are not claimed. |
| 204 | a, b, c | a | 통과(한 선택) | [증거1](../eb-weight-204-live/README.md); a: actual stall_fee income 20d, ledger-013028 at 326400, h-023125 partial cause h-023122; chip 3→5, target 1→2, exact canonical item fully exposed once and navigation SHA unchanged. Other choices are not claimed. |
| 206 | a, b, c, d | a | 실패: 칩 자리 제한 | [증거1](../eb-weight-206-live/README.md); a: actual 2-unit timber deliveries at 314080/314160/314240, remaining 10→8→6→4, exact direct causes h-020521/522/524→h-020520. Reader 7/target 4 at 314277, but lawsuit/burnt-plot/poll-tax chips occupy MAX_CHIPS=3 and target chip absent. Card/navigation SHA NOT OBSERVED, not changed; bounded window, not permanent inaccessibility. |
| 209 | a, b, c, d | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 211 | a, b, c | b | 통과(한 선택) | [증거1](../eb-weight-211-live/README.md); b: actual stall_fee income 16d, ledger-000312 at 33600, h-002538 partial cause h-002496; chip 2→4, target 0→1, exact canonical item fully exposed once and navigation SHA unchanged. Other choices are not claimed. |

## 실패 원인 구분

- 규칙: 실제 상태 변화가 없는 답. 처리 기록 증가만으로 효과를 만들지 않는다.
- 흔적: 실제 변화는 있지만 해당 답ID로 연결되지 않음.
- 화면: 정확한 trace와 연간 읽기가 있는데 칩/항목이 누락되거나 탐색 SHA가 달라짐.
- 하네스/관측: 관련 없는 개입·관측 창 때문에 아직 실제 결과에 닿지 못함. 제품 결함으로 합산하지 않음.
- 입력: 진짜 제안/성공 답 저장이 없음. 정본을 넓히거나 사실을 채워 넣지 않음.
- 청지기: 실제 청지기 처리 발생을 영주 칩 통과로 세지 않고 계절 보고를 따로 확인.

공식 FAIR-LINE 실행 하나가 종료된 뒤 다음 실행을 제출한다. 이 표 생성기는 보존 장부만 읽으며 게임·브라우저·DGX를 실행하지 않는다.

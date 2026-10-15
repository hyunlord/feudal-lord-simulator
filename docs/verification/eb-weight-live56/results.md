# EB-WEIGHT 56사건 실제 화면 관문

진행 중: 사건별 통과 5/56, 실패·관측미달 3, 미검증 48, 청지기 별도 경로 0. 전체 관문 통과가 아니다.

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
| 031 | able, loyal, direct | able | 미통과: 관측 중단 | [증거1](../eb-weight-031-live/README.md); Unrelatedsuitnotice@276000 stoppedbeforeexpectedresult. Separate normalContinue replayplanned, nottracefailure. |
| 032 | charter, roll, both, defer | roll | 통과(한 선택) | [증거1](../eb-weight-032-live/README.md); roll actualsuittransition, chip3→5 target0→1, exactcardonce andnavigationSHA; otherchoicesnotclaimed. |
| 033 | deed, witnesses, both, defer | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 034 | precedent, hear, rights_only | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 035 | larger, smaller, wait | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 037 | direct, delegate_visit | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 038 | enforce, defer | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 042 | light, firm | firm | 통과(한 선택) | [증거1](../eb-weight-042-live/README.md); firm: actual stall_fee income 23d; chip 2→4, target 1→2; exact card and navigation SHA verified. light is not claimed. |
| 046 | trim, cancel | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 051 | file, leave, file_with_deed | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 052 | punish, replace, tolerate | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 053 | deed, roll, both, defer | roll | 통과(한 선택) | [증거1](../eb-weight-053-live/README.md); roll: actual suit-4 filed→evidence transition; chip 1→3, target 0→1; exact card and navigation SHA verified. Other choices are not claimed. |
| 057 | light, fee, refuse | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 058 | remit, collect | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 059 | delegate, direct, loyal_candidate | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 061 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 075 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 076 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 077 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 080 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 083 | a, c | a | 통과(한 선택) | [증거1](../eb-weight-083-live/README.md); a: actual timber order remaining 16→14, delivery 2; chip 7→8, target 0→1; exact card and navigation SHA verified. Other choices are not claimed. |
| 090 | a, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 092 | a, b | 예정: b | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 124 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 128 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 130 | a, b, c | 예정: c | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 131 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 132 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 133 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 139 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 140 | a, b, c | 예정: a | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 143 | a, b | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 144 | b, c | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 147 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 150 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 157 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 163 | a, b, c | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 165 | a, b, c | 예정: a | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 174 | a, b, c | 아직 없음 | 미검증 | [입력 조건](missing-inputs.md); Original reader inclusion is not screen acceptance. |
| 201 | a, b, c | 예정: b | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 204 | a, b, c | 예정: a | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 206 | a, b, c, d | 예정: a | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 209 | a, b, c, d | 아직 없음 | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |
| 211 | a, b, c | 예정: b | 미검증 | 입력 장부만 있음; Original reader inclusion is not screen acceptance. |

## 실패 원인 구분

- 규칙: 실제 상태 변화가 없는 답. 처리 기록 증가만으로 효과를 만들지 않는다.
- 흔적: 실제 변화는 있지만 해당 답ID로 연결되지 않음.
- 화면: 정확한 trace와 연간 읽기가 있는데 칩/항목이 누락되거나 탐색 SHA가 달라짐.
- 하네스/관측: 관련 없는 개입·관측 창 때문에 아직 실제 결과에 닿지 못함. 제품 결함으로 합산하지 않음.
- 입력: 진짜 제안/성공 답 저장이 없음. 정본을 넓히거나 사실을 채워 넣지 않음.
- 청지기: 실제 청지기 처리 발생을 영주 칩 통과로 세지 않고 계절 보고를 따로 확인.

공식 FAIR-LINE 실행 하나가 종료된 뒤 다음 실행을 제출한다. 이 표 생성기는 보존 장부만 읽으며 게임·브라우저·DGX를 실행하지 않는다.

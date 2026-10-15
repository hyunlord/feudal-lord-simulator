# EB-WEIGHT LS1-4 화면 인계 — 진행 중

제품0eddc146c/v55, 코어·화면 고침 없음. 별도056 카드 접근은 렌더 A 소유이며 여기서 재검증/수정하지 않는다. 전체56관문은 진행 중이다.

| 사건·선택 | 실제 효과 / trace | 칩·카드 관문 | 원인·소유 |
|---|---|---|---|
| 024/lower·keep | 실제 수입27d 부분원인 / 관계38→36 | 두 사례 칩·정확항목·SHA 통과 | [증빙](../verification/eb-weight-024-keep/README.md) |
| 009/c | suit-2 filed→evidence, h-000474→h-000381 부분원인 | reader16건 중 정확항목1, 화면칩 없음; 카드·SHA 미검증 | 표시 우선순위/3개 상한. 렌더 A 검토. [증빙](../verification/eb-weight-009-live/README.md) |

009 소스 근거: src/ui/hud/useStoryPresentation.ts:25(MAX_CHIPS), :81–96(storyChips). 새 결과는 trace와 연간 읽기에 이미 있다. 현재 화면의 화재·불탄 자리·소송 칩이 3개 자리를 차지한다. 초기 results:1302 9건은 보였으나 새 결과 뒤 칩이 밀렸다. 이 관측 창에서 자동 표시 미달이며 영구 접근 불가를 주장하지 않는다. 본선/화면 수정은 하지 않았다.

005/b 후속: [engineB-weight005-later-430d8d6](../verification/eb-weight-005-later/README.md) 종료1. 실제 수입23d·정확한 부분원인·칩1건은 존재한다.042 ‘나중에’로 닫으니1308 연말 카드가 자동으로 열리고 seen.year-review:1308이 추가돼 탐색SHA가 변했다(틱36151 동일). 원인은 useStoryPresentation.ts:218–224의 밀린 연말 카드·markOpened 경로. 영지 규칙 변경이 아니라 읽음 기록이며, 전체SHA조건을 임의로 완화하지 않는다. 렌더A 검토.

032/roll: [증빙](../verification/eb-weight-032-live/README.md) 실제소송단계전이·칩3→5·대상1항목·SHA동일·원본JPEG검토 통과. 다른 선택의 통과로 확대하지 않는다.

042/firm: [증빙](../verification/eb-weight-042-live/README.md) 실제 stall_fee 수입 23d(ledger-000393, tick 38400), h-003000→h-002984 부분원인. 칩 2→4, 대상 카드 1→2건, 원본 JPEG 두 장에서 정확한 제목·건수 노출과 탐색 SHA 동일을 확인했다. firm 한 선택만 통과다.

053/roll: [증빙](../verification/eb-weight-053-live/README.md) 실제 suit-4 filed→evidence(tick 78000), h-005067→h-005003 부분원인(소송 시작 h-004944와 함께). 칩 1→3, 대상 카드 0→1건, 원본 JPEG 두 장에서 정확한 제목·건수 노출과 탐색 SHA 동일을 확인했다. roll 한 선택만 통과다.

083/a: [증빙](../verification/eb-weight-083-live/README.md) 실제 목재 주문 잔량 16→14, 배송 2단(tick 73040), h-003392→h-003391 직접 원인. 칩 7→8, 대상 카드 0→1건, 원본 JPEG 두 장에서 정확한 제목·건수 노출과 탐색 SHA 동일을 확인했다. 다른 선택지의 세율 명령에 기대지 않았으며 a 한 선택만 통과다.

092/b: [증빙](../verification/eb-weight-092-live/README.md) 실제 stall_fee 수입 8d(ledger-000262, tick 33600), h-001368→h-001317 부분원인. 칩 없음→2(initialYearCount null이며 숫자 0 표시가 아님), 정확한 대상 카드 1건. 부모가 원본 JPEG 두 장에서 제목·건수 전체 노출을 확인했고 탐색 SHA도 동일하다. b 한 선택만 통과다.

130/c: [증빙](../verification/eb-weight-130-live/README.md) tick 68001의 권리 청원+영주 상대 소송 복합 자동 정지에서 관측이 끝났다. 하네스가 suit_defence 단독 알림만 계속 처리해 역사 입력의 감사 결과 예정 74320에 도달하지 못했다. 부모가 final.jpg를 직접 확인했다. 실제 결과·카드·탐색 SHA 쌍은 미관측이며 하네스 관측 제한으로 분류한다(흔적/제품 결함 판정 아님). 현재 순차 줄 뒤 재시도 예정, 원본 실패는 보존한다.

140/a: [증빙](../verification/eb-weight-140-live/README.md) tick 223153에 사건 025 결정 카드가 관측을 막아 역사 감사 결과 예정 230320에 도달하지 못했다. 현재 하네스가 실제 목표 결과 뒤에만 정상 ‘나중에’를 처리하는 제한이다. 부모가 final.jpg를 직접 확인했다. 목표 실제 결과·카드·탐색 SHA 쌍은 미관측이며 하네스 관측 제한으로 분류한다(흔적/제품 결함 판정 아님). 결과 전 정상 ‘나중에’ 후속 관측을 준비 중이며 원본 실패는 보존한다.

130/c 후속: [증빙](../verification/eb-weight-130-notices/README.md) 정상 알림 계속(68001 권리+소송, 69001 소송) 및 68150 연말 보고 계속은 각각 전체 SHA 동일. 이후 ‘나중에’가 속도를 복구한 뒤 하네스의 명시적 32ms 시계 진행으로 69151→69154가 되어 SHA 비교에 실제 진행이 섞였다. 부모가 이후 JPEG에서 모달 없는 정상 세계를 확인했다. 화면·흔적 실패가 아닌 fail_harness로 분류하고, 해당 시계 진행 제거 뒤 재시도한다. 원본 두 실패와 목표 결과·카드 미관측을 그대로 보존한다.

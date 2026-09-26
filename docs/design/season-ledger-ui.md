# 압력이 화면에 — 계절 결산·계절 띠·배치 장부·집 압력·보릿고개·타이틀 (UI-3)

F0-A 압력(흐름 설계서 FP-1~FP-6)과 F0-B·F0-C1 사건 줄을 플레이어가 보게 한다. [UI 상태 설계](UI_STATE_DESIGN.md)(UX-3)의 "평소엔 작게, 필요할 때만" 위에 놓는다.
코드: `src/ui/seasonLedgerCard.ts`·`hud/SeasonLedgerCard.tsx`, `src/ui/seasonStrip.ts`·`hud/SeasonStrip.tsx`, `src/ui/placementChip.ts`, `src/ui/houseDiagnosisModel.ts`, `src/ui/tutorial/useTutorialController.ts`(보릿고개 카드), `src/ui/wave8Art.ts`(Wave 8 그림). 설치 `scripts/installWave8.py`.

## UI3-1 계절 결산 카드 (S-28 모달)
- 계절이 닫혀 `seasons.history`가 한 칸 늘면 카드가 뜬다. 상태 기계 `push_modal season_ledger`라서 시간이 멈추고, [계속]을 누르면 전 속도로 돌아간다. 5배속 중에도 뜬다.
- 한 번에 두 칸 이상 늘면(불러오기) 뜨지 않는다.
- 설정은 카드 안 버튼과 일시정지 메뉴에 있다. 브라우저별 설정(`feudal.seasonLedgerAuto`)이고 기본은 켬이다.
- Wave 8 `frame_season_ledger` 두루마리를 쓴다.
  - 머리의 세 칸에는 그 계절의 가장 큰 변화 셋(인구·빵·밀·목재·석재·돈, 인구는 가중 10)을 그림과 부호 붙은 수로 넣는다.
  - 본문은 수입·지출·남음, 인구(전 계절 대비), 재고 네 가지, 일어난 일(떠날 채비·빈집·재정착·시대·첫 겨울 경고·사건 소문/조짐/도래/회복)이다.
  - 엔진의 `nextObjectiveHint`는 [다음: …] 단추가 된다. 누르면 카드가 닫히고 건설 서랍이 그 분류로 열린다(식량 → 저장·유통, 수확 → 생업, 불 → 생활).
- 화살표·기호 대신 "(전 계절 +4)"처럼 글로 적는다.

## UI3-2 계절 띠 (평소엔 작게)
- 상태 알약의 날짜 칸 아래에 5px 띠와 오늘 핀이 있다. 면적은 늘지 않는다(UX-3 평소 예산).
- 날짜를 누르면 전체 띠(Wave 8 `season_strip`, 300px)가 열린다. 사건 표시와 "다가오는 일" 목록이 함께 나온다.
- 표시는 엔진의 날짜다.
  - 파종 시작: 노동 띠 `sowing`, 연중 3500 = 겨울 중순.
  - 수확 시작: `harvest`, 1500 = 여름 중순.
  - 장부 기간 마감: `LEDGER_PERIOD_TICKS` 2,400마다. 계절과 맞물리지 않는다.
  - 장날: 매달 `MARKET_DAY_OF_MONTH`. 시장이 있을 때만, 다음 한 번만.
- 시각은 달력 도착점으로 적는다("가을 초쯤", "내년 여름 중순쯤"). 틱은 쓰지 않는다.

## UI3-3 배치 장부 한 줄
UX-3 커서 칩에 "장부 기간마다 지대 +N · 유지비 −N · 일꾼 N"을 더한다. 0이 아닌 것만 적는다. 값은 `predictPlacementLedger`다. 오두막의 실제 지대 일치는 엔진 테스트 P1(`flowPressure.test.ts`)이 보장한다. 방앗간 유지비는 `tests/placementLedgerChip.test.ts`가 정산과 비교한다.

## UI3-4 집 압력
- 떠날 채비인 집: INSTALL-7 보따리 표시 위에 식량 원인 그림을 더한다.
- inspector 첫 줄은 엔진 원인(`housePressureCauseLabel`, "식량 부족으로 떠날 준비")이다.
- 비워진 집: INSTALL-7 판자 덧그림(확인만)과 "비워진 집 — 식량이 모자라 떠났습니다".
- 결산 카드에는 떠날 채비·빈집 가구 수가 나온다.

## UI3-5 보릿고개
`firstWinterWarningActive`가 서 있는 동안 목표 카드 "다음 수확까지 비축 부족"이 가장 급한 카드가 된다. 목표 띠에는 한 장만 보인다. 단추는 곡창이 없으면 곡창, 있으면 경작지다. 청지기는 걱정 얼굴로 한 줄 말한다(닫을 수 있음).

## UI3-6 일시정지·타이틀·장 화면
- **일시정지:** Wave 8 비네트(가장자리만 어둡게)와 모래시계 표지다.
- **타이틀:** 기존 환영 화면이 곧 타이틀이다. 모든 스크립트의 `.welcome-*` 입구를 그대로 쓴다. 뒤에 `keyart_title_bg`, 위에 엠블럼이 있다. 저장이 있을 때 [새 게임]을 누르면 `keyart_mode_select` 배경이 된다.
- **장 화면:** 새 게임을 고르면 0.9초 동안 장 화면을 띄운다. 1장은 타이틀 배경을 다시 쓰고, 누름을 받지 않는다. 1315·1337·1348 화면은 등록만 했다.

## UI3-7 그 밖의 Wave 8
- 위기 아이콘은 알림 종이다(즉시 = threat, 주의 = bad). info 종은 등록만 했다.
- 겹쳐보기 아이콘 8, 미니맵 틀, 목표 서랍 틀, 연대기·청원 틀과 장식은 붙일 자리가 아직 없어 등록만 했다(`WAVE8_IMAGES`).

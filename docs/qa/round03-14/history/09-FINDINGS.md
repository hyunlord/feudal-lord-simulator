# QA ROUND 09 — 발견 목록

HEAD `265079891b074d7e023674e17984c3ac828f6c8e`

- **QA012 · 계절 전환 · 중간 · 렌더 추정** — 새 게임1300겨울→1301봄·틱3774→4128·1×·줌2·카메라(544,-2277)·중심칸(46,42):180장 중114~122에서 큰 대각선 지면 경계가 이동. JPEG (원문 경로: evidence/root9-first-winter-spring180-unfolded.jpg) · GIF (원문 경로: evidence/root9-first-winter-spring180.gif).

- **QA003 · 연결 · 중간 · 그림·렌더 추정** — 틱320000·줌2·칸(45,42): 닫힌 고리19/19 표기와 별개로 동일 문/벽 접합이 끊긴 틈처럼 읽힌다. JPEG (원문 경로: evidence/wall9-same003.jpg) · 확대 (원문 경로: evidence/wall9-same003-detail.jpg).
- **QA005 · 가림 · 중간 · 렌더 추정** — 틱320047·줌2·칸(38,40): 실제 선택한 파란 로저 운반인/수레가 성벽 면·흉벽에 겹친다. 경로 충돌은 미판정이다. JPEG (원문 경로: evidence/wall9-roger-selected.jpg) · 확대 (원문 경로: evidence/wall9-roger-selected-detail.jpg) · GIF (원문 경로: evidence/wall9-roger80.gif) · 전체 펼침 (원문 경로: evidence/wall9-roger80-unfolded.jpg).
- **QA026 · 보행 · 중간 · 렌더 추정** — 틱320750→320916·1×·줌2·시작 칸(21,32): 동일 존 운반인의 첫32장 이동 중 다리 벌림 자세가 유지된다. 사람·방향 표본에 한정한다. JPEG (원문 경로: evidence/wall9-john32-tracked.jpg) · GIF (원문 경로: evidence/wall9-john80.gif) · 전체 펼침 (원문 경로: evidence/wall9-john80-unfolded.jpg).
- **QA027 · 화풍 · 중간 · 그림·렌더 추정** — 틱320860·줌2·칸(29,17): 실제 선택 영주관이 갈색 지붕·밝은 면의 단순 도형으로 보인다. 내부 원인은 미확정이다. JPEG (원문 경로: evidence/wall9-manor-selected.jpg).

- **QA010 · 인물 표기 · 낮음 · 엔진/표시 추정** — 기존 자연 저장의 나이 든 존26살·젊은 토머스82살을 확인했다. 신규 출생 명명은 미검증이다. 존 (원문 경로: evidence/ui9-04-person1600.jpg) · 토머스 (원문 경로: evidence/ui9-95-guild1394-1600.jpg)
- **QA013 · 패널 가림 · 중간 · 렌더 추정** — 추가 표본:375 젖은 여름 사건 칩을 펼친 목표판과 접은 뒤 상단이 가린다. 원래1314 대기근은 미검증이며 이후 칩 소실 사진을 클릭 실패로 세지 않는다. 펼침 (원문 경로: evidence/ui9-74-fullgoalchip375.jpg) · 접음 (원문 경로: evidence/ui9-75-goalcollapsedchip375.jpg)
- **QA029 · 좁은 연대기 · 중간 · 렌더 추정** — 375 연대기 목록·닫기가 보이지 않고 가로/세로 휠 후에도 복구되지 않는다. 리사이즈·fresh1447 및 이번 새 게임1315 원본을 처음부터375로 연 표본에서 확인, Escape 복구 성공. 새 게임 표본 (원문 경로: evidence/ui9-175-freshnew375-record.jpg) · 휠 후 (원문 경로: evidence/ui9-176-freshnew375-record-wheel.jpg) 새 게임375 표본은 Tab24회/Enter로 닫혔지만 목록 비표시는 유지된다. 긴 전기 이름은 가로 휠로 복구됐다. fresh (원문 경로: evidence/ui9-110-fresh375-record.jpg) · 휠 후 (원문 경로: evidence/ui9-111-fresh375-record-wheel.jpg)
- **QA014 · 내부 문자열 · 낮음 · 표시 추정** — 권리의 townsfolk와 국왕 카드·전기의 king 내부 역할 문자열이 보인다. 권리 (원문 경로: evidence/ui9-03-rights1600.jpg) · 전기 (원문 경로: evidence/ui9-37-emptybio1600.jpg)
- **QA015 · 전기 줄 겹침 · 낮음 · 렌더 추정** — 1600/1280/768/375의 빈 전기 문장이 중앙 장식선과 겹친다. 1600 (원문 경로: evidence/ui9-37-emptybio1600.jpg) · 375 (원문 경로: evidence/ui9-38-emptybio375.jpg)
- **QA016 · 선택지 겹침 · 중간 · 렌더 추정** — 틱376147·1394 길드 결정의 둘째 선택지 테두리를 보류 버튼이 덮는다.375에서는 실제 세로/가로 휠 후 선택에 성공했으므로 선택 불능으로 확대하지 않는다. 1600 (원문 경로: evidence/ui9-95-guild1394-1600.jpg) · 1280 (원문 경로: evidence/ui9-96-guild1280.jpg)
- **QA017 · 건설 메뉴 · 중간 · 렌더 추정** — 375 생업 분류·초기 항목이 위로 이탈하며 위쪽 휠과 닫기/재열기로 복구되지 않았다. 방어 메뉴 QA패널 가림은 별개 미검증이다. 휠 (원문 경로: evidence/ui9-71-production375-up.jpg) · 재열기 (원문 경로: evidence/ui9-72-production375-reopen.jpg)
- **QA018 · 설정 겹침 · 낮음 · 렌더 추정** — 375 및1280×720에서 튜토리얼 설명과 화면 소리 제목이 겹친다.1280×900에서는 미재현이며 하단 저장행은 스크롤로 접근했다. 375 (원문 경로: evidence/ui9-16-settings375.jpg) · 1280×720 (원문 경로: evidence/ui9-58-settings1280x720.jpg)
- **QA019 · 설정 표적 · 중간 · 렌더 추정** — 설정 표적 너비44px 중32px가1600/1280 창 오른쪽 밖이다.768/375는 창 안이며1600 노출부 실제 클릭은 성공했다.1920/1440에서도32px 이탈이 재현됐다. 추가 (원문 경로: repro/ui9-wide-scale-observation.md) 표적 (원문 경로: evidence/ui9-83-topbar1600.jpg) · 클릭 (원문 경로: evidence/ui9-84-settings-visibleedge.jpg)
- **QA020 · 가계도 이름 · 낮음 · 렌더 추정** — 실제로 자손을 펼친 가계도에서 조앤·윌리엄 이름 둘째 줄이 카드 내부에서 잘린다. 화면 밖 가지와 구분하며1920/1440에서도 같은 내부 잘림을 확인했다. 1920 (원문 경로: evidence/ui9-wide-187-tree1920.jpg) 1600 (원문 경로: evidence/ui9-14-tree-open1600.jpg) · 1280 (원문 경로: evidence/ui9-15-tree-open1280.jpg)
- **QA021 · 닫기 기호 · 낮음 · 렌더 추정** — 제재소(57,47) 닫기 기호는 기본/실제 Tab 초점에서 안 보이고 호버에서 보인다. Enter 닫힘은 성공했다.43번 사진은 다른 초점이라 제외했다. 기본 (원문 경로: evidence/ui9-41-sawmilldefault.jpg) · 초점 (원문 경로: evidence/ui9-44-sawmillfocus.jpg)
- **QA022 · 더 보기 · 낮음 · 렌더/UI 추정** — 짧은 과세 사건의 더 보기 후 본문·그림은 그대로이고 버튼만 사라진다. 결정하기 이후 과세 납부 성공은 확인하지 않았다.1348여름193150 열병 소문에서도 버튼만 사라졌다. 추가 전 (원문 경로: evidence/root9-109-fever-rumour.jpg) · 추가 후 (원문 경로: evidence/root9-110-rumour-more.jpg) 전 (원문 경로: evidence/ui9-48-morebefore375.jpg) · 후 (원문 경로: evidence/ui9-50-moreafter375.jpg) · 모션 (원문 경로: evidence/ui9-49-more-motion.gif) · 전체 펼침 (원문 경로: evidence/ui9-49-more-unfold.jpg)
- **QA023 · 상세 닫기 가림 · 중간 · 렌더 추정** — 375 제재소 닫기(x324,y83,44×44) 하단을 과세 칩이 덮고 실제(345,124) 클릭이 시설 닫힘 대신 사건을 연다. 가림 (원문 경로: evidence/ui9-46-facilitychip375.jpg) · 클릭 후 (원문 경로: evidence/ui9-47-chipcloseclick.jpg)
- **QA024 · 인물 닫기 이탈 · 중간 · 렌더 추정** — 1407 인물카드를375로 리사이즈하면 닫기(x406.078,y486,55.922×44)가 전부 창밖이다. 가로 휠 실패/Escape 성공, 추가 fresh 표본의 Tab9회/Enter 복구는 성공했다. 키보드 복구 (원문 경로: evidence/ui9-156-person375-keyboard-closed.jpg) 카드 (원문 경로: evidence/ui9-05-person375.jpg) · 휠 (원문 경로: evidence/ui9-06-person375-wheel.jpg)
- **QA025 · 목표 보기 · 중간 · 렌더/UI 추정** — 정지430090에서 목표 보기를 누르면 소개 없이1×·430124로 진행한다.100ms 간격20프레임이며 처리 속도 측정은 아니다. 전 (원문 경로: evidence/ui9-30-goal-before.jpg) · 후 (원문 경로: evidence/ui9-32-goal-after.jpg) · 모션 (원문 경로: evidence/ui9-31-goal-motion.gif) · 전체 펼침 (원문 경로: evidence/ui9-31-goal-unfold.jpg)
- **QA031 · 문제 범례 · 중간 · 렌더 추정** — 1407 정지430090에서 O활성 후 세계 표현은 바뀌지만 범례는 보이지 않는다.500ms 정착·여러 해상도·QA끔1600을 확인했다. 활성 (원문 경로: evidence/ui9-24-problems1600.jpg) · QA끔 (원문 경로: evidence/ui9-100-problems-qaoff1600.jpg)

- **QA030 · 현재값 불일치 · 중간 · 엔진/렌더 추정** — 1339가을 정지158016 HUD3701d와 피란민 선택지 지금3639d가 다르고 정상 저장→불러오기 후 같은 틱 HUD3639d·식량185→187일로 바뀐다. 인구480은 그대로다. 추가1352봄208009 재열기에서도 HUD4857d/지금4877d 차이가 보이나 이 표본은 저장 재진입 검사가 아니다. 추가 청원 (원문 경로: evidence/root9-164-petition-reopen-decision.jpg) 원래1364 인구238→241은 미재현이며 공통 원인·실제 손실은 미확정이다. 현재값 (원문 경로: evidence/root9-072-current-modal.jpg) · 저장 (원문 경로: evidence/root9-077-paused-money-saved.jpg) · 재로드 (원문 경로: evidence/root9-078-manual-reload-money.jpg) · 독립 판독 (원문 경로: repro/current-treasury9-review.md)

- **QA028 · 인구 기록 접근 · 중간 · 렌더 추정** — 1348가을 정지194155·인구434 상태에서 인구 창이 얇은 빈 띠로 남는다.600ms 후와 실제 띠(1420,80) 휠600 후에도 제목·기록이 사진에 보이지 않는다. 화면DOM의46명 감소 기록 존재와 실제 가독성을 구분한다.114의 띠 밖 휠은 실패 근거에서 제외하고 Escape 복구했다. 열기 (원문 경로: evidence/root9-113-population-after-plague.jpg) · 띠 휠 (원문 경로: evidence/root9-116-population-strip-wheel.jpg)

이번 회차 고유 재현은 **23개**다. 실패 기준은24행이며 UI-01과 UI-02가 같은 QA029 접근 실패를 함께 검토하므로 고유 결함 수와 다르다. QA011은 동일1394 길드/1396 교회 쌍에서 서로 다른 삽화를 확인해 닫힘을 유지한다. QA004·007·009는 이번 범위에서 미재현이다. QA030은 원래1364 인구 조건은 미재현이나1339 재정·식량 표시의 추가 변형을 재현했다. QA028은 기존 기록 없는 표본에 더해 역병 직후 기록이 존재하는 표본에서도 접근 실패를 확인했다. UI 범위·미확인 조건 (원문 경로: repro/ui9-observation.md) · 자동 발전 표본 한계 (원문 경로: repro/auto-watch9-review.md).

**기록-01 · 관찰 후보 · 엔진/표시 추정** — 1337여름149156 양모 공납에서 현금으로 낸다를 직접 선택했고149165 금고4132→3832로 바뀌었다. 새 결정명은 일치하지만 위 관계 사유는 가격을 붙여 수락으로 표시된다. 표현 후보이며 엔진 오류는 미확정이다. 선택 전 (원문 경로: evidence/root9-064-war-state.jpg) · 선택 후 (원문 경로: evidence/root9-065-war-paid.jpg) · 새 기록 (원문 경로: evidence/root9-066-cash-record.jpg)

감면 청원에서도 선택 직후 결정명과 관계 사유, 선택 상세의 고른 길(거절)/다른 길(수락) 표현 차이를 관찰했다. 결정 (원문 경로: evidence/ui9-161-decision-record-selected.jpg) · 관계 (원문 경로: evidence/ui9-162-relation-record-selected.jpg). 나무/이랑 중첩과 가계도 반복·세대 표시는 관찰 후보다. 역할·동일성, 해안/습지 선택 조건 등은 미검증으로 남긴다. 월드 근거 (원문 경로: repro/wall9-observation.md) · 새 땅 탐색 (원문 경로: repro/land9-observation.md). 제품 전체 합격 판정이 아니다.

UI-08은 여름·겨울 결산에서 내용이 있는 앞 슬롯 뒤 빈 장식 틀이 남는 관찰 후보다. 데이터 누락은 미확정이다. 여름 (원문 경로: evidence/root9-014-summer-ledger.jpg) · 겨울 (원문 경로: evidence/ui9-113-winter-summary.jpg). 비 표본은 제한 확인이며 안개·먼지는 미검증이다. 지면-02는 후속 가을 넓은 평지에서 기존 시각 반복 후보를 관찰했다. 앞선 봄 미관측은 유지한다. 가을 (원문 경로: evidence/root9-117-autumn-ground.jpg) · 다른 줌 (원문 경로: evidence/root9-118-autumn-ground-mid.jpg) · GIF (원문 경로: evidence/root9-autumn-ground-live80.gif) · 전체 펼침 (원문 경로: evidence/root9-autumn-ground-live80-unfolded.jpg). 독립 판독 (원문 경로: repro/ground-weather9-review.md).

임금 카드 뒤 곡창 선택은 촬영 첫 프레임부터 카드가 없으므로 관통 클릭 결함에서 제외했다. 실제 결정 필터에는 자동 발전OFF 이전 봄의 임금 인상 응답이 이미 있어 미결정 처리 불능으로도 확정하지 않는다. 입력 시점 판독 (원문 경로: repro/wage-interaction9-review.md) · 주검수 기록 (원문 경로: repro/root-observations.md). 어린이 세 명의 목록/전기 초상은 확대 대조에서 보닛·볼·입·포대기가 대응해 단계 불일치 후보를 기각했다. QA032는 등록하지 않았다. 초상 독립 판독 (원문 경로: repro/portrait-age9-review.md).

청원자-01은 같은1352봄 사망 인물이 청원 수장으로 남는 상태 설명 후보다. 같은 계절의 청원·사망 선후가 없어 발송 오류는 미확정이다. 청원 (원문 경로: evidence/root9-160-ch3-modal.jpg) · 전기 (원문 경로: evidence/root9-162-dead-petitioner-biography.jpg) · 판독 (원문 경로: repro/dead-petitioner9-review.md). 추가 빨간 인물120장에서는 지정 위치의 지속 정지를 관측하지 못했고 선택 ID가 없어002 전체 해소로 확대하지 않는다. 판독 (원문 경로: repro/standing-person9-review.md).

건물-02:1356 도시 전체의 밝은 주홍 지붕·흰 면 시설 반복은 미적 후보로 추가했다. 약6개 유사 형상 중 두 위치만 서로 다른 창고로 선택 확인했으며 자산 누락·기능 혼동은 미확정이다. 전체 (원문 경로: evidence/root9-174-warehouse-repeat-wide.jpg) · 독립 판독 (원문 경로: repro/building-repetition9-review.md). 추가3×/5× 강우는 제한 확인이며 겨울 전환·자동정지 구간을 분리했다. 날씨 범위 (원문 경로: repro/weather9-speed-observation.md).

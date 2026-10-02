# Charter & Kin 지역 지도 제작 근거 계약

상태: candidate / 정적 검토용. 저장소 코드·원본 그림은 변경하지 않는다. 아래는 2026-10-03 체크아웃 문서에서 읽은 계약이며, 신규 절차 생성 표본을 기존 엔진 지도나 실제 측량 자료로 주장하지 않는다.

## 1. 읽은 원문

- `docs/design/art-bible.md`: 사용자 채택 ART_BIBLE_v2, S_England_1300_1450_v1.
- `docs/design/map-archetypes.md`: MA-1~MA-13, FD 건넘 규칙.
- `docs/design/neighbor-world-20261003/MAP.md` 및 `world/map.json`.
- `docs/design/mockups/lord-screens-20261002/{DESIGN.md,README.md,source/ASTRA_CK_SCREENS_brief.md}`.
- 지도 데이터는 `references/neighbor-world.json`에 바이트 그대로 복사한다. 그 안의 원본 지도 SHA256은 `54d6ad354a71de8ace6a1029dc163b3758ff9a6330e7b030318661e961db71c8`이다.

## 2. 유형 다섯

| 엔진 ID | 지역 특징 | 물·경계·재료 제약 |
|---|---|---|
| `core:open_field` | 강가 시장도시, 초지·숲·강어귀 | 강 2~4칸, 산울타리; 기본 계수 1000 |
| `core:coastal_port` | 북쪽 또는 서쪽 바다, 해변·염습지, 나무 적음 | 바다 깊이 8~15칸; 모래·자갈·염습지; 개울 1~2칸이 바다로 합류 |
| `core:chalk_downs` | 짧은 풀·백악·히스·목양 | 백악 바위 약11%, 물 약1%; 마른 돌담; 개울 1~2칸 |
| `core:forest_edge` | 숲 가장자리 개척, 낙엽·쓰러진 나무 | 숲 약56%, 숲바닥과 불규칙 숲 가장자리; 개울 1~2칸 |
| `core:fen_drainage` | 습지·갈대·물길·간척 | 물 약33%, 강 2~4칸, 갈대 둑과 얕은 잔물결 |

원문의 지형 분위수 목표(물/바위/숲, 천분율): 해안30/30/120, 백악12/110/70, 숲50/20/560, 습지330/5/70. 해안 바다는 추가 처리이므로 분위수 숫자를 바다의 최종 면적비로 오독하지 않는다. 새 지역 키트가 이 엔진 통계를 재현하지 않는다면 시각적 대응만 검증하고 엔진 동등성은 미검증으로 표시한다. 기존 엔진의 시작 마을 직사각형 x30~50/y34~62, 벌목장 동쪽 숲 보장, 강의 마을 회피는 타일 지도의 계약이며 아래 1600×1000 지역지도 좌표와 직접 섞지 않는다.

## 3. 18개 영지와 접지 좌표

`coordinateSystem={origin:"top-left",width:1600,height:1000,anchor:"sprite-bottom-center"}`. 좌표는 그림의 중심이 아니라 **스프라이트 하단 중앙 접지점**이다. 절차 생성 표본은 houseId/estateId를 보존하고 새 위치가 필요하면 원본 x/y와 신규 anchor를 별도 필드로 기록한다.

| houseId | estateId | 영문 이름 | 원본 접지 x,y | 원본 sprite |
|---|---|---|---|---|
| h01 | estate-home | de Haverel | 665,473 | manor |
| h02 | estate-h02 | de Coldmere | 310,397 | manor |
| h03 | estate-h03 | de Brancel | 465,510 | manor |
| h04 | estate-h04 | de Vauterre | 890,290 | manor |
| h05 | estate-h05 | de Grimesand | 1020,335 | manor |
| h06 | estate-h06 | de Wystanley | 1260,387 | manor |
| h07 | estate-h07 | de Hollenby | 1470,530 | manor |
| h08 | estate-h08 | de Querney | 1135,665 | manor |
| h09 | estate-h09 | de Tamerel | 1320,755 | manor |
| h10 | estate-h10 | Abbey of Saint Mary at Avenel | 875,455 | abbey |
| h11 | estate-h11 | See of Merrowen | 960,230 | manor |
| h12 | estate-h12 | Chapman | 750,430 | market |
| h13 | estate-h13 | Miller | 848,367 | market |
| h14 | estate-h14 | de Sauvenay | 430,700 | manor |
| h15 | estate-h15 | de Ravenholt | 310,210 | manor |
| h16 | estate-h16 | de Blaucourt | 700,195 | manor |
| h17 | estate-h17 | Fitzaldric | 590,555 | manor |
| h18 | estate-h18 | de Montgarnier | 1160,165 | manor |

JSON `placements[]`는 houseId/houseNameEn/houseNameKo/estateId/x/y/sprite/routeFromPlayer/travelDays를 가진다. `routeFromPlayer`는 distanceKm와 edgeIds, `travelDays`는 foot/mounted 범위·crossings·delayExcluded를 가진다. h01이 플레이어 출발점이다. 원본의 마커는 96px 그림을40px로 줄인 위치 확인용 조립이다.

## 4. 네트워크와 도하

원본 `network.nodes`는 **39개**의 id→[x,y] 사전, `network.edges`는 **39개**의 간선이다. 간선 필드는 id/from/to/kind/points/lengthKm/crossing. 종류는 `painted_road`, `painted_ford_crossing`, `proposed_spur`, `proposed_tributary_bridge_crossing`, `proposed_ferry_crossing`, `anchor`이다. 원본에 실제 그려진 길과 신규 제안을 합쳐 '기존 길'이라고 표기하지 않는다.

- 본류 중앙 여울: fw(760,423)→ford(810,400)→fe(855,375), 두 간선이 하나의 도하를 나타낸다.
- 남쪽 지류 다리: bsw(770,455)→bse(810,465), **신규 제안**.
- 동부 나루: fn(1130,485)→fs(1130,540), **신규 제안**.
- 진입 지선은 옅은 파선, 제안 도하는 붉은 파선. 제안 도하를 비활성화하는 구성에서는 그래프를 다시 계산해야 한다.
- 1px=20m, 도보20~30km/일, 기마30~45km/일은 게임 추정이다. 방문·협상과 도하 지연은 원본 이동 일수에서 제외한다.
- 정상 여울0~0.05일, 다리0~0.02일, 나루0.02~0.15일, 범람0.25~1일도 게임 추정. 심한 홍수는 간선 폐쇄 후 재탐색한다.
- 원본 지역 지도는 해안·항구·수로 운송을 확정하지 않았다. 신규 해안 유형의 항구/바다는 별도 생성 설계다.
- 엔진 FD 규칙상 여울은 개울 유형(해안·백악·숲)에만 있으며 강가·습지는 다리뿐이다. 기존 지역 삽화 중앙 여울은 다른 축척의 설계 제안이므로 이 충돌을 숨기지 말고, 새 강가/습지 표본에는 다리를 선택한다.

## 5. 미술·UI 계약

남부·남동부 잉글랜드1300 기본형, 명시된1300~1450 후기만 예외. 따뜻한 회칠·갈색 참나무·저채도 테라코타 평기와·거친 초가·회갈색 잡석, 부드러운 손그림 프리렌더. 장난감 같은 둥근 형태·벡터 아이콘풍 월드 오브젝트·검은 만화 윤곽·사진성 미세 잡음을 섞지 않는다. 재료 견본: 초가 #C78D45, 평기와 #B86E44, 회칠 #F7E8CD, 참나무 #825C3D, 잡석 #93806D. 견본은 승인 원본의 한 픽셀 비교값이며 절대 역사색이 아니다.

월드 사물은 정사영2:1, 지면축±26.565°, 수직 유지. 낮 기본광은 화면 좌상, 그늘은 우하. 넓고 진한 그림자는 본체에 굽지 않고 약한 접촉 AO만 허용. 방향성 채광이 있는 원본은 flipX 변주 금지. 지역 지면은 위에서 본 손그림 지도, 마커는 일관된 사선 시점의 기호로 읽히도록 하고 지면 타일 계약128×64를 지도 패치에 임의 적용하지 않는다.

일반1300 집은 외부 굴뚝/굴뚝 통·푸른 유리·쇼윈도·새시창 금지, 무유리 작은 창과 덧창. 평기와/초가 사용, 슬레이트·팬타일·S기와·과장된 튜더·일반 주택 벽돌 전면 금지. 기술 발전을 목재→벽돌→석재의 사다리로 표현하지 않는다. 현대 기계·고무 타이어·공장 굴뚝·규격 컨테이너·전등 금지.

지역지도 UI는 인물→관계/권리→도시 결과의 위계를 지원한다. 지도·영지 문장·길·강·시장도시와 선택 카드의 관계가 읽혀야 한다. mockup 팔레트: ink #2A2118, timber #463625/#5E4A33, parchment #DCD3C1, vellum #EFE8D8, vermilion #A83232, gold #C9A227, forest #405633, water #4D758A. 얇은 잉크선·참나무 테두리, 현대 둥근 카드·그라디언트 금지. 과거 mockup의 벡터 지형은 구성 시안이지 완성 손그림 지도 자산이 아니다. 다른 상용 게임 캡처를 참조로 사용하지 않았다.

RGBA 자산은 실제 투명, 글자·워터마크·가짜 체크보드 없음. 큰 덩어리로 읽히는 질감, 과도한 샤프닝/흰 테두리/반복 업스케일 금지. 원본에서 최종 크기로 한 번 축소, alpha=0 주변 번짐을 밝고 어두운 바탕 모두 검사한다. 정적 조립 검수는 엔진 작동·줌·DPR·성능 검증이 아니다.

## 6. 방앗간 충돌의 처리

원본 `map_mill_96x96.png`는 물레바퀴가 보인다. ART_BIBLE_v2의 곡물 방앗간은 **목조 post mill**(buck, 중앙 기둥, 십자받침, 네 날개, 꼬리대)이다. 탑풍차·스목풍차·곡물 수차는 금지한다. 원본 수차를 풍차로 재명명하거나 곡물 시설로 설치하지 않는다. h13 Miller는 원본처럼 중립적 market 표식을 유지한다. 신규 postmill 키트는 별도 후보이며 Miller의 실제 시설 위치/용도를 자동 확정하지 않는다. 물을 쓰는 축융시설은 기능과 물길이 별도 확인된 때만 별도 이름으로 사용한다.

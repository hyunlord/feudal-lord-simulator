# S2 서비스 배분 (우물·시장·교회: 반경·수용량·일꾼·도로) + 빵 배급자

원본 분석 대상: `47c9aeb`. 아래 S2.R6와 S2-F1은 R1-fix에서 갱신했다. 나머지 항목과 행 번호는 원본 감사 시점의 기록이며 현재 구현을 보증하지 않는다.
프로브: `raw/probes/s1s2_probe.ts` → `s1s2_probe.out.txt`, `raw/probes/s2_greedy_probe.ts` → `s2_greedy_probe.out.txt`.

## 1. 상태

| 필드 | 타입 | 쓰는 곳 |
|---|---|---|
| (저장 안 함) `ServiceAllocation {houses: Map<id, {water,market,church}>, providers: Map<id, {service,capacity,used,workers,requiredWorkers}>}` | 파생값 | `src/population/serviceAllocation.ts:allocateHouseServices:41-88`. state 객체마다 WeakMap에 캐시한다(`src/engine/householdServices.ts:5-16`) |
| `houses[].hasWater` | boolean | T10 `updateHousing:179-182`이 배분 결과로 덮어쓴다 |
| `buildings[].workers` | number | T7 `allocateBuildingAndConstructionLabour`(`src/population/labour.ts:141-218`), 철거 시 `demolishHouse:17-29` |
| `buildings[].inventory.bread`, `.reserved.bread` (곡창) | | 배급자 출발 `roamingSpawn.ts:57-63`, 반납 `roamingCommon.ts:restoreBread:80-102`, 배달 시 예약 해제 `roamingStep.ts:184-188` |
| `walkers[]` `kind:"distributor"` (`id, phase roaming/returning, path, pathIndex, cargo, junctionVisits, tilesTravelled, priorTile, spawnedTick`) | `DistributorWalker` | T5 `stepDistributors`, T15 `spawnDistributors` |
| `houses[].breadStock`, `lastServicedTick` | | T5에서 RoamingHouse 사본으로 바뀌고 T8에서 합쳐진다 |
| `treasuryCoin`, `coinLedger`, 창고 재고 | | T9 `settleMarkets` (`src/engine/marketSettlement.ts:145-170`) |
| `seed` | | 배급자 갈림길 RNG 시드 (`tick.ts:rngForState:89-101`) |

## 2. 입력과 출력

입력: 건물 배치(`place_building`), 도로 설치·제거(`place_road_line`/`remove_road`, `gameActions.ts:57-100`, 둘 다 `roadRevision+1`, `pathCache={}`), 성벽(도로 경계 통과 `canTraverseRoadBoundary`), 인구(T7 일꾼 수), 곡창 빵 재고(방앗간·짐마차 시스템에서 옴), 합필(`houseLot` → 수요 2).
출력: S1 요구 조건 water/market/church `served`와 bread(`breadStock`), 금화(T9), UI 진단.

## 3. 규칙

**S2.R1 시설 상수.**
| 서비스 | 시설 | 반경 | 수용량(필지) | 필요 일꾼 | 도로 필요 |
|---|---|---|---|---|---|
| water | well | `src/content/buildingConfig.ts:83 = 6` | `serviceAllocation.ts:35 = 12` | `buildingConfig.ts:76 = 0` | `serviceAllocation.ts:35 roadRequired false` |
| market | market | `buildingConfig.ts:253 = 8` | `serviceAllocation.ts:36 = 24` | `buildingConfig.ts:246 = 3` | true |
| church | church | `buildingConfig.ts:267 = 12` | `serviceAllocation.ts:37 = 32` | `buildingConfig.ts:260 = 0` | true |
해금 시기: market은 palisade(`buildingConfig.ts:250`), church는 stone_town(`:264`).

**S2.R2 수요 = 필지 수.** `serviceAllocation.ts:47, 61`: `houseLotArea`는 단독 1, 합필 2다. 주민 수와 등급은 보지 않고 빈집도 자리를 차지한다(주석 `:32-33`과 코드가 같다). 합필 수요는 나눌 수 없다(`:75`: 한 시설에 `used + demand ≤ capacity`).

**S2.R3 반경 = 발자국 간 맨해튼 간격.** `serviceAllocation.ts:62`, `src/geometry/buildingDistance.ts:buildingFootprintDistance:4-17`. 벽, 물, 지형을 무시한 직선 격자 거리다.

**S2.R4 일꾼 조건.** `serviceAllocation.ts:63`: `workers >= workersRequired`. 우물과 교회는 필요 일꾼이 0이라 항상 통과한다.

**S2.R5 도로 조건.** `serviceAllocation.ts:64`: `roadRequired`이면 `roadService(home, provider) === true`여야 한다. tick이 쓰는 `roadService`는 `src/engine/marketService.ts:marketRoadService:6-24`다. 집의 도로 접근 타일(`src/engine/routing.ts:buildingRoadAccessTiles:103-124`)과 시설의 접근 타일이 **같은 도로 연결 요소**(`src/world/roadGraph.ts:labelRoadComponents:164-177`)에 하나라도 있으면 된다. 경로 길이 제한은 없다. 성벽은 `canTraverseRoadBoundary`(`roadGraph.ts:55,63`, `routing.ts:120-123`)로 반영하므로 문을 통하면 연결된다.

**S2.R6 배분 순서(먼저 지어진 집 우선, R1-fix).** `src/population/serviceAllocation.ts:allocateHouseServices`
1. 서비스는 water → market → church 순으로 독립 배분한다. 시설 후보는 거리 → id 순이다.
2. 주택은 시작 마을 집 우선, 이후 `construction-site-N`의 숫자 건설 서수 오름차순, 동점은 id 순으로 배분한다. 입력 배열 순서·반경 진입 시각·주민 수·생활 등급은 순서를 바꾸지 않는다. 건설 서수는 지시서가 지정한 기존 상태의 우선순위 키이며 실제 완공 틱을 새로 저장하지 않는다. 알 수 없는 구형/준비 상태 id는 시작 주택과 같은 동점 집합에서 id로 정렬한다.
3. 먼저 지어진 집이 받는 서비스를 새 집이 빼앗지 않는다. 가까운 시설이 가득 찼지만 기존 집이 다른 시설의 여유 용량을 쓸 수 있으면, 기존 집을 한 번 재배정해 새 집의 자리를 마련한다. 모든 기존 집의 공급과 합필 수요의 불가분성을 보존한다. 복잡한 완전 매칭이나 재귀 탐색은 하지 않는다.
4. 재배정 후보는 기존 배정 순서와 거리/id 순으로 고정한다. 필요한 용량 전체를 확보할 때만 이동을 확정한다. 탐색은 기존 집 × 시설 후보 범위 내로 제한된다.
5. 용량 부족 집의 파생 `ServiceAccess.earlierHomesUsingCapacity`는 접근 가능한 시설을 이미 쓰는 우선 배정 주택 수를 담는다(필지 수 아님). 원인 등록표의 기존 물/시장/교회 원인을 유지하며 `수용량 부족 · 먼저 지어진 집 N채가 사용 중`으로 설명한다. 저장 상태·스키마 변경 없음.
6. 회귀: `tests/servicePriority.test.ts`의 R-T1은 우물/시장/교회를 모두 확인, R-T2는 반경 진입 순서와 입력 배열 반전을 확인한다. 기존 단독/합필 독점 접근 테스트도 유지한다.

**S2.R7 실패 사유 우선순위.** `serviceAllocation.ts:77-79`: missing(시설 없음) → outside(반경 안 시설 없음) → understaffed(반경 안 시설 모두 일꾼 부족) → unreachable(도로 연결 없음) → capacity. 우물은 understaffed·unreachable이 될 수 없고, 교회는 understaffed가 될 수 없다.

**S2.R8 파생 계산 시점.** tick T10은 `householdServices(marketSettled)`를 쓴다(`tick.ts:171-172`). T7 노동 배분 뒤의 `workers`, T8 뒤의 houses가 들어간다. UI는 틱이 끝난 state로 다시 계산한다. `updateHousing`의 기본 인자(`housing.ts:177`)는 tick에서 쓰이지 않는다.

**S2.R9 일꾼 배정(시장 가용성을 결정).** `labour.ts:allocateBuildingAndConstructionLabour:141-218`
- 가용 일꾼은 `floor(population × 0.5)`(`labour.ts:53-57`)이고, T10 전 인구를 쓴다(`tick.ts:152-157`).
- 성벽 시대 공사 예약을 먼저 뗀다(`labour.ts:176`, `max(1, floor(available × quota))`, `src/population/eraLabour.ts:109-112`).
- 식량 건물(wheat_farm, mill, granary)을 먼저 채우고(`labour.ts:177`), 일반 공사 1명을 떼어 둔 뒤(`:178`), 나머지 건물을 우선순위 `sawmill/logging_camp/storehouse = 4`, 그 외(시장 포함) `= 5`, 같으면 id 순으로 채운다(`labour.ts:94-103`).
- 건물마다 `min(remaining, workersRequired)`만큼 주므로 일부만 채워질 수 있다(`labour.ts:106`). 시장이 2/3명이면 understaffed이고, 그 2명은 다른 곳에 쓰이지 않는다.
- 자격 조건은 `buildingHasRequiredRoadAccess`다(`tick.ts:158`, `src/engine/roadAccess.ts:7-13`).
- 플레이어가 일꾼 우선순위를 조정하는 행동은 없다(`gameStore.ts:94-142`의 action 목록).

**S2.R10 시장 판매(금화).** `src/engine/marketSettlement.ts:settleMarkets:146`: `tick % MARKET_CADENCE_TICKS(:35 = 80) === 0`일 때만(`:146`) 일꾼을 다 채운 시장이 id 순으로(`:60-65`) 같은 도로 연결 요소의 곡창·창고(`:67-81`)에서 판매 규칙(`:26-33`)의 최고가 품목 1단위를 판다(`:118-143`). 비축량을 1 넘는 분량만 팔고(`:97`), 목재·석재는 시민 공사 비축분을 넘는 경우에만 판다(`:91-93`). 판매는 주택 서비스와 따로 돈다.

**S2.R11 배급자 출발.** `src/agents/roamingSpawn.ts:spawnDistributors:45-68`: `tick % BALANCE.DISTRIBUTOR_INTERVAL(balanceConfig.ts:7 = 120) === 0`에만 곡창을 id 순으로 본다(`:52`). 조건은 다음과 같다. 활동 중인 배급자가 2명 미만이어야 하고(`:54`), `homePath`가 null이 아니어야 하고(`:55`), 싣는 양은 `min(BALANCE.DISTRIBUTOR_CAPACITY(:6 = 12), bread)`로 0보다 커야 한다(`:57-58`). 실은 양은 곡창 예약으로 잡는다(`:59-62`). **곡창 일꾼 수는 보지 않는다**(S2-F3).

**S2.R12 출구 선택.** `src/engine/distributorAccess.ts:eligibleRoamingExits:9-35`: 곡창 접근 타일 가운데 가장 큰 도로 연결 요소에 속한 것만 쓴다. `src/engine/simulationPorts.ts:homePath:170-189`: 그 출구들 중 수요가 가장 급한 집(S2.R13 비교)을 가진 출구 하나를 고르고, 경로는 `[access]` 한 칸짜리다.

**S2.R13 이동.** `src/agents/roamingStep.ts:continueRoaming:79-104`
- 짐이 0이거나 `tilesTravelled >= BALANCE.DISTRIBUTOR_RANGE(balanceConfig.ts:8 = 40)`이면 귀환한다(`:86-88`).
- 그렇지 않으면 남은 범위 안에서 빵이 가득 차지 않은 집 가운데 최단 서비스 경로의 다음 칸으로 간다(`roamingDemand.ts:bestHouseDemand:17-37`). 비교 기준은 남은 끼니(`breadStock/ration`) → 경로 길이 → `lastServicedTick` → id(`roamingDemand.ts:compareHouseDemand:11-15`)다.
- 수요가 없으면 갈림길에서 RNG로 고른다(`roamingStep.ts:chooseNextTile:45-77`): 길이 하나면 그 길로, 둘이면 온 길이 아닌 쪽으로 간다. 셋 이상이면 `[이전칸, 대안, 대안]`처럼 대안을 두 배 가중해 뽑는다(`:64-66`).
- 속도는 `BALANCE.DISTRIBUTOR_SPEED(:5 = 0.11)`칸/틱이다(`roamingStep.ts:164`).

**S2.R14 배달.** `src/agents/roamingService.ts:serviceHouses:11-51`: 배급자가 서 있는 도로 타일에서 집 발자국까지 거리가 1 이하이고(`:25`), 도로-집 경계를 통과할 수 있어야 한다(`:26`, `simulationPorts.ts:193-196`). 배달량은 `min(남은 짐, capacity − stock, max(ration, 면적))`이다(`:27-29`). 빵 한도는 `max(3, ceil(residents/8) × 3)`이다(`src/content/houseFoodConfig.ts:7-9`). 빈집도 1씩 받는다.

**S2.R15 귀환과 반납.** `roamingStep.ts:routeHome:30-43`, 도착하면 `restoreBread`가 곡창 저장 한도(`granary storageCapacity` `buildingConfig.ts:110 = 200`)까지만 되돌리고, 넘치는 빵은 walker가 계속 들고 있다(`roamingCommon.ts:80-102`, `roamingStep.ts:166-178`). 경로가 끊기면 반납을 시도하고 멈추거나 귀환한다(`roamingStep.ts:151-162`).

**S2.R16 결정론.** 갈림길 RNG는 `createMulberry32(createRoamingJunctionSeed{seed, walkerId, tick, tx, ty, visitCount})`다(`tick.ts:89-101`). 배분과 출발은 모두 id 정렬을 쓴다.

**S2.R17 결과 합치기.** T8 `mergeRoamingHouses`(`tick.ts:57-72`)는 `breadStock`과 `lastServicedTick`만 house에 반영한다.

## 4. 틱 안에서의 위치

- T5 `stepDistributors` (S2.R13~R15, R16 RNG)
- T6 배달 이벤트 관측(오토플레이 전용 `deliveredBreadFromObservedGranary`, `tick.ts:74-86`)
- T7 일꾼 배정(S2.R9). 시장·곡창 `workers`가 이때 정해진다.
- T8 배급 결과 합치기(S2.R17)
- T9 `settleMarkets`(S2.R10)
- T10 `updateHousing`이 `householdServices(marketSettled)`로 S2.R1~R8을 계산해 S1에 넘긴다.
- T15 `spawnDistributors`(S2.R11~R12). 방금 T12 생산으로 늘어난 곡창 빵까지 쓸 수 있다.
- 틱 밖: 도로·건물 배치와 철거는 reducer에서 적용된다. 일시정지 중 UI는 새 state로 배분을 다시 계산하지만, `house.hasWater`는 다음 T10까지 옛 값이다.

## 5. 플레이어에게 보이는 신호

| 규칙 | 화면 |
|---|---|
| R1~R7 집별 결과 | 카드 "물" 줄과 "주택 발전 조건 › 시장/교회"(`src/ui/serviceDiagnosisModel.ts:serviceDiagnosis:15-39`, 문구 `:30-37`: "우물에서 d칸", "… 이용 가능 — 거리 d / 범위 r · 담당 u/c필지", "…이 멉니다", "가까운 …의 일꾼이 부족합니다", "…까지 연결된 도로가 없습니다", "… 수용량 부족 — 가까운 곳에 추가 시설이 필요합니다") |
| R1~R2 시설별 | 시설 인스펙터 "서비스 담당 u/c 주거 필지", "단독 주택 1 · 합필 주택 2필지, 빈집도 자리 유지", "서비스 중단: 일꾼 부족"(`serviceDiagnosisModel.ts:providerServiceRows:41-51`, `buildingInspectorModel.ts:83`) |
| 원인 아이콘 | 물/시/교, unreachable은 '길', understaffed는 '일'(`houseProgressModel.ts:serviceBlocker:41-61`, `src/ui/causeRegistry.ts:4-10`) |
| R6 id 순·기존 배정 무시 | **드러나지 않음**. 밀려난 집에는 "수용량 부족"만 뜨고, 어느 집이 자리를 가져갔는지는 나오지 않는다 |
| R5 연결 요소 판정(거리 무관) | 드러나지 않음 |
| R9 일꾼 우선순위 | 시장 인스펙터 "일꾼 n/3"(`buildingInspectorModel.ts:84`), 주택 "가까운 시장의 일꾼이 부족합니다". 우선순위와 성벽 예약은 드러나지 않음 |
| R10 판매 | 자원바 금화, 장부(`coinLedger`) |
| R11~R15 배급 | 카드 "빵" 줄(`houseDiagnosisModel.ts:servingBreadDiagnosis:185-219`), 진행 원인 "빵 배급 범위 밖입니다 — 도로거리 d / 범위 40"(`houseProgressModel.ts:72-76`), 인스펙터 "마지막 빵 N틱 전"(`buildingInspectorModel.ts:56-58`), 배급 경로 기록(`src/ui/distributorRouteHistory.ts`) |
| R11 곡창 일꾼 무관 | 곡창 인스펙터에는 "일꾼 n/2"가 뜨지만 배급에는 아무 영향이 없다(충돌, S2-F3) |

## 6. 테스트

| 조항 | 테스트 |
|---|---|
| R1 | serviceAllocation › "community well serves empty startup home without workers or roads"; housing › "well service uses a direct Manhattan radius of exactly six tiles"; marketHousing › "completed market footprint distance eight grants access and distance nine does not"; phase3Config(상수 표). 교회 반경 12 경계는 **직접 테스트 없음** |
| R2 | serviceAllocation › "finite capacity reserves empty and merged lots with stable allocation and recovery"; serviceDiagnosis › "facility inspector exposes actual used capacity and merged-lot units" |
| R3 | 위 R1 반경 테스트들 |
| R4 | serviceAllocation › "urban services require reachable roads and market workers"; marketHousing › "market service stops on a cut road or insufficient staffing and recovers on restoration" |
| R5 | marketHousing › "market roads respect completed walls and permit the gate", "compound home can receive market service from only its second tile frontage"; houseProgressModel › "capacity detail selects reachable staffed provider instead of nearer disconnected facility" |
| R6 | serviceAllocation › "exclusive single/merged homes retain coverage when earlier neighbours have two wells"(입력 순서를 뒤집어도 결과가 같음). **새 집이 기존 집을 밀어내는 경우와 탐욕 배정의 실패는 테스트 없음** |
| R7 | serviceDiagnosis › "house diagnostics do not claim water from distance or stale hasWater when the well is full"; houseDiagnosisModel 우물 3개 테스트 |
| R8 | houseProgressModel › "same-tick immutable edits refresh snapshot while unchanged state reuses it"; › "live water allocation overrides stale house flags and outranks bread" |
| R9 | houseDemolition › "demolition immediately reallocates scarce workers…"; marketSettlement › "market cannot sell using stale assigned workers after the population disappears"; efficientServices › "…market workers are already promised to construction…"(오토플레이). **시장 우선순위 5와 일부 배정은 직접 테스트 없음** |
| R10 | marketSettlement 8개 테스트 |
| R11 | roamingDistributor › "granary spawns one bread distributor on the interval while respecting max active walkers". **일꾼 0 곡창의 출발은 테스트 없음** |
| R12 | roamingAccessIntegration › "…starts from the connected access when the first access road is isolated", "…chooses the largest road component over a sorted-first dead end"; distributorEntry 7개 |
| R13 | roamingDistributor › junction 3개, "distributor follows reachable hungry household demand…", "demand routing uses stable ties, refuses routes beyond remaining range…", "demand urgency compares remaining meals…"; distributorDemand 2개 |
| R14 | roamingDistributor › "serves only houses adjacent to its actual route…", "full homes keep distributor cargo…", "one distributor visit supplies a full ration…" |
| R15 | roamingLifecycle 4개; roamingAccessIntegration › "an active distributor stops without ghost service when its route access road is removed" |
| R16 | roamingDistributor › "picks a deterministic non-reverse road at a junction" |
| R17 | roamingAccessIntegration › "presentation route history records a completed distributor branch from real tick transitions"(간접) |

테스트 없는 핵심 조항 목록은 `raw/untested-S2.txt`에 있다.

## 7. 발견

**S2-F1 · R1-fix 해소 — 시작 주택 서비스 선점 회귀(S2.R6 갱신).**
현재 P1 결과: 기존 12집 공급 유지, 새 집 capacity. 다음 문단은 수정 전 재현 기록이다.
근거: `serviceAllocation.ts:70-71`은 기존 배정을 보지 않고 `reachable 수 → 수요 → buildingId 사전순`으로 정렬한다. 플레이어 집 id `construction-site-…`(`constructionSites.ts:115`)는 시작 마을 집 id `house-…`(`openingVillage.ts:95`)보다 사전순으로 앞선다.
재현(프로브 P1): 우물 하나에 L1 집 12채(`house-…`)가 12/12를 쓰고 있다. 반경 안에 새 집 `construction-site-000042`를 짓는다. 새 집은 `served`가 되고 `house-9-8-0`은 `capacity`로 밀려나 **400틱 뒤 L1→L0**이 된다. 밀려난 집 카드에는 "우물 수용량 부족 — 가까운 곳에 추가 시설이 필요합니다"만 뜨고, 방금 지은 집이 원인이라는 신호는 없다. 새 집은 빈집이어도 자리를 가져간다(S2.R2).
판단: 규칙 결정이 필요하다(기존 배정 유지, 높은 등급 우선, 건설 시각 순서 등). 표시만 바꿔서는 문제가 남는다.

**S2-F2 · 막힘 · 중간 — 시장 일꾼은 우선순위가 가장 낮고 일부만 채워질 수 있으며, 플레이어가 바꿀 수단이 없다.**
근거: `labour.ts:94-106`(시장 우선순위 5, `min(remaining, 3)`), `labour.ts:176`(성벽 시대 공사 예약이 먼저), `gameStore.ts:94-142`(일꾼 우선순위나 비주택 철거 action이 없음).
재현: palisade 시대에 인구가 줄거나 성벽 공사 예약 창이 열리면 시장이 2/3명이 된다. 시장은 understaffed가 되고 L4 집은 market을 잃어 400틱 뒤 L3이 된다. 화면에는 "가까운 시장의 일꾼이 부족합니다"만 뜬다. 플레이어가 할 수 있는 조치는 인구를 늘리는 것뿐이고, 그 인구는 다음 틱 T7에야 반영된다. 일부만 배정된 2명은 아무 데도 쓰이지 않는다.
판단: 규칙 결정이 필요하다(서비스 시설 우선순위, 전원 채우지 못하면 배정하지 않기, 플레이어 조정 수단).

**S2-F3 · 충돌 · 중간 — 곡창 일꾼 2명은 노동력을 쓰지만 배급에는 필요 없다.**
근거: `buildingConfig.ts:104`(`granary workersRequired 2`), `labour.ts:81, 93-97`(곡창을 식량 핵심으로 먼저 채움), 반면 `roamingSpawn.ts:45-68`에는 `workers` 확인이 없다(`src/agents/*.ts`에서 `workers` 참조 0건).
재현(프로브 P5): 일꾼 0명인 곡창에 빵 30이 있으면 120틱에 배급자 1명이 빵 12를 싣고 나간다. 곡창 인스펙터는 "일꾼 0/2"로 표시되지만 배급은 계속된다. 반대로 인구가 적은 초반에도 곡창이 식량 우선순위로 일꾼 2명을 가져간다.
판단: 곡창 일꾼이 배급 조건이어야 하는지 규칙을 정해야 한다.

**S2-F4 · 숨은 규칙 · 중간 — 시장·교회의 "도로 연결"은 거리를 보지 않고, 반경은 강과 벽을 가로지른다.**
근거: `marketService.ts:20-23`(연결 요소가 같은지만 비교), `buildingDistance.ts:12-17`(직선 맨해튼).
재현: 강 건너 발자국 거리 8인 집과 시장이 100칸 우회 도로로 연결되어 있으면 served다. 반대로 도로로 2칸이지만 발자국 거리가 9면 outside다. 화면의 "거리 d / 범위 r"은 직선 거리만 말한다.

**S2-F5 · 숨은 규칙 · 중간 — 탐욕 배정이 가능한 완전 배정을 놓친다.**
근거: `serviceAllocation.ts:72-85`(한 번에 가장 가까운 시설을 고르고 다시 배정하지 않음).
재현(프로브 `s2_greedy_probe`): w1·w2·w3가 12/11/11 자리를 쓰는 상태에서, 집 p(w1·w3 둘 다 거리 6)와 q(w1·w2 둘 다 거리 6)를 놓는다. p가 먼저 w1의 마지막 자리를 가져가 q가 `capacity`가 된다. 그러나 w3에 빈자리가 있어 p→w3, q→w1이면 36필지 전부 배정된다. q 카드에는 "우물 수용량 부족 — 가까운 곳에 추가 시설이 필요합니다"가 뜨지만, 실제로는 우물을 새로 짓지 않아도 풀리는 상황이다.
판단: 배정 알고리즘(완전 매칭 또는 재배정)을 규칙으로 정해야 한다.

**S2-F6 · 숨은 규칙 · 낮음 — 빈집과 L0 집이 발전한 집과 같은 우선순위로 자리를 차지한다.**
근거: `serviceAllocation.ts:47, 70-71`(수요 = 필지 수, 등급과 주민 수는 정렬에 없음).
재현: L3 집 옆에 빈 오두막을 여럿 지어 우물 12자리를 채우면, id 순서에 따라 L3 집이 밀려날 수 있다(S2-F1과 같은 경로).

**S2-F7 · 상수 의존 · 낮음 — 쓰이지 않는 상수와 도달할 수 없는 상태가 있다.**
근거: `BALANCE.BREAD_HUNGER_WINDOW`(`balanceConfig.ts:9 = 200`)는 `src` 전체에서 정의 외 참조가 0건이다. 우물과 교회의 `understaffed`, 우물의 `unreachable`에는 UI 문구(`serviceDiagnosisModel.ts:34-35`)가 있지만 필요 일꾼 0과 roadRequired false 때문에 도달할 수 없다(`serviceAllocation.ts:63-64`).

**S2-F8 · 결정론 위험 · 낮음 — 배급자 이름이 곡창·틱 단위로만 구분된다.**
근거: `roamingSpawn.ts:29`(`id: distributor:${granary.id}:${tick}`). 한 곡창은 한 틱에 한 명만 내보내므로 지금은 충돌하지 않는다. RNG 시드가 walkerId를 쓰기 때문에(`tick.ts:94`) B·C 단계에서 한 틱에 여러 명을 내보내도록 바뀌면 같은 시드가 생긴다.

## 8. B·C 단계에서 바뀔 부분

구역(zones)과 ZoneFillAgent가 들어오면 집이 한꺼번에 많이 생긴다. S2-F1(id 사전순 배정)과 S2-F5(탐욕 배정)는 그때 빈번하게 드러나고, 구역 단위로 "어느 집이 서비스를 받나"를 정해야 한다. 지금은 오토플레이 `efficientServices` 계열이 같은 배분 함수를 witness로 쓰므로, 배분 규칙을 바꾸면 오토플레이 판단도 함께 바뀐다. 기존 배정을 기억하는 규칙을 택하면 파생값이던 `ServiceAllocation`(`householdServices.ts:7` "no duplicate service state enters saves")이 저장 상태가 된다. 그러면 claude/b8-save의 스키마 버전을 올려야 한다. 장부(C2)는 시장 판매 이벤트(`coinLedger`)를 이미 받고 있지만, 서비스 시설의 일꾼 비용·유지비는 아직 없다. C3 일용 노동이 들어오면 `labour.ts`의 우선순위(S2-F2)와 곡창 일꾼 의미(S2-F3)를 먼저 확정해야 한다. 권리(rights)와 성벽은 `canTraverseRoadBoundary`를 통해 시장·교회 연결에 영향을 준다. 흉작 사건은 곡창 빵 → 배급자 출발(S2.R11) → S1 bread 판정으로 이어진다. 입력 의도 계층은 합필·철거·도로 제거가 서비스를 잃게 만드는지 미리 보여줄 자리다. B2 시나리오 데이터화 때는 `HOUSEHOLD_SERVICE_CONFIG` 수용량, 시설 반경·일꾼, `BALANCE.DISTRIBUTOR_*`가 데이터로 빠진다.

# 압력 명세 (F0-A) — 계절 결산·배치 장부 예측·실패 사다리 1~2단·첫 겨울·시대 준비도

지시서: F0-A 흐름 뼈대 1 — 압력. 근거: [플레이어 흐름 설계서 v1](player-flow.md) 1절(결정 F1~F6)·2절(루프 5층)·4절(1장 대본, 첫 겨울)·7절(실패 사다리), [보이는 시뮬레이션 설계서 v1](visibility.md) S4(연기 없는 집)·S12(짐 진 가족). 결정: F1~F6(흐름 설계서 권고안 확정), FP1~FP8.

게임이 플레이어에게 대가를 청구한다. 계절마다 결산이 남고, 배치 전에 장부 변화를 알 수 있다. 식량이 모자라면 가구가 떠날 준비를 하고, 계속되면 실제로 떠나 집이 빈다. 대기근은 연도와 준비도로 온다. 조항 번호(FP-*)는 `tests/flowPressure.test.ts`의 테스트 이름(P1~P8)과 이어진다. 화면(결산 카드·예측 줄·폐허 그림)은 렌더 세션 몫이다.

## FP-1 계절 결산 (`SeasonLedger`, 저장 v12)

- 계절 = 달력 한 계절(1,000틱, 1년 = 4계절). 틱이 1,000의 배수가 되면 끝난 계절의 결산 한 장을 만든다. 돈 정산(2,400틱 기간 마감) 뒤에 돌아서, 기간 마감이 계절 끝과 겹치면 그 게시를 이 계절에 넣는다.
- 필드: `season`(0 봄~3 겨울) · `year` · `startTick` · `endTick` · `income` · `expense` · `stockDelta{bread, wheat, timber, stone}` · `popDelta` · `notableEvents[]` · `nextObjectiveHint`.
  - 수입·지출 = 장부 현금 계정 항목 가운데 틱이 (시작, 끝]인 것의 양수 합·음수 합(부호 뺌). 개시 잔액 항목은 넣지 않는다. 기간 마감이 없는 계절은 0이다.
  - 재고 = 자원 막대와 같은 셈(건물·수레, 목재는 금고 목재 포함). 증감 = 끝 − 시작.
  - 사건: `first_winter_warning`, `households_leaving{count}`, `households_abandoned{count}`, `households_resettled{count}`, `era_entered{eraId, forced}`.
  - 다음 목표 힌트: 떠날 준비 가구가 있거나 비축이 한 계절 미만이면 `food_reserve`, 가을·겨울에 비축이 겨울 소비(1,200틱) 미만이면 `winter_reserve`, 황폐한 집이 있으면 `resettle`, 아니면 없음.
- 최근 8계절(2년)만 남긴다. 세는 중인 계절(`current`)은 시작 인구·재고와 사건 수를 들고 있다.

## FP-2 배치 장부 예측 (`predictPlacementLedger(state, kind, tile)`)

UI 예측 줄이 쓰는 순수 함수다. 건물을 그 자리에 세운 가상 도시를 만들어, 기간 마감과 서비스 할당이 쓰는 같은 규칙에 묻는다.

- `rentPerPeriod`(집): 한 기간(2,400틱) 안에 그 자리의 서비스가 주는 등급의 지대. L1은 물 + 600틱 유지라 한 기간 안에 되고, L2는 2,400틱이 더 필요해 한 기간을 넘는다. 집은 물과 빵이 있어야 찬다. 그래서 물이 없거나 어느 곡창 배급꾼의 도로 범위(40칸)에도 없는 자리는 0이다. 필지 위면 전면 폭으로 비례한다(M-2).
- `upkeepPerPeriod`: 시설 유지비(M-6), 없는 종류는 0.
- `labourDemand`: 가동에 드는 어른(`workersRequired`), 집은 0.
- `serviceCoverage`: 우물·시장·교회는 할당이 이 시설에 줄 집 수, 곡창은 L3 반경(12) 안 집 수, 집이면 그 집이 받을 서비스(`water`·`market`·`church`).

## FP-3 실패 사다리 1~2단 (결정 F3)

`sampleTicks`(50틱)마다 모든 집을 본다.

- **부족**: 사람이 사는 집의 빵 비축이 0이거나, 도시 비축(FIX-1 `foodReserveTicks`, 이 계절 소비 기준)이 한 계절 미만이다. 굶주림 유예 중인 집(오프닝 마을 첫 6,000틱)은 부족이 아니다(굶지 않으므로).
- **1단 떠날 준비**(`leavingSinceTick`): 부족이 한 계절(1,000틱) 끊김 없이 이어졌다. 원인은 `food_shortage`이고 문구는 `식량 부족으로 떠날 준비`다.
- **2단 이탈·황폐**(`abandonedTick`): 1단이 다시 한 계절 이어졌다. 가구가 떠나고 집은 헐리지 않은 채 빈다. 주민 0, 빵 0, 지대 0(지대는 사람이 사는 집만 낸다), 인구가 줄어든다.
  - 한 달력 계절에 최대 2가구(`maxDeparturesPerSeason`, F3 "필지 1~2개 황폐"). 빵 비축이 적은 집 → 등급이 낮은 집 → id 순서로 먼저 떠난다.
  - 사는 집이 4채(`minOccupiedHouses`, 오프닝 마을) 아래로는 떠나지 않는다. 2단은 손실이고 끝이 아니다(결정 FP3).
  - 굶어서 빈 집(기존 규칙)은 황폐가 아니라 보통 빈집이다. 빵이 오면 다시 찬다.
- **회복**: 부족이 끝나면 1단이 풀린다. 황폐한 집은 한 계절 이상 비었고, 물이 닿고, 도시 비축이 한 계절 이상이면 새 가구(필지 한 칸 몫의 주민)를 받는다. 표본 한 번에 한 집이다.
- 저장 v12: 집의 `foodShortSinceTick`·`leavingSinceTick`·`abandonedTick`, 없으면 정착.

## FP-4 첫 겨울 시험 (결정 F4)

- 겨울(해의 넷째 계절, 해 안 틱 3,000~) 끼니는 배급량 × 1.2다. 연료 자원이 없어 난방을 대신한다. 우수리는 천분의 일 단위로 집의 `winterRationCarry`에 넘겨, 한 겨울의 끼니가 정확히 1.2배를 먹는다(배급량 1이면 겨울 끼니 다섯 번에 6).
- 비축 판정(FP-3)도 이 계절 소비로 잰다. 겨울에는 비축 틱 ÷ 1.2다.
- 경작 성장은 이미 겨울에 멈춘다(AF-4). 바뀌지 않는다.
- 목표 카드 훅 `first_winter_warning`: 가을이 시작되는 틱에 비축(보통 끼니 기준 틱)이 겨울 소비(1,000 × 1.2 = 1,200틱)보다 적으면 한 번 올린다(`seasons.firstWinterWarning{tick, reserveTicks, winterNeedTicks}`). `firstWinterWarningActive(state)`는 그 가을과 겨울 동안 참이다.

## FP-5 시대 준비도 (결정 F2)

- `EraDef.enterWhen = { yearAtLeast, state?: ConditionSet, maxDelayYears? }`. 달력이 연도에 닿고 도시가 `state`를 만족하면 들어간다. 만족하지 못하면 `maxDelayYears`년 뒤에 강제로 들어간다(`forced`). 앞 시대보다 먼저 들어가지 않는다.
- 대기근(1315): 곡창 ≥ 1 ∧ 필지 ≥ 12 ∧ 시장 ≥ 1, 최대 5년 유예(1320 강제). 새 조건 종류 `housing_lots_at_least`(필지 = 집의 필지 면적 합, 필지 상한과 같은 셈).
- 들어간 시대는 `GameState.historicalEras`(저장 v12)에 남는다. `historicalEra(state)`는 마지막으로 들어간 시대다. 기록이 없는 상태(v12 이전 틱)에서는 연도로 셈하되, 준비도 문이 있는 시대는 유예가 끝난 해부터 센다.
- 효과는 아직 0이다(F0-B 사건 뼈대에서).

## FP-6 자동 성장 봇의 비축 조치와 `--naive-reserve` (가드레일 유지·관문 ①)

- 봇의 연 수요 추정(경작지 계획)은 겨울 끼니를 넣는다. 한 해는 세 계절 × 1 + 겨울 × 1.2 = 1.05년 분이다(`YEAR_RATION_PERMILLE`). 넣지 않으면 가드레일 1회차 seed 4처럼 밭이 한 해의 0.95만큼만 계획돼 도시가 L4 13~16/24에서 멈춘다.
- 표준 봇은 가을에 비축을 겨울과 그 다음 봄에 맞춘다(목표 2,200틱 = 겨울 1,200 + 봄 1,000). 모자라면 수확 여유 1.6배로 경작지·헛간을 늘리고, 곡창이 없으면 곡창을 짓는다(`autoplayWinterReserve.ts`). 식량 단계 바로 앞에서 본다.
- `--naive-reserve`(관문 ① 변형)는 봇의 비축 조치 세 가지를 끈다(결정 FP6).
  - 가을 겨울 비축 확인을 하지 않는다.
  - 경작지 수확 여유를 1.2배에서 1.0배로 낮춘다.
  - 빵 재고가 20 미만이어도 집을 늘린다. 흐름 설계서의 "비축 vs 확장"에서 확장을 고르는 플레이어다.
- `scripts/pressureGateRun.ts <seed> <ticks> [--naive-reserve]`가 1단·2단 첫 발생 틱과 계절을 기록한다. `efficientGrowthRun.ts`도 같은 플래그를 받는다.

## FP-7 시장일 박동 (MOVE-1 후속, [주민 이동 명세](resident-movement.md) RM-2 갱신)

- 장날은 달마다 한 번(30일, 약 333틱), 그달의 셋째 날이다. 집의 장보기는 장날마다 모든 집이 간다(시장 목적 상한 12가 막는다). 교회는 그대로 일요일, 네 주에 한 번이다.
- 방문객은 시장에서 도로 12걸음 안에서 출발한다. 그 안에 성문이 있으면 성문 도로 칸, 없으면 가장 먼 도로 칸이다. 머무름은 60틱이다. 왕복은 최대 2 × 12 ÷ 0.12 + 60 = 260틱이라, 장날의 방문객은 다음 장날(333틱) 전에 모두 돌아간다. 장날 화면에만 파동이 선다.

## 렌더·UI에 넘기는 API

- `state.seasons.history: SeasonLedger[]`(최근 8계절), `state.seasons.current`, `firstWinterWarningActive(state)`.
- `predictPlacementLedger(state, kind, tile)`.
- 집 상태 `housePressureStatus(house)`: `settled` · `leaving` · `abandoned`, `housePressureCauseLabel(house)`. 문구는 `src/content/pressureCopy.ko.ts`.
- 렌더 분기: `buildingVisualState`의 `housePressure` 한 줄(예외 18번). 폐허 그림·짐 진 가족(S12)·연기 없는 집(S4)은 렌더 세션 몫이다.

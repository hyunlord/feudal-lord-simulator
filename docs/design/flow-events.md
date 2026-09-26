# 사건 명세 (F0-B) — 사건 뼈대·예고 사다리·날씨·첫 화재·첫 흉년 리허설

지시서: F0-B 흐름 뼈대 2 — 사건 뼈대. 근거: [플레이어 흐름 설계서 v1](player-flow.md) 0절 2·5(위기는 배운 루프의 시험, 예고 → 도래 → 회복), 4절 1장 대본(35~45분 첫 화재, 50~60분 첫 흉년), 5절 시대 전환, 7절 사건 주기, [보이는 시뮬레이션 설계서 v1](visibility.md)(사건은 세계에서 먼저 보이고 UI가 뒤따른다). 결정: EV1~EV8.

위기가 온다. 사건은 소문 → 징후 → 도래 → 회복의 톱니로 오고, 대비한 도시와 안 한 도시의 손실이 다르다. 조항 번호(EV-*)는 `tests/flowEvents.test.ts`의 테스트 이름(E1~E10)과 이어진다. 화면(사건 카드·연기·불·폐허 그림)은 렌더 세션 UI-4 몫이고, 이 명세는 렌더가 읽을 상태 API까지다.

## EV-1 사건 뼈대 (`EventDef`, 결정론 스케줄러)

- 사건 정의는 데이터다(`src/content/eventConfig.ts` `EVENT_DEFS`): `id` · `kind`(`fire` | `dearth`) · `schedule` · `forecast{rumourSeasons, signSeasons}` · `effects: EffectSpec[]` · `harvestYears` · `harvestPermille` · `foodPricePermille` · `recoverySeasons`.
- 시나리오의 `activeEvents`가 켤 사건을 고른다. 캠페인과 샌드박스 모두 `weather`·`first_fire`·`fire`·`dearth_rehearsal`. 사건은 날씨가 있어야 한다(레지스트리가 검사).
- 일정: `scheduled`는 `centreYear + yearOffsets` 가운데 한 해의 여름을 seed가 고른다(`afterEventId`가 있으면 그 사건 해보다 `minYearsAfter` 이상 뒤만). `chance`는 기준 사건 해 다음부터 마른 여름마다 seed의 굴림이 `chancePermille` 아래면 놓인다.
- 일정과 날씨는 seed·시나리오·틱의 순수 함수이며 저장하지 않는다. 저장하는 것은 일어난 일(도래 기록·타는 집·손실·놓친 화재)뿐이다(`GameState.events`, 저장 v13).
- 효과·원인 추적: 도래한 사건은 정의의 `effects`를 B1 효과 관(`eventEffectRegistry`)에 출처 `{type:"event", id:"<defId>@<계절>"}`로 싣는다. 불탄 집의 원인(`houseEventCauses`)과 흉년 값으로 바뀐 장부 게시(`demesne_sale`)도 같은 출처를 단다.

## EV-2 예고 사다리 (`eventForecast(state)`)

| 단계 | 언제 | 무엇 |
|---|---|---|
| 소문 `rumour` | 도래 `rumourSeasons` 계절 전부터 | 결산 줄 `event_rumour`, 다음 목표 힌트(`dearth_reserve` · `fire_break`) |
| 징후 `sign` | 도래 1계절 전부터 도래까지 | 결산 줄 `event_sign`, 세계 상태: 날씨가 먼저 바뀐다(흉년 → 젖은 봄, 화재 → 마른 봄). 경고 카드 훅 = 이 단계의 항목 |
| 도래 `arrival` | 흉년: 여름 시작 · 화재: 발화 틱 | 결산 줄 `event_arrived`, 효과 적용 |
| 회복 `recovery` | 도래 끝부터 `recoverySeasons` 계절 | 흉년: 다음 수확 뒤 두 계절(이듬해 보릿고개) · 화재: 마지막 불이 꺼진 뒤 두 계절 |
| 끝 `done` | 회복 뒤 | 결산 줄 `event_recovered{losses}`, 예보에서 빠진다 |

- `eventForecast`는 소문·징후 단계의 예정 사건과 도래·회복 중인 사건을 도래 틱 순으로 준다(`id` · `defId` · `kind` · `stage` · `arrivalTick` · `year` · `season`).
- 흉년 리허설은 소문 3계절(전년 가을), 징후 1계절(봄). 화재는 소문 2계절(전년 겨울), 징후 1계절(봄).

## EV-3 날씨 (`weatherAt(state)`)

- 계절마다 `normal` · `wet` · `dry` · `cold` 가운데 하나. seed와 계절 번호의 굴림으로 계절 표에서 고른다(천분율): 봄 보통 750·젖음 250, 여름 보통 600·젖음 200·마름 200, 가을 보통 750·젖음 250, 겨울 보통 700·추움 300.
- 예정 사건이 날씨를 정한다: 예정 화재의 여름과 그 전 봄은 마름, 흉년의 수확 여름과 그 전 봄은 젖음.
- 젖은 여름: 그해 수확 × 0.95. 마른 여름: 화재 확산 확률이 오른다(EV-4). 추운 겨울은 상태만 있다(규칙 없음 — 겨울 끼니 × 1.2는 모든 겨울, FP-4).

## EV-4 화재

1장에는 기와가 없으므로 집은 모두 초가다.

- **발화 조건**(예정 여름에만, 여름 시작 + seed 오프셋(전반부)부터 50틱마다): 서 있는 초가(불타는 중·불탄·재건 중 제외) 가운데 발자국 거리 2 안에 초가가 2채 이상(밀도)이고 가장 가까운 우물에서 2칸 이상(우물에 붙은 집은 지켜본다)인 집. 맞닿은(거리 1, 불이 번질 수 있는) 초가가 많은 집, 밀도가 높은 집, 물을 긷지 않는 집(`hasWater` 아님), 우물에서 먼 집 순으로 앞 3채 가운데 seed가 고른다. 여름이 끝날 때까지 후보가 없으면 그 화재는 놓친다(`missed`).
- **1장 첫 화재**(`first_fire`): 1302 ± 1의 여름(seed), 마른 여름으로 강제 → 조건이 맞으면 보장. 이후 화재(`fire`)는 마른 여름마다 30 %.
- **확산**: 10틱마다 타는 집이 맞닿은 초가마다 굴린다(마름 120‰ · 보통·추움 50‰ · 젖음 15‰). 빈 칸이나 우물이 사이에 있으면 맞닿지 않으므로 번지지 않는다. 이웃 가구가 우물물을 긷는 집이면(`hasWater`) 확률 × 0.3(지붕에 물을 끼얹는다).
- **진화**: 집은 150틱 탄다. 그 집 가구가 우물물을 길으면 60틱에 꺼진다.
- **불탄 집** `burnt`(`House.burntTick` · `burntByEventId`): 등급·지은 등급 0, 곳간 빵 0, 지대 없음, 승급·입주 없음. 가구는 떠나지 않는다(실패 사다리 이탈이 아님). 빵이 끊기면 옛 규칙대로 줄어든다.

## EV-5 첫 흉년 리허설 (`dearth_rehearsal`)

- 1303 ± 1 여름(첫 화재 해보다 1년 이상 뒤), 젖은 여름 강제.
- 그해 수확 × 0.7(`harvestPermille` 700, 젖은 여름 몫 포함). 줄어든 밀은 사건 손실 `harvestLost`.
- 여름 시작부터 다음 수확 시작(이듬해 해 안 1,500틱, AF-11 전망의 수확)까지 시장 판매가 빵·밀 × 1.5(`foodPricePermille` 1500, 1페니 단위 반올림: 밀 2 → 3, 빵 5 → 8). 판매 우선순위는 평소 값 그대로라 흉년이 시장이 먼저 내보내는 물건을 바꾸지 않는다.
- 비축이 적은 도시는 이듬해 봄~초여름 보릿고개에 사다리 1단(FP-3)에 든다. 흉년 수확 시작 + 2계절부터 회복 끝까지 떠난 가구(2단)는 흉년의 손실 `departures`로 센다(2단은 두 계절 부족이라, 그보다 앞선 이탈은 지난해 수확 탓이다).
- 대기근 자리(`EraDef.effects`)는 F0-C.

## EV-6 재건 (`rebuild_house`)

- 불탄 집에 재건 공사를 놓는다: 집 공사를 2단계(기초)부터 — 공사량과 자재의 25 %가 이미 되어 있고 자재는 75 %(올림)만 든다. 공사장은 집의 타일을 차지하지 않고(집이 그대로 서 있다) `rebuildOf`로 집을 가리킨다.
- 완공하면 새 건물 대신 그 집의 `burntTick`을 지운다. 가구는 등급 0에서 다시 오른다.
- 한 집에 재건 공사는 하나.

## EV-7 봇

- 불탄 집이 있으면 가장 먼저 `rebuild_house`(표준·naive 모두 — 재건은 비축 조치가 아니다).
- 흉년이 소문·징후·도래 중이면 표준 봇은 (가) 경작 여유를 1.2 ÷ 0.7 ≈ 1.72로 올려 나쁜 여름 전에 밭을 늘리고, (나) 도시 비축이 네 계절(4,000틱) 미만이면 집을 늘리지 않는다. naive 변형(`--naive-reserve`)은 둘 다 하지 않는다.
- 관문 ②의 대비 안 한 봇 = `--naive-reserve --no-wells`(오프닝 우물 말고는 우물을 짓지 않는다).

## EV-8 결정론·저장 v13

- `GameState.events{records[], burning[], missed?}`, `House.burntTick`·`burntByEventId`, 공사장 `rebuildOf`. v12 → v13 승격은 버전만 올린다(일정·날씨는 파생). 흉년 중에 저장된 v12는 첫 틱에 도래를 따라잡는다.
- 모든 굴림은 `hashSeed(seed, 소금, 정수…)`(FNV + avalanche)로 틱·건물 id·계절에서 나온다. 같은 상태는 같은 미래를 낳는다.

## EV-9 결산 연결

- `SeasonLedger.notableEvents`에 `event_rumour` · `event_sign` · `event_arrived` · `event_recovered{losses{burntHouses, departures, harvestLost}}`가 붙는다.
- 다음 목표 힌트는 `food_reserve` → `harvest_reserve` → `dearth_reserve`(흉년 소문·징후) → `fire_break`(화재 소문·징후) → `rebuild`(불탄 집) → `resettle` 순이다.

## 렌더가 읽을 API

| API | 뜻 |
|---|---|
| `eventForecast(state)` | 예고·도래·회복 중 사건(종류·단계·도래 연도·계절) |
| `state.events.records` | 도래한 사건(종류·도래·끝·회복 끝 틱, 발화 집, 손실) |
| `burningHouses(state)` | 지금 타는 집(건물 id, 발화 틱, 꺼질 틱, 가구가 끄는 중인지) — 불 확산 칸 |
| `weatherAt(state)` | 이번 계절 날씨 |
| `House.burntTick` · `buildingVisualState.houseBurnt` | 불탄 집 |
| `houseEventCauses(state, id)` | 집 상태의 원인(`SourceRef{type:"event"}`) |
| `foodPricePermille(state, tick)` · `marketSalePrice` | 흉년 값 |

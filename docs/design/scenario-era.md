# 시나리오·정착 단계·역사 시대·달력 명세 (B2)

지시서: B2 시나리오·시대·달력 데이터화. 결정: K4, K4-1, K4-2(보류), K9([결정 목록](../decisions/README.md)). 이 명세의 조항 번호(SC-*)는 `tests/scenarioEra.test.ts`의 테스트 이름에 그대로 쓴다.

## 데이터 (`src/content/scenario/`)

- **SC-1 등록**: 시나리오는 `namespace:id`(예 `core:campaign_market_town`)로 등록한다. 등록 순서는 선언 순서이며, 같은 id를 두 번 등록하면 오류다. 로더는 스키마를 검증한다. 단계 id 3종이 모두 있어야 하고, 시대는 연도 오름차순이어야 한다. 조건의 술어는 아래 목록 밖이면 안 되며, 숫자는 유한해야 한다.
- **SC-2 조건 술어**: 새 규칙을 만들지 않고, 기존 승리·선포 판정에 쓰이던 값에 이름을 붙인다.

| 술어 | 기존 근거 |
|---|---|
| `population_at_least` | `state.population` |
| `supplied_percent_at_least` | `settlementMetrics`의 입주 가구 수 >0 ∧ `suppliedPercent` |
| `occupied_l4_lots_at_least` | `settlementMetrics.occupiedL4Lots` |
| `stage_at_least` | `state.era` 순서(촌락 < 시장도시 < 요새 도시) |
| `wall_completed` / `stone_wall_completed` | `settlementMetrics.completedWall` / `completedStoneWall` |
| `building_count_at_least` | 완공 건물 수(`era.ts`의 선포 조건) |
| `spendable_resource_at_least` | `placementSpendableResource` 목재·석재 |
| `treasury_coin_at_least` | `state.treasuryCoin` |
| `settlement_empty_for` | 주민 0 연속 틱(`emptyTicks`) |

- **SC-3 파생·비저장**: 달력·역사 시대·단계 이름·해금 목록은 파생값이다. 상태에 새로 저장하는 것은 `scenarioId` 하나다(저장 v5). 정착 단계는 기존 `state.era`(`hamlet`/`palisade`/`stone_town`)를 `village`/`market_town`/`fortified_town`에 대응시켜 읽는다.

## 정착 단계와 성벽 (K4-1)

- **SC-4 시장도시**: 목책 선포가 시장도시 진입이다(`confirm_palisade_proclamation`, 성벽 긋기 필수). 진입 조건은 `StageDef.enterWhen`에 둔다. 기본 시나리오 값은 인구 60·곡창 1·예배당 1·가용 목재 250으로 기존과 같다. `WallPolicy.palisade`는 데이터 자리다. `required`만 허용하고 다른 값은 로더가 거부한다(K4-2까지).
- **SC-5 해금**: 단계별 해금은 `StageDef.unlocks`가 유일한 원천이다. 촌락은 기존 촌락 건물, 시장도시는 채석장·석공소·시장·**교회**, 요새 도시는 성채를 해금한다. 교회는 석조 선포에서 시장도시로 옮긴다. L4에 교회가 필요하므로, 석벽 없이 번영에 도달하려면 이 이동이 있어야 한다.
- **SC-6 석벽 프로젝트**: 석조 선포(요새 도시 진입, 목책 구간의 석벽 교체 시작)는 `WallPolicy.stoneWall`이 `off`이면 열리지 않는다. `optional`이면 `stoneWallPrereq`를 충족할 때 열린다. 기본 시나리오의 전제조건은 기존 석조 선포 조건(인구 140·시장 1·석공소 1·가용 석재 400·금화 200)과 같다. 교체 공사 규칙은 그대로다.
- **SC-7 번영 승리**: 목표형의 승리 조건은 인구 140, 입주 L4 4필지, 물·빵 90%이며 1,200틱 유지해야 한다. 이전 목표(자립 마을 → 목책 마을)를 모두 달성한 뒤에만 센다. 석조 시대와 석벽 완공은 승리 조건에서 뺐다. 석벽이 완공되어 있으면 승리 화면에 보너스로 표시한다.
- **SC-8 목표 순서**: 목표형의 목표는 `자립 마을`(인구 20·공급 90%·600틱 유지)과 `목책 마을`(인구 60·시장도시·성벽 전체 완공)이다. 저장된 이정표 키(`selfSufficient`/`palisade`/`prosperity`)는 바꾸지 않는다.
- **SC-9 실패**: 목표형의 실패는 기존과 같다. 주민이 있던 뒤 시작 유예 6,000틱이 지나고 주민 0이 600틱 이어지면 `abandoned`다.

## 샌드박스

- **SC-10**: `sandbox`는 `victory`·`failure`가 `null`이다. 결과는 언제나 `ongoing`이고, 목표판은 목표 대신 샌드박스 안내를 보여 준다. 단계·해금·성벽·시대·달력은 목표형과 같다.

## 달력과 역사 시대

- **SC-11 달력**: `calendar(tick, startYear)`는 `{ year, season, dayOfYear }`를 돌려준다. `TICKS_PER_YEAR = 1200`, 계절은 각 300틱(봄·여름·가을·겨울)이다. `dayOfYear`는 360일 기준 1~360이며 정수 연산으로 구한다. 틱 0이 시작 연도 봄 1일이다. 잠정값이며 사용자 플레이를 측정한 뒤 조정한다.
- **SC-12 역사 시대 5기**: 포화 1300 / 기근과 취약 1315 / 전쟁 동원 1337 / 인구 붕괴와 노동 반전 1348 / 재편과 전문화 1380. 현재 시대는 `yearAtLeast`를 충족하는 마지막 시대다. 상태 조건은 자리만 두고 비워 둔다. `effects`는 이번에 0개이며, 효과 파이프(`EffectRegistry`)에 등록되는 효과도 0개다.
- **SC-13 결정론**: 달력·시대는 틱과 시나리오만의 함수다. 저장·불러오기 뒤에도 같은 값이 나온다.

## 저장

- **SC-14**: 저장 v5는 `GameState.scenarioId`를 추가한다. v4→v5 이주는 `core:campaign_market_town`을 채운다. 알 수 없는 id는 불러오기 오류이며, 없는 경우(이전 코드가 만든 상태)는 기본 시나리오로 읽는다.

# 노동·가구·가내 생산 슬롯·방앗간 운반 명세 (C3)

지시서: C3 노동 모델·가내 생산 슬롯·계절 노동·방앗간 운반. 설계: [콘텐츠 설계서](CONTENT_DESIGN.md) 6절(사람·시간)·3절(가내 생산 = 실제 재고, K3), [설계서](DESIGN_MASTER.md) 7절 노동, R1 명세 [S5](rule-repairs/S5-labour.md)(R-3 공사 최소 몫), [경작지 명세](arable-fields.md) AF-7·AF-9·AF-15. 결정: [결정 목록](../decisions/README.md) LB1~LB6.

조항 번호(LB-*)는 `tests/labourHousehold.test.ts`(시나리오 L1~L10)의 테스트 이름에 쓴다. 수치는 `src/content/balanceConfig.ts`의 `LABOUR_BALANCE`(`BALANCE_CONFIG.labour`)·`SEASON_BALANCE`(`BALANCE_CONFIG.season`) 한 곳에 있다.

## 가구 구성원

- **LB-1 성인과 아이**: 집마다 `House.members = { adults, children, seed }`(저장 v11)를 둔다. `adults + children = residents`이고, 인구 총계 규칙은 바뀌지 않는다.
  - 성인 합은 기존 노동력 계산 `⌊인구 × 0.5⌋`(`availableWorkers`)와 정확히 같다. 집마다 ⌊누적 주민 × 0.5⌋의 차이로 나눠서, 주민이 홀수인 집의 남는 한 명은 id 순으로 번갈아 성인이 된다.
  - `seed`는 게임 seed와 건물 id로 정한다(결정론). 새 집은 첫 주민 갱신 때 받는다.
- **LB-2 구성원 속성**: 개별 속성은 저장하지 않고 `memberProfile(house, i) → { sex, ageBand }`로 파생한다. 앞의 `adults`명은 성인(`adult` 또는 `elder`), 나머지는 `child`다. 성별·노인 여부는 `seed`와 순번의 해시다.
  - 렌더 V2용 API: `householdMembers(state, houseId) → { adults, children, members: MemberProfile[] } | null`.

## 노동 배분 v2

- **LB-3 공급과 수요**: 공급은 가구 성인이다. 수요는 네 종류다.
  1. **시설 고용**: 기존 건물 슬롯(`workersRequired`). 헛간의 일꾼 4도 여기다.
  2. **계절 농사**: 헛간이 맡은 띠의 일손(LB-5).
  3. **일용 풀**: 공사(R-3 최소 몫 + 추가 인력), 곡창 거점 운반(LB-7).
  4. **가내 생산 슬롯**: 집 안 슬롯(LB-8). 제품이 없는 동안(C4 전) 수요는 0이다.
- **LB-4 우선순위(최종값)**: 부족할 때 위에서부터 채운다.
  1. 공사 최소 몫(R-3, 준비된 부지가 있을 때 `max(3, ⌈성인 × 0.2⌉)`까지)
  2. 핵심 식량 한 사슬(헛간·방앗간·곡창 각 1)
  3. 준비된 공사가 있으면 핵심 벌목장·제재소 한 쌍
  4. 나머지 식량 시설
  5. 벌목·제재·창고, 그 밖의 시설
  6. 헛간 계절 일손(LB-5)
  7. 곡창 거점 운반(LB-7)
  8. 공사 추가 인력(부지당 3명까지)
  9. 가내 생산 슬롯(LB-8)
  10. 남은 성인 = 유휴
  - 1~5와 8은 R1-fix 배정(`allocateBuildingAndConstructionLabour`) 그대로다. 새 수요 6·7·9는 그 배정이 남긴 성인에서만 나온다. 지시서의 잠정안(식량 시설 > 헛간 계절 > 공사 최소 몫 > 그 밖의 시설)과 다른 점은 결정 LB2에 적었다.
  - `GameState.idleWorkers`는 R1-fix 뜻(시설·공사에 배정되지 않은 성인 = 새 시설이 쓸 수 있는 인력)을 유지한다. 자동 성장의 시설 판단이 이것을 쓴다.
  - `GameState.labour`(저장 v11, 틱마다 다시 계산)는 `{ adults, facility, construction, fieldHands, hauling, household, idle }`이다. `idle`이 유휴 노동이다.
- **LB-6 가구별 배분표(파생)**: `householdLabour(state)`는 LB-4의 배정 결과를 집에 나눈다. 집은 id 순, 일자리는 LB-4 순위·건물 id 순으로 채운다. 상세창 줄은 `성인 3 · 방앗간 1 · 가내 1 · 일용 1`(`householdLabourRows`)이다. 저장하지 않는다.

## 계절 노동

- **LB-5 헛간 계절 일손**: 헛간의 계절 필요 인력 = ⌈맡은 띠 칸 수 × `fieldHandsPerCellPermille` × 계절 배율⌉ ÷ 10⁶이다.
  - 계절 배율(연중 틱): 파종철 3,500~1,000 ×2 · 초여름 1,000~1,500 ×1 · 수확철 1,500~3,000 ×2 · 초겨울 3,000~3,500 ×0.5.
  - 헛간 일꾼(시설 고용)이 먼저 필요 인력을 채우고, 모자란 만큼을 일손(`Building.fieldHands`)으로 일용 풀에서 데려온다. 가동 중지·도로 없는 헛간은 일손을 받지 않는다.
  - 단계 전이 속도: 일꾼과 일손이 틱마다 한 명당 1 일-틱을 낸다(AF-7 그대로). 필요 인력을 다 채우면 속도는 필요 인력 일-틱이고, 속도 비율은 (일꾼 + 일손) ÷ 필요 인력이다. 일손이 없어도 C1c-2의 헛간 일꾼 4명 속도는 그대로 남는다.
  - 겨울에는 필요 인력이 절반이 되어 일손이 풀리고, 풀린 성인은 가내 슬롯·유휴로 간다.

## 방앗간 운반

- **LB-7 방앗간 수레 두 대와 곡창 거점 운반**
  - 방앗간은 수레 두 대를 둔다. 본 수레는 빵을 내보낸다(빵 8 이상이면 출발). 입고 수레(`cart: "intake"`)는 밀만 가져온다. 밀 + 들어올 밀이 12 미만이면 출발한다. 두 수레의 적재량은 12(`carterCapacity`)다.
  - 곡창 거점 운반: 곡창은 운반꾼 한 명(일용 풀, LB-4의 7)이 있으면 반경 `pushRadius` 안의 방앗간 중 밀 + 들어올 밀이 가장 적은 곳에 밀을 12까지 밀어낸다(`cart: "push"`).
  - 곡창이 없는 초반에는 방앗간이 헛간 곳간에서 밀을 바로 가져온다(AF-9 그대로).
  - 자동 성장의 방앗간 상한은 운반 계수 2(AF-13, 수레 하나 왕복)를 `LABOUR_BALANCE.millHaulingFactorPermille`로 낮춘다.

## 가내 생산 슬롯

- **LB-8 슬롯**: 집 등급별 슬롯 수는 L0 0 · L1 1 · L2 1 · L3 2 · L4 2다. 슬롯 = `{ craftId | null, workers, input, output, stock }`이다.
  - 저장은 제품이 있는 슬롯만(`House.crafts`)이고, 없으면 빈 슬롯으로 파생한다(`householdSlots(house)`).
  - 재고는 집 안 재고다(창고를 거치지 않는다). 집 밖으로는 `공정 배달`(`processDelivery`) 한 종류로만 나간다(시장·이웃 집).
  - 제품 정의는 `src/content/crafts/*.json`을 `CRAFT_DEFINITIONS`로 읽는다(`parseCraftDefinition`). 지금은 0개이고 첫 항목은 C4의 `brew_ale`이다.
  - 상세창 줄은 `가내 생산: 없음` 또는 제품 이름이다.

## 유휴 표시

- **LB-9 유휴 노동**: 유휴 = LB-4의 어느 수요에도 못 간 성인(`labour.idle`). 비율은 A″와 같이 유휴 ÷ 인구다.
  - 자원바 인구 칸: `유휴 일꾼 N`은 `labour.idle`이다.
  - 원인 등록표 `idle_labour`(`일손 남음`): 목표판 줄 `일손 남음 N`, 출처는 유휴 성인이 있는 집(`SourceRef{type:"building"}`).
  - 비율이 25%를 넘으면 안내 `일손이 남습니다 — 건설을 늘리거나 경작지·헛간을 넓히세요`(C4 뒤 `가내 생산·일용 노동을 늘리세요`).

## 저장

- **LB-10 v10→v11**(`migrateStateV10ToV11`): 집마다 `members`를 LB-1로 만들고(seed 생성), `labour`를 LB-4로 다시 계산한다. 인구·주민 수·건물·재고는 그대로다. 수레·일손 필드는 없으면 0이다.

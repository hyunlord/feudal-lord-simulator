# v3 변경 기록

작성일 2026-10-03. 기준 브랜치 `codex/phase15-organic-ground`, 읽은 코드 HEAD **`5c16778d2eff26a1501485a7c0d7413ce16a6388`**. v2 작성 기준은 `83b06802661d6eef33ebf7dc5b7c31a18aa9fae8`이므로 새 판단은 현재 소스로 다시 확인했다. 기존 역사 참고문헌과 변경하지 않은 근거 링크는 원래 SHA를 유지한다.

사용자가 지정한 **15개**만 변경했다. `number`, `id`, 분류, 연도 범위, 역사 출처는 유지했다. 코드·명령·저장 필드를 새로 만들지 않았다. 아래 숫자는 엔진 상수가 아니라 **콘텐츠에서 확정한 발동/입력 기준**이며, 250‰ 장려금 한도·18d 목재 가격 등 실제 엔진 상수와 구분한다.

| 초안 | 바꾼 내용과 이유 | 실제 데이터·코드 근거 |
|---|---|---|
| 002 | 이미 accounts인 상태에 accounts를 다시 설정하던 선택 삭제. 방문 감사 또는 직접 감독이라는 실제 변화 두 개로 정리. 직접 감독 선택의 불필요한 accounts 재설정도 제거. 현재 위임/accounts·관리 부하=용량·용량≥2·최근 방문 차감 없음 조건. | `stewardship.oversight.mode/auditMode`, `attention(state)`, `visitTick`; `src/engine/stewardship.ts:60`, `:371`, `:431` |
| 004 | 거주 가구≥2, 실제 물 미공급 가구≥2, 기존 밀 저장처 반입 공간0으로 구체화. 장려금40d 또는20d씩, 남은 설정한도40≤L<80. 물은 재고가 아닌 서비스 할당 결과로 검사. | `houses[].residents`, `allocateHouseServices(state).houses`, `storageCapacityBlock(buildings,'wheat')`, `agency.subsidies`; `src/population/serviceAllocation.ts:53`, `src/economy/storage.ts:98`, `src/engine/townAgency.ts:73` |
| 008 | 기존 예배당≥1, 모든 기존 예배당에서 외곽거리8타일 초과인 거주 가구≥3. 장려금50d 또는20d. 8타일은 편집 문턱이며 chapel의 서비스 반경이 아님. 장려금0인데 기존 자율 제안이 이미 있어야 한다는 순환 조건을 적법 건설 후보 검사로 대체. | `buildings[].kind`, `buildingFootprintDistance`, `autoplayBuildAction`; `src/geometry/buildingDistance.ts:12`, `src/engine/autoplay.ts:275`, `src/content/buildingConfig.ts:200`; 교회 서비스는 `src/population/serviceAllocation.ts:34` |
| 015 | 봄·여름, 실제 거래시장, 주문잔량0, 금고≥180d, 가용 목재<10단이며 실제 미납품 수요>가용량. 비·젖음·공사 대기일을 가짜 상태로 사용하지 않음. | `stateCalendar(state).season`, `timberTradeMarket`, `timberOrder`, `treasuryCoin`, `waitingTimberNeed`; `src/engine/timberTrade.ts:19`, `src/engine/autoplayTimberDemand.ts:23` |
| 019 | 첫 문장부터 직접 살피던 영지임을 명시. 두 후보의 **소작인 친화/상인 친화 성향**이 비교 중심임을 본문에 명시. 현재 direct를 조건으로 고정. | `EstateOversight.mode`, `StewardRecord.disposition=peasant/merchant`; `src/engine/stewardship.types.ts:14`, `src/engine/stewardship.ts:371` |
| 025 | 지원되는 punish/replace/tolerate는 유지하되 미결·기한·현직 일치, 드러난 횡령≥2d, 충성≤90, 소작인 호의≤95, 연결 세력 관계≥−95와 유효 후임을 요구. 후임은 기존 엔진의 능력 우선 자동 선택을 사용. 회수·관계·충성·교체가 실제로 달라짐. | `audits[].status/deadline/revealedKept`, `stewards[].loyalty/ability/connection`, `oversight.tenants`; `src/engine/stewardship.ts:443`, 연결 세력 후처리 `src/engine/history.ts:984` |
| 028 | 막연한 병 소식을 두 번째 역병의 도착 후·종료 전 상태로 고정. 인구≥1, 현재 growth 또는 defence여서 stability/revenue 둘 다 실제 변경. 곡창32d는 별도 가용성 조건. | `plague.second.arrivalTick/endTick`, `plague.endedTick`, `population`, `agency.policy`; `src/engine/plague.types.ts:9`, `:28`, `src/engine/plague.ts:551` |
| 030 | 주체는 실제 직인 길드 대표 `reorganisation.guild.headId`, 청원 분류 `craftsmen`, 세력 `town`으로 확정. 실제 인물·길드 건축 주체가 없으면 생략. 건설 주체 점수에 쓰는 merchant_house_2를 발신 세력으로 혼동하지 않음. 세 선택 공통 총32d 한도. | `state.persons.people`, `agency.actors[].kind='guild'`; `src/engine/reorganisation.ts:214`, `src/content/factionConfig.ts:35`, `src/engine/townAgency.ts:207` |
| 031 | 제목 **청지기를 갈아야 할 때**. 이미 위임 중이고 생존 현직이 있는 상황. 교체 후보 둘은 서로 및 현직과 다른 인물이며 능력·충성도가 교차 우열을 가져야 함. | `oversight.mode='steward'`, `stewardId`, `StewardRecord.ability/loyalty/personId`; `src/engine/stewardship.ts:371` |
| 035 | 가을·겨울, 인구≥1, 실제 거래시장, 주문0, 금고≥72d, 가용 목재<12단이며 실제 공사 수요>가용량. 12단 전체216d 지불은 보장하지 않으며 금고 부족 시 납품 지연을 유지. | `treasuryCoin`, `timberOrder`, `timberTradeMarket`, `waitingTimberNeed`; `src/engine/timberTrade.ts:42`, `src/content/timberTradeConfig.ts:5` |
| 037 | 같은 청지기·같은 위임 모드를 다시 보내던 선택 삭제. 위임→직접 감독 또는 accounts→방문 감사 두 선택. 이미 위임 중인 상황을 첫 문장에 명시. | `oversight.mode/auditMode`, `attention(state)`; `src/engine/stewardship.ts:60`, `:371`, `:431` |
| 042 | 시장 장려금 **32d**. 좌판세도 범위 대신 **800‰/1150‰**, 현재1000‰로 확정. 다른 장려금0이면 금고 최소128d. 사업 후보·기존 market 장려금0 검사. | `agency.duesPermille/subsidies`, `treasuryBalance(state)`; `src/engine/townAgency.ts:73`, `:82`, 실제 후보 `src/engine/autoplay.ts:275` |
| 046 | 여름·가을, 실제 거래 거점, 주문≥8단, 금고 목재>0. 유지안은 주문≤60단이고 실제 수요>가용량일 때만. 같은 주문 재전송을 명령 성공으로 꾸미지 않고 no_op(전송 없음)로 명시. | `timberOrder`, `treasuryTimber`, `timberTradePoint`, `waitingTimberNeed`; `src/engine/timberTrade.ts:28`, `src/content/timberTradeConfig.ts:12` |
| 049 | 직조/축융 단독 **32d**, 분할 **16d+16d**. 같은 총 설정액으로 비교. 다른 설정0이면 금고≥128d. 분할 둘째 단계는 첫16d가 이미 설정된 상태를 기준으로 검사하며 양쪽0을 재요구하지 않음. | `agency.subsidies`, `subsidyRefusal`, `treasuryBalance`; `src/engine/townAgency.ts:73`, `:82` |
| 059 | 제목 **직접 감독을 내려놓을 때**. 현재 직접 감독→위임이며 **능력·충성도라는 자질** 비교를 본문에 명시. 서로 다른 유효 후보가 교차 우열을 가져야 함. 직접 감독 유지가 상태 변화라는 주장은 제거. | `oversight.mode='direct'`, `StewardRecord.ability/loyalty`; `src/engine/stewardship.ts:371`, `src/engine/stewardship.types.ts:14` |

## 조건 계산과 경계

파생 별칭의 완전한 계산식·단위는 `records/threshold-findings.json`의 `bindings`에 있다. 이는 새 엔진 필드나 명령 목록이 아니다.

- `TIMBER_AVAILABLE`: 금고 목재 + 건물의 `availableStock(b,'timber')` 합. 운송 예약분을 다시 세지 않는다.
- `TIMBER_NEED`: `waitingTimberNeed(state)`, 현재 공사의 미납품·미예약 목재. 일반 공사 대기일과 다르다.
- `LEGAL(kind)`: `autoplayBuildAction(state,kind)` 결과가 `place_building`이고 `building===kind`인지 확인. 도로·목재 주문 등 다른 반환은 건설 후보로 인정하지 않는다. 실제 착수/완공은 보장하지 않는다.
- `WATERLESS`: 실제 거주 가구의 서비스 항목이 존재하고 `water.kind!=='served'`인 수. 누락 서비스 항목은 부족으로 추측하지 않는다.
- `WHEAT_BLOCKED`: 기존 밀 저장처가 있으며 반입 공간이0일 때의 `storageCapacityBlock(...)!==null`. 저장처가 아예 없는 경우는 이 조건에 포함되지 않는다.
- `REMOTE`: 기존 모든 예배당과 `buildingFootprintDistance>8`인 거주 가구 수. 새 예배당의 근거리 배치를 명령하거나 보장하지 않는다.

004의 분할안도 둘째 단계에서는 **well20d 성공·granary0**을 검사한다. 초기 well0 조건을 반복 적용해 둘째 명령을 스스로 막지 않는다. 모든 복합 선택은 아직 원자적 새 명령이 아니다.

의도적인 보류·유지는 상태 변화가 없다는 것을 그대로 표시한다. 이를 “실효 있는 선택 둘”의 대체물로 세지 않는다. 사용자 요청인 002·037의 무효 재설정은 제거했고, 025의 지원 명령은 실제 효과 차이를 확인할 조건을 보강했다.

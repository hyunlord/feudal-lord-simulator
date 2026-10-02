# 엔진 사건과 도시 연출 조사

현재 HEAD `c2460918ecb13cdd6475f25f3e4809b3a352b01d`. 읽기 조사이며 실제 발동/연출 설치를 검증한 결과가 아니다. 위치·인원·시간은 아래 표의 **미술 연출 제안**이며 엔진의 현재 동작과 구분한다.

## 핵심

- `eventSchedule.ts`만 읽으면 혼인·전쟁·역병·반란을 놓친다. 공통 스케줄 정의는 화재 둘, 흉작·대기근 둘뿐이며 나머지는 별도 상태기계·인물 기록·렌더 달력이다.
- 기존 세계 연출도 이미 있다: 장날 방문자/빈 좌판, 역병 운구·무덤·닫힌집, 청원 군중, 반란 징수인 추격. “카드만 존재”로 모두 재제작하면 중복이다.
- 세례 의식, 개별 장례 조종, 정기시 곡예/천막 일정, 실제 홍수 수위·범람영역은 신규 제안이다. 대응하는 기존 출생·사망·경제 선택·습한 날씨는 별도로 표기했다.
- 사용자 명시 지시인 역병 문 표식은 이전 바이블 금지보다 우선한다. 건물 벽에 부착하지 않는 문 앞 독립 표식으로 표현한다. 검역 효과를 엔진에 새로 있다고 주장하지 않는다.

## 14종 대응

| 연출 | 실제 식별자 / 근거 | 상태와 발동 조건 | 위치 · 인원 · 표시시간 제안 |
|---|---|---|---|
| 혼인 행렬 | `marriage.bride_arrived`, `marriage.contracted`, `person.married`<br>src/engine/marriage.ts:467<br>src/engine/history.ts:1039<br>src/engine/history.ts:399 | 신부 거주 이전이 확정된 bride_arrived에 한 번. 계약 체결만으로 도착을 그리지 않음. | 성문/다리 → 장원 앞 도로<br>신부·친족 4, 악사 2, 수레꾼 1, 짐수레 1 (총 7명)<br>20–30초 1회; 도착 뒤 짐수레 최대 1게임일 |
| 장례 행렬 | `person.died`, `estate.person_died`, `marriage.father_died`<br>src/engine/history.ts:417<br>src/engine/history.ts:1084<br>src/render/plagueWorldProps.ts:209 | 사망은 구현. 역병 장례 행렬은 이미 구현. 개별 인물 장례·조종 연출은 새 제안. 원격 영지 사망을 본도시에 자동 표시하지 않음. | 사망 가구 → 교회 묘지; 영주는 장원 출발<br>운구인 4, 사제 1, 유족 3; 덮은 관 1 (총 8명)<br>20–30초 1회; 무덤은 영속 소품 |
| 세례 | `person.born`, `marriage.child_born`<br>src/engine/history.ts:395<br>src/engine/marriage.ts:470 | 출생으로 파생할 제안. 세례 완료라는 엔진 사건은 없음. | 교회/예배당 문 앞 빈 마당<br>아기 안은 부모 1, 부모 1, 대부모 2, 사제 1 (총 5명)<br>15–20초 1회; 출생 뒤 교회 접근 가능 시 |
| 장날 | `isMarketDay`, `legacy.last_market`<br>src/render/presentation/residentTrips.ts:46<br>src/render/presentation/residentTrips.ts:85<br>src/render/worldSigns.ts:93<br>src/engine/history.ts:766 | 현재 매30일 셋째 날 장날, 시장 방문자·빈 좌판 표식 구현. eventSchedule ID는 아님. | 시장 길가 여유 공간; 도로 중앙 비움<br>상인 3, 구매자 6, 가축몰이 1, 가축 2 (총 10명)<br>장날의 시각 루프; 기존 market/visit quota와 전체40 상한 공유 |
| 정기시 | `wall_or_market`<br>src/content/warConfig.ts:88<br>src/content/warConfig.ts:19 | 시장 선택의 수입 효과가 fair로 설명됨. 천막·곡예·별도 연례 정기시 일정은 신규 제안. | 시장 확장 공터, 성문 진입로 옆<br>천막 2, 곡예사 2, 악사 1, 관객 8 (총 11명)<br>제안: 연1회 2게임일; 승인·시장 접근 조건 |
| 대기근·구휼 | `dearth_rehearsal`, `great_famine`, `relief`, `price_control`, `laissez_faire`, `speculation`<br>src/content/eventConfig.ts:104<br>src/content/eventConfig.ts:121<br>src/engine/eventSchedule.ts:338<br>src/engine/politics.ts:87 | 구휼 선택 때만 식량 배급 줄. 방관·투기는 빈 시장/굶주림 무리로 분리. | 교회 앞 배급대와 창고→교회 경로; 빈 시장<br>대기 주민 8, 배급자 2, 곡물 수레꾼 1 (총 11명)<br>도착~dearthEndTick; 줄은 8–12초 순환, 회복 시 감소 |
| 흑사병 | `black_death_1348`, `arrival`, `second`<br>src/content/plagueConfig.ts:11<br>src/engine/plague.ts:513<br>src/engine/plague.ts:553<br>src/render/plagueWorldProps.ts:13 | 기존 닫힌집·무덤·운구 재사용. 문 표식은 이번 사용자 명시 지시 우선; 실제 벽 패치 대신 문 앞 땅 위 표식 팻말 제안. 시신은 완전히 덮음. | 피해 가구 문 앞 / 외곽 매장로 / 닫힌 시장<br>수레꾼 2, 사제 1; 덮은 시신 수레1, 화로1, 표식1 (총 3명)<br>plagueStage arrival 기간; 도로 화로는 길 가장자리 |
| 화재 | `first_fire`, `fire`, `burningHouses`<br>src/content/eventConfig.ts:86<br>src/content/eventConfig.ts:95<br>src/content/eventConfig.ts:152<br>src/engine/events.ts:228 | 기존 화염·연기·탄집 재사용. 새 독립 물동이 줄. 엔진 burnTicks150/급수60을 연출 기준으로 사용. | 우물 → 불난집의 안전한 도로 측면<br>물동이 운반자 6, 지휘자 1 (총 7명)<br>불타는 상태 동안; 진화 후 5초 퇴장 |
| 홍수 | `weatherAt`, `wetSummerHarvestPermille`<br>src/engine/eventSchedule.ts:130<br>src/engine/eventSchedule.ts:269 | 습한 여름 수확손실과 지형 floodPermille는 구현. 범람 polygon/수위·별도 flood 사건은 찾지 못함. 침수 범위는 새 연출 입력 필요. | 하천 저지 밭 경계; 도로측 모래주머니<br>제방 작업자 4, 빈 수레 1, 자루 묶음 (총 4명)<br>wet 상태+향후 범람영역 유효 때; 마른 뒤 잔재 1게임일 |
| 징집·원정 출발 | `war_1337`, `commission`, `levy_response`<br>src/content/warConfig.ts:12<br>src/engine/war.types.ts:53<br>src/engine/war.ts:300<br>src/engine/war.ts:524 | levy_response accept일 때 conscripts 생성. 면제료 선택은 출정 인원으로 그리지 않음. | 장원/성문 앞 공터 → 외부 도로<br>궁수 6, 관리1, 짐마차꾼1, 짐마차1 (총 8명)<br>청원 응답 뒤20–30초 집결·출발 1회; 인원은 conscripts 값 이하 |
| 1381 반란 군중 | `reorganisation_1362`, `rebellion_rumour`, `reorg.rebellion_rumour`<br>src/content/reorganisationConfig.ts:10<br>src/engine/reorganisation.ts:451<br>src/engine/history.ts:702<br>src/render/reorgWorldProps.ts:201 | pressure>=threshold의 outcome chased에 군중. quiet면 소수 토론만, 횃불 군중 금지. 기존 세금징수인 추격 재사용. | 시장 → 장원 접근로, 출구 남김<br>주민 10; 횃불2·곤봉3, 비폭력 몸짓 (총 10명)<br>해당 계절 첫30초; 해결 후 해산; 잔혹 묘사 없음 |
| 순례 | `person.pilgrimage`, `person.returned`<br>src/engine/persons.ts:824<br>src/engine/persons.ts:847<br>src/engine/history.ts:423 | 18–60세 성인의 연초1% pilgrim 조건,2계절. 실제 출발 인물과 연결; 군중은 동행 표현. | 교회 → 성문 도로<br>순례자 5, 지팡이·순례 가방 (총 5명)<br>조건 진입/종료 각15–20초; 부재2계절 동안 도시 재등장 금지 |
| 국왕 사신 | `war_1337:messenger`, `legacy.royal_tax_envoy`, `royal_tax`<br>src/engine/war.types.ts:53<br>src/engine/legacy.ts:470<br>src/engine/history.ts:733 | 전쟁 전령과 후반 국왕 세금사신은 구분된 실제 상태. 기존 wk_royal_messenger 재사용. | 성문 → 장원 앞; 청원 대기 장소<br>사신1, 호위2, 서기1 (총 4명)<br>도착20초; royal_tax 미응답 동안 대기 |
| 판결 집행 | `estate.suit_judged`, `estate.possession_enforced`<br>src/engine/estateSuits.ts:120<br>src/engine/estateSuits.ts:142<br>src/engine/history.ts:1070 | 판결은 권원만, enforcePossession은 점유. 집행 성공을 재판 승소와 혼동하지 않음. 사형/체벌 사건 아님. | 장원 법정 앞 공터, 해당 영지에서만<br>집행관1, 서기1, 당사자2, 증인·구경꾼4 (총 8명)<br>판결20초; 집행 성공 별도10초. 원격 영지는 카드/지역 화면에 연결 |

## 읽은 설계·플레이 기록의 적용

`docs/design/lord-mode.md`의 원칙은 인과·사람·시간이다. 결과를 실제 결정/인물ID에 연결하고, 혼인 계약→신부 도착→출생을 하나의 상시 축제로 뭉치지 않는다. 판결 권원과 집행 점유를 분리한다.

`docs/qa/playtest-20261002/TOP5_FUN.md`의 청원 선택, 물 공급 뒤 입주, 건설 완공, 월터의 불탄 집 전기는 “결정→눈에 보이는 결과→인물 귀속”을 보여 준다. `TOP10_FRICTION.md`의 식량 총량/가구 접근 혼동과 화재 재건 불명확성은 구휼 줄을 굶주린 사람 상태와 연결하고, 탄 집을 회복 단계와 구분할 이유다. `PLAY_DIARY.md`의 구휼 선택은 실제 플레이 기록이며 새 합성 장면의 사건 발동 증거로 대체할 수 없다.

## 현재 표시 규격

`src/render/storyWorldProps.ts:19`는 4방향(NE,SE,SW,NW) 열 × 2걸음 행 규격. `:27`은 사람 그림의 실높이를 `WALKER_FIGURE_PX`에 맞춘다. 오래된 주석은17.6px지만 실제 `walkerComposer.ts:36`의0.5×32는16world px(H16)이다. 바이블17.6와현재코드16의차이는 별도 기록한다. 군중이라도 사람1명을 과대화해 판독성을 얻지 말고 군집 실루엣·수레·소품으로 구별해야 한다. `residentTrips.ts:43`은 presentation walker 전체40 상한, `:79`는 market12/visit10 등 목적별 quota다. 새 인원을 엔진 주민수로 가산하지 않는다.

## 재사용 확인을 자산 조사와 합칠 지점

- `plagueWorldProps.ts:18`: `wk_funeral_bearers`, `prop_bier_shroud`; 묘지는 `decal_fresh_graves_a/_b`.
- `storyWorldProps.ts:66`: `event_crowd_manor_gate`, `wk_petitioner_m/f`; `wk_royal_messenger` 규격도 존재.
- `reorgWorldProps.ts:201`: 징수인 추격. 반란 상태가 quiet일 때 폭동으로 과장하지 않음.
- `warWorldProps.ts:33`: 습격 화재·연기는2계절 지속, 일반 화재 burnTicks와 별개.
- 자산 파일의 여름/겨울 실제 존재 여부는 별도 자산 인벤토리와 결합해 결정한다.

## 경계와 검증 한계

코드는 수정하지 않았다. Graft 로컬 캐시만 생성했다. clone의 LFS checkout 도중 git status가 대량 D/??로 보였으므로 이 시점 상태는 종료 시 저장소 무변경 증거로 쓰지 않는다. root가 checkout 완료 뒤 확인해야 한다. 신규 연출의 실제 엔진 통합·이동 경로·깊이 정렬은 본 작업의 합성 그림 검증과 별개다.

Graft 절감 합계: 약19,233tokens, 절감 줄이 있는4calls(초기 no-hit ask와build 제외), 비용 표시 없음.

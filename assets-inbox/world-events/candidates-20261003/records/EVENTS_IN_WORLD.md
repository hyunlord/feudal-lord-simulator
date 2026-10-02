# 세계에서 보이는 사건 — 연출·그림·엔진 연결 명세

작성 2026-10-03. Charter & Kin / 인장과 가문. 기준 소스 HEAD `c2460918ecb13cdd6475f25f3e4809b3a352b01d`. **그림 후보와 실제 게임 캡처 위 합성 검토용이며 게임에는 설치하지 않는다.** 코드의 현재 사실은 [엔진 조사](provenance/ENGINE_FINDINGS.md), 기존 그림99개는 [자산 조사](provenance/EXISTING_ASSETS.md)와 각 JSON으로 추적한다.

## 연출의 성격

새 그림은 땅에 서는 **전체 정지 무리·수레·소품**이다. 행렬의 집결·정차 순간을 그린 것이며 새 보행 애니메이션 완성품이 아니다. 실제 걸음이 있는 것은 기존 296×148 워커 시트(74×74셀, NE/SE/SW/NW 네 열 × 두 걸음 행)이다. 기존 시트와 발좌표는 보존하며 정지 그림을 복제해8프레임이라고 부르지 않는다.

사람·수레를 건물 벽에 붙이지 않는다. 기존 닫힌 집·탄 집은 기존 건물과 맞는 전체/기존 오버레이를 그대로 사용한다. 장례는 폐기된 육각 관 대신 **기존 열린 운구대와 흰 수의**를 사용한다. 교회의 조종은 향후 소리·기존 교회 연동 제안이며 새 벽·종탑 부품도, 이번에 검증한 음향도 아니다.

아래 인원·지속시간·배치는 **향후 연출 제안**이다. 합성 정지 그림이 그 시간 동안 실제 움직였다는 뜻이 아니다. 초는 기본 재생속도의 제안 화면시간, 게임일/계절은 상태 수명을 뜻한다. 임의 수의 주민을 엔진 인구에 더하지 않는다. 실제 그림의 인원·프레임·발좌표·파일명은 배포 CSV를 최종 기준으로 삼는다.

## 14종 사건 → 연출

| 사건 | 엔진 사건·상태 이름 / 근거 | 무엇을 어디에 | 누가·몇 명 / 얼마나 오래 | 있는 그림 → 새 그림 |
|---|---|---|---|---|
| 혼인 행렬 | `marriage.bride_arrived`, `marriage.contracted`, `person.married`<br>src/engine/marriage.ts:467<br>src/engine/history.ts:1039 | 성문/다리 → 장원 앞 도로<br>신부 거주 이전이 확정된 bride_arrived에 한 번. 계약 체결만으로 도착을 그리지 않음. | 신부·친족 4, 악사 2, 수레꾼 1, 짐수레 1 · 제안 총7명<br>20–30초 1회; 도착 뒤 짐수레 최대 1게임일 | **기존:** 일반 워커·손수레<br>**새:** `wedding-{summer,winter}.png` 신부·악사·짐수레 전체 무리 |
| 장례 행렬 | `person.died`, `estate.person_died`, `marriage.father_died`<br>src/engine/history.ts:417<br>src/engine/history.ts:1084 | 사망 가구 → 교회 묘지; 영주는 장원 출발<br>사망은 구현. 역병 장례 행렬은 이미 구현. 개별 인물 장례·조종 연출은 새 제안. 원격 영지 사망을 본도시에 자동 표시하지 않음. | 운구인 4, 사제 1, 유족 3; 흰 수의를 덮은 운구대 1 · 제안 총8명<br>20–30초 1회; 무덤은 영속 소품 | **기존:** wk_funeral_bearers, bier_shroud_ne/nw, wk_priest_m_01, fresh_graves_a/b<br>**새:** 운구·관 새 제작 없음 |
| 세례 | `person.born`, `marriage.child_born`<br>src/engine/history.ts:395<br>src/engine/marriage.ts:470 | 교회/예배당 문 앞 빈 마당<br>출생으로 파생할 제안. 세례 완료라는 엔진 사건은 없음. | 아기 안은 부모 1, 부모 1, 대부모 2, 사제 1 · 제안 총5명<br>15–20초 1회; 출생 뒤 교회 접근 가능 시 | **기존:** 일반 성직자<br>**새:** `baptism-{summer,winter}.png` 부모·아기·대부모 축복 무리 |
| 장날 | `isMarketDay`, `legacy.last_market`<br>src/render/presentation/residentTrips.ts:46<br>src/render/presentation/residentTrips.ts:85 | 시장 길가 여유 공간; 도로 중앙 비움<br>현재 매30일 셋째 날 장날, 시장 방문자·빈 좌판 표식 구현. eventSchedule ID는 아님. | 상인 3, 구매자 6, 가축몰이 1, 가축 2 · 제안 총10명<br>장날의 시각 루프; 기존 market/visit quota와 전체40 상한 공유 | **기존:** market_active/quiet, cattle_pair, sheep_flock, 시장 방문 워커<br>**새:** 없음. 기존 시장 방문 워커·좌판·가축으로 구성 |
| 정기시 | `wall_or_market`<br>src/content/warConfig.ts:88<br>src/content/warConfig.ts:19 | 시장 확장 공터, 성문 진입로 옆<br>시장 선택의 수입 효과가 fair로 설명됨. 천막·곡예·별도 연례 정기시 일정은 신규 제안. | 천막 2, 곡예사 2, 악사 1, 관객 8 · 제안 총11명<br>제안: 연1회 2게임일; 승인·시장 접근 조건 | **기존:** 시장 좌판·가축<br>**새:** `fair-{summer,winter}.png` 천막과 곡예·관객 전체 무리 |
| 대기근·구휼 | `dearth_rehearsal`, `great_famine`, `relief`, `price_control`, `laissez_faire`, `speculation`<br>src/content/eventConfig.ts:104<br>src/content/eventConfig.ts:121 | 교회 앞 배급대와 창고→교회 경로; 빈 시장<br>구휼 선택 때만 식량 배급 줄. 방관·투기는 빈 시장/굶주림 무리로 분리. | 대기 주민 8, 배급자 2, 곡물 수레꾼 1 · 제안 총11명<br>도착~dearthEndTick; 줄은 8–12초 순환, 회복 시 감소 | **기존:** hungry_queue, empty_stall, empty_granary_floor, yard_hungry_a/b<br>**새:** `relief-table-{summer,winter}.png` 배급 거점 |
| 흑사병 | `black_death_1348`, `arrival`, `second`<br>src/content/plagueConfig.ts:11<br>src/engine/plague.ts:513 | 피해 가구 문 앞 / 외곽 매장로 / 닫힌 시장<br>기존 닫힌집·무덤·운구 재사용. 문 표식은 이번 사용자 명시 지시 우선; 실제 벽 패치 대신 문 앞 땅 위 표식 팻말 제안. 시신은 완전히 덮음. | 수레꾼 2, 사제 1; 덮은 시신 수레1, 화로1, 표식1 · 제안 총3명<br>plagueStage arrival 기간; 도로 화로는 길 가장자리 | **기존:** plague_shut_l1~l3, 운구·묘지<br>**새:** `plague-cart-{summer,winter}.png`, `plague-marker-brazier-{summer,winter}.png` |
| 화재 | `first_fire`, `fire`, `burningHouses`<br>src/content/eventConfig.ts:86<br>src/content/eventConfig.ts:95 | 우물 → 불난집의 안전한 도로 측면<br>기존 화염·연기·탄집 재사용. 새 독립 물동이 줄. 엔진 burnTicks150/급수60을 연출 기준으로 사용. | 물동이 운반자 6, 지휘자 1 · 제안 총7명<br>불타는 상태 동안; 진화 후 5초 퇴장 | **기존:** fire_roof_l0~l4, burnt_l0~l4, black_smoke_column_sheet, work_waterbucket_*<br>**새:** `bucket-brigade-{summer,winter}.png`, `fire-flicker-all.png`(4프레임) |
| 홍수 | `weatherAt`, `wetSummerHarvestPermille`<br>src/engine/eventSchedule.ts:130<br>src/engine/eventSchedule.ts:269 | 하천 저지 밭 경계; 도로측 모래주머니<br>습한 여름 수확손실과 지형 floodPermille는 구현. 범람 polygon/수위·별도 flood 사건은 찾지 못함. 침수 범위는 새 연출 입력 필요. | 제방 작업자 4, 빈 수레 1, 자루 묶음 · 제안 총4명<br>wet 상태+향후 범람영역 유효 때; 마른 뒤 잔재 1게임일 | **기존:** ridge_flooded, puddle_a/b<br>**새:** `sandbags-{summer,winter}.png` 모래주머니 방재 작업 무리 |
| 징집·원정 출발 | `war_1337`, `commission`, `levy_response`<br>src/content/warConfig.ts:12<br>src/engine/war.types.ts:53 | 장원/성문 앞 공터 → 외부 도로<br>levy_response accept일 때 conscripts 생성. 면제료 선택은 출정 인원으로 그리지 않음. | 궁수 6, 관리1, 짐마차꾼1, 짐마차1 · 제안 총8명<br>청원 응답 뒤20–30초 집결·출발 1회; 인원은 conscripts 값 이하 | **기존:** wave17 후보 wk_levy_archer/billman + held_longbow/held_bill, muster_field<br>**새:** `expedition-wagon-{summer,winter}.png` 원정 짐마차 무리 |
| 1381 반란 군중 | `reorganisation_1362`, `rebellion_rumour`, `reorg.rebellion_rumour`<br>src/content/reorganisationConfig.ts:10<br>src/engine/reorganisation.ts:451 | 시장 → 장원 접근로, 출구 남김<br>pressure>=threshold의 outcome chased에 군중. quiet면 소수 토론만, 횃불 군중 금지. 기존 세금징수인 추격 재사용. | 주민 10; 횃불2·곤봉3, 비폭력 몸짓 · 제안 총10명<br>해당 계절 첫30초; 해결 후 해산; 잔혹 묘사 없음 | **기존:** 기존 주민·held_torch 후보, 징수인 추격<br>**새:** `revolt-{summer,winter}.png` 횃불·몽둥이 주민 군중 |
| 순례 | `person.pilgrimage`, `person.returned`<br>src/engine/persons.ts:824<br>src/engine/persons.ts:847 | 교회 → 성문 도로<br>18–60세 성인의 연초1% pilgrim 조건,2계절. 실제 출발 인물과 연결; 군중은 동행 표현. | 순례자 5, 지팡이·순례 가방 · 제안 총5명<br>조건 진입/종료 각15–20초; 부재2계절 동안 도시 재등장 금지 | **기존:** pilgrim_shrine 후보, 일반 주민<br>**새:** `pilgrimage-{summer,winter}.png` 지팡이·여행가방 순례 무리 |
| 국왕 사신 | `war_1337:messenger`, `legacy.royal_tax_envoy`, `royal_tax`<br>src/engine/war.types.ts:53<br>src/engine/legacy.ts:470 | 성문 → 장원 앞; 청원 대기 장소<br>전쟁 전령과 후반 국왕 세금사신은 구분된 실제 상태. 기존 wk_royal_messenger 재사용. | 사신1, 호위2, 서기1 · 제안 총4명<br>도착20초; royal_tax 미응답 동안 대기 | **기존:** wk_royal_messenger, scroll_royal_ne/nw<br>**새:** 없음. 기존 사신·두루마리·청원/주민 워커로 구성 |
| 판결 집행 | `estate.suit_judged`, `estate.possession_enforced`<br>src/engine/estateSuits.ts:120<br>src/engine/estateSuits.ts:142 | 장원 법정 앞 공터를 원칙으로 하되 이번 합성은 서쪽 진입로의 임시 법정 탁자, 해당 영지에서만<br>판결은 권원만, enforcePossession은 점유. 집행 성공을 재판 승소와 혼동하지 않음. 사형/체벌 사건 아님. | 집행관1, 서기1, 당사자2, 증인·구경꾼4 · 제안 총8명<br>판결20초; 집행 성공 별도10초. 원격 영지는 카드/지역 화면에 연결 | **기존:** crowd_manor_gate, wk_petitioner_m/f<br>**새:** `judgment-bailiff-{summer,winter}.png` 문서 낭독 집행관·탁자 무리 |

## 납품 파일 찾기

새 PNG는12종×여름·겨울24장과 불길 시트1장, **총25개**다. 기존 재사용은31개이며 새 제작 수에 넣지 않는다. [새 그림](assets/new/) · [기존 재사용](assets/reused/) · [합성 전후와 판독 자료](proofs/) · [기존 자산 원본 경로·해시](provenance/existing-assets.json) · [워커 규격](provenance/walker-contract.json).

| ID | 여름 | 겨울 |
|---|---|---|
| wedding | [PNG](assets/new/wedding-summer.png) | [PNG](assets/new/wedding-winter.png) |
| baptism | [PNG](assets/new/baptism-summer.png) | [PNG](assets/new/baptism-winter.png) |
| pilgrimage | [PNG](assets/new/pilgrimage-summer.png) | [PNG](assets/new/pilgrimage-winter.png) |
| fair | [PNG](assets/new/fair-summer.png) | [PNG](assets/new/fair-winter.png) |
| plague-cart | [PNG](assets/new/plague-cart-summer.png) | [PNG](assets/new/plague-cart-winter.png) |
| plague-marker-brazier | [PNG](assets/new/plague-marker-brazier-summer.png) | [PNG](assets/new/plague-marker-brazier-winter.png) |
| sandbags | [PNG](assets/new/sandbags-summer.png) | [PNG](assets/new/sandbags-winter.png) |
| revolt | [PNG](assets/new/revolt-summer.png) | [PNG](assets/new/revolt-winter.png) |
| bucket-brigade | [PNG](assets/new/bucket-brigade-summer.png) | [PNG](assets/new/bucket-brigade-winter.png) |
| relief-table | [PNG](assets/new/relief-table-summer.png) | [PNG](assets/new/relief-table-winter.png) |
| expedition-wagon | [PNG](assets/new/expedition-wagon-summer.png) | [PNG](assets/new/expedition-wagon-winter.png) |
| judgment-bailiff | [PNG](assets/new/judgment-bailiff-summer.png) | [PNG](assets/new/judgment-bailiff-winter.png) |

[독립 불길 시트](assets/new/fire-flicker-all.png)는 계절공용256×96, 가로4프레임이며 셀64×96·셀내 피벗(32,88)이다. 사람 보행시트가 아니며 새 정지 무리24장의 프레임은 각1개다. 장날·장례·국왕 사신은 이미 있는 그림을 사용해 신규 중복 제작을 피했다.

## 계절 대응

모든14연출에 여름·겨울 배치 구성을 정한다. **기존 all-season 그림 재사용**과 **새 여름/겨울 짝**을 구분한다. 기존 망토는 템플릿 전용이므로 성직자·새 군중 위에 임의로 덮지 않는다. 겨울 버전이 있다는 이유로 역사 사건 날짜나 엔진 일정이 겨울로 바뀌지 않는다.

| 연출 | 여름·겨울 구성 |
|---|---|
| 혼인 행렬 | 여름 혼례옷 / 겨울 울망토; 신부 흰 실루엣 유지 |
| 장례 행렬 | 두 계절 기존 all-season 운구·성직자 사용; 겨울 장례복 신작 아님 |
| 세례 | 여름 평상복 / 겨울 담요·울망토; 아기는 완전히 감쌈 |
| 장날 | 기존 좌판·가축·손님 워커 all-season; 새 겨울 손님 신작 없음 |
| 정기시 | 여름 천막 / 겨울 얕은 눈·울망토; 계절 대응 후보이며 겨울 개최는 별도 일정 필요 |
| 대기근·구휼 | 기존 줄 all-season + 여름/겨울 배급대; 복제 파일을 겨울 신작으로 세지 않음 |
| 흑사병 | 여름/겨울 수레·표식 무리; 기존 집 판자 오버레이는 제자리 원본만 |
| 화재 | 여름/겨울 물동이 줄; 기존 불·연기 및 새4프레임 불길 all-season |
| 홍수 | 여름 젖은 흙 / 겨울 눈 섞인 물가; 기존 침수 strip 재사용 |
| 징집·원정 출발 | 여름/겨울 짐마차; 기존 군복시트는 all-season 후보 |
| 1381 반란 군중 | 여름/겨울 복장; 겨울은 재사용 가능 버전이며 실제1381 발동 계절 변경 아님 |
| 순례 | 여름 얇은 망토 / 겨울 두꺼운 울망토; 같은 식별 소품 |
| 국왕 사신 | 기존 사신·두루마리·호위용 일반 워커 all-season; 새 겨울 호위 신작 없음 |
| 판결 집행 | 여름/겨울 옷; 법정·문서 소품 동일, 처형 도구 없음 |

## 영주의 결정이 보이는 규칙

- 혼인은 계약 자체보다 `bride_arrived`에서 도착을 보여 준다. 아직 협상 중이거나 거절된 혼인에 축하 행렬을 띄우지 않는다.
- 기근에서 `relief`를 고른 경우만 배급자·빵·솥을 둔다. 구휼을 거부하거나 투기하면 빈 좌판·부족한 가구가 보여야 한다. 도시의 총 식량이 많더라도 가구가 살 수 없다면 구휼 필요 상태와 구분한다.
- `levy_response=accept`일 때만 징집 출발. 면제료 선택이면 같은 궁수 출정 장면을 재생하지 않는다. 참가 인원은 실제 징집자 이하로 제한한다.
- 반란 `outcome=chased`는 군중·징수인 추격, `quiet`는 조용한 주민 몇 명이다. 모든1381년 장면을 폭동으로 만들지 않는다.
- 판결 `estate.suit_judged`는 권원 변경, `estate.possession_enforced`는 별도의 점유 집행이다. 법정 앞 낭독은 판결, 물러나거나 들어오는 집행관은 성공한 집행에만 연결한다. 처형 사건이 아니다.
- 원격 영지의 사망·소송은 해당 영지에서 보이게 해야 한다. 본도시 장례·법정으로 자동 전환하지 않는다. 순례자는 부재 중 도시에 다시 나타나지 않는다.
- 이미 끝난 일을 로드·카메라 이동 때 반복하지 않도록 향후 연출 키를 사건ID/인물ID/발동tick으로 둔다. 이 재생 관리 로직은 이번에 구현하지 않았다.

## 실제 트리거와 새 제안의 경계

`eventSchedule.ts`의 공통 정의는 `first_fire`, `fire`, `dearth_rehearsal`, `great_famine` 네 개다. `weather`는 활성 날씨 플래그다. 전쟁 `war_1337`, 역병 `black_death_1348`, 재편 `reorganisation_1362`, 후반 `legacy_1400`은 별도 시퀀스이며 전체 단계는 [engine-events.json](provenance/engine-events.json)에 있다. 혼인·사망·출생·순례·소송도 각각 상태/연대기 연결이다.

장날은 `residentTrips.ts:isMarketDay`의 실제 월별 렌더 달력이다. 세례 의식은 출생에서 파생할 **신규 연출**, 개별 장례·조종도 **신규 연결**이다. 정기시의 수입 선택은 기존이지만 천막·곡예 개최 달력은 없다. 홍수도 습한 날씨의 수확손실은 있으나 실제 범람 영역·수위 사건은 찾지 못했다. 침수 그림을 곧바로 엔진 범람 구현으로 해석하지 않는다.

## 크기·광원·발 기준

바이블 v2 성인 기준은17.6world px지만 현재 코드 `walkerComposer.ts:36`의 `VILLAGER_WORLD_SCALE=0.5`, `WALKER_FIGURE_PX=32×0.5`는 **16world px(H16)**다. `drawWalkers.ts:42`의 줌 하한0.65 때문에 실제 기존 워커는 줌0.6에서10.4screen px다. 오래된 `storyWorldProps.ts` 주석17.6을 현재 코드값으로 잘못 인용하지 않는다. 이 불일치는 숨기지 않고 캡처·합성 배율 기록에 남긴다.

신규 후보의 기준은 사용자 지정 바이블17.6world px, 좌상광·등각시점·저채도 천·참나무·양피지 계열이다. 기존 워커보다 약10% 큰 기준이라는 한계를 명시한다. 저줌 판독이 약하면 사람만 확대하지 않고 수레·배급대·장궁·천막·운구대의 집단 실루엣으로 식별한다.

새 무리의 발은 그림 아래 모서리가 아닌 실제 접지점이다. CSV의 피벗에 따라 지면에 올리고, 앞뒤 건물·지붕과 겹치지 않는 길가/마당에 배치한다. 등각 그림을 좌우 반전해 광원을 바꾸지 않는다. 같은 무리를 늘어놓아 길을 막거나 그림 속 인원을 엔진 주민수로 간주하지 않는다. 기존 전체 presentation walker 상한40 및 market12/visit10 quota는 연출 통합 때 함께 조정해야 한다.

## 문 표식의 명시적 예외

기존 제작 기록은 `plague_door_mark`를 폐기했고 렌더도 문 표식을 금지한다. 이번 최신 사용자 요청은 문 표식을 명시했으므로 이를 우선하되, **문 앞 땅에 선 독립 표식**으로 만든다. 과거 벽부착 그림을 복원하지 않는다. 이는 이번 게임 연출 선택이며1300~1450 잉글랜드의 일반적 검역 제도를 역사적으로 검증했다는 뜻이 아니다.

## 검증을 읽는 법

이번 캡처의 교회·시장은 실제 렌더된 시설이다. 장원은 현재 캡처에서 플레이스홀더가 남아 있으므로 판결 장면은 **서쪽 진입로의 임시 법정 탁자**로 검토한다. 완성된 장원 법정에서 검증했다고 주장하지 않는다.

proofs의 전후는 실제 게임 장면 위 합성으로 위치·배율·판독성을 확인하는 자료다. 실제 엔진이 해당 사건을 발동해 그림을 그렸다는 증거가 아니다. 정지 합성으로 이동·애니메이션·깊이 정렬·군중 경로·프레임 성능·조종 소리를 검증하지 못한다. 판독 결과와줌0.6 한계는 proofs 보고서를 따른다. 기존 자산을 새 그림 수에 넣지 않고, 겨울에도 그대로 쓴 all-season 파일을 겨울 신작으로 세지 않는다.

## 실제 합성 인원과 제안의 차이

위 표의 인원·기간은 엔진 연결 시의 연출 제안이다. 이번 그림에는 혼인 6명, 세례 성인 5명과 영아 1명, 순례 6명, 반란 8명, 물동이 7명, 시신 수레 2명, 구휼 배급자 3명, 모래주머니 작업자 2명, 원정 마차꾼 2명, 집행관 무리 3명이 들어 있다.

장례 합성은 운구인 4명+사제 1명+검은 옷 동행인 3명, 순례 합성은 새 무리 6명+기존 성직자 2명이다. 징집은 기존 궁수 6명+새 마차꾼 2명이다. 구휼 줄은 접지 충돌을 피해 기존 줄의 앞부분만 크롭했으며, 원본 전체 PNG는 보존했다. 천막 2동·큰 군중 등의 제안 규모를 모두 그렸다고 세지 않는다. 실제 배치는 proofs/placements.json을 참고한다.

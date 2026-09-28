# 2장 사건 명세 (F2-A) — 전령·양모 공납·징집·보조세·봉화·해안 습격·피란민·조달 면허·석벽 대 시장

지시서: F2-A 2장 사건(엔진 세션, 6시간). 근거:
- [플레이어 흐름 설계서](player-flow.md) 3절(2장 전쟁의 그늘 1318–1347, 병목 돈·징발, 장 끝 석벽 완공 또는 포기 결정), 5절(전쟁 1337: 전령·양모 공납 → 징발·징집 노동 공백·해안 습격 → 왕실 조달 면허·석벽 인가, 석벽 대 상업), 7절(습격 2장 해안, 강도는 방어 상태로)
- [사건 명세](flow-events.md) EV-2(예고 → 도래 → 회복 사다리), [1장 명세](flow-chapter-one.md) FC-3(청원), [실패 사다리·장 이어하기](failure-ladder-campaign.md) FL-8(장 이어하기)
- Wave 17 결정 카드 다섯 장(`levy_response`·`wool_payment`·`wall_or_market`·`war_funding`·`refugee_admission`)과 1:1

결정: [결정 목록](../decisions/README.md) WR1~WR12. 조항 번호(WR-*)는 `tests/chapterTwoWar.test.ts`의 시험 이름(E11~E20)과 이어진다. 화면(결정 카드·봉화·습격 연기·피란민)은 렌더 몫이고, 이 명세는 렌더가 읽을 상태 API까지다.

2장은 돈과 징발의 장이다. 전쟁 시대(1337)가 오면 왕이 한 계절씩 청구서를 보내고, 해안의 도시는 습격을 받는다. 성벽이 막는 만큼 덜 잃는다. 전쟁이 지나가면 석벽을 쌓을지 시장을 넓힐지 고르고, 그 선택이 끝나면 2장이 끝난다.

## WR-1 전령과 순서 (`war.ts`, `warForecast`)

- 시나리오의 `activeEvents`에 `war_1337`이 있으면 전쟁이 있다(캠페인·샌드박스 모두).
- 전쟁 시대(1337, 준비도 없음)에 들어간 뒤 첫 계절 시작에 국왕의 전령이 온다(`war.messengerTick`). 이후 순서는 전령의 계절에서 센다.

| 계절(전령부터) | 단계 | 무엇 |
|---|---|---|
| 0 | 전령(소문) | 전쟁 상태가 생긴다. 원장 `war.messenger` |
| 1 | 양모 공납 칙령 | 청원 `wool_payment`(청원자 `crown`) |
| 4 | 징집 명령 | 청원 `levy_response`(`crown`) |
| 6 | 전쟁 보조세 | 청원 `war_funding`(`crown`) |
| 습격 − 1 | 봉화(징후) | `beaconLit(state)`, 원장 `war.beacon` |
| 9 또는 13(seed) | 해안 습격(도래) | WR-5 |
| 습격 + 1 | 피란민 | 청원 `refugee_admission`(`refugees`) |
| 습격 + 2 | 회복 | 조달 면허(WR-7), 청원 `wall_or_market`(`townsfolk`) |

- 봄 1337 전령이면 습격은 1339 또는 1340 여름(역사: 1338–1340 사우샘프턴·포츠머스·헤이스팅스·플리머스).
- 해안이 아닌 도시는 봉화·습격·피란민이 없고, 회복이 15계절째(해안 도시의 가장 늦은 회복)에 온다.
- 전쟁 시대에 처음 닿은 해가 1340년보다 늦은 도시(옛 저장)는 전쟁을 놓친 것이다. 늦게 시작하지 않는다(FC-1 `lastYear`와 같다).
- 시대 효과(`EraDef.effects`, B1 관): `wool_price × 1.5`. 양모 거래가 아직 없어 데이터만 있다(결정 WR3).
- `warForecast(state)`: 단계마다 틱과 `ahead`·`now`·`done`.

## WR-2~WR-8 결정 다섯 (청원)

- 다섯 결정은 청원이다. 플레이어는 청원 카드로, 봇은 `petition_response`로 답한다(결정 WR1).
- 답은 세 가지(`accept`·`accept_with_price`·`refuse`)이고, 뜻은 결정마다 아래 표와 같다.
- 한 계절 안에 답하지 않으면 거절로 친다(`expired`, 원장 `war.unanswered`).
- 왕실의 요구(`crown`)를 거절하면 왕실의 신임(`war.favour`)을 잃는다. 신임이 없으면 조달 면허와 성벽세가 없다(원장 `war.favour_lost`).
- 돈이 모자라면 낼 수 있는 만큼 내고, 나머지는 미납(`arrears`, 그 줄의 `category`)이 된다. 기간 마감이 유지비처럼 오래된 것부터 갚고, 실패 사다리의 미납 기간(FL-3)에도 들어간다(결정 WR4).
- 예측(HL-3): 결정 기록의 금고 예측은 `warDecisionForecast`(두 계절 뒤까지 낼 돈)다.

### WR-2 양모 공납 (`wool_payment`)
금액 = 사는 집 × 20d. 금액은 1337년 봇 도시(금고 7,800~13,600d, 한 해 순수입 약 800d, 집 24채)를 재어 정했다.

| 답 | 뜻 |
|---|---|
| `accept` 현물 | 125 %를 네 계절에 나눠 낸다(원장 `wool_levy`). 계절마다 목초지 양의 양털 뭉치를 먼저 내고, 모자란 만큼만 현금으로 낸다(아래 WR-2a, 결정 WR5·FX7-1) |
| `accept_with_price` 현금 | 100 %를 지금 낸다 |
| `refuse` 거절 | 왕의 조달관이 150 %를 가져간다. 신임을 잃는다 |

#### WR-2a 현물의 양털 뭉치 (FIX-7, 결정 FX7-1)
- 양모는 C5 전에는 자원이 아니다. 그래서 양털 뭉치는 쌓아 두지 않고 목초지에서 셈한다(`src/engine/pastureWool.ts`, 수치 `src/content/woolConfig.ts`).
  - 양 = 목초지 칸 수 × 1(`pastureSheep`).
  - 한 계절의 양털 뭉치 = 양 × 한 해 1개 ÷ 4, 내림(`pastureFleecesPerSeason`). 초여름에 깎아 한 해 동안 계절마다 4분의 1씩 낸다.
  - 뭉치 하나 = 5d.
- 한 계절 몫 = 125 % ÷ 4, 올림(`woolInKindPerSeason`). 계절 시작마다 이렇게 낸다(`woolInKindSplit`).
  - 뭉치를 먼저 낸다. 한 계절 양털 뭉치를 넘지 않고, 몫을 채울 만큼만 낸다.
  - 원장: `in_kind` 계정, 분류 `wool_levy`, `resource: "fleece"`, 금액 −(뭉치 × 5d), 출처 국왕·`wool_levy`·`fleece:<수>`. 금고는 움직이지 않는다.
  - 모자란 만큼은 현금(`cash`, `wool_levy`)이다. 현금이 모자라면 미납이다(결정 WR4).
- 예측(`warDecisionForecast`): 현물은 두 계절 동안 낼 현금만 뺀다.
- 목초지가 없는 도시는 전과 같다(모두 현금).
- **C5 이음**: 양털 뭉치가 자원 `fleece`가 되면 양 떼가 저장소에 뭉치를 쌓는다. 공납은 같은 나눔을 목초지 셈 대신 그 재고에서 가져간다. 원장 줄의 `resource`는 그대로 `fleece`다.

### WR-3 징집 (`levy_response`)
사람 = 사는 집 어른 20명마다 1명(최소 2명). seed 순서로 집마다 한 명씩 돌아가며 뽑고, 집의 마지막 어른은 남긴다.

| 답 | 뜻 |
|---|---|
| `accept` 사람 | 두 계절 동안 일하지 않는다(`labourPool`에서 빠진다, `conscriptsAway`). 돌아올 때 다섯 명에 한 명은 돌아오지 못해 그 집 식구가 하나 준다. 원장 `war.conscripts_left`·`war.conscripts_returned` |
| `accept_with_price` 면제금 | 1명당 20d(`war_exemption`) |
| `refuse` 거절 | 사람도 돈도 없다. 신임을 잃는다 |

### WR-4 전쟁 보조세 (`war_funding`)
보조세 = 금고의 10분의 1(성읍의 "10분의 1" 세), 적어도 사는 집 × 10d.

| 답 | 뜻 |
|---|---|
| `accept` 상인 차입 | 상인이 빌려준 돈으로 곧바로 낸다(`war_loan` +, `war_subsidy` −). 120 %를 여덟 계절에 갚는다. 상인 게이지 +10 |
| `accept_with_price` 세금 인상 | 보조세를 지금 금고에서 낸다. 네 계절 동안 기간 마감의 지대에 50 %를 더 걷는다(`war_tax`). 그 계절마다 seed 굴림이 1/3 아래면 가장 가난한 가구(등급 → 빵 → id) 하나가 떠난다(FP-3 2단과 같은 빈 집) |
| `refuse` 거절 | 내지 않는다. 신임을 잃는다 |

### WR-5 봉화와 해안 습격
- 봉화: 습격 한 계절 전부터 습격까지 켜진다(해안 archetype만. `core:open_field`는 강어귀 도시라 해안이다, 결정 WR2).
- 성벽의 방어(`ringDefencePermille`)
  - 모든 구간이 완공된 닫힌 고리여야 한다. 틈이 있으면 0이다.
  - 구간마다 석재 1,000, 목재 600을 주고 평균한다.
- 노출: 성 밖 건물(성벽이 없으면 모든 건물)은 1,000이고, 성 안은 1,000 − 방어다. 도시 노출 = 서 있는 집들의 노출 평균이다.
- 손실(`raidLosses(state, defence)`)
  - 집: `8 × 도시 노출 ÷ 1,000`(반올림)채가 탄다. 노출이 큰 집부터, 같으면 지도 가장자리에 가까운 집부터다. 불탄 집은 화재와 같은 상태(`burntTick`, `burntByEventId = coastal_raid@<계절>`)라 재건(EV-6)으로 되살린다.
  - 창고: 건물마다 재고의 `노출 × 30 %`를 빼앗긴다.
  - 금고: `20 % × 도시 노출`을 빼앗긴다(최대 2,000d, `raid_loot`).
- 기록: `war.raid{tick, defencePermille, losses{burntHouses, looted, coin}}`, 원장 `war.raid`(256² 지도).
- 대비 차: 같은 도시에서 석재 고리 < 목재 고리 < 성벽 없음(E15).

### WR-6 피란민 (`refugee_admission`)
네 가구(가구당 4명).

| 답 | 뜻 |
|---|---|
| `accept` | 모두 받아들인다. 빈 집(FP-3 2단)부터 한 가구씩, 그다음 등급 수용량에 여유가 있는 집에 채운다. 자리가 모자라면 들어간 만큼만 받는다 |
| `accept_with_price` | 절반을 받고 가구당 10d를 받는다(`refugee_fee`) |
| `refuse` | 돌려보낸다 |

### WR-7 회복: 왕실 조달 면허
- 습격 두 계절 뒤, 신임이 있으면 여덟 계절 동안 조달 면허가 선다.
- 계절 시작마다 곡창 밀의 10 %를 조달관이 시장가로 산다(`purveyance`). 원장 `war.licence`.
- 신임이 있든 없든 `wall_or_market` 청원이 온다.

### WR-8 석벽 대 시장 (`wall_or_market`)

| 답 | 뜻 |
|---|---|
| `accept` 석벽 | 석벽 사업(SC-6)을 한다. 선포 조건·비용은 그대로다 |
| `accept_with_price` 성벽세 석벽 | 신임이 있을 때만 성벽세가 붙는다. 석벽이 다 설 때까지 통행세가 두 배다(`murage`). 상인 게이지 −5. 신임이 없으면 `accept`와 같다 |
| `refuse` 시장 확장 | 석벽을 포기한다. 좌판세가 × 2다(정기 장). 상인 게이지 +5 |

## WR-9 2장 끝 (`endChapterTwo`, 캠페인)
- 2장 도시에서 계절 시작마다 본다. 다음 가운데 하나면 2장이 끝난다(`chapterEnd{2}`).
  - 전쟁의 회복이 지나고, 시장을 골랐다.
  - 전쟁의 회복이 지나고, 석벽을 골랐고, 석벽이 다 섰다(모든 구간 석재, 교체 공사 없음).
  - 1348년이 되었다(흑사병의 장이 온다). 이때 석벽은 `unfinished`다.
- 연대기 쪽: `stats.war{raidYear, raidLosses, defencePermille, men, lostMen, wall}`.
- 같은 틱에 3장이 시작한다(같은 도시, 3장 내용은 나중).
- `chapterGoals`: 2장 `wall_or_market`은 2장 끝 틱에 이룬다(FL-9의 번영 목표와 함께).
- 샌드박스는 전쟁을 겪지만 장이 없다.

## WR-10 봇·저장
- 봇의 답(`warAnswer`, 결정 WR9)
  - 양모: 금고 ≥ 공납 + 50d면 현금, 아니면 현물.
  - 징집: 금고 ≥ 면제금 + 50d면 면제금, 아니면 사람.
  - 보조세: 상인 차입.
  - 피란민: 자리가 네 가구분이면 모두, 두 가구분이면 절반, 아니면 거절.
  - 석벽 대 시장: 석벽 사업을 지금 선포할 수 있거나 이미 했으면 석벽(신임이 있으면 성벽세), 아니면 시장. 1회차에서 다섯 seed가 모두 성벽세를 골랐으나 석벽을 1348년 전에 못 끝내 장이 달력으로 끝났다(결정 WR9). 관문 변형 `--wall-choice=wall|market`이 이 답을 정한다.
- **WR-11 석벽 변형 봇**(FIX-5, `--wall-choice=wall`): 2장부터 식량 다음, 집보다 먼저 석벽 사업을 찾는다(채석장·석공소·석재 → 선포). 선포 뒤에는 성벽 공사를 우선(`priority`)으로 둔다. `wall_or_market`에는 석벽(신임이 있으면 성벽세)으로 답한다. 표준 봇은 그대로다.
- 저장 v20: `GameState.war`, 청원자 `crown`·`refugees`·`townsfolk`, 전쟁 청원 다섯, 미납 줄의 `category`.
  - v19 → v20은 버전만 올린다. 전쟁 상태가 없으면 "아직 전쟁 없음"이다.
  - 지문 `c89d70cb`, v20 저장 픽스처 9개.
- 결정론: 모든 굴림은 `hashSeed(seed, 소금, 틱)`이다(습격 해 `war:raid`, 징집 순서 `war:array`, 세금 이탈 `war:tax-flight`).

## 렌더가 읽을 API

| API | 뜻 |
|---|---|
| `state.war` | 전령 틱, 신임, 답, 징집(사람·돌아올 틱·집), 분할 납부, 세금 계절, 습격(틱·방어·손실), 면허 계절, 석벽/시장 |
| `warForecast(state)` | 순서의 단계(전령·공납·징집·보조세·봉화·습격·피란민·회복)와 상태 |
| `beaconLit(state)` | 봉화가 켜졌나 |
| `raidLosses(state, defence?)` | 습격이 지금 가져갈 것(미리보기, 성벽별) |
| `ringDefencePermille(state)` | 지금 성벽의 방어 |
| `conscriptsAway(state)` | 떠나 있는 사람 수 |
| `openPetitions(state)` | 결정 카드 다섯(청원 `defId` = Wave 17 카드 id) |
| `chapterEnd(state, 2)`·`chapterGoals(state)` | 2장 끝·연대기 `stats.war` |
| 원장 `war.*` 문구 | `historyCopy.ko.ts` |

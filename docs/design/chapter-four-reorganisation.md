# 4장 재편 명세 (F4-A) — 1362–1400: 병목이 사람에서 권리로

지시서: F4-A 4장 재편(엔진 세션, 6시간, 사용자 지시 2026-09-29). 근거:
- [플레이어 흐름 설계서](player-flow.md) 3절(4장 1362–1400, 병목 노동·권리: 농민 반란 압력·자치 요구·전문화, 장 끝 특허 협상), 5절(재편: 임금 경쟁·청원 급증 → 반란 압력·자치 요구 → 특허 협상, 권리를 내줄지)
- 권리·정치 조사(첨부 `research_rights_politics.md`): 회수 경로, 행위자의 힘(power)·태도(trust)·원인이 남는 원한(grievance), 1381의 문서 공격, fee farm은 권리가 아니라 대가(의무)
- [3장 명세](chapter-three-plague.md)(같은 청원 방식·자체 순서), [세력 명세](factions.md) FX-4(원장 기억), [직물 사슬](cloth-chain.md)
- Wave 21 4장 결정 카드 넷(`ch4_decision_guild_approval`·`ch4_decision_tax_collection`·`ch4_decision_textile_or_grain`·`ch4_decision_charter_negotiation`)과 1:1, 사건 삽화(`ch4_event_*`)

결정: [결정 목록](../decisions/README.md) RG1~RG10. 조항 번호(RG-*)는 `tests/chapterFourReorganisation.test.ts`의 시험 이름(R1~R12)과 이어진다. 사람 경로는 `tests/humanPathChapterFour.test.ts`다. 화면(결정 카드·길드홀·세력 힘)은 렌더 몫이고, 이 명세는 렌더가 읽을 상태 API까지다. 모든 값은 가설이며 플레이 뒤 조정한다(`src/content/reorganisationConfig.ts`).

3장은 사람이 모자란 장이었다. 4장에는 사람이 돌아오고, 직물로 부유해진 도시가 영주에게 권리를 요구한다.

## RG-1 순서 (`reorganisation.ts`, `reorganisationForecast`)
- 시나리오의 `activeEvents`에 `reorganisation_1362`가 있으면 재편이 있다(캠페인·샌드박스 모두).
- 시작: 캠페인은 4장의 첫 계절 시작, 샌드박스는 3장 역병이 끝난 뒤 1364년 봄부터의 첫 계절 시작에 `state.reorganisation`이 생긴다(`startTick`). 이미 4장에 들어선 옛 저장(v26)도 다음 계절 시작에 생긴다.

| 단계 | 언제 | 무엇 |
|---|---|---|
| 임금 경쟁 | 시작 + 1계절 | 원장 `reorg.wage_competition`, RG-2 |
| 직물 거리 성장 | 시작 + 4계절부터, 직조공 집이 둘 이상인 첫 계절(자동) | 원장 `reorg.textile_street` |
| 에일하우스 성황 | 시작 + 8계절부터, 에일하우스 셋 이상·지난 계절 마신 통 12 이상인 첫 계절 | 원장 `reorg.alehouse_boom` |
| 청원 급증(상인·직인 무리) | 1368 봄부터, 직물 거리와 에일하우스가 모두 온 다음 계절 — 늦어도 1372 봄 | 원장 `reorg.petitions_surge` |
| 길드 결성 요구 | 청원 급증 + 4계절 | 청원 `guild_charter`(`craftsmen`), RG-5 |
| 직물 대 곡물 | 길드 요구 + 4계절 | 청원 `cloth_or_grain`(`merchants`), RG-7 |
| 상위 영주의 경고 | 길드 요구부터, 도시 공동체의 힘이 50 이상인 첫 계절 | 원장 `reorg.overlord_warning`, RG-4 |
| 인두세 | 1377 봄 | 청원 `tax_collection`(`townsfolk`), 걷기 1377 여름·1379 봄·1381 여름(답이 난 뒤), RG-6 |
| 1381 농민 반란 소문 | 1381 여름 | 원장 `reorg.rebellion_rumour`(`chased`·`quiet`), RG-8 |
| 자치 요구서 | 길드 인가 1382 봄, 아니면 1384 봄. 징수원을 쫓았으면 곧(1381 가을) | 원장 `reorg.autonomy_request`, 청원 `borough_charter`(`townsfolk`), RG-9 |
| 4장 끝 | 특허에 답한 다음 계절 시작, 늦어도 1400 봄 | RG-10 |

- `reorganisationStage(state)`: `rumour`(시작 ~ 청원 급증 전)·`arrival`(청원 급증 ~ 자치 요구서)·`recovery`(자치 요구서 ~ 끝)·`done`. F0-B 사다리의 이름이다(결정 RG1).
- 청원은 한 계절 안에 답하지 않으면 영주의 침묵이 답한다(RG-5~RG-9의 "답하지 않으면").

## RG-2 임금 경쟁
- 이웃 장원이 더 높은 임금으로 일꾼을 부른다. 네 계절 동안 계절마다 35 %로 가장 가난한 가구 하나가 이웃 장원으로 떠난다(집은 비고, 사다리가 다시 채운다).
- 떠난 가구마다 이웃 세력(`neighbour_1`)이 원장에 남는다(`reorg:wage_competition`, 관계 −2).

## RG-3 직물이 주 수입원 (밸런스)
4장부터(재편이 시작된 뒤) 직물 값과 영주의 몫이 오른다(결정 RG3). 1~3장의 값(CL-8)은 그대로다.

| 값 | 3장까지 | 4장 | 뜻 |
|---|---|---|---|
| 완성 직물 값(주인의 몫) | 30d | 40d, 전문화 50d | 장거리 상인의 매입가 |
| 인장세 `ulnage`(금고) | 4d | 8d | 직물 보조세가 붙은 인장(1353~) |
| 직물 매매세 `cloth_toll`(금고) | — | 값의 5분의 1(8d, 전문화 10d) | 영주 시장의 직물 매매세 |
| 축융 사용료(금고) | 3d | 3d | |
| 시장이 파는 직물 | 시장의 한 칸(80틱마다 하나, 다른 물건과 나눔) | 다른 물건과 따로 80틱마다 하나 더 | 장거리 상인이 따로 온다 |
| 염료(상인이 염색집마다, 계절마다) | 10짐 | 20짐 | 10짐이면 염색집 하나가 한 해 40필에서 막힌다 |
| 길드 인가 | — | 직물 네 건물의 공정 시간 × 0.75 | RG-5 |

- 염색집은 염료 자리를 남긴다(결정 RG4): 축융한 베를 곧장 나르는 수레는 염료 몫(20짐 − 쥔 염료)을 비워 두고 나른다. 베로 창고가 차면 염료를 들일 자리가 없어 사슬이 섰다(4장 도시 탐침, 1377).
- 봇 도시 4장의 금고 수입을 분류별 표로 보고한다(보고서). 기준은 "4장 마지막 네 해의 금고 수입에서 직물(인장세 + 직물 매매세 + 축융 사용료)이 가장 큰 분류"다.

## RG-4 세력의 힘 (`factionInfluence`, 0~100)
- 재편이 시작된 뒤 계절마다 센다(`state.reorganisation.influence`). 1~3장에는 없다.
  - **도시 공동체**(`town`): 인구 ÷ 20(최대 40) + 지난 네 계절 팔린 직물 ÷ 2(최대 30) + 길드 20 + 도시가 쥔 권리 한 줄마다 5(최대 10).
  - **상인 가문 첫째**(`merchant_house_1`): 지난 네 계절 팔린 직물(최대 40) + 상인의 시장권 10 + 길드 10 + 상인 게이지 ÷ 5(최대 20).
  - **상인 가문 둘째**: 첫째의 5분의 3.
- **줄다리기**: 도시의 힘이 50 이상이 되면 상위 영주(백작)가 경고한다(RG-1). 경고 뒤에 특허를 내주면 백작이 더 크게 돌아선다(RG-9). 결정마다 도시·상인 쪽과 상위 영주·국왕 쪽 관계가 반대로 움직인다(RG-5~RG-9 표의 관계 열).
- 관계는 FX-4 그대로 원장 기록(`faction.relation`)으로 남고, 세력의 기억이 그 기록을 가리킨다. 원인 문자열은 `reorg:<무엇>`이다.

## RG-5 길드 인가 (`guild_charter`, 청원자 `craftsmen` → 도시 공동체, 카드 둘)

| 답 | 뜻 | 관계 |
|---|---|---|
| `accept` 인가 | 길드가 선다(`guild`: 선 틱, 수장 = 도시의 장인 가장). 직물 네 건물의 공정 시간 × 0.75. 도시의 힘 +20. 자치 요구서가 1382로 앞당겨진다 | 도시 +10, 상인 첫째 +5, 상위 영주 −5 |
| `refuse` 거부 | 다음 계절 시작에 직조공 가구 둘이 떠난다(직조공 집에 가까운 집부터, 길드가 있는 도시로). 직조 공정 시간 × 1.25(4장 끝까지) | 상인 첫째 −15, 도시 −10 |

- 답하지 않으면 거부로 친다.

## RG-6 세금 징수 방식 (`tax_collection`, 청원자 `townsfolk`, 카드 둘)
- 1377 리처드 2세의 인두세(14세 이상 한 사람 4d). 도시 공동체가 스스로 걷겠다고 청한다. 국왕의 몫은 금고를 지나지 않는다. 영주의 몫만 금고에 든다(`poll_tax`).

| 답 | 뜻 | 관계 |
|---|---|---|
| `accept` 공동체 위임 | 걷을 때마다 어른 한 사람당 1d(도시가 정한 대납금) | 도시 +10, 평민 +10 |
| `refuse` 직접 징수 | 걷을 때마다 어른 한 사람당 3d(영주의 징수원). 반란 압력 +40 | 평민 −10, 국왕 +5 |

- 답하지 않으면 직접 징수로 친다(영주의 징수원이 늘 하던 대로 걷는다).

## RG-7 직물 대 곡물 (`cloth_or_grain`, 청원자 `merchants` → 상인 가문, 카드 둘)

| 답 | 뜻 | 관계 |
|---|---|---|
| `accept` 직물 전문화 | 영지의 쟁기밭을 양으로 돌린다: 직물 값 50d(매매세 10d), 수확 × 0.85(식량 취약) — 영구. 반란 압력 +10(빵이 비싸다) | 상인 첫째 +10, 평민 −5 |
| `refuse` 곡물 유지 | 바뀌는 것이 없다 | 상인 첫째 −10, 평민 +5 |

- 답하지 않으면 곡물 유지로 친다.

## RG-8 1381 농민 반란 소문 (`rebellion_rumour`, 유혈 없이)
- 1381 여름, 인두세 셋째 걷기와 같은 계절에 온다. **반란 압력**(`revoltPressure`, 원인마다 한 줄):

| 원인 | 압력 |
|---|---|
| 직접 징수(RG-6) | 40 |
| 3장 부역 유지(`cash_rent` 거부·답 없음) | 20 |
| 3장 조례대로 임금을 묶음(`wages` 거부·답 없음) | 10 |
| 길드 거부 | 10 |
| 직물 전문화 | 10 |
| 평민 관계가 0 아래 | 10 |

- 압력이 50 이상이면 **징수원을 쫓는다**(`chased`): 그 계절의 인두세를 걷지 못하고, 장원 법정 기록이 불타 다음 장부 기간 지대가 들지 않는다(`rentWithheld`). 평민 −10·상위 영주 −10·국왕 −10. 자치 요구서가 곧(다음 계절) 온다(St Albans 1381처럼 도시가 특허를 요구한다).
- 50 아래면 소문이 지나간다(`quiet`): 도시 +5.
- 누구도 죽지 않는다.

## RG-9 자치 특허 협상 (`borough_charter`, 청원자 `townsfolk`, 카드 둘) — 5장 시작 상태를 정한다

| 답 | 뜻 | 관계 |
|---|---|---|
| `accept` 부분 허용 | 권리 두 줄이 도시로: `market_tolls`(시장 좌판세가 도시로, 영주 좌판세 0), `bridge_tolls`(통행세 절반). 지대는 그대로. 도시가 해마다 봄에 fee farm 120d를 낸다(`fee_farm`, 권리가 아니라 대가 — 결정 RG6) | 도시 +20, 상인 첫째 +10, 상위 영주 −15(경고 뒤면 −25), 국왕 +5 |
| `refuse` 거부 | 권리가 그대로. 5장 반발 = 도시의 힘(최소 30) | 도시 −25, 상인 첫째 −15, 평민 −5, 상위 영주 +10 |

- 답하지 않으면 거부로 친다.
- **5장 시작 상태**(`chapterFiveStart`): `charter`(`partial`·`refused`·`calendar`), 넘긴 권리, fee farm, 반발(0~100), 길드(있음·수장), 세력 힘. 5장 작업이 읽는다.

## RG-10 4장 끝
- 특허에 답한 다음 계절 시작, 늦어도 1400 봄(`calendar`, 특허는 거부로 친다).
- 캠페인 4장이면 `endChapterFour`가 연대기 쪽을 쓰고(`stats.reorganisation`: 시작 해, 떠난 가구, 팔린 직물, 직물 수입, 길드, 인두세, 반란 소문, 특허, 도시·상인의 힘), 같은 틱에 5장이 시작한다. 장 목표 `charter`.
- 샌드박스는 장이 없고 순서만 끝난다(`endedTick`). 결정의 결과(길드·전문화·권리·fee farm)는 남는다.

## RG-11 봇과 저장
- 봇의 표준 답: 길드 인가·공동체 위임·직물 전문화·부분 허용(`chapterDecisionAction`).
- 봇의 직물(CL-11에 더함): 4장에 첫 완성 직물이 팔린 뒤 둘째 직조공 집, 전문화하면 목초지 120칸·둘째 목축 농장(첫 농장이 닿지 않는 목초지가 30칸 이상일 때)·둘째 텐터 틀.
- 저장 v27: `state.reorganisation`. v26 → v27은 버전만 올린다.
- 1~3장은 바뀌지 않는다. 재편이 시작되기 전에는 이 코드가 상태를 건드리지 않고, 직물 값도 3장까지의 값이다.

## RG-12 결정 비교
- `reorganisationDecisionForecast(state, defId, response)`: 결정 카드의 예측 줄(두 계절 뒤 금고).
- 보고서의 비교표: 같은 4장 도시에서 봇의 표준 답과 반대 답을 돌려 결과(금고·직물 수입·떠난 가구·반란 소문·특허·세력 관계·5장 시작 상태)를 나란히 둔다.

## 렌더가 읽을 API

| API | 뜻 |
|---|---|
| 청원 `guild_charter`·`tax_collection`·`cloth_or_grain`·`borough_charter`, `PetitionDef.responses` | Wave 21 4장 결정 카드 넷(1:1), 카드마다 답 둘 |
| `reorganisationForecast(state)`, `reorganisationStage(state)` | 계절 띠 예고, 사건 삽화(`ch4_event_wage_competition`·`textile_growth`·`alehouse`·`petitions`·`guild_foundation`·`lord_warning`·`rebellion_1381`·`autonomy_request`·`ending`) |
| 원장 `reorg.*`, `faction.relation`(`reorg:*`) | 연대기·세력 쪽 문장 |
| `factionInfluence(state, id)`, `factionsList`의 `influence` | 세력 힘 수치 |
| `guildOf(state)` | 길드(선 틱·수장 person id) — Wave 12 길드홀은 렌더 몫 |
| `revoltPressure(state)` | 반란 압력과 원인 줄 |
| 권리 `market_tolls`·`bridge_tolls`(보유 `townsfolk`), `chapterFiveStart(state)` | 권리 이양 목록, 5장 시작 상태 |
| 장부 `poll_tax`·`cloth_toll`·`fee_farm` | 4장 돈 |
| `chapterGoals` `charter`, `chapterEnd(state, 4)` | 4장 목표·장 끝 |
| `reorganisationDecisionForecast(state, defId, response)` | 결정 카드의 예측 줄 |

# 3장 사건 명세 (F3-A) — 흑사병 1348–1362: 병목이 땅에서 사람으로

지시서: F3-A 3장 흑사병(엔진 세션, 6시간, 사용자 지시 2026-09-28). 근거:
- [플레이어 흐름 설계서](player-flow.md) 3절(3장 1348–1362, 병목 사람: 인구 절반·빈 필지·임금 상승·노동자 조례, 장 끝 재정착), 5절(흑사병 1348: 항구 열병 소문·사제 사망 → 인구 −45 %·빈 필지·노동 절벽 → 토지 재분배·부역 → 화폐 지대, 임금 대 조례)
- [2장 명세](chapter-two-war.md)(같은 청원 방식·자체 순서), [사건 명세](flow-events.md) EV-2(예고 → 도래 → 회복), [인물 명세](persons.md) PS-3(사망), [실패 사다리](failure-ladder-campaign.md) FL-7(가문 교체)
- Wave 21 3장 결정 카드 넷(`ch3_decision_wages`·`ch3_decision_land_redistribution`·`ch3_decision_vacant_priest`·`ch3_decision_cash_rent`)과 1:1, 사건 삽화 아홉(`ch3_event_*`)

결정: [결정 목록](../decisions/README.md) BD1~BD9. 조항 번호(PL-*)는 `tests/chapterThreePlague.test.ts`의 시험 이름(P1~P12)과 이어진다. 사람 경로는 `tests/humanPathChapterThree.test.ts`다. 화면(결정 카드·빈집·묘지·장례)은 렌더 몫이고, 이 명세는 렌더가 읽을 상태 API까지다. 모든 값은 가설이며 플레이 뒤 조정한다(`src/content/plagueConfig.ts`).

1~2장은 땅과 돈이 모자란 장이었다. 흑사병 뒤에는 사람이 모자라고 땅이 남는다. 사람은 인물 단위로 죽고 원장과 가계도에 남는다.

## PL-1 순서 (`plague.ts`, `plagueForecast`)
- 시나리오의 `activeEvents`에 `black_death_1348`이 있으면 흑사병이 있다(캠페인·샌드박스 모두).
- 붕괴 시대(`collapse`, 1348)에 들어간 뒤 첫 계절 시작에 `state.plague`가 생긴다(`eraTick`). 이후 순서는 그 계절에서 센다.

| 계절(시대 첫 계절부터) | 단계 | 무엇 |
|---|---|---|
| 1(1348 여름) | 항구 열병 소문(예고) | 원장 `plague.rumour` |
| 2(해안·강어귀) · 3(내륙) | 도래 — 첫 사망, 사제의 죽음 | PL-2, PL-6, 청원 `vacant_priest`(`parish`) |
| 도래 + 1 | 교회 묘지의 새 무덤 | 원장 `plague.new_graves`(첫 사망 뒤) |
| 도래 중 | 빈 거리 | 원장 `plague.empty_streets`(첫 빈집) |
| 도래 + 2 | 임금 요구 | 청원 `wages`(`labourers`) |
| 도래 + 4 | 역병이 물러감, 버려진 밭 | 원장 `plague.abandoned_fields`, 청원 `land_redistribution`(`townsfolk`) |
| 1351 봄 | 노동자 조례 낭독(국왕) | 원장 `plague.ordinance`, PL-5 |
| 1352 봄~ | 재정착 | PL-7, 청원 `cash_rent`(`townsfolk`) |
| 1361 봄 | 두 번째 역병 | PL-9 |
| 1362 봄~1364 봄 | 3장 끝 | PL-10 |

- 코어 도시는 조수가 드는 강어귀에 있어(`coastal`) 1348 가을에 역병이 온다.
- 붕괴 시대에 처음 닿은 해가 1350년보다 늦은 도시(옛 저장)는 역병을 놓친 것이다. 늦게 시작하지 않는다.
- `plagueStage(state)`: `rumour`·`arrival`·`recovery`·`done`(소문 전 `null`). F0-B 사다리와 같은 이름이다(결정 BD1).

## PL-2 사망 (인물 단위)
- 역병은 네 계절 돈다. 계절마다 사망일(계절 둘째 틱, PS-3과 같다)에 사람 층(`advancePersons`)이 그 계절의 죽을 사람을 부른다(`plagueVictims`).
- 죽는 비율: 도래 때 사람(`residents`)의 42~48 %를 seed가 고른다(역사: 잉글랜드 30~50 %, 지시서 40~50 %). 계절 몫은 20·35·30·15 %다.
- 누가 죽나(가중 무작위 추첨, 비복원, seed 결정론)
  - 나이: 5세 미만 1.6배, 5~13세 1.2배, 14~54세 0.8배, 55세 이상 1.7배.
  - 붐비는 집(방의 90 % 이상 참) 1.2배. 도시 안쪽 3분의 1(사는 집들의 가운데에서 가까운) 1.25배, 바깥 3분의 1 0.85배.
  - **가구 전체**: 사는 집의 15 %는 가구 전원이 죽는다(무게가 무거운 집부터, 계절 몫대로, 죽는 사람 수 안에서). 한 집에 스무 명이 사는 도시에서 사람만 뽑으면 빈집이 생기지 않았다(결정 BD3).
- 영주 가솔(영주 가족·청지기)도 예외가 없다. 그 계절 도시의 확률(죽을 수 ÷ 사람 수) × 제 무게로 굴린다. 인구 수에는 들지 않으므로 따로 센다(`manorDead`).
- 역병 사망자는 다시 채우지 않는다(여느 계절 사망은 가구가 곧 채운다, PS-3). 원장은 `person.died`에 원인 `plague`로 남는다(결정 BD2). 가계도에서는 고인이다(`persons.past`, `deathCause: "plague"`).
- 사람이 모두 죽은 집은 빈집이 된다(`abandonedTick`, 빈 필지 `vacantHouseIds`).
- **영주 가족이 끊기면**(산 사람이 없고, 그 가운데 역병으로 죽은 사람이 있으면) 다음 계절 시작에 새 가문이 선다(FL-7의 가문 교체, 쇠퇴 없이). 그다음 계절에 새 가문의 가족이 영주 가솔에 선다(`lordFamilyExtinct`). 역병이 줄인 가족이 몇 해 뒤 끊겨도 같다(봇 seed 2, 1359).

## PL-3 빈 필지와 회복
- 도래부터 3장 끝까지 **성장 규칙이 사람을 늘리지 않는다**(`plagueHousing` → 집 규칙 `growthHeld`). 굶는 집이 줄어드는 규칙은 그대로다.
  - 이유: 성장 규칙은 150틱마다 집을 채운다. 두면 역병의 죽음이 한 계절 안에 메워진다(결정 BD4).
- 회복은 이 규칙만 한다. 역병이 물러간 뒤 계절마다 도래 때 사람의 0.6 %가 먹을 것과 물이 있고 자리가 남은 사는 집에 든다(출생·시골의 친척). 도래 때 사람 수를 넘지 않는다.
- 빈 필지는 재정착(PL-7)을 기다린다. 실패 사다리의 새 가구(FP-3)는 빈 필지를 채우지 않고, 쇠퇴의 "황폐"(FL-3)에도 세지 않는다. 3장이 끝나면 빈 필지는 사다리로 돌아간다.
- 빈 필지는 지대를 내지 않는다(사는 사람이 없는 집, M-2 그대로).
- API: `plagueVacantPlots(state)`(집 id), `plagueRecoveryPermille(state)`(도래 때 대비 지금 사람, ‰).

## PL-4 경제
- 노동: 어른이 줄어 노동 규칙이 그대로 보여 준다(생산 시설 가동률 하락, `labourPool`).
- 곡물값: 도래부터 3장 끝까지 빵·밀은 5분의 4 값이다(먹는 입이 줄어서, `foodPricePermille`). 흉작 값은 그 위에 곱한다.
- 임금·지대·유지비는 결정(PL-5, PL-8)을 따른다.
- 목초지 전환이 유리하다(양은 일손이 적게 든다)는 C5의 몫이다. 양은 아직 목초지 셈뿐이다(FX7-1).

## PL-5 임금 (`wages`, 청원자 `labourers`, 카드 둘)

| 답 | 뜻 |
|---|---|
| `accept` 인상 | 3장 끝까지 장부 기간마다 영주 시설의 일꾼 한 사람당 1d(`wages`). 일꾼이 남는다 |
| `refuse` 조례대로 묶음 | 임금이 없다. 계절마다 50 %로 가장 가난한 가구 하나가 임금을 주는 곳으로 떠난다(빈 필지가 된다). 평민 세력이 기억한다 |

- 1351 봄 국왕의 **노동자 조례**가 낭독된다. 임금을 올린 영주는 치안관에게 벌금 100d를 낸다(`statute_fine`).
- 답하지 않으면(한 계절) 묶은 것으로 친다.

## PL-6 사제 공석 (`vacant_priest`, 청원자 `parish`, 카드 둘)
- 첫 사망과 함께 사제가 죽는다. 교회·예배당은 사제가 올 때까지 아무도 섬기지 않는다(`curacyVacant`, 건물 `curacyVacant` — 가동 중지와 같다).

| 답 | 뜻 |
|---|---|
| `accept` 수도원에 청함 | 봉급 60d(`church_fee`). 수도원의 사제는 다음다음 계절 시작에 온다. 주교 세력 +10 |
| `refuse` 평신도 서기 | 돈이 들지 않고 곧 기도를 맡는다. 주교 세력 −15 |

- 답하지 않으면 서기가 맡은 것으로 친다(주교 −10).

## PL-7 빈 필지 재분배 (`land_redistribution`, 청원자 `townsfolk`, 카드 둘)
- 역병이 물러갈 때 온다. 재정착은 1352 봄부터다.

| 답 | 뜻 |
|---|---|
| `accept` 이웃 가구가 넓혀 씀 | 3장 끝까지 집의 승급 대기가 절반이다. 빈 필지에는 계절마다 한 가구(친척, 필지 크기만큼)가 든다 |
| `accept_with_price` 새 이주민 | 계절마다 두 가구(네 명씩)가 빈 필지에 든다. 가구마다 입주금 10d(`entry_fine`) |

- 답하지 않으면 이웃 가구가 넓혀 쓴 것으로 친다.

## PL-8 부역 → 화폐 지대 (`cash_rent`, 청원자 `townsfolk`, 카드 둘)
- 재정착이 시작되는 1352 봄에 온다. 부역은 이 게임에서 처음 생기는 개념이다. 소작인이 영주의 일을 몸으로 하던 몫이다(결정 BD6).

| 답 | 뜻 |
|---|---|
| `accept` 돈으로 바꿈 | 지대가 영구히 1.25배다(금고가 안정된다). 권리 목록에 `commuted_rent`(소유 `townsfolk`) — 영주의 부역 권리가 없어진다 |
| `refuse` 부역을 지킴 | 3장 끝까지 영주 시설 유지비가 4분의 3이다(소작인이 일한다). 계절마다 25 %로 한 가구가 부역을 피해 달아난다 |

- 답하지 않으면 부역을 지킨 것으로 친다.

## PL-9 두 번째 역병 (1361)
- 1361 봄부터 두 계절, 그때 사람의 12 %(60·40 %). 아이 병이라 불린 역병이라 젊은 사람이 무겁다(14세 미만 2배, 14~29세 1.3배, 30~54세 0.7배, 55세 이상 0.9배). 가구 전체를 고르지는 않는다.
- 원장 `plague.second`·`plague.second_ended`.

## PL-10 3장 끝
- 두 번째 역병이 물러간 뒤, 1362 봄부터 계절마다 본다. 사람이 도래 때의 70 % 이상이면 끝난다(재정착 완료, `resettled`). 늦어도 1364 봄에는 끝난다(`calendar`).
- 캠페인 3장이면 `endChapterThree`가 연대기 쪽을 쓰고(`stats.plague`: 도래 해·그때 사람·죽음·영주 가솔 죽음·두 번째 죽음·재정착 가구·떠난 가구·결과), 같은 틱에 4장이 시작한다. 장 목표 `resettled`.
- 샌드박스는 장이 없고 순서만 끝난다(`endedTick`). 끝나면 성장 규칙·빈 필지·곡물값·유지비는 평소로 돌아간다. 화폐 지대는 남는다.

## PL-11 봇과 저장
- 봇의 표준 답: 수도원·임금 인상·새 이주민·화폐 지대(`chapterDecisionAction`).
- 저장 v26: `state.plague`, 교회의 `curacyVacant`. v25 → v26은 버전만 올린다.
- 1~2장은 바뀌지 않는다. 붕괴 시대 전에는 역병 코드가 상태를 건드리지 않는다.
- 청원 카드는 제 답만 받는다(`PetitionDef.responses`). 다른 답은 상태를 바꾸지 않는다.

## 렌더가 읽을 API

| API | 뜻 |
|---|---|
| 청원 `vacant_priest`·`wages`·`land_redistribution`·`cash_rent`, `PetitionDef.responses` | Wave 21 결정 카드 넷(1:1), 카드마다 답 둘 |
| `plagueForecast(state)`, `plagueStage(state)` | 계절 띠 예고, 사건 삽화(`ch3_event_harbour_fever`·`priest_death`·`new_graves`·`empty_streets`·`abandoned_fields`·`wage_demand`·`ordinance_reading`·`resettlement`·`ending`) |
| 원장 `plague.*`, `person.died`(`cause: plague`) | 연대기·인물 전기·세력 쪽 문장 |
| `plagueVacantPlots(state)` | 빈집(Wave 9 `plague_shut_l1~l3`)·빈 필지 |
| `curacyVacant(state)`, 건물 `curacyVacant` | 사제 없는 교회 |
| 장부 `wages`·`statute_fine`·`church_fee`·`entry_fine` | 임금 장부와 3장 돈 |
| `plagueRecoveryPermille(state)`, `chapterGoals` `resettled`, `chapterEnd(state, 3)` | 3장 목표·장 끝 |
| `plagueDecisionForecast(state, defId, response)` | 결정 카드의 예측 줄 |

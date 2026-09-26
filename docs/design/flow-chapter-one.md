# 1장 명세 (F0-C1) — 대기근(준비도 게이트)·첫 청원·권리·연대기·1장 끝

지시서: F0-C1 흐름 뼈대 3. 근거: [플레이어 흐름 설계서 v1](player-flow.md) 2절 루프 4층(구휼/가격 통제/방관, 청원 수락·거절·가격), 3절 1장(1300–1318, 장 끝: 시장도시 선포 + 대기근 생존 → 연대기 1쪽), 4절 대본 60–75분(첫 청원)·90–120분(비 오는 여름 2년 → 대기근), 5절 시대 전환(대기근: 예고 → 도래 → 회복), 8절(연대기: 결정 3개 인용). 앞 단계: [사건 명세](flow-events.md)(예고 사다리·흉년 틀), [압력 명세](flow-pressure.md) FP-3(사다리)·FP-5(준비도). 결정: FC1~FC7.

1장이 끝까지 한 판이 된다. 조항 번호(FC-*)는 `tests/flowChapterOne.test.ts`의 테스트 이름(C1~C10)과 이어진다. 화면(대응 카드·청원 카드·권리 패널·연대기 쪽)은 렌더 세션 UI-4 몫이고, 이 명세는 렌더가 읽을 상태 API까지다.

## FC-1 대기근 (`great_famine`, 시대 사건)

- 정의는 F0-B 흉년 틀(`EventDef`, kind `dearth`)에 일정 종류 `era`를 더한 것이다. 기근 시대(FP-5: 1315 이후 곡창 ≥ 1 ∧ 필지 12 ∧ 시장 ≥ 1, 못 갖추면 1320 강제)가 들어오는 틱에 도래한다.
- 예고(F0-B 사다리 재사용): 1315 여름에서 거꾸로 센다. 소문 12계절 전(1312 여름), 징후 8계절 전(1313 여름)부터. 징후 동안 1313·1314 여름이 젖고(수확 × 0.95), 빵·밀 값이 × 1.2로 먼저 오른다. 준비가 안 돼 1315를 넘기면 도래할 때까지 징후에 머문다.
- 도래: 수확 2~3번(seed)이 반(`harvestPermille` 500), 그 여름들은 젖음. 첫 반 수확은 도래한 해의 수확(도래가 해 안 1,500틱 전이면), 아니면 이듬해. 값 × 3(빵 5 → 15, 밀 2 → 6)은 도래부터 마지막 반 수확 다음 좋은 수확 시작까지. 회복 2계절.
- 효과(`EraDef.effects`, B1 관): `harvest_yield × 0.5`, `food_price × 3`, `livestock_health × 0.8`(가축이 아직 없어 데이터만, 결정 FC2).
- 기록: 도래 인구·끝 인구(`populationAtArrival` · `populationAtEnd`), 수확 해(`harvestFromYear` · `harvestYears`), 대응(`response`). v13 저장이 이미 기근 시대에 들어가 있었으면 그 대기근은 놓친 것으로 적는다(늦게 시작하지 않는다).

## FC-2 대기근 대응 (`famineResponse(state, choice)`)

도래 중 한 번 고른다. 값 충격: 값이 × 2 이상인 동안(가격 통제가 아니면) 사는 집 가운데 가장 가난한 1/4(등급 → id 순, 계절이 바뀌어도 같은 가구)은 빵을 살 수 없어 사다리(FP-3)에서 부족으로 센다.

| 대응 | 계절 시작마다 | 사다리 | 장부 |
|---|---|---|---|
| 구휼 `relief` | 가난한 가구의 한 계절 빵을 기근 값으로 사서 곡창에 넣는다(금고의 50 %까지). 가난한 가구는 부족이 아니다 | 이탈 계절당 1 | `famine_relief`(지출, 출처 사건) |
| 가격 통제 `price_control` | 상인 게이지 −10 | 값 상한 × 1.5 → 가난한 가구도 산다 | — |
| 방관 `laissez_faire` | 없음 | 가난한 1/4 부족, 이탈 계절당 2 | — |
| 투기 `speculation` | 곡창 빵·밀의 1/4을 기근 값으로 판다 | 가난한 1/4 부족, 이탈 계절당 3 | `famine_sale`(수입, 출처 사건) |

## FC-3 첫 청원 (`Petition`, 시장권)

- 청원자: 상인 무리. 요구: 시장권(상인 감독 아래 장을 열 권리, 가벼운 좌판세). 1305–1308 가운데 seed가 고른 계절부터, 필지 6개 이상인 마을에 온다(시장이 없어도 — 시장을 열 권리를 청한다).
- 응답 3종(`respondToPetition(state, id, response)`):

| 응답 | 권리 | 좌판세 | 금고 | 상인 게이지 |
|---|---|---|---|---|
| 수락 `accept` | 시장권(`rights[]` 한 줄) | × 0.75 | — | +15 |
| 가격 붙여 수락 `accept_with_price` | 시장권 | 그대로 | +150(`charter_fee`) | +5 |
| 거절 `refuse` | 없음 | 그대로 | — | −20 |

- 1308이 끝날 때까지 답이 없으면 `expired`, 게이지 −10. 상인 게이지는 50에서 시작, 0~100.

## FC-4 권리 목록 (`rights[]`)

- 권리 한 줄: `id` · `holder` · `grantedTick` · `petitionId` · `stallFeePermille`. 좌판세 게시(M-5)는 가장 낮은 권리의 비율을 쓰고 출처에 `{type:"right"}`를 단다. B1 관에도 `stall_fee × 비율`(출처 권리)로 싣는다.

## FC-5 연대기와 1장 끝

- 1장 끝 판정(`chapterEnd`): 시장도시 선포(목책 시대, `era ≠ hamlet`) ∧ 대기근이 끝났고 끝 인구 ≥ 도래 인구의 60 %. 둘 다 되는 첫 표본에서 `chapterEnds`에 `{chapter:1, tick, chronicle}`.
- 연대기 한 쪽(`ChronicleEntry`): 장·시작 해·끝 해, 장 안 사건(해·손실), 플레이어 결정 3개 인용(대기근 대응 → 청원 응답 → 시장도시 선포 순으로 무게), 통계(시작·끝·최고 인구, 집, 불탄 집, 이탈, 잃은 수확, 금고, 대기근 도래·끝 인구).
- 결정 기록(`decisions[]`): 대기근 대응·청원 응답·시장도시 선포(선포 틱).

## FC-6 봇

- 대기근이 오면 곧 대응(표준 = 구휼, 관문 ③ 변형 `--famine-response=laissez_faire`), 청원이 오면 수락.
- 흉년 대비(EV-7)는 대기근에도 쓴다. 경작 여유는 최대 × 1.5(반 수확이 밭을 두 배로 늘리지 않게).

## FC-7 저장 v14

- `GameState.politics{merchantGauge, petitions[], rights[], decisions[], chapter{number, startTick, populationStart, peakPopulation}, chapterEnds[]}`, 사건 기록의 FC-1 필드. v13 → v14: 기근 시대에 이미 든 저장은 대기근을 놓친 것으로 적는다. 정치 상태는 첫 틱에 생긴다(장은 그때부터 센다).

## 렌더가 읽을 API

| API | 뜻 |
|---|---|
| `famineStatus(state)` | 대기근 단계·고른 대응·남은 선택지·끝 틱 |
| `eventForecast(state)` | 대기근 소문·징후(F0-B) |
| `openPetitions(state)` · `state.politics.petitions` | 기다리는 청원, 지난 청원과 응답 |
| `state.politics.rights` · `rightsEffectRegistry` | 권리 목록 |
| `state.politics.merchantGauge` | 상인 게이지 |
| `chapterEnd(state)` · `ChronicleEntry` | 장 끝과 연대기 한 쪽 |

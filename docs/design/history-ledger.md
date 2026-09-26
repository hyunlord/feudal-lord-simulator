# 기록 원장 명세 (F0-C2) — 모든 결정·사건·변화가 남는다

지시서: F0-C2 기록 원장 v0. 근거: [연대기 설계서](CHRONICLE_DESIGN.md) 1절(원장 타입·원천·심각도·스냅샷). 앞 단계: [1장 명세](flow-chapter-one.md) FC-5(연대기 한 쪽), [사건 명세](flow-events.md)(예고 사다리). 결정: HL1~HL8.

게임의 이야기가 **append-only 원장**(`GameState.history`, 저장 v15)에 남는다. 원장은 시뮬레이션을 바꾸지 않는다 — 매 틱과 매 명령의 앞뒤 상태를 읽어 기록만 더한다(봇·가드레일 결과 불변). 조항 번호(HL-*)는 `tests/historyLedger.test.ts`(H1~H8)와 이어진다. 화면(UI-4 기록 패널·CHRON-1 연대기)은 렌더 세션 몫이고, 이 명세는 렌더가 읽을 API까지다.

## HL-1 기록 (`HistoryRecord`, `src/engine/history.types.ts`)

- `id`(`h-000001` 순번) · `tick` · `kind`(`decision` `event` `person` `faction` `era` `milestone` `ledger`) · `template` · `params` · `subject`(`ActorRef`: town · household · person · faction · lineage) · `actors?` · `place?`(타일·건물) · `cause?`(`SourceRef`, B1 원인 등록표 재사용) · `decision?` · `severity` · `illustration?` · `snapshotId?`.
- 문장은 저장하지 않는다. 템플릿 id + 파라미터만 저장하고 `historySummary(record)`가 `src/content/historyCopy.ko.ts`에서 다시 짓는다(문자열 조립 금지 규칙 5 — 문구는 한 파일). 날짜는 `historyDate(record, state)`가 틱에서 계산한다.
- append-only: 기록은 더하기만 한다. 뒤에 쓰는 것은 결정의 `actual` 하나뿐(HL-3).

## HL-2 원천

| 원천 | 기록 | 심각도 |
|---|---|---|
| ① 플레이어 명령 전부(`gameReducer` → `recordDecision`) — 봇 명령도 같은 길 | 일상 7종(건설·길·구역·집 합치기/헐기·공사 취소·가동·성벽 우선)은 계절마다 종류별 한 건(`decision.bundle`, 횟수). 큰 결정 5종(시장도시 선포·석벽 선포·대기근 대응·청원 응답·재건)은 각각 한 건, 대안·예측 포함 | 일상 0 · 큰 결정 1 |
| ② F0-B 사건·F0-C1 시대 | 사건 줄(소문·징후·도래·회복, 원인 = 사건), 시대 진입, 장 끝 | 소문·징후 1 · 도래·회복 2 · 시대·장 끝 3 |
| ③ 이정표 | 첫 우물·곡창·방앗간·헛간·시장·예배당·교회·제재소·채석장·석공장, 시장도시, 석벽 도시, 첫 L4, 필지 6·12·24(표본 틱마다 확인, 한 번씩) | 1 |
| ④ 계절 결산 | 계절마다 결산 한 줄(인구·증감·수입·지출, 128² 축소판). 큰 변화: 인구 ±5 % 이상, 금고 수지 부호가 바뀜, 이탈 가구 | 결산 0 · 큰 변화 1 |
| ⑤ 가구 생애(가구 id, PERSON-0 뒤 가구주에게 귀속) | 입주·승급·하락·떠날 준비·남음(준비 거둠)·이탈·빈 집에 새 가구·화재 피해(원인 = 그 화재)·복구·흩어짐·굶기 시작·다시 먹음·우물 물 닿음/잃음·식구 늘/줄 | 화재 피해·이탈·흩어짐 1 · 나머지 0 |

## HL-3 결정의 대안·예측·실제

- 큰 결정 5종은 `decision {chosen, alternatives, predicted, actualDueTick}`을 갖는다. 예측 지표(같은 키로 실제를 읽는다):

| 결정 | 대안 | 예측 키 | 예측 |
|---|---|---|---|
| 대기근 대응 | 나머지 3 대응 | population · treasury | 방관 이탈 2가구 · 투기 3가구(가난한 1/4 한도), 구휼 금고 − 지난 계절 수입 × 2 · 투기 + 수입 ÷ 2 |
| 청원 응답 | 나머지 2 응답 | treasury · merchantGauge | 응답 결과표(FC-3)의 금고·게이지 |
| 석벽 선포 | 미룸 | treasury · lots | 금고 − 석벽 사업비, 필지 그대로 |
| 시장도시 선포 | 미룸 | population · lots | 선포 직후 값 유지 |
| 재건 | 그대로 둠 | population | 인구 유지 |

- 실제: 결정 2계절(2,000틱) 뒤 원장이 같은 키로 `actual`을 채운다(`pendingActuals`). 기록 수는 늘지 않는다.

## HL-4 심각도

0 일상 · 1 이정표·큰 결정·큰 변화 · 2 사건 · 3 시대. 조회 필터 `severity`는 "그 이상".

## HL-5 지도 축소판 (`src/engine/historySnapshot.ts`)

- 계절 끝마다 128×128, 시대 진입·장 끝은 256×256. 엔진 쪽 순수 래스터라이저(렌더 파일 무관): 타일 한 칸을 (크기 ÷ 지도 폭)² 픽셀로, 팔레트 색인 13종(풀·숲·물·바위·길·집·건물·공사·주거 구역·경작 구역·불탄 집·성벽·빈 집).
- 저장: 줄 단위 run-length + base64 문자열. `history.snapshot(state, id)`가 색인 배열로 푼다.

## HL-6 연대기 한 쪽 = 원장

`chronicleEntry`(FC-5)는 원장에서 만든다(`chapterPageRecords`): 장 범위의 사건·시대 기록(심각도 2 이상) 가운데 심각도 → 시간순 상위 8개, 결정 인용은 대안·예측을 가진 큰 결정을 대기근 대응 → 청원 응답 → 시장도시 선포 → 석벽 → 재건 순으로 3개. 각 줄은 `recordId`로 원장 기록을 가리킨다.

## HL-7 조회 API (`history`)

- `history.query(state, {kinds?, severity?, actors?, range?})` — 오래된 순. 10,000건에서 5 ms 미만(H8).
- `history.snapshot(state, id)` → `{size, tick, pixels}` 또는 null.
- `history.summary(record)` · `history.date(record, state)`.

## HL-8 저장 v15

`GameState.history?: HistoryState {records, snapshots, nextOrdinal, seasonDecisions, milestones, pendingActuals}`. v14 → v15 이관은 판 번호만(원장은 첫 틱부터 쌓인다 — 소급하지 않는다).

## HL-9 봇·시뮬레이션 무변경

원장은 규칙이 읽지 않는다. 가드레일 결과는 원장 전과 같아야 한다(관문 ④, 틱 성능 +3 % 이하).

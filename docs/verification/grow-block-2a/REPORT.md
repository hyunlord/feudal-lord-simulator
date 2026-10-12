# GROW-BLOCK-2a 보고서 — 마을 자동 동작 고침(엔진만)

관문: 통과(사용자 판정 2026-10-12) — 가드레일 2회차 5/5·새 기준선 `baseline-096eb86`, seed 1–20 성장이 본선과 같거나 낫다(10년 넘게 멈춘 seed 10 → 7, 그루터기 최대 886 → 800, 목책 없는 seed 4 → 1), 식량 관문은 아래 기준으로 통과(seed 9·2는 원래 있던 약점으로 기록).

- **지시**: 사용자 판정 2026-10-10(2a·2b 나누기, ①②), 2026-10-11(③⑥ 영주 모드, 밭 상한, 데이터 규칙 하나), 2026-10-12(식량 관문 기준, 푸시).
- **결정**: GB2A-1~GB2A-7, GB2A-G(가드레일·기준선).
- **남긴 것**: 밭이 집터를 덮는 seed 3은 GROW-BLOCK-2b, 특허 목재·교회 돌 대기는 A안 묶음.

## 만든 것
| 결정 | 무엇 | 범위 |
|---|---|---|
| GB2A-1 | 빈 목책 탐색은 실패로 남긴다. 선포 규칙이 받아들일 가장 가까운 성벽(`ruledCharterWall`)이 있으면 그 경로를 요청에 싣는다 | 영주 모드 |
| GB2A-2 | 처음 마을 자리는 지도 가장자리에서 12칸 띄운다. 그런 자리가 없으면 옛 규칙 | 둘 다 |
| GB2A-3 | 자재 공급자(사슬의 첫 빈 고리, 입력이 밀린 생산자)의 건설 목재를 성벽이 가져가지 않는다(`supplierKeep`, 데이터에서 읽음) | 영주 모드 |
| GB2A-4 | 통나무가 한 창 몫(137) 넘게 쌓이면 벌목장 대신 제재소, 제재소당 벌목장 최대 둘 | 영주 모드 |
| GB2A-5 | GB-8(느린 특허 목재 주문)은 영주 모드 것 | 영주 모드 |
| GB2A-6 | 경작지는 집터당 9.6칸에서 멈춘다(보리 포함) | 둘 다 |
| GB2A-7 | 읽기 모델 `growthBlock`(아래 모양) | 영주 모드 |

## 관문 결과

### 가드레일 — DGX
| 실행 | 결과 | seed 1 | seed 2 | seed 3 | seed 4 | seed 5 | 사람 경로 |
|---|---|---|---|---|---|---|---|
| 1회차 `engine-GROW2a-guard-439ee50` | 3/5 | **밭 248칸** | **L4 17/24** | 통과 | 통과 | 통과 | 12/12 |
| 2회차 `engine-GROW2a-guard2-096eb86`(올리는 코드) | **5/5** | 372,667 | 281,540 | 299,309 | 281,572 | 333,724 | 12/12 |

- 1회차 seed 2: 새 배치에서 둘째 교회 자리 123곳이 모두 서비스 공간 규칙에 막혔다. 같은 상태를 본선 코드에 넣어도 같은 123곳을 거부했다(`engine-GROW2a-seed2-154e05f`). 그래서 ③⑥을 영주 모드로 좁혔다(사용자 판정).
- 2회차와 `baseline-11205c9`: seed 1·2·4는 끝 틱과 지표가 같다. seed 3은 끝 틱 +123(밭 164 → 142칸), seed 5는 599,642 → 333,724(승리 틱 128,941 → 98,430, 밭 184 → 210칸). 경고 최대 3. 숫자는 실행 결과이며 역산하지 않았다.
- 1회차 seed 1: 밭이 248칸으로 상한 230.4를 넘었다(GR1과 같은 원래 있던 버그). GB2A-5·6으로 고쳐 2회차는 208칸이다.

### 영주 모드 성장 — DGX
seed 1–20은 60년, seed 21–40은 30년. 2a는 `engine-GROW2a-final-bdf07e1`, 본선은 `engine-GROW2a-base-final-26e53ed`.

| | 10년 넘게 멈춘 seed | 그루터기 최대 | 목책 해 중앙값/최대(년) | 목책 없음 |
|---|---|---|---|---|
| 본선 seed 1–20 | 10 | 886 | 8 / 12 | 9·12·14·17 |
| 2a seed 1–20 | 7 | 800 | 7 / 10 | 14 |
| 2a seed 21–40 | 7 | 793 | 7 / 9 | 26·31·36 |

- seed 1–20 판정은 3·9를 빼고 셌다(사용자 판정).
- 밭 상한(9.6칸)은 영주 모드 40 seed 어디에서도 닿지 않았다. 밀밭 한 칸의 밀 25.8–27.9, 보리 몫 14 % 이하.

### 식량 — 기존 기록으로 판정(새 실행 없음)
- **seed 1–20**: 본선과 식량 부족 철 수를 비교했다.
  - 같음: 2·9를 뺀 나머지. 나아짐: 5(21 → 15), 17(33 → 23), 18(21 → 20).
  - seed 2(38 → 68): 가장자리 집 4채에 빵이 닿지 않음. 밀은 필요의 1.24배. 60년 인구는 661로 본선과 같다. 알려진 약점으로 기록.
  - seed 9: 2a에서 목책이 섰다(본선은 60년 동안 안 섬). 그래서 마을이 달라 철 수를 비교하지 않는다(사용자 판정). 1330–1348 인구 608 → 489의 원인을 기존 해마다 기록으로 봤다.
    - 2a가 바꾼 규칙은 배제: 밀 여유 1.25–1.47, 경작지 136칸(상한 182칸에 안 닿음), 벌목장 2·제재소 5 그대로, 성벽 공사장 없음.
    - 남은 후보 둘은 모두 원래 있던 약점이다: 배급 거리 밖 집에 의한 식량 결정 멈춤, 또는 방앗간·운반 부족. 진단은 푸시 뒤 DGX에서(1330 저장).
- **seed 21–40**: 본선을 새로 돌리지 않는다. 2a가 바꾼 규칙이 이 seed들의 시작 자리(GB2A-2)부터 바꿔 본선 판과 같은 마을이 아니고, 본선 판을 돌리면 DGX 한 줄을 오래 잡는다(사용자 판정).
  - 기준: **식량 부족이 까닭인 인구 감소가 10년 안에 15 %를 넘은 seed가 없다.** 넘는 seed가 있으면 seed 9와 같은 방식으로 원인을 본다.
  - 넘은 seed: 24(1304–05, −35.2 %), 36(1302–06, −22.3 %), 37(1304–05, −16.9 %), 31(1308–18, −17.9 %).
  - 24·36·37은 초반 촌락 감소다(밭이 인구보다 늦게 는다). 같은 기준으로 본선 seed 1–20에서 seed 5(−36.8 %)·15(−27.4 %)가 이미 넘고, 2a의 seed 15는 본선과 같다. 원래 있던 패턴으로 통과(사용자 판정).
  - 31은 시작 자리가 지도 가장자리로 돌아간 촌락이다(알려진 문제에 기록). 통과(사용자 판정).

## growthBlock 모양(렌더 A의 LS1-3용)
`src/engine/growthBlock.ts`:
```ts
export function growthBlock(state: GameState): GrowthBlock | null   // 영주 모드 밖이거나 자라는 중이면 null
export interface GrowthBlock { readonly reason: GrowthBlockReason; readonly detail: string | null; readonly since: number | null; readonly lever: GrowthLever | null; }
export type GrowthBlockReason = "era_condition" | "charter_search" | "wall_not_found" | "charter_asked" | "wall_building"
  | "service_missing" | "service_outside" | "food" | "no_lots" | "town_full";
export type GrowthLever = { kind: "order_timber" } | { kind: "subsidy"; building: BuildingKind } | { kind: "wall_priority" }
  | { kind: "answer_request" } | { kind: "draw_wall" };
```
- 보는 순서: 특허 계획(못 채운 조건 → `era_condition`, 요청 → `charter_asked`, 실패 → `wall_not_found`, 조건 다 채움 → `charter_search`) → 목책 공사장(`wall_building`) → 빵 없는 집(`food`) → L4 아래 집에 모자란 교회·시장(`service_missing`·`service_outside`) → 성 안 빈 집터 0(`no_lots`) → 24채 모두 L4(`town_full`).
- `detail`: 조건 키(`timber`·`stone`…), 서비스(`church`·`market`), 실패 까닭, 탐색 단계, 공사장의 멈춤 까닭.
- `lever`: 영주의 기존 명령만. `order_timber` = 목재 구매, `subsidy` = 그 건물 공사 보조(교회 돌이 모자라면 석공소 → 채석장 중 먼저 없는 것), `wall_priority` = 목책 우선, `answer_request` = 요청 카드, `draw_wall` = 영주가 직접 긋기. 명령이 없으면 null(`charter_search`·`no_lots`·`town_full`).
- `since`: 지금은 늘 null. v56(TRACE-LINK)에서 저장 칸과 함께 채운다.

## 알려진 문제(STATUS에 기록)
- seed 9: 목책 뒤 1330–1348 빵이 닿지 않아 608 → 489.
- 초반 촌락 식량 감소: 본선 seed 5·15, 2a seed 15·24·36·37.
- seed 2: 가장자리 집 4채에 빵이 닿지 않음.
- seed 31: 시작 자리가 지도 가장자리.
- 배급 거리 밖 집 하나가 식량 결정 전체를 멈춤.

## 필수 조건
- **typecheck**: 통과 — Mac(본선 병합 뒤).
- **바뀐 파일에 걸린 시험**: 4,147/4,165 통과(519개 파일, 나머지는 건너뜀) — DGX `engine-GROW2a-tested-bb60cab`.
- **check:merge**: 푸시 훅 — Mac.
- **기하(바뀐 줄)**: 21줄 410칸, 실패 0, 못 연 조건 0 — DGX `engine-GROW2a-geometry2-edc9256`(RR26 trailer). 엔진 파일이 import로 화면에 닿아 특허 계획·상태 알약·식량·막힌 물자·목표·장부·요청 줄을 쟀다. 첫 실행 `engine-GROW2a-geometry-edc9256`은 작업 트리의 추적 안 된 탐침 결과 47개를 dirty 입력으로 세어 check:merge가 거부했고, 결과 파일을 트리 밖으로 옮겨 다시 돌렸다.
- **가드레일**: 위 표 — DGX `engine-GROW2a-guard-439ee50`·`engine-GROW2a-guard2-096eb86`.
- **영주 모드 성장 판**: DGX `engine-GROW2a-final-bdf07e1`·`engine-GROW2a-base-final-26e53ed`.

## 다음(푸시 뒤, DGX 한 번에 한 줄)
1. seed 9 진단(1330 저장): 식량 결정 진단, 방앗간·곡창 수, 수레, 일꾼 배정. 후보 둘을 가른다.
2. seed 1–3 × 125년(저장 포함).
3. 멈춤 까닭 표(실행 없음)와 다음 묶음 순서 제안.

# 벽시계에 기대는 시험 — 전수 조사(2026-10-01)

- 사용자 지시(2026-10-01): 벽시계에 기대는 시험을 모두 찾아 ① 가짜 시계·틱 수 기준으로 바꿀 것과 ② 성능을 재려는 것이라 회귀 시험에서 빼고 성능 추이(DGX 커밋별)로 옮길 것으로 나눈다. ①은 고치고 ②는 옮긴다. 게임 코드를 고쳐야 하는 것은 엔진·렌더 몫으로 목록만 둔다.
- 결정 RR9. 앞선 조사는 [CODE-1c 목록](code1c/real-clock-tests.txt)(2026-09-27)이다. 그때 "성능 예산이라 그대로 둔다"고 한 CHRON-1·H8이 이번에 떨어져 ②로 옮겼다.

## DGX 부하로 떨어진 기록

| 언제 | 시험 | 까닭 | 지금 |
|---|---|---|---|
| 2026-09-27 이전 | 키보드 바인딩·땅 청크·성벽 미리 불러오기·seasonArt | 실제 `performance.now()`·200 ms 타이머 | 가짜 시계(TEST-1·CODE-1c·UI-6c) |
| BOT-4 1회차, FIX-11, 2026-10-01 정리 클론 | `growthStateRecord` 자연 시작 기록(240틱) | 20초 벽시계 예산(실제 23~27초) | ① 고침 |
| FIX-11 | `wave26HouseVariants` 프레임 캐시 | 50·100·0.5 ms 예산 | ② 옮김 |
| 2026-10-01 정리 클론 | `chronicleScreen` CHRON-1 30,000건 | 120 ms 예산(실제 701 ms) | ② 옮김 |

## 찾은 방법

- `tests/**`에서 `performance.now()`·`Date.now()`·`process.hrtime`·`new Date()`·`setTimeout`·`setInterval`·`sleep`·`waitForTimeout`·`timeout:`·예산 낱말(wall-time·budget·elapsed·watchdog)을 찾았다.
- 시험이 부르는 `src`의 시계 자리도 모두 찾았다: `performance.now()` 57곳(25개 파일, `graft grep`).
  - 그 가운데 **일의 양을 시간으로 자르는 곳**(시간 예산)을 골라, 그걸 부르는 시험의 판정이 시계에 따라 달라지는지 봤다: 땅 장면 단계 빌드, 저장 조각, 걷는 사람 칸.

## ① 가짜 시계·틱 수 기준으로 고친 것

| 시험 | 시계에 기대던 곳 | 고친 것 |
|---|---|---|
| `tests/growthStateRecord.test.ts` "recording the natural opening preserves existing driver results" | 240틱에서 멈춰야 하는데 20초 벽시계 예산이 먼저 다 되면 `wall-time-budget`로 멈췄다 | 멈춤은 틱 예산이 판정한다. 벽시계는 걸림 울타리로만 두고 5분(자식 울타리 다섯 배)으로 늘렸다. 바로 위 감시 시험(멈추지 않는 자식을 5초 벽시계가 멈추는지)은 벽시계 멈춤 자체가 판정이라 그대로 둔다 |
| `tests/villageLife.test.ts` 마을 생활 캐시 | 두 번째 호출이 첫 번째보다 빠른지(`cachedMs <= scanMs`) | 캐시를 정체성으로 본다: 같은 상태·같은 화면이면 같은 배열, 새 상태 객체라도 같은 배열이면 같은 배열, 집 배열이 새로우면 새로 훑음 |
| `tests/groundSceneIncremental.test.ts` SMOOTH-2R 단계 빌드 셋 | 프레임마다 4 ms 예산을 실제 시계로 써서, "여러 프레임에 걸쳐" 지은 프레임 수가 기계 속도에 달렸다(빠른 기계에서는 한 프레임에 끝날 수 있음) | 시험 동안 `performance.now()`를 읽을 때마다 1 ms씩 가는 셈 시계로 바꿨다. 어디서나 27프레임 |
| `tests/engineFrameBudget.test.ts` FB-2 나눠 쓰는 자동 저장 | 저장 조각(`SAVE_SLICE_MS`)을 실제 시계로 잘라, 빠른 기계에서는 한 조각에 끝나 `paces >= 1`이 떨어질 수 있었다 | 같은 셈 시계 |

## ② 회귀 시험에서 빼고 성능 추이로 옮긴 것

시험은 이제 결과(만든 것이 맞는지)만 보고, 시간은 `tests/helpers/codeBudget.ts`로 넘긴다. DGX 추이 실행(`scripts/perf/trendRun.ts`)이 커밋마다 그 커밋의 트리에서 세 시험 파일을 세 번 돌려, 예산마다 중앙값을 [성능 추이](perf-trend/README.md)의 "코드 시간 예산" 표에 적는다. 예산을 넘으면 "예산 넘음"이고, 같은 줄에 다른 일 CPU를 함께 적는다(참고, 결정 RR9).

| 예산 | 시험 | 예산 |
|---|---|---|
| CHRON-1 연대기 30,000건 열기(행·표식·인물·첫 카드, 세 번 중 최선) | `tests/chronicleScreen.test.ts` | 120 ms(목표 200 ms) |
| H8 기록 10,000건 질의(다섯 번 중 최선) | `tests/historyLedger.test.ts` | 5 ms |
| INSTALL-26 집 400채 항목 / 그림 배정 / 같은 입력 프레임 / 새 집 배열 프레임 | `tests/wave26HouseVariants.test.ts` | 50 / 100 / 0.5 / 50 ms |

## 그대로 둔 것(벽시계로 판정하지 않음)

- **자식 프로세스 걸림 울타리**: `tests/helpers/childGuard.ts`의 60초(FIX-7 결정 FX7-4).
  - 끝난 자식은 바로 통과한다. 걸림만 막는다.
- **node:test 울타리**: 브라우저 증명 45초, 목록 확장 시험 600초.
- **`setTimeout(0)`**: 이벤트 루프를 한 번 비우는 것이라 시간과 무관하다.
  - 해당 시험: `wave26HouseDraw`·`wave30PairHouseDraw`·`wave32GranaryDraw`·`leak1PresentedState`.
- **시간을 재서 찍기만 하는 시험**: 판정 없음.
  - 해당 시험: `countryside`·`warWorldProps`·`backyardDecals`.
- **이미 가짜 시계인 것**: CODE-1c 목록의 "already on an injected fake clock"과 같다.
- **`elapsedMs` 같은 이름의 고정 자료**: 증명 보고서 형식 시험의 입력값이다. 시계를 읽지 않는다.

## 게임 코드가 필요한 것(엔진·렌더 몫, 목록만)

| 몫 | 자리 | 무엇이 필요한가 |
|---|---|---|
| 렌더 | `src/render/wave26HouseArt.ts` `beginHouseVariantFrame` | 같은 입력이면 프레임을 다시 만들지 않는다는 것을 시간 없이 볼 길이 없다. 다시 만든 횟수나 프레임 정체성을 돌려주면, 시험이 ②로 옮긴 "같은 입력 프레임" 시간 대신 그것을 판정할 수 있다 |
| 렌더 | `src/render/walkerComposer.ts` `composedCell` | 칸을 10초(`STALE_MS`) 안 그리면 실제 시계로 내보낸다. 지금 시험은 그 안에 끝나 위험이 낮지만, 시계를 넣을 수 있게 하면 결정적이 된다 |
| 렌더 | `src/render/groundBoundaryScene.ts` `advanceBuild` | 단계 빌드의 4 ms 예산이 전역 `performance.now()`다. 시험은 지금 전역을 바꿔 끼운다. 시계를 넣을 수 있게 하면(`createGroundChunkCache`처럼) 전역을 건드리지 않아도 된다 |
| 엔진 | `src/save/saveService.ts` `encodePaced` | 저장 조각 시간이 전역 `performance.now()`다. 위와 같다 |

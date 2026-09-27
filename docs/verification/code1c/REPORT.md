# CODE-1c 표현 워커 이동·App 분리·문구 이전·가짜 시계 — 보고서

관문: 통과 — 5배속 pop176 React 커밋 25.2 → 2.4 / 초(9.5 %), 프레임 작업 p95 3.8 → 3.9 ms(102.6 %, 틱은 13 → 15 / 초) · 결정론 불변(DGX 전체 회귀 3,236/3,236, C25 재기록 없음) · 스킨 감사 0 / 714 · UX-3 회귀 세트 통과(면적: 첫 실행 1280 평소 6.1 % / 6 % 한 번, 다시 재면 세 번 모두 5.9 % = 본선) · 병합 전 검사 · 클론 `9ff76d5` 3,236/3,236

## 1. 표현 워커 → `render/presentation/`
- `src/ui/residentTrips.ts` → `src/render/presentation/residentTrips.ts`, `src/state/residentWalkerState.ts` → `src/render/presentation/residentWalkerState.ts`.
- 스토어는 이제 시뮬레이션 상태 그대로를 낸다. 화면이 그리는 상태(그 틱의 주민 워커를 더한 것)는 `render/presentation/presentedState.ts`가 상태 객체마다 한 번 만든다(WeakMap). 캔버스, UI 채널, 모달이 같은 값을 나눠 쓴다.
- `src/state`·`engine`·`population`·`economy`·`zones`·`world`·`save`·`ledger`에서 `ui`·`render`를 가져오는 곳은 `population/marketAccess.ts` 하나만 남았다(CODE-1a, 엔진 세션).

## 2. App 분리와 구독
- **스토어가 React 밖으로**(`src/state/gameStore.ts`): 공급자는 틱마다 다시 그리지 않는다. 채널 둘이다.
  - `subscribe`: 모든 변화(틱·행동·속도). 캔버스(런타임의 ref), 틱 관찰자(창고 기록·분배꾼 경로·인구 기록·완공 알림), 자동 발전(켰을 때만)이 쓴다.
  - UI 채널(`useGameUiSelector`): 행동은 곧바로, 커밋된 틱은 250 ms에 한 번까지(마지막 틱은 반드시). 순수 단위 `src/state/uiChannel.ts`, 가짜 시계 시험 `tests/uiChannel.test.ts`.
- **컴포넌트별 구독**
  - `GameCanvas`: 지도는 스토어에서 매 틱 그린다. 컴포넌트는 카드(선택·호버)가 떠 있을 때만 상태를 읽는다.
  - `SpeedSeals`: 자동 발전을 켰을 때만 매 틱.
  - `ui/screens/AppModals`: 모달이 떠 있을 때만.
  - App: UI 채널(초당 네 번까지).
- **표현 시계**(100 ms): 이제 무언가 시간에 맞춰 보일 때만 돈다 — 튜토리얼 진행·배너·"완료" 유지, 시대 선포 의식, 완공 알림. 이야기 칩은 시계 대신 다음 차례(지연 끝·머무름 끝·장 끝 연대기)에 타이머 하나로 깨어난다(`useStoryPresentation`). 시계가 쉴 때 렌더는 벽시계를 직접 읽어 도장이 낡지 않는다.
- **나눈 파일**: UI 상태 기계 `src/ui/stateMachine/`(`uiStateMachine.ts` 이동, `useUiStateMachine.ts` = 상태·Esc·모달 자동 정지), 입력 구독 `src/input/useAppIntents.ts`, 화면 `src/ui/screens/WelcomeScreen.tsx`(제목·저장 이어하기·방식 선택)·`AppModals.tsx`, 틱 관찰자 `src/ui/useTickObservers.ts`, 시계 `src/ui/usePresentationClock.ts`. App.tsx 821 → 555줄.
- **관문 측정**(`scripts/reactCommitPerf.mjs`, DGX, 본선 `5f7584a2` 대비, 번갈아 5회, rAF 16.7 ms인 회만): pop176 마을 5배속 10초 창.
  - React 커밋 25.2 → 2.4 / 초(9.5 %).
  - 프레임 작업 p95 3.8 → 3.9 ms(102.6 %), 중앙 3.6 → 3.8 ms. 같은 10초에 이 판은 틱을 13 → 15 / 초 더 돌렸다(메인 스레드가 비어서).
  - 반면 UI-KIT 성능(1배속 HUD·건설 서랍): p95 96.4 %·98.1 %, 연대기 열기 98 → 97 ms([perf.json](gates/perf.json)).
  - [commit-perf.json](commit-perf.json).

## 3. 문구 이전(상위 20파일)
- 렌더·UI 파일 중 한글 문자열이 많은 20개에서 문구를 `*.ko.ts`로 옮겼다. 모두 0줄(보이는 글자 그대로). 목록은 [korean-literals-moved.txt](korean-literals-moved.txt).
  - `aQuadruplePrimeWallCopy.ts`는 원래 문구 파일이라 `wallDraftCopy.ko.ts`로 이름만 바꿨다.
  - `renderStageProbe.ts`(증명 모드 벤치 표의 단계 이름, 플레이어에게 안 보임)는 건너뛰고 다음 파일을 넣었다.
- 남은 파일 목록: [korean-literals-remaining.txt](korean-literals-remaining.txt)(CODE-1b의 병합 전 검사 목록 재료).
- 이 부분과 4절은 하위 에이전트가 따로 작업 가지에서 했고, 병합해 함께 검증했다.

## 4. 실제 시계 시험 → 가짜 시계
- 검토의 grep에 걸린 8파일: 셋은 이미 가짜 시계였다(`inputIntents`, `phase12PublishedProofRuntime`, `touchGamepadInput`).
- 셋을 바꿨다.
  - `buildingGrounds`: TEST-1처럼 `createGroundChunkCache(factory, clock)`.
  - `inputIntentBoundary`: 번역기에 선택 인자 `now`(기본 `performance.now`, 게임은 그대로).
  - `stoneWallAssetLoading`: 실제 200 ms 타이머 대신 다음 매크로태스크.
- 둘은 시간 예산 자체가 관문이라 벽시계로 남겼다: H8(`historyLedger`, 5회 중 최선 < 5 ms), CHRON-1(`chronicleScreen`, 이제 3회 중 최선 < 120 ms). [real-clock-tests.txt](real-clock-tests.txt).

## 5. 검증
- DGX 전체 회귀 `e5ddcc2`: typecheck, 3,236/3,236(C25 판 시험 포함, 재기록 없음).
- DGX UI 관문 `e5ddcc2`, 본선 `5f7584a2` 대비.
  - 스킨 감사 0 / 714(19개 상태), 본선도 0([audit.json](audit.json)).
  - 튜토리얼 22 = 22, B9·TOUCH 14/14, 터치 대상·글자 위반 0, 패드·포커스, 저장 거부 증명([gates.json](gates/gates.json)).
  - **면적: 첫 실행에서 1280×800 평소 화면이 6.1 % / 6 %로 한 줄 넘었다.** 같은 판을 세 번 더 재면 5.9 %, 본선도 5.9 %, 24/24 통과였다([hud-reruns](hud-reruns/)). 재현되지 않았고, 첫 실행은 감사·재생이 이어지는 긴 실행의 중간이었다. 원인은 찾지 못했다.
- 로컬: typecheck, lint, 관련 시험 179파일 1,312/1,314 → 원천 모양 시험 셋을 새 파일로 돌린 뒤 통과.
- 깨끗한 클론 `9ff76d5`: npm ci, typecheck, 3,236/3,236, build. 본선 FIX-5를 받은 병합 `b60b804`에서 다시 3,252/3,252, build. `npm run check:merge` 통과.
- 시간: 22:30(작업 가지 생성) → 23:55(마지막 클론 통과, KST 벽시계), 약 1시간 25분.

## 6. 결정
CODE1C-D1~D6([결정 목록](../../decisions/README.md)).
- D1 UI 채널: 커밋된 틱은 UI에 250 ms에 한 번까지(행동은 곧바로), 지도는 매 틱.
- D2 표현 시계는 시간에 맞춰 보이는 것이 있을 때만. 이야기 칩은 타이머로 깨어난다.
- D3 주민 표현 워커는 `render/presentation`에서 상태마다 한 번(WeakMap).
- D4 시험 고정값: App 원천 모양 시험 셋(`onboardingUi` 둘, `eraConsoleModel` 하나)을 옮긴 파일(`usePresentationClock`·`useTickObservers`·`WelcomeScreen`·`useAppIntents`)로 돌렸다.
- D5 CHRON-1 시간 예산은 3회 중 최선(H8처럼).
- D6 문구: `aQuadruplePrimeWallCopy.ts` → `wallDraftCopy.ko.ts`, `renderStageProbe.ts`는 제외.

## 7. 다음 후보
- 면적 6.1 % 한 번(재현 안 됨) — 다음 긴 실행에서 다시 보이면 그때 사진으로 원인을 본다.
- UI 채널 주기(250 ms)는 사람 플레이 판정 대상이다. 5배속에서 틱이 초당 13~15번이었으니 1배속은 초당 3번 안팎(틱 간격 250 ms 넘음)이라 모든 틱이 그대로 갈 것이다(1배속 틱 간격은 따로 재지 않았다).

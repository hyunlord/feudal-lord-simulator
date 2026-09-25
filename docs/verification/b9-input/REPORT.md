# B9 입력 의도·플랫폼 계층·모바일/Deck 규칙 감사

관문: ①의도 · ②호버 0 · ③44/12 · ④회귀 · ⑤저장 경유 · ⑥클론 — 통과

범위: 렌더·UI·`src/platform`·`src/input`(신규)·`src/App.tsx`, 테스트·스크립트·문서.
- 엔진·구역·저장·콘텐츠·`src/state`는 0줄 바꿨다.
- 저장 시스템 `src/state/saveSystem.ts`도 그대로다. 그 대신 이 파일이 부르는 `openPlatformSaveStorage()`를 플랫폼 계층으로 돌렸다.

명세: [입력 의도·플랫폼 계층](../../design/input-intents.md). 결정: IN1–IN3, PL1–PL2.

## 관문 결과

| 관문 | 결과 | 증빙 |
|---|---|---|
| ① 모든 조작이 `InputIntent` 경유 | 정적 검사 위반 62 → 0 | `scripts/inputIntentBoundary.ts`, `tests/inputIntentBoundary.test.ts`, `intent-boundary-before.json` |
| ② 호버 전용 정보 0 | 9곳 → 0곳 | `hover-audit.md`, `tests/hoverOnlyInfo.test.ts` |
| ③ 44px·12px 위반 0 | 44px 미만 186 → 0, 12px 미만 선언 8 → 0 | `touch-audit-before/after.json`, `tests/touchTargets.test.ts` |
| ④ 기존 조작 회귀 | 13/13 단계 동일, C25 SHA 동일, 전체 2811/2811 | `input-replay.json`, `tests/c25Board.test.ts` |
| ⑤ 저장·불러오기가 `PlatformServices.storage`만 경유 | 정적 검사와 왕복 테스트 | `tests/saveStorageRoute.test.ts` |
| ⑥ 깨끗한 클론 | npm ci·typecheck·test·build 통과 | 아래 |

①의 세부:
- **정적 검사 규칙(oxc 파서):**
  - R1: DOM 입력 리스너는 `src/input`에서만 단다.
  - R2: 이벤트 객체를 함수에 넘기지 않는다.
  - R3: `on*` 처리기에 함수를 참조로 달지 않는다.
  - R4: 처리기가 도구·속도 setter나 dispatch를 직접 부르지 않는다.
- **전 62건:** R1 30, R2 21, R3 11. 해당 파일은 캔버스 런타임 5개(canvas 런타임·클릭·호버·구역 붓·이벤트 바인딩), `App.tsx`, BuildMenu·OverlayControls 등 UI 7개다.
- **후:** 0건.

④의 세부:
- **옛 빌드와 새 빌드에서 같은 입력 재생(`c33e32e` 대 B9):**
  - 도로 끌기;
  - 한 칸 클릭(놓기·지우기);
  - 도로 끌기 중 오른쪽 클릭 취소;
  - Esc, 왼쪽·가운데 끌기 이동;
  - 휠 확대·축소;
  - 오두막 배치, 오른쪽 클릭 공사 취소;
  - Space+끌기;
  - 구역 붓 칠하기·`]`·Z;
  - D 키 이동, 지도 개요 누르기.
- **비교한 것:** 단계마다 도로·건물·공사·구역·되돌리기 스택·카메라가 같다.
- **D 키 이동:** 벽시계 프레임에 따라 움직여서, 옛 빌드끼리도 조금 다르다. 이동량은 380.3 / 379.3 / 380.8px(옛 / 새 / 옛 재실행)다.

## 의도 번역 표 (요약, 전체는 명세 IN-2)

| 이벤트 | 의도 |
|---|---|
| 포인터 이동 / 캔버스 밖 | `point{screen}` / `point{null}` |
| 왼쪽 누름(구역 붓·목책 초안·도로) → 이동 → 뗌 | `strokeBegin{toolId}` → `strokeMove` → `strokeEnd`(캔버스 밖이면 `outside`) |
| Shift 클릭·다각형 모드 / 다각형 더블클릭 | `strokeBegin{zone, polygon}` / `confirm` |
| 도구 없음·Space·가운데 끌기(4px 넘음) | `pan{dx,dy}` (첫 이동 카메라에 고정) |
| 클릭(끌기 아님, Space 아님) | `select{world}` |
| 오른쪽 클릭 | `cancel{world}` |
| 휠 | `zoom{0.9 / 1.1, anchor}` |
| Esc · Z · [ ] · O · 1–4 | `cancel` · `undo` · `brushSize` · `problemView` · `overlayToggle` |
| Enter · Q/E · +/− · Space 탭 (신규) | `confirm` · `toolStep` · `zoom` · `pauseToggle` |
| WASD·방향키·가장자리 | 매 프레임 `pan` |
| 건설 메뉴 도구 / 구역 카드 / 속도 도장 / 지도 개요 | `toolSelect` / `toolSelect{zone:<종류>}` / `speed{0..3}` / `lookAt{tile}` |
| 창 포커스 잃음 | `focusLost` |
| 구역 붓 터치 1손가락 / 2손가락 | `strokeBegin/Move/End{zone}` / (붓 획 중이면 `cancel`) `pan` |

## 감사 목록 전/후

- **호버(`hover-audit.md`):**
  - 정보가 호버로만 보이던 곳이 9곳이었는데, 모두 선택·탭 경로를 붙여 0곳이 됐다:
    - 건설 카드 5줄, 다각형 안내, 인구 추세, 목재·석재 보유량 2칸, 장부 출처 안내;
    - 인장 툴팁 CSS;
    - 경관 장식 안내(캔버스 `title` → 칸을 선택하면 칸 위 알림);
    - 건물 원인 한 줄(선택 카드 머리에 같은 한 줄, UI-1).
  - 중복 `title` 5곳은 지웠다.
  - 건설 카드의 `onMouseEnter` 미리보기는 데스크톱 보조로 남겼다. 같은 내용이 탭으로도 나온다(허용 목록에 사유 기록).
- **44px(실측 12개 상태, 1280×800):**
  - 44px 미만 컨트롤: 186건(고유 40) → 0.
  - 지도 원인 아이콘 탭 반경: 15px → 22px(지름 44px). 겹치면 가장 가까운 아이콘을 고른다.
- **12px:**
  - 11px 선언 8곳을 12px로 올렸다. CSS 6곳(`--font-badge` 사용처 5, 원인 범례 1), 캔버스 2곳(원인 배지, 성문 기호)이다.
  - 실측 상태에서 12px 미만 글자는 전후 모두 0이다(11px 배지 요소가 측정 상태에 안 나왔음). 그래서 정적 검사로 막는다.

## 플랫폼 계층·해상도 배율·금화

- **`PlatformServices`:**
  - `storage`: B8 `SaveStorage` + `ready()`.
  - `preferences`, `window`(DPR·크기·전체화면·render scale), `locale`, `input`(의도 흐름).
  - 웹 구현 1개(`webPlatform.ts`)와 테스트용 메모리 구현이 있다.
- **직접 호출을 옮긴 곳:**
  - `localStorage`: 환영 화면, 곡선 지면 플래그, 벽 띠 플래그.
  - `devicePixelRatio`: `resizeCanvas`.
  - 이제 `src/platform` 밖에서 부르는 곳은 0이다.
  - `src/state/saveSystem.ts`의 `requestIdleCallback`·`visibilitychange`(자동 저장 시점)는 범위 밖이라 남겼다.
- **해상도 배율:**
  - 설정 메뉴에서 "해상도 배율"로 0.75 / 1 / 1.25를 고른다.
  - 캔버스 내부 해상도 = CSS 크기 × DPR × 배율이다. 브라우저에서 1.25일 때 1280×800 → 1600×1000을 확인했다.
  - 지면 청크 키에 배율이 들어간다. 배율 1이면 키가 D1a와 같다(C25 SHA 동일).
- **"금화" 잔재:** `placementFeedback.ts`·`buildingInspectorModel.ts`의 `coin: "금화"`를 `돈`으로 바꿨다.

## 필수 조건

- 마지막 커밋 기준 전체 회귀 2811/2811, typecheck, build.
- 깨끗한 클론(npm ci)에서도 같다.
- 브라우저 재생(`scripts/inputReplayCompare.mjs`)과 실측(`scripts/touchTargetAudit.mjs`)은 Playwright 경로(`PLAYWRIGHT_MODULE`)를 받는 증빙 스크립트다. 테스트가 아니다.

## 다음에 넘길 것

- **터치 제스처(13.1 3항):**
  - 번역기를 하나 더 만들면 된다. 도구 없이 한 손가락 = `pan`, 핀치 = `zoom`, 탭 = `select`(배치는 유령 이동 → `confirm`), 길게 누르기 = `inspect`.
  - 지금 터치는 구역 붓만 예전 그대로 번역한다(`zoneTouchTranslator.ts`).
  - 처리기는 이미 의도만 받으므로 바꿀 필요가 없다.
- **컨트롤러:**
  - `controllerActions.ts` 표의 게임패드 열을 Gamepad API 번역기로 잇는다. 버튼 그림은 입력별로.
  - `select`에는 지도 커서가 필요하다. 지금 방향키는 카메라를 움직인다.
- **키보드 포커스:**
  - 버튼(예: 속도 도장)을 누른 뒤 포커스가 버튼에 남으면 지도 단축키(WASD·Q/E·Space·+/−)가 먹지 않는다. 예전 WASD와 같은 규칙이다.
  - 컨트롤러 포커스 순서를 만들 때, 지도 누름에서 포커스를 지도로 돌리는 것이 좋다.
- **UI 명령 버튼:** 패널 열기·저장·선포 확정은 DOM `click` 그대로다(결정 IN3). 컨트롤러 포커스 이동 작업에서 같이 본다.

## 소요 시간

2026-09-25 14:00 ~ 14:50, 약 50분.

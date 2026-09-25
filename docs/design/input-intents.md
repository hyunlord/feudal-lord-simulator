# 입력 의도·플랫폼 계층 (B9)

근거: B9 지시서, 설계서 13.1(모바일·Deck 규칙, `InputIntent`)·13.3(`PlatformServices`), AGENTS 상시 규칙 4.
코드:
- **의도·흐름:** `src/input/inputIntent.ts`(의도 타입), `src/input/intentBus.ts`(의도 흐름).
- **번역기:** `src/input/mouseKeyboardTranslator.ts`(마우스·키보드), `src/input/zoneTouchTranslator.ts`(구역 붓 터치).
- **DOM 수신:** `src/input/domInputBindings.ts`(DOM 입력 이벤트를 받는 유일한 곳).
- **컨트롤러:** `src/input/controllerActions.ts`(컨트롤러 액션 ID 표).
- **처리기:** `src/render/canvasIntentHandler.ts`(지도 처리기), `src/App.tsx`(앱 처리기).
- **플랫폼:** `src/platform/PlatformServices.ts`·`webPlatform.ts`·`memoryPlatform.ts`·`platform.ts`.

## IN-1 흐름

DOM 이벤트
→ 번역기(`src/input`)
→ `PlatformServices.input`(의도 흐름)
→ 처리기

- **번역기가 맡는 것(장치 상태):**
  - 어느 버튼이 눌렸는지;
  - Space를 누르고 있는지;
  - 4px 끌기 문턱;
  - 끌기 뒤 클릭 삼키기;
  - 누르고 있는 카메라 키, 가장자리 스크롤;
  - 키 배정.
- **번역기가 게임에 묻는 것:** "지금 무장된 그리기 도구"(`armed()`) 하나뿐이다. 그 밖의 게임 판단은 하지 않는다.
- **처리기 순서:** 지도(`INTENT_ORDER.world`) → 앱(`app`) → 메뉴(`menu`).
- **처리기 반환값:**
  - `"handled"`는 처리했다는 뜻이다. `preventDefault`의 근거가 된다.
  - `"consumed"`는 처리하고 뒤로 넘기지 않는다는 뜻이다. 구역 붓의 Esc가 자기 획만 지우고 도구를 유지하던 `stopImmediatePropagation`과 같다.
- **키보드 의도의 대상(`target`):**
  - 지도(`world`)·네이티브 컨트롤(`control`)·글 입력(`text`) 셋이다.
  - 지도 처리기는 `world`만 받는다(예전 `isCanvasKeyboardControl` 조건과 같다).
  - 앱 처리기는 목책 초안 Esc·Z를 `text`에서만 건너뛴다(예전 `editable` 조건과 같다).
- **점 좌표:**
  - `ScreenPoint`는 캔버스 CSS px이다.
  - `WorldPoint`는 카메라가 보는 아이소 평면 px이다(캔버스 = 월드 × 줌 + 이동).

## IN-2 번역 표 (이벤트 → 의도)

| 입력 | 조건 | 의도 |
|---|---|---|
| 포인터 이동 | 항상 | `point{screen}` (호버·미리보기·가장자리 스크롤, 표시 전용) |
| 캔버스 밖으로 | — | `point{screen:null}` |
| 왼쪽 누름 | 구역 도구, Space 아님 | `strokeBegin{zone, polygon:false}`. Shift·다각형 모드면 `strokeBegin{zone, polygon:true}`(꼭짓점), 다각형 모드 더블클릭이면 `confirm` |
| 왼쪽 누름 | 목책 초안 | `strokeBegin{palisade}`. 처리기가 거절하면 이동 끌기 |
| 왼쪽 누름 | Space 또는 도로 도구 아님 | 이동 끌기 시작(의도 없음) |
| 왼쪽 누름 | 도로 도구 | `strokeBegin{road}` |
| 가운데 누름 | — | 이동 끌기 시작 |
| 오른쪽 누름 | 도로 획 중 | 무시 |
| 이동 | 획 중 | `strokeMove{world}` |
| 이동 | 이동 끌기, 4px 넘음 | `pan{dx,dy}` (첫 이동 때 카메라에 고정: 지도 끝에 닿았다 돌아와도 예전처럼 따라감) |
| 뗌 | 획 중 | `strokeEnd{world}`, 캔버스 밖이면 `outside:true`(도로 없음) |
| 뗌 | 끌기가 4px 넘음 | 다음 클릭 삼킴 |
| 클릭 | 삼키지 않음, Space 아님 | `select{world}` (도구 있으면 배치, 없으면 선택) |
| 오른쪽 클릭(contextmenu) | — | `cancel{world}`: 목책 초안 취소 → 구역 획 취소 → 도로 획 취소 → 그 자리 공사 취소 순. 도로 획을 취소하면 그 누름의 나머지는 아무것도 하지 않음 |
| 휠 | — | `zoom{factor: 0.9 | 1.1, anchor}` |
| 창 포커스 잃음 | — | `focusLost` (키·버튼·Space 해제, 목책 끌기 마무리) |
| Esc | — | `cancel` (지도: 구역 획만 있으면 그것만 지우고 끝, 아니면 도로 미리보기·선택 해제. 앱: 목책 초안 취소 또는 모든 도구 해제. 메뉴: 분류 닫기) |
| Z | — | `undo` (구역 되돌리기 또는 목책 초안 되돌리기) |
| [ / ] | — | `brushSize{-1 / +1}` |
| O | 반복 아님, 글 입력 아님 | `problemView` |
| 1–4 | — | `overlayToggle{slot}` |
| Enter | 지도 | `confirm` (구역 다각형 닫기) — B9 신규 |
| Q / E | 지도 | `toolStep{-1 / +1}` (길 → 해금된 건물 순, 끝에서 돌아감) — B9 신규 |
| + / − | 지도 | 화면 가운데 `zoom{1.1 / 0.9}` — B9 신규 |
| Space 누름·뗌 | 지도 | 누르는 동안 왼쪽 끌기 = 이동(예전 그대로). 끌기 없이 떼면 `pauseToggle` — B9 신규 |
| WASD·방향키 | 지도 | 매 프레임 `pan` (가장자리 스크롤 포함, 이동 끌기 중 멈춤) |
| 건설 메뉴 도구 | — | `toolSelect{toolId}` (구역 붓은 `zone:<종류>` / `zone:off`, 반경·다각형 토글은 무장된 붓의 설정) |
| 지도 개요 누름 | — | `lookAt{tile}` (카메라 이동) |
| 속도 도장 | — | `speed{0..3}` (일시정지·1·3·5배속) |
| 터치 한 손가락(구역 도구) | — | `strokeBegin/Move/End{zone}` (다각형 모드면 꼭짓점) |
| 터치 두 손가락(구역 도구) | — | 붓 획 중이면 `cancel{world}`, 그다음 `pan` |

13.1 기본 12종 밖의 의도 8개는 모두 기기와 무관한 뜻이다:
- `point`
- `focusLost`
- `toolStep`
- `brushSize`
- `overlayToggle`
- `problemView`
- `pauseToggle`
- `lookAt`

## IN-3 컨트롤러 액션 ID (표만)

| ID | 의도 | 게임패드(나중) | 키보드 기본 |
|---|---|---|---|
| `cursor` | `pan` | 왼쪽 스틱·방향 패드 | 방향키·WASD (지도 커서가 아직 없어 카메라 이동 = 화면 가운데가 커서) |
| `select` | `select` | A | (키 없음, 클릭·탭) |
| `confirm` | `confirm` | A(제스처 중) | Enter |
| `cancel` | `cancel` | B | Esc |
| `tool_prev` / `tool_next` | `toolStep` | LB / RB | Q / E |
| `zoom_in` / `zoom_out` | `zoom` | 오른쪽 / 왼쪽 트리거 | + / − |
| `pause` | `pauseToggle` | 메뉴 | Space 탭 |
| `menu` | (예약) | 보기 | — |

지시서의 키보드 배정 중 두 가지는 기존 조작과 겹쳐서 이렇게 정했다(결정 IN2):
- **방향키 = 커서:** 지도 커서가 없으므로 카메라 이동으로 둔다.
- **Space = 일시정지:** Space를 누른 채 끄는 이동은 그대로 두고, 끌기 없이 떼는 탭만 일시정지로 한다.

## IN-4 정적 검사 (관문 ①)

검사 스크립트는 `scripts/inputIntentBoundary.ts`(oxc 파서)이고, 테스트는 `tests/inputIntentBoundary.test.ts`다.
- **R1:** DOM 입력 이벤트 리스너는 `src/input`에서만 단다.
- **R2:** `src/render`·`src/ui`·`App.tsx`에서 DOM·React 입력 이벤트 객체를 함수에 넘기지 않는다(객체 리터럴 안에 넣어 넘기는 것도 포함).
  - 허용 1: 필드 읽기.
  - 허용 2: DOM 전용 도우미에 넘기기. 이 도우미는 이벤트를 `preventDefault`·`stopPropagation`에만 쓴다.
- **R3:** 호스트 요소의 `on*` 처리기는 즉석 함수이거나, 이벤트를 받지 않는 지역 함수여야 한다. `onClick={onClose}`처럼 넘기면 이벤트가 그대로 전달된다.
- **R4:** 호스트 요소 처리기가 도구·속도 setter나 `dispatch`를 직접 부르지 않는다.
- **범위 경계:** 패널 열기·저장·선포 확정 같은 UI 명령 버튼은 DOM `click` 그대로다.
  - 이유: `<button>`의 `click`은 키보드(Enter·Space)·터치·포커스된 컨트롤러 확정에서도 똑같이 나오는, 이미 기기와 무관한 "활성화"다.
  - 의도를 거치는 것은 지도 조작 전부와, 13.1이 의도로 정한 도구 선택·속도·되돌리기다.

## IN-5 플랫폼 계층

`PlatformServices`는 다섯 가지를 담는다:
- `storage`: B8 `SaveStorage` 그대로에 `ready()`(어댑터 종류·영속 여부)를 더했다.
- `preferences`: 작은 문자열 설정이다. 예외를 던지지 않는다.
- `window`: DPR·크기·전체화면·render scale.
- `locale`
- `input`: 의도 흐름.

그 밖의 규칙:
- **웹 구현은 하나다:** IndexedDB 저장(안 되면 메모리)과 localStorage 설정. `localStorage`·`devicePixelRatio`·`navigator.language`·전체화면 API를 직접 부르는 곳은 이 구현뿐이다.
- **저장 경로:** `openPlatformSaveStorage()`가 `PlatformServices.storage`를 돌려준다. 그래서 저장 시스템(`src/state/saveSystem.ts`, 이번에 바꾸지 않음)의 저장·불러오기는 이 계층만 거친다.
- **업적·클라우드:** 제공하는 플랫폼이 생길 때 추가한다.

## IN-6 해상도 배율

- **설정:** 설정 메뉴에서 0.75 / 1 / 1.25를 고른다(`feudal.renderScale`, 기본 1).
- **캔버스 해상도:** 캔버스 내부 해상도 = CSS 크기 × DPR × 배율이다. 그리기 변환도 같은 곱을 써서 화면 크기는 그대로이고 해상도만 바뀐다.
- **청크 캐시 키:** 지면 청크 캐시 키에 배율이 들어간다. 배율 1이면 키와 픽셀이 예전과 같다(C25 판 SHA 동일).

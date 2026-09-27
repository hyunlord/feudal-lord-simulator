# UI-KIT-1 디자인 통일 — 보고서

관문: ①~⑥ 통과, ⑦ 사용자 판정 대기
- ① 스킨 없는 상호작용 요소 0 / 661(18개 상태). 본선은 307 / 481, 네이티브 컨트롤 7이었다.
- ② ESLint 금지 규칙 통과. 억제 122건 → 0건.
- ③ 갤러리 캡처: 데스크톱·태블릿.
- ④ 전후 캡처 9장.
- ⑤ 회귀 0: 면적 24/24, 튜토리얼 22 = 22, B9 14/14, TOUCH-1 14/14, 터치 대상·글자 위반 0, 패드·포커스.
- ⑥ 성능: HUD p95 97.9 %, 건설 서랍 100 %, 연대기 열기 79 / 89 ms. DGX 3,148/3,148.

**원인(지시서 그대로 확인):**
- 공용 부품이 없었다. UX-2 스킨(`uiSkin.css`)은 그때 있던 선택자에만 입혀졌다.
- 그 뒤 화면은 저마다 CSS를 짰다. 연대기 `<select>` 4개와 소리 `<input type="range">` 3개는 브라우저 기본 모양이었다.
- 본선에서 감사하면, 보이는 상호작용 요소 481개 가운데 307개가 UI 아트 없이 네모였다.

## 1. 만든 것 — [공용 부품 명세](../../design/ui-kit.md) KIT-1~KIT-5

**① 부품 `src/ui/kit/`:**
- `Button`: 변형 primary·secondary·quiet·danger·icon·toggle·tab·surface, 크기 sm·md·lg
- `IconButton`
- `Select`: 네이티브 없이 보조 단추 + 밝은 틀 목록. 키보드 ↑↓·Home·End·Enter·Esc·Tab, 스크린리더 `listbox`
- `Toggle`·`Checkbox`: 봉랍 인장
- `Slider`: 양피지 홈 + 인장 손잡이
- `Tabs`, `Chip`
- `Panel`·`Card`·`Modal`: 틀 light·dark·objective·advisor·modal·tooltip·record
- `Tooltip`, `Divider`, `Disclosure`
- 부품은 이벤트 객체를 넘기지 않는다: `onPress()`·`onPressAt(점)`·`isolate`.

**② 토큰:** 색·간격·글자·9-slice 폭·아트 값(`--art-*`)을 `uiSkin.css` `:root` 한 곳에 두었다. `uiKit.css`는 이 변수만 쓴다.

**③ 전수 적용:**
- 본선의 `<button>` 127개(`src/ui`·`App.tsx`·`src/render`의 React 화면) 중 124개를 `Button`으로, 소리 켜기·끄기 1개를 `Toggle`로 바꿨다.
- 셀렉트 4개 → `Select`, 소리 범위 입력 3개 → `Slider`, `<details>` 5개 → `Disclosure`.
- 전체 음량의 −·+ 단추 2개(기호가 아이콘을 대신함)는 밀대 하나로 바꿨다.
- 틀이 없던 판 셋에 틀을 입혔다: 상태 알약, HUD 판 자리(장부 서랍·목표 기록·inspector), 일시정지 판.
- 인물·사건 칩에 단추 아트를 입혔다.

**④ 금지 규칙:** REVIEW-1의 공유 규칙 `tools/eslint/uiControls.mjs`를 넓혔다.
- 대상에 `App.tsx`·`src/render`를 더했다.
- `button`·`select`·`input`에 `textarea`·`details`·`summary`를 더했다.
- 억제 목록을 비웠다.
- 루트에 따로 두었던 ESLint(Babel 파서)는 본선 병합 때 걷어 내고, 하나로 합쳤다(UIKIT-D3).

**⑤ 갤러리 `/dev/ui-kit`:** 모든 부품·변형·크기·상태·틀. 개발 화면이라 게임과 다른 조각으로 불러온다.

**⑥ 감사 `scripts/uiSkinAudit.mjs`:** 18개 UI 상태를 헤드리스로 열고, 요소마다 계산된 `border-image`/`background-image`가 UI 아트인지 본다. 출력은 스킨 없는 요소 목록(0이어야 통과)과 상태별 캡처 시트다. 실행은 `scripts/uiKitVerification.sh`.

**R4 보강:** 부품의 핸들러 속성(`<Button onPress>`·`<Select onChange>` …)에서도 `setSpeed`·`dispatch`를 부르면 R4 위반이다(`scripts/inputIntentBoundary.ts`).

## 2. 의존성 경고를 끈 곳 — 하나씩 확인

지시서는 23곳이라 했는데, 본선에서 센 것은 22줄이다. ESLint를 켜니 끄지 않은 곳에서 4건이 더 나왔다. 26곳을 모두 보고 **16곳만 남겼다**. 남긴 곳마다 윗줄에 `// why:` 이유를 달았다.

| 곳 | 처리 |
|---|---|
| 연대기 `timelineSegments`·`timelineChapters`·`seasonWindow`(`state.tick` 키, 매 틱 다시 계산) | 계절 시작 틱 키로 바꿔 없앰(UIKIT-D6) |
| 연대기 `chronicleYears` | 해 키로(끄기는 남김: 계절 안에서 목록이 같음) |
| 연대기 ResizeObserver `[personId === null]` | `onList` 값으로 없앰 |
| App 모달 자동 닫기 `[famineView === null …]` | 불린 값 + `sendUi`로 없앰 |
| App 구역 종류·되돌리기 기록 | `zoneTarget`·`zoneToolDown`으로 없앰(둘) |
| 튜토리얼 전환 정리 `[nowMs]` | 함수형 갱신으로 없앰 |
| 캔버스 런타임(새로 찾음, ref 12개 빠짐) | ref와 `interpolationAlpha`(스토어의 `useCallback`)는 정체가 안 바뀌어 넣어도 다시 묶지 않음 → 넣어서 해결 |
| 속도 조절(새로 찾음, `{kind:"none"}` 새 객체가 매 렌더 효과를 다시 돌림) | 모듈 상수로 고침 |
| 건설 서랍 요청(새로 찾음) | 끄기 남김: 요청은 도착할 때 한 번, `setCatalogOpen`은 매 렌더 새 전달자 |
| 이야기 표시 기록 효과(새로 찾음, 의존성 없음) | 끄기 남김: 매 렌더 의도, 새 이야기일 때만 다시 그림 |
| 연대기 행·사람·전기, 그때 지도 둘, 문장, 초상 크로스페이드, 튜토리얼 셋, 이야기 멈춤, App 프레임 측정, 기록 목록 스크롤 | 끄기 남김, 이유 기록 |

## 3. 관문 결과 (커밋 `a700c7e`, 본선 `7f7be2c7` 병합 뒤)

| 관문 | 결과 | 증빙 |
|---|---|---|
| ① 스킨 없는 요소 0 | 0 / 661(18개 상태: 타이틀·평소·건설 서랍·배치·구역·선택·인물 카드·전기·장부·연대기·목록 연 셀렉트·일시정지와 설정·청원·결정·결산·장 끝·갤러리 둘), 네이티브 0. 본선: 307 / 481, 네이티브 7 | [audit.json](audit/audit.json) · [시트](audit/sheet-desktop.jpg) · [본선](audit-base/audit.json) |
| ② ESLint 금지 규칙 | `npm run lint`(억제 없이 `src` 전체) 위반 0, `npm run check:merge` 통과(고정값 변경 0·새 예외 0·typecheck) | 아래 필수 조건 |
| ③ 갤러리 | 데스크톱 1280·태블릿 1180(터치) 모두 스킨 없는 요소 0 / 46 | [데스크톱](audit/g-gallery-desktop-full.jpg) · [태블릿](audit/g-gallery-tablet-full.jpg) |
| ④ 전후 캡처 | 연대기·설정(일시정지)·결산·인물 전기·장부 서랍·청원·결정·선택·타이틀. 왼쪽 본선, 붉은 선은 스킨 없는 요소 | [before-after/](before-after/) |
| ⑤ 회귀 | 면적 24/24(1280 평소 5.9 %, 장부 18.3 %), 튜토리얼 13단계 22 = 22, B9 입력 14/14, TOUCH-1 14/14, 터치 대상 44 px·글자 12 px 위반 0, 패드·포커스 통과 | [gates.json](gates/gates.json) · [hud-coverage.json](gates/hud-coverage.json) |
| ⑥ 성능(DGX) | 5회 번갈아, 전부 rAF 16.7 ms(유효). 프레임 작업 p95: HUD 4.7 / 4.8 ms = 97.9 %, 건설 서랍 4.7 / 4.7 ms = 100 %. 장부에서 연대기 열기(누름 → 첫 카드 그림) 중앙값 79 / 89 ms | [perf.json](gates/perf.json) |

**필수 조건(커밋 `a700c7e`):** DGX 전체 회귀 3,148/3,148, typecheck, build(갤러리는 따로 나뉜 조각), `npm run check:merge` 통과.

## 4. 결정

- **UIKIT-D1 표면:** 틀 두른 판·띠 안의 칸·행·카드 전체(알약 칸, 연대 띠·계절 칸, 기록 카드 본문, 장부 행, 미니맵)는 `surface`다. 스킨은 둘레의 틀이다.
  - 감사는 표면이 여섯 단계 안의 조상이나 자신을 덮는 형제 틀 겹(기록 카드의 Wave 19 틀) 안에 있으면 통과로 친다.
  - 그 판이 틀 없는 네모였던 곳(상태 알약·HUD 판 자리·일시정지 판)에는 틀을 입혔다.
- **UIKIT-D2 우선순위:**
  - 배치·글자색은 명시도 0(`:where`)에 둔다. 화면의 자리·흐름·색이 이긴다.
  - 스킨은 0-4-0에 둔다. 옛 화면 규칙(가장 높은 것이 0-2-1)이 지우지 못한다.
  - 처음에 배치까지 높은 명시도로 두었더니 대기근·청원 선택지의 격자가 깨졌다("수/락" 세로 쪼개짐). 그래서 나눴다.
- **UIKIT-D3 ESLint 하나:**
  - REVIEW-1이 같은 날 본선에 `tools/eslint`(자체 잠금, TS 6.0 파서, 공유 `uiControls.mjs`, 기존 위반 122건 억제)를 들였다.
  - 병합하며 이쪽의 루트 ESLint(Babel 파서)를 걷어 내고, 규칙을 공유 파일에 더했다. 억제는 0으로 가지치기했다.
- **UIKIT-D4 마크업 계약:**
  - 부품은 호출한 쪽 속성을 쓴 순서대로 그리고, 호출한 쪽 클래스를 맨 앞에 둔다. 부품만의 속성과 `title` 툴팁(호버 전용 정보)은 없다.
  - 클래스를 정확히 비교하던 마크업 시험 9개는 `ui-btn…`을 허용하도록 고쳤다.
  - 장부 시험은 부품의 `onPress`를 누르게 고쳤다. 호버 허용 목록은 부품의 `onHover` 한 곳과 그 사용처(건설 카드)로 바꿨다.
- **UIKIT-D5 전체 음량:** −·+ 단추(기호가 아이콘을 대신함)를 버스별 밀대와 같은 `Slider`로 바꿨다(10 % 단계 그대로).
- **UIKIT-D6 연대기 키:** 연대 띠·장 막대·계절 보기는 계절 시작 틱을 키로 쓴다(지시서 예). 띠의 "지금" 가장자리는 계절 단위로 움직이고, 지금 핀은 정확한 틱이다. 연대기가 열린 동안은 시간이 멈춰 있어 보이는 차이는 없다.

## 5. 사용자 판정 대기

- 전체 인상: 네모가 사라졌는지. [전후 캡처](before-after/)와 [갤러리](audit/g-gallery-desktop-full.jpg)를 보면 된다.
- 셀렉트 목록 판, 토글(홈 + 봉랍 인장), 체크 칸(둥근 인장), 밀대 손잡이의 모양. P0 아트가 없는 부분이라 코드로 그렸다.
- 새로 틀을 입힌 곳: 상태 알약(도움말 틀), HUD 판 자리(밝은 판 틀 10 px), 일시정지 판(대화 상자 틀). 인물·사건 칩은 보조 단추 아트다.
- 전체 음량 밀대(UIKIT-D5).

## 6. 다음 후보

- 일시정지 설정 줄: "색약 모드" 옆 설명이 다음 단추 밑으로 겹친다(본선부터 있던 배치). 이번에는 글자색만 고쳤다.
- 상호작용이 없는 판(예: 연대기 오른쪽 상세 판, 결산 카드 안 칸)은 감사 대상이 아니다. 틀 없는 판을 찾는 감사로 넓힐 수 있다.
- `scripts/chron1Captures.mjs`는 부품 셀렉트를 쓰도록 고쳤다(옛 `selectOption`).
- FIX-4 WIP의 UI 파일 다섯(초상 그림·결산 카드·튜토리얼 문구·연대기 모델·실루엣)은 이 작업에서 건드리지 않았다. 엔진 세션이 FIX-4를 병합할 때 충돌은 없을 것이다(사용자 지시: 충돌하면 UI-KIT-1 쪽 우선).

## 7. 커밋·시간

- **커밋:** 가지 `claude/uikit1-design-system`(본선 `ea30ffb0`에서). 본선 `7f7be2c7`(REVIEW-1·BOT-3·INBOX-1k/1l)을 양쪽 살려 병합했다.
- **DGX 환경:** 한 번 실패했다. 겹쳐 돌던 제 옛 실행 때문에 파일 감시 한도(`ENOSPC`)에 걸려 이 빌드의 Vite가 죽었다. 그 실행을 멈추고 다시 돌렸다.
- **시간:** 2026-09-27 14:38(가지 생성) → 푸시 시각은 푸시 뒤 커밋에 적는다.

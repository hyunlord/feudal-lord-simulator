# UI 공용 부품 명세 (UI-KIT-1)

지시서: UI-KIT-1 디자인 통일(사용자 판정: 연대기 등 몇몇 메뉴·버튼·셀렉트가 "그냥 네모"). 원인은 공용 부품이 없던 것이다. UX-2 스킨(`src/styles/uiSkin.css`)은 그때 있던 선택자에만 입혀졌고, 그 뒤 화면(연대기·소리 설정·결산·청원·인물 카드·장부 서랍)은 저마다 CSS를 새로 짰다. 결정은 [결정 목록](../decisions/README.md) UIKIT-D1~D6이다.

## KIT-1 부품 (`src/ui/kit/`, 화면은 `src/ui/kit`에서만 가져온다)

| 부품 | 무엇 | 아트 |
|---|---|---|
| `Button` | 변형 `primary`·`secondary`·`quiet`·`danger`·`icon`·`toggle`·`tab`·`surface`, 크기 `sm`·`md`·`lg`(없으면 화면의 배치 그대로), `tone="dark"` | P0 `button_primary_base`·`button_secondary_base`·`button_icon_square_base`·`tab_build_base`, quiet는 `divider_manuscript_*` 밑줄 |
| `IconButton` | 네모 아이콘 단추. `label`이 접근성 이름과 툴팁 | `button_icon_square_base` |
| `Select` | 네이티브 `<select>` 대신 보조 단추 + 밝은 틀 목록 | 단추 아트 + `frame_panel_light` |
| `Toggle` | 켜기·끄기(`role="switch"`): 양피지 홈 위 봉랍 인장이 미끄러진다 | 보조 단추 + 어두운 양피지 결 |
| `Checkbox` | 인장 모양 둥근 칸, 켜면 예측 시트의 확인 표시 | 밝은 양피지 결 + `icon_prediction_sheet` ok |
| `Slider` | 양피지 홈 + 봉랍 손잡이(부품 폴더 안에서만 `<input type="range">`) | 밑줄 + 코드 홈·손잡이 |
| `Tabs` | `tablist`, 고른 탭 `aria-selected`, ←·→로 옮김 | `tab_build_base` |
| `Chip` | 조건·수·꼬리표, `tone` ok·warn·block·info | `chip_condition_base` |
| `Panel`·`Card`·`Modal` | 틀 종류 light·dark·objective(완료·경고)·advisor(걱정)·modal·tooltip·record | `frame_panel_*`·`frame_objective_*`·`frame_advisor_*`·`frame_modal`·`frame_tooltip`·`toast_small` |
| `Tooltip`·`Divider` | 도움말 몸체, 원고 구분선 | `frame_tooltip`, `divider_manuscript_*` |
| `Disclosure` | `<details>`, 그 `<summary>`가 단추 아트를 입는다 | 단추 아트 |

- **KIT-1a 상태는 코드다:** 호버는 조금 밝게(그것만이 단서가 되지 않게), 누르면 1 px 가라앉고, 초점은 봉랍색 고리, 눌림·켬은 봉랍색 안쪽 선, 사용 불가는 회색이다.
- **KIT-1b 표면(`surface`):** 틀 두른 띠·판 안의 칸·행·카드 전체(상태 알약 칸, 연대 띠, 계절 칸, 기록 카드 본문, 장부 행, 미니맵)다. 둘레의 틀이 그 스킨이다. 부품은 상태만 더하고 화면의 채움(계절 칸 색, Wave 19 띠)을 지우지 않는다.
- **KIT-1c 입력 규칙(R2~R4, `scripts/inputIntentBoundary.ts`):** 부품의 핸들러는 이벤트 객체를 받지 않는다.
  - `onPress()`: 한 번 누름.
  - `onPressAt({clientX, clientY, rect, keyboard})`: 띠·지도처럼 어디를 눌렀는지가 필요할 때.
  - `isolate`: 누름이 뒤 요소(지도 위 모달)에 가지 않게 한다.
  - `onHover(bool)`·`onFocusChange(bool)`·`Select.onChange(value)`·`Disclosure.onToggle(open)`.
  - R4는 부품의 핸들러 속성에도 걸린다. 부품 안에서 `setSpeed`·`dispatch`를 부르면 호스트 요소와 같은 위반이다.
- **KIT-1d 마크업 계약:** 부품은 호출한 쪽 속성을 쓴 순서대로 그리고, 호출한 쪽 클래스를 맨 앞에 둔다(`class="map-overview ui-btn ui-btn--surface"`). 부품만의 속성은 없다. 부품은 `ui-*` 클래스로 알아본다.

## KIT-2 토큰 (`src/styles/uiSkin.css` `:root`)

- **색:** `--parchment`·`--parchment-light`·`--parchment-deep`·`--oak`·`--ink`·`--ink-soft`·`--seal-red`·`--seal-red-deep`·`--gold-rule`·`--status-*`
- **간격:** `--space-half`·`--space-1~3`
- **글자:** `--ui-font-sans`·`--ui-font-serif`·`--text-12~18`
- **9-slice 폭:** `--slice-*`
- **아트 값 전체:** `--art-button-*`·`--art-tab`·`--art-chip`·`--art-frame-*`·`--art-texture-*`·`--art-rule-*`

`src/styles/uiKit.css`는 이 변수만 쓴다. 토큰을 `.app-shell`에서 `:root`로 옮겨 모달·타이틀·갤러리도 같은 값을 읽는다.

**KIT-2a 우선순위:**
- 배치와 글자(`display`·정렬·크기·글자색)는 명시도 0인 `:where(.ui-btn…)`에 둔다. 화면의 자리·흐름·색(격자인 대기근 선택지, 붉은 부족 칸)이 이긴다.
- 스킨(채움·틀·모서리)은 `:root .ui-btn.ui-btn`(0-3-0)에 둔다. 옛 화면 규칙(가장 높은 것이 0-2-1 `.app-shell .era-console button`)이 스킨을 지우지 못한다.

## KIT-3 금지 규칙 (`tools/eslint/uiControls.mjs`, `npm run lint`)

- **공유 규칙:** 규칙원은 REVIEW-1의 `tools/eslint/uiControls.mjs` 하나다(병합 검사 `npm run check:merge`가 같은 것을 쓴다).
  - UI-KIT-1이 넓힌 것: 대상 파일에 `src/App.tsx`·`src/render/**/*.tsx`를 더했고, 금지 요소에 `<textarea>`·`<details>`·`<summary>`를 더했다(`<button>`·`<select>`·`<input>`은 원래 있음).
  - 예외는 부품 폴더 `src/ui/kit/`뿐이다.
- **억제 목록:** `tools/eslint/eslint-suppressions.json`에 REVIEW-1 때 있던 122건(금지 컨트롤 118, exhaustive-deps 4)을 모두 고쳐 0건이다. `npm run lint`는 `tools/eslint`의 ESLint로 억제 없이 `src` 전체를 본다.
- **훅 규칙:** `react-hooks/rules-of-hooks`·`exhaustive-deps`는 오류다. 남긴 경고 끄기마다 윗줄에 `// why:`로 이유를 쓴다(AGENTS 규칙 19).
- **파서:** `tools/eslint`는 자기 잠금 파일과 TypeScript 6.0으로 구문만 읽는다. typescript-eslint는 루트 TypeScript 7(JS 컴파일러 API 없음)을 쓸 수 없다.

## KIT-4 갤러리 `/dev/ui-kit`

`src/main.tsx`는 이 경로에서 게임 대신 `UiKitGallery`를 따로 불러 그린다(개발 화면이라 게임 번들에 들지 않는다). 모든 부품·변형·크기·상태·틀 종류가 한 화면에 있고, `.app-shell` 안이라 게임과 같은 스킨·글자·터치 하한을 받는다.

## KIT-5 스킨 감사 `scripts/uiSkinAudit.mjs`

- **여는 상태:** 타이틀·평소·건설 서랍·배치·구역·선택·인물 카드·전기·장부·연대기(목록을 연 셀렉트 포함)·일시정지와 설정·청원·결정·결산·장 끝, 그리고 갤러리(데스크톱·태블릿)다. 상태는 `scripts/ui5States.ts`의 것(결정론)이다.
- **통과 조건:** 보이는 상호작용 요소(`button`·`summary`·역할 button/tab/option/switch/checkbox/slider·링크·입력)마다 계산된 `border-image-source`나 `background-image`가 UI 아트(`/assets/ui-p0/`, `/assets/wave*/`)여야 한다.
  - 표면과 목록 항목은, 여섯 단계 안의 조상이나 그 자신을 덮는 형제 틀 겹(연대기 카드의 Wave 19 틀)이 아트를 입었으면 통과다.
  - 네이티브 `select`·`textarea`와 부품 밖 `input`은 실패다.
- **출력:** `audit.json`(상태별 수와 스킨 없는 요소 전부), 스킨 없는 요소에 선을 그은 상태별 캡처, 상태 시트. 스킨 없는 요소가 0이어야 통과(종료 0)다.

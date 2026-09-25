# UI 아트 스킨 — P0 틀·버튼·아이콘·커서·청지기·글꼴 (UX-2)

근거: UX-2 지시서(0-A절 UX-1이 넘긴 자리, 0절 재작업본), Astra UI P0 43장 + 재작업 14장 대장(`assets-inbox/ui-p0/`), 딥리서치 12 과제 F.
코드: `scripts/installUiArt.py`(설치·파생·매니페스트·대장), `src/ui/uiArtManifest.generated.ts`, `src/ui/uiArt.ts`·`src/ui/UiIcon.tsx`(아이콘·초상·캔버스 그리기), `src/styles/uiSkin.css`(토큰·9-slice·상태·커서).
정보 구조(UX-1)·게임 규칙·저장 형식은 바꾸지 않는다. 글자·숫자·bar 안쪽은 그림으로 바꾸지 않는다.

## US-1 설치
- **런타임 바이트:** `assets-inbox/ui-p0/ui/` 43장은 받은 그대로이고 C2PA `caBX` 청크가 붙어 있다. 청크를 빼면 29장은 P0 대장, 14장은 재작업 대장 SHA와 같다. `public/assets/ui-p0/`에 그 바이트를 둔다.
- **재작업으로 바뀐 초판:** 12장은 `superseded/`에 있다. 툴팁·청지기 neutral은 재작업에서 바이트가 같다. 파일럿 12장은 `pilot/`에 있고 설치하지 않는다.
- **파생 크기:** 스크립트가 한 번 만들고 커밋한다.
  - 아이콘 시트 11장은 칸별 Lanczos 24/32/48/64 사본을 만든다. 96 원본은 48 px 아이콘의 2x다.
  - 커서 6장은 32 px 사본(1x)을, 초상 3장과 원형 틀은 96 px 사본(1x)을 만든다.
  - 실행 중에 브라우저가 아이콘을 축소하지 않는다. CSS 크기마다 1x·2x 사본을 `image-set`으로 고른다.
- **대장:** `docs/provenance/assets.csv`에 97행(원본 43 + 파생 54)이 있고, 프롬프트 파일은 43개다. 공급자 대장 기준으로는 런타임 43 + superseded 12 = 55장이다.

## US-2 토큰(`src/styles/uiSkin.css` `.app-shell`)
| 토큰 | 값 | 출처 |
|---|---|---|
| `--parchment` / `--parchment-light` | `#decda8` / `#e1d1ae` | 밝은 틀 읽기 면 |
| `--oak` | `#514334` | 어두운 틀·HUD strip 면 |
| `--ink` / `--ink-soft` | `#3b2a1c` / `#5c4a36` | 틀 잉크 선 |
| `--seal-red` | `#a85038` | 완료 카드 밀랍 도장. 강조 1색으로 눌림 테두리와 focus 링에 쓴다 |
| `--status-ok/warn/block/info` | `#687040` / `#b8883c` / `#a85038` / `#7a6650` | 예측 아이콘 시트(체크·마름모·가위표·말풍선) |
| `--space-half/1/2/3` | 4 / 8 / 16 / 24 px | 8 px 배수 |
| `--text-12…18` | 12·13·14·16·18 px | UX-1 크기 그대로 |
| `--slice-*` | 원본 여백 ÷ 2 | 매니페스트 `slice`, `sourceScale 2` |

## US-3 자리 → 그림(0-A)
| 자리 | 틀·바탕 | 아이콘 |
|---|---|---|
| 상단 자원 bar · 시간 묶음 | `frame_hud_strip_top` | 자원 5(인구·빵·목재·석재·재정), 계절 4(날짜 옆), 시간 4(속도 단추) |
| 아래 콘솔 | `frame_hud_strip_bottom` | |
| 목표 카드 보통 · 완료(완료 · 이미 갖춰짐) · 주의 | `frame_objective_normal` · `_complete` · `_warn` | 완료 표시 `prediction.ok`, 위치 보기 `action.look`, `?` `lock.help`, 목표 기록 `action.log` |
| 청지기 | `frame_advisor_normal`, 우려 톤은 `_warn` | 원형 틀 `advisor_portrait_frame`을 초상 위에 따로 얹는다. 초상 `advisor_steward_portrait_{neutral,concern,success}` |
| 해금 배너 | `banner_unlock` | `lock.new` |
| 일시정지 문구판 · 경고 줄 · 상태 줄 | `toast_small` | 경고 즉시 `alert.urgent`, 주의 `alert.warn`, 보기 `action.look` |
| inspector · 목표 서랍 · 건설 상세 · 예측 판 | `frame_panel_light` + `texture_vellum_light` | 닫기 `prediction.block` |
| 건설 카탈로그 · 설정/지도/보기 팝오버 · 소지도 | `frame_panel_dark` + `texture_vellum_dark` | |
| 층위 단추(보통·눌림·잠김) | `button_secondary_base` | 층위 3 |
| 분류 탭 | `tab_build_base` | 분류 6. 순서는 UX-1 생활·길·생업·저장·유통·공공·신앙·방어와 같다 |
| 건설 카드(보통·선택·잠김·부족) | `button_primary_base`, 잠김 이유·부족은 `chip_condition_base` | 잠김 `lock.locked`. 그림 없는 도구는 첫 세션 건물 아이콘(길·헛간·필지·경작지·목책), 지우개는 `prediction.block` |
| 목표 CTA · 청지기 단추 | `button_primary_base` | |
| 보조 단추(보기·되돌리기·스위치·반경·설정 등) | `button_secondary_base` | |
| 정사각 단추(속도·`?`·닫기·상세) | `button_icon_square_base` | 상세 안내 `action.log` |
| 툴팁(`?` 도움말·잠김 사유·지도 표지판) | `frame_tooltip` | |
| 환영(모달) | `frame_modal` + `texture_vellum_light` | |
| 지도 경고 마커 | 캔버스 `warning_map_marker`(▲ `urgent` / ◆ `warn`) + 원인 아이콘 | 원인 7(물·빵·길·일손·저장·안전·권리) |
| 설정 문제 줄(SettlementStatusLine) | | 원인 아이콘 |
| 커서 | 선택·살펴보기(건물 위)·길·구역 붓·배치 가능/불가 | `data-placement`는 프레임이 판정이 바뀔 때만 쓴다 |

## US-4 상태는 코드
- **그림으로 두지 않는 상태:** 눌림·켜짐은 밝기 1.08과 안쪽 `--seal-red` 2 px 선, 누르는 중은 1 px 내려앉음과 밝기 0.96, focus는 `--seal-red` 2 px 링으로 코드가 그린다.
- **잠김:** 흑백 0.6~0.7에 불투명도를 낮춘다.
- **카드 선택:** 밝기에 안쪽 3 px 도장색 선을 더한다.
- **호버:** 밝기 1.06만 준다. 호버에만 보이는 정보는 없다.
- **터치 대상:** 44 px 바닥 규칙(uiConsole.css)이 그대로 적용되고, 글자는 12 px 이상이다.

## US-5 청지기 톤
- 대사마다 `tone`이 있다(`useTutorialController` `ADVISOR_TONE`).
- **success:** 칭찬하는 줄(wellDone·burgageDone·wrapUp).
- **concern:** 제약·부족을 말하는 줄(arable·granary). 초상이 우려 표정이 되고 말풍선이 주의 틀이 된다.
- **neutral:** 나머지.

## US-6 글꼴
- **본문:** Noto Sans KR 400·700.
- **제목·목표 제목·청지기 대사·날짜·환영 제목·지도 표지판:** Noto Serif KR 600.
- 둘 다 `@fontsource`(OFL 1.1)로 번들한다. 라이선스와 출처는 [`docs/provenance/fonts/`](../provenance/fonts/README.md)에 있고, 빌드에는 `public/licenses/fonts/`가 실린다.

## US-7 대체 경로
- **캔버스 그림:** 지도 마커와 지도 표지판은 시트가 올 때까지 옛 벡터 모양과 평판으로 그린다. Node 테스트에는 `Image`가 없어서 늘 대체 경로를 탄다.
- **CSS 그림:** `border-image`가 없는 환경에서는 UX-1의 평면 색이 남는다(같은 규칙 아래 층).

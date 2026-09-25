# Astra 의뢰: UI 아트 P0 본 제작 — 첫 15분 셸 전체 (약 60장)

작성 2026-09-25 · 파일럿 12장 통과(C안 확정) · 첨부: `astra-ui-p0-reference-files.zip` — 파일럿 12장(규격·톤의 기준), 파일럿 HUD 합성, 세계 화풍, 딥리서치 UI 카탈로그
상태: 후보. 설치는 UX-2(코드)에서.

## 0. 파일럿에서 바꿀 것 (본 제작 전체에 적용)
- **아이콘 외곽선을 얇게, 채도를 한 단계 낮게.** 파일럿 아이콘은 읽히지만 세계 그림(손그림 저채도)보다 윤곽이 굵고 반짝여 모바일 게임 아이콘처럼 보인다. 금화의 노랑·빵의 주황을 세계 팔레트(황토·oak)로.
- **달력 아이콘은 현대식 격자 달력 금지.** 계절 상징(해·낫·낙엽·눈송이 중 하나) 또는 두루마리 달력으로.
- 패널 모서리 장식은 파일럿보다 **한 단계 더 절제**(선 1개, 잉크 점 1개).
- 그 외 규격·톤·9-slice 규칙은 파일럿 그대로.

## A. 틀·버튼·질감 (14장)
| ID | 규격(@2×) | 상태 | 수 |
|---|---|---|---:|
| `frame_hud_strip_top`, `_bottom` | 9-slice 256×256 | 1 | 2 |
| `frame_panel_light` v2, `frame_panel_dark` v2 | 파일럿 규격 | 1 | 2 |
| `frame_objective` v2 | 9-slice 256×256 | normal / complete(인장) / warn(잉크 번짐) | 3 |
| `frame_advisor` v2 | + 원형 초상 틀 **별도 파일** `advisor_portrait_frame` 192×192 | normal / warn | 3 |
| `frame_tooltip` | 9-slice 128×128 | 1 | 1 |
| `frame_modal` | 9-slice 256×256 | 1 | 1 |
| `button_primary_base` v2, `button_secondary_base`, `button_icon_square_base` v2 | 9-slice | 1(상태는 코드) | 3 |
| `tab_build_base` | 9-slice H72 | 1 | 1 |
| `chip_condition_base` | 9-slice H48 | 1 | 1 |
| `texture_vellum_light` v2, `texture_vellum_dark` | 256×256 seamless | 1 | 2 |
| `divider_manuscript` | 128×16 반복 | 1 | 2 |
| `banner_unlock` | 9-slice 800×128 | 1 | 1 |
| `toast_small` | 9-slice 640×96 | 1 | 1 |

## B. 아이콘 (시트, 각 셀 96px 원본 → 24/32/48 축소 확인)
| 시트 | 내용 | 수 |
|---|---|---:|
| `icon_resource` v2 | 인구·빵·목재·석재·돈·**계절 4**(봄·여름·가을·겨울) | 9 |
| `icon_build_category` v2 | 생활·길·생업·저장유통·공공신앙·방어 | 6 |
| `icon_layer_mode` v2 | 직접·구역·방향 | 3 |
| `icon_first_session_buildings` | 오두막·우물·길·경작지·헛간·방앗간·곡창·창고·예배당·시장·필지 구역·목책 | 12 |
| `icon_prediction` | info·ok·warn·block | 4 |
| `icon_cause_family` | 물·식량·접근(길)·노동·저장·안전·권리/기타 | 7 |
| `icon_alert_priority` | 주의(마름모)·즉시(삼각)·정보 | 3 |
| `icon_time` | 일시정지·재생·2배·3배 | 4 |
| `icon_objective_action` | 열기(도구)·지도 이동·도움·접기 | 4 |
| `icon_lock_new` | 잠김·새로움·도움말 | 3 |
| `warning_map_marker` | 주의·즉시 (지도 위, 24/32) | 2 |

## C. 커서 (6장)
선택·배치 가능·배치 불가·길 긋기·구역 붓·상세. 64px 원본, 핫스팟 좌표 CSV에.

## D. 조언자 초상 (3장)
`advisor_steward_portrait` 청지기 1명 × neutral / concern / success. 192×192, 인물 파일럿 초상화 화풍(첨부 초상 P1 참조는 파일럿 ZIP에 있음), 눈선·어깨 기준 동일. 40대 남성, 소박한 관리 복장(지갑·열쇠), 모자 없음.

## E. 확인 그림 (3장)
1. **첫 세션 HUD 합성 v2**: 파일럿 합성과 같은 장면에 A·B·D를 전부 얹은 1280×800 + 태블릿 1180×820. 딥리서치 HUD 재배치안 배치.
2. 아이콘 전체 24px 나열(실루엣 구분).
3. 목표 카드 3상태·조언자 3표정 나열.

## F. 제출물·검수
PNG 약 60 + 확인 3 + CSV + 검수표. 기준: 0절 변경 반영, 24px 실루엣 구분, 9-slice 왜곡 없음, 텍스트·숫자·bar 내부 없음, 청지기 3표정이 같은 인물.

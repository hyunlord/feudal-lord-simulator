# Astra 의뢰: Wave 4e 후보 정리 일괄 — 석벽 조각·물가·울타리·가축·헛간·워커 보충 (30장)

작성 2026-09-25 · 규격 `ASSET_PIPELINE_SPEC_v1.md`(전달됨), 워커는 파일럿 2 재스킨 방식 · 첨부: `astra-wave4e-reference-files.zip` — Wave 4b/4c/4d 대표 그림, 기존 성문 조각, 워커 템플릿·5a 시트 4종·외투 오버레이, **현재 게임 석벽 v2 캡처**
상태: 후보. 게임 설치는 코드 작업에서.

## A. 석벽 보강 (6장)
| # | ROLE / ID | 원본 | 내용 |
|---|---|---:|---|
| 1–2 | strip / `wall/stone_face_rubble_{a,b}-v2` | 512×128 | v2 정면과 같은 규격·높이, **잡석(rubble) 톤** — 첨부 성문 조각의 돌 크기·불규칙함에 더 가깝게. 흉벽 윗면 띠와 접합 |
| 3 | module / `wall/stone_pillar_135-v1` | 기존 목책 코너 조각 규격 | **135° 모서리 전용** 석벽 기둥(원통 아님, 각진 버트리스). v2 면 톤 |
| 4 | module / `wall/stone_gate_v2-v1` | 기존 성문 조각 규격·피벗 | 석벽 성문 전용 그림 v2: 첨부 성문 조각과 같은 구도, v2 면·윗면 띠와 높이·톤 일치 |
| 5 | module / `wall/palisade_gate_v2-v1` | 기존 목책 성문 규격 | 목책 성문 v2: 목책 v2 면과 톤 일치 |
| 6 | module / `wall/stone_tower_corner_b-v1` | 4d 탑과 같은 규격 | 코너 탑 변형(사각 탑) |

## B. 물가·다리 (5장)
| # | ROLE / ID | 원본 | 내용 |
|---|---|---:|---|
| 7–8 | strip / `shore/shoreline_deep_{a,b}-v1` | 512×96 | 물 쪽 색을 **4d 깊은 물(`deep_a`) 계열**로 맞춘 물가 띠 |
| 9 | module / `module/bridge_abutment_sw_a-v1` | 256×192 | 앞쪽 남서 교대 전용(지금은 SE 반전) |
| 10 | module / `module/bridge_abutment_nw_b-v1` | 256×192 | 뒤쪽 북서 교대 변형 |
| 11 | module / `module/ferry_landing-v1` | 256×192 | 나루·선착장(말뚝 2·판자 데크·작은 배 없이). 논리는 나중, 그림만 |

## C. 울타리·가축·헛간 (8장)
| # | ROLE / ID | 원본 | 내용 |
|---|---|---:|---|
| 12–13 | module / `fence/hurdle_quarter-v1`, `hurdle_three_quarter-v1` | 32×64, 96×64 | 1/4·3/4 칸 직선(4c 규격) |
| 14 | module / `fence/hurdle_gate_short-v1` | 64×64 | 반 칸 문 |
| 15–17 | object / `animal/sheep_flock_{b,c,d}-v1` | 128×96 | 양 무리 변형(마릿수·배치·한 마리 검은 양) |
| 18 | object / `animal/pig_pair-v1` | 128×96 | 돼지 2마리(숲 방목용) |
| 19 | object / `farmstead_winter-v1` | 160×136 | 헛간 겨울 상태(눈 없음, 마른 마당·닫힌 문·장작 더미) |

## D. 워커 보충 (재스킨 7시트 + 오버레이 1 + 소지품 2종×4방향)
| # | ID | 템플릿 | 내용 |
|---|---|---|---|
| 20–22 | `wk_labor_f_{03,04,05}-v1` | `actor_civilian_woman` | 노동 여 3 추가(머리수건·kirtle 색 다르게) |
| 23–24 | `wk_servant_f_{03,04}-v1` | 같음 | 하인 여 2 추가 |
| 25–26 | `wk_poor_{m_02,f_02}-v1` | 남/여 템플릿 | 빈민 2 추가(패치 위치·색 다르게) |
| 27 | `overlay_cloak_merchant_m-v1` | `actor_merchant` | 상인 몸에 맞춘 외투 오버레이(모자 밖으로 나오게) |
| 28–29 | `held_{yarn_bundle, ale_jug}` | — | 소지품 2종 × 4방향(C4·C5 대비) |

## E. 확인 그림 (3장)
1. 석벽: 잡석 v2 면 + 윗면 띠 4회 + 성문 v2 + 135° 기둥 + 탑 b를 한 줄에 — 첨부 캡처와 나란히
2. 물가: 깊은 물 3×3 + 새 물가 띠 단면 + 나루·교대
3. 워커 7시트 겹치기 표 + 거리 나열

## F. 제출물·검수
PNG 30(워커 시트 7·소지품 8·오버레이 1 포함하면 약 45 파일) + 확인 3 + CSV + 검수표. 기준: 규격, 잡석 면이 성문과 같은 돌 언어, 물가 띠가 깊은 물과 색 연속, 워커 발 0px·머리 ≤ 2px.

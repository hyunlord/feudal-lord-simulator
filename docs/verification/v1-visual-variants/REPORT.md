관문: ①결정론 · ②분포 · ③오버레이 · ④성능 · ⑤클론 CLONE_COUNT — 통과

# V1 시각 변형 설치 보고 (Claude Code, 2026-09-24)

같은 등급의 집·창고·우물·시장·예배당·방앗간·밀밭이 위치에 따라 결정론적으로 다른 그림으로 그려진다. 게임 규칙·저장 형식은 그대로다(`src/engine`·`src/content/scenario`·`src/save` 변경 0줄, 저장 코덱은 테스트에서 읽기만). 같은 작업에서 사용자 지시로 **`RENDER_BOUNDARY_V2` 기본값을 켬**으로 바꿨다(토글·`render-boundary-v2=0` 유지). 캡처는 모두 시뮬레이션을 시작하지 않은 **준비 상태**이며, 오버레이 갤러리는 **상태 주입**(증빙용 합성 상태)이다.

## 커밋·합치기·대장

COMMITS_BLOCK

에셋 대장 `docs/provenance/assets.csv` **31행 추가**(첨부 CSV에서, 상태 `runtime`, 원본 경로 `docs/asset-evidence/runtime-sources/variants-wave2/` SHA 일치, 프롬프트 `docs/provenance/prompts/`). 목축형 3장(`assets_hold/`)·반려된 L1 초가·확인 그림 4장은 설치·대장·매니페스트에 넣지 않았다.

## 관문 결과

### ① 결정론 — 통과
| 방법 | 결과 |
|---|---|
| 같은 상태로 변형 두 번 선택 / 건물·주택 배열 역순 / `encodeSave`→`decodeSave` 후 선택 (seed 2·3) | 모두 동일 (`tests/buildingVariants.test.ts`) |
| 브라우저 화면 SHA: 같은 상태를 새 페이지 두 번 (seed 2·3 도시, 갤러리 × DPR 1·2, 소프트웨어 래스터) | 6/6 동일 (`determinism-browser.json`) |

변형은 저장된 값(세계 seed, 종류, anchor tx·ty, 필지 폭, 건축 등급)만으로 정해진다. 건물에 건설 서수 필드가 없어 `builtOrdinal`은 쓰지 않았다.

### ② 분포 — 통과 (`distribution.json`)
| 도시 | 풀(수) | 변형별 수 — 최대 비율 | 인접 동일 |
|---|---|---|---|
| seed2 | 전체 인접 쌍 | — | 4/29 (14%) |
| seed2 | chapel (1) | stone 1 — 최대 100% | 0/0 |
| seed2 | house_l4 (24) | base 6 · wing 6 · inn 5 · courtyard 7 — 최대 29% | 1/14 |
| seed2 | market (2) | c 1 · base 1 — 최대 50% | 0/0 |
| seed2 | mill (10) | base 4 · windmill 6 — 최대 60% | 0/3 |
| seed2 | storehouse (4) | c 2 · b 2 — 최대 50% | 0/1 |
| seed2 | well (3) | b 1 · c 1 · base 1 — 최대 33% | 0/0 |
| seed2 | wheat_farm (20) | base 13 · mixed 7 — 최대 65% | 3/11 |
| seed3 | 전체 인접 쌍 | — | 0/16 (0%) |
| seed3 | chapel (1) | b 1 — 최대 100% | 0/0 |
| seed3 | house_l3 (11) | clothier 5 · shop 2 · storage 4 — 최대 45% | 0/3 |
| seed3 | house_l4 (13) | inn 4 · base 3 · wing 4 · courtyard 2 — 최대 31% | 0/7 |
| seed3 | market (2) | b 1 · c 1 — 최대 50% | 0/0 |
| seed3 | mill (8) | base 5 · windmill 3 — 최대 63% | 0/0 |
| seed3 | storehouse (3) | c 1 · base 2 — 최대 67% | 0/0 |
| seed3 | well (7) | b 3 · c 2 · base 2 — 최대 43% | 0/0 |
| seed3 | wheat_farm (19) | base 9 · mixed 10 — 최대 53% | 0/6 |

- 등급(주택 풀)은 최대 45%(seed 3 L3), 인접 두 건물이 같은 변형인 비율은 14%·0%. 4채 이상인 시설 풀도 최대 65%. 1~3채 풀(예배당 1, 시장 2, 우물 3)은 수가 적어 비율 판정에서 뺐다.
- 최종 도시에는 L3·L4 집만 있다. 규칙 자체의 분포(60×10 anchor 격자, 세계 seed 1, 참고):

| 풀 | 비율 |
|---|---|
| single L0 | base 35% · pen 32% · garden 33% |
| single L1 | base 35% · garden 50% · artisan 16% |
| single L2 | base 27% · garden 38% · weaver 17% · brewer 19% |
| single L3 | base 27% · shop 24% · clothier 32% · storage 18% |
| single L4 | base 27% · inn 36% · courtyard 23% · wing 15% |
| horizontal L3 | base 50% · courtyard 50% |
| horizontal L4 | base 50% · hall 50% |
| vertical L3 | base 50% · workshop 50% |
| vertical L4 | base 50% · court 50% |

### ③ 상태 오버레이 — 통과 (`captures/closeup-*.jpg`, `overlay-registration-sheet.jpg`)
하락 33종 오버레이는 기본 본체에 그려진 그림이라 변형 본체(작아지거나 옆으로 비킨 집)에 그대로 얹으면 마당·소품 위로 떨어진다. `scripts/registerVariantOverlays.py`가 변형마다 주 지붕(단독) 또는 두 채 지붕 전체(합필)의 색 마스크를 기본과 맞추는 배율·이동을 찾아 `buildingVariantOverlay.generated.ts`에 17행을 만든다. 오버레이 그림과 대체 표식(벽·지붕·창 좌표) 모두 이 변환을 따른다. 테스트: 17개 모든 변형에 등록이 있고 해당 등급·필지의 3상태 그림이 모두 있다.

| 변형 | 배율 | dx | dy | 지붕 IoU |
|---|---|---|---|---|
| `house_l0_garden-v1` | 0.89 | 24.6 | 122.9 | 0.714 |
| `house_l0_pen-v1` | 0.75 | 57.4 | 204.9 | 0.789 |
| `house_l1_artisan-v1` | 0.95 | 45.1 | 54.1 | 0.91 |
| `house_l1_garden-v1` | 0.77 | 45.1 | 198.5 | 0.789 |
| `house_l2_brewer-v1` | 0.84 | 27.5 | 173.9 | 0.821 |
| `house_l2_garden-v1` | 0.86 | -9.2 | 137.3 | 0.772 |
| `house_l2_weaver-v1` | 0.85 | 18.3 | 73.2 | 0.79 |
| `house_l3_clothier-v1` | 0.85 | 44.2 | 132.5 | 0.705 |
| `house_l3_shop-v1` | 0.92 | 79.5 | 97.1 | 0.637 |
| `house_l3_storage-v1` | 0.85 | 17.7 | 141.3 | 0.712 |
| `house_l4_courtyard-v1` | 0.93 | 93.5 | 54.5 | 0.689 |
| `house_l4_inn-v1` | 0.93 | 0.0 | 124.6 | 0.692 |
| `house_l4_wing-v1` | 0.96 | 0.0 | 38.9 | 0.771 |
| `house_pair_l3_horizontal_courtyard-v1` | 0.85 | 20.1 | 134.2 | 0.387 |
| `house_pair_l3_vertical_workshop-v1` | 1.01 | 20.6 | 13.7 | 0.481 |
| `house_pair_l4_horizontal_hall-v1` | 0.9 | 30.7 | 178.3 | 0.439 |
| `house_pair_l4_vertical_court-v1` | 0.92 | 20.4 | 75.0 | 0.581 |

- 확인 그림: `overlay-registration-sheet.jpg`(열: 기본+오버레이 / 변형+미등록 오버레이 / 변형+등록 오버레이, 17행). 화면 캡처: 갤러리(`gallery-*`, 17변형 × 관리·부족·방치·빈집 66채)와 하락 집 6채 확대(`closeup-*`: L0 pen 빈집, L1 garden 방치, L2 weaver 부족, L3 shop 방치, L4 courtyard 빈집, 합필 L4 hall 방치).
- 한계: 합필 L3 courtyard는 두 채 사이가 넓어 벽 얼룩이 틈 가장자리에 걸친다(IoU 0.39). 카메라 최대 확대가 약 1.5배라 표식이 작게 보인다.

### ④ 성능 — 통과 (`perf/`)
B11 방식(3회 × 240프레임, 첫 회 버림, 1배속, 1280×800, headless GPU). 전 = V1 이전 본선 `d7ad548`에 곡선 지면 켬, 후 = V1(기본 = 곡선 지면 켬). 번갈아 측정.

PERF_TABLE

변형은 기본과 같은 방식으로 한 번 래스터해 재사용한다(URL·크롭·높이별 캐시). 변형 배정은 건물 목록이 바뀔 때만 다시 계산한다.

### ⑤ 깨끗한 클론 회귀 — 통과
CLONE_LINE

## 만든 것
| 항목 | 파일 |
|---|---|
| 변형 선택 규칙 | `src/render/buildingVariants.ts` — seed = hash(세계 seed, 종류, anchor, 필지 폭). 등급 풀 안에서만 고름. 등급이 오르면 같은 seed로 다시 고르되 50%(seed로 결정) 확률로 같은 계열 유지(garden→garden). 하락·복구는 건축 등급이 그대로라 변형 유지. 합필은 폭 2 seed, 해제하면 원래 seed. 인접(모서리 포함 맞닿음) 같은 풀의 앞선 건물이 같은 원선택이면 한 번 다음 후보로(연쇄 없음) |
| 매니페스트 | `src/render/buildingVariantManifest.ts` — `building:house_l2` 등 `namespace:id` 풀, `variants: [{id, weight, family}]`(기본 그림도 변형 `base`). 가중치 동일 |
| 설치 | `public/assets/buildings/variants-wave2/` 31장. 모든 변형이 기본 그림과 같은 틀(같은 캔버스 비율·접지점)이라 기본의 좌표 등록을 그대로 쓰고 샘플링 배율만 등록(`registerRuntimeAssetVariant`) |
| 그리기 | 단독·합필 주택, 오버레이, 시장(활성 B·C / 조용 B, 조용 C는 없어 기본 조용), 예배당, 풍차(정지 그림이라 회전 날개 대신 그림), 혼합형 밀밭(생장 4단계), 우물·창고(월드 스프라이트 교체) |
| 곡선 지면 기본 켬 | `src/render/renderBoundaryFlag.ts`. 이전 지면 렌더러를 검증하던 테스트 4개 파일은 끔으로 고정(토글로 여전히 제공되므로 유지) |
| 증빙 도구 | `scripts/registerVariantOverlays.py`, `variantOverlaySheet.py`, `variantDistribution.ts`, `variantGalleryState.ts`, `variantEvidence.mjs` |

## 지시서와 다르게 하거나 못 한 것
1. `builtOrdinal`: 건물에 서수 필드가 없어 seed에 넣지 않았다(엔진 수정 금지).
2. 풍차는 회전 날개가 그려진 정지 그림이라, 풍차 변형 방앗간은 날개가 돌지 않는다.
3. 조용한 시장 C가 없어 C형 시장은 조용할 때 기본 조용 그림을 쓴다.
4. 변형 원본 보관본이 35MB다(기존 `runtime-sources/` 관례를 따름).
5. 테스트 1개 파일(`phase13Part6Rendering`)은 기본 밀밭 층 순서를 검사하므로 변형을 끄는 테스트 훅(`setBuildingVariantsEnabled`)을 추가해 썼다.

## 다음 후보
- **변형과 규칙 연결**(C3·C4): brewer·inn·weaver·clothier·shop·storage 계열은 가내 공예·저장 슬롯이 생길 때 그 계열을 요구하는 조건으로. 지금은 순전히 그림이다.
- **성벽 안팎 지붕**(C6): 아트 바이블(성밖 초가·성내 평기와)대로면 L0·L1 성내 집은 기와여야 한다. L1 기와 변형(Astra 재의뢰 중)이 오면 성내 L1 풀에 넣으면 된다.
- 목축형 농장은 C5(양)에서 `building:wheat_farm` 풀에 한 줄 추가.
- 합필 L3 courtyard 오버레이 등록을 수작업 보정할지.

## 소요 시간
TIME_LINE

# ASSET-1 에셋 전수 점검 — runtime 대조·중복·규격·일관성 시트

작성 2026-09-27 · 기준 본선 `codex/phase15-organic-ground` 6618053 · 작업 지시서 `CLAUDE_CODE_WORK_ORDER_ASSET1_full-audit.md` · **수정은 하지 않았다**(목록만, 사용자 판정 후 ASSET-2).

산출물: 이 문서(A·C 표), [`sheets/`](sheets/) 8장(B), [`runtime_reconcile.csv`](runtime_reconcile.csv)(runtime 전 파일 분류), [`confirmed_not_installed.csv`](confirmed_not_installed.csv), [`defects.csv`](defects.csv), [`sheet_stats.csv`](sheet_stats.csv), [`fix_candidates.csv`](fix_candidates.csv), 방법 스크립트 [`method/`](method/).

## 요약

- **A. runtime 대조** — `public/assets` 885개 파일(PNG 879, JSON 5, `.gitkeep` 1)과 빌드 때 `assets-inbox`에서 만드는 웹 파생 507개를 모두 분류했다(**미분류 0**). superseded·rejected·retired 바이트는 runtime에 **0개**다. 대신 ① 판정 전(candidate)인 **초상 풀 2차 92장**이 CHRON-1 설치로 빌드 파생 184개(256·96 px)로 게임에 들어가 있고, ② 새 확정본(-v 번호가 큼)이 있는데 옛 버전이 코드에 등록된 파일이 **7개**(도로 2·성벽 면 5), ③ INBOX 장부·설치 대장 어디에도 없고 코드도 읽지 않는 파일이 **10개**(예약 목책 5·빵 바구니 1·옛 UI 질감 4)다. 장부 밖이지만 설치 대장에 기록된 초기 에셋(Codex·ComfyUI·phase16 합성)이 144개다.
- **중복** — 같은 픽셀이 runtime에 두 이름으로 있는 경우 0. 같은 이름·다른 내용은 runtime 안 4쌍(Wave 11 석조·목조 공사 킷의 `stage_*_medium-v1.png`), runtime↔inbox 82건(대부분 다른 배치의 같은 이름 후보).
- **manifest** — 게임이 읽는 생성 manifest(`src/**/*.generated.ts`·`*Manifest*.ts`)가 가리키는데 파일이 없는 것 **0**. manifest 어디에도 없는 runtime PNG 19개(코드가 경로를 조립하는 자원 아이콘 8 포함).
- **C2PA caBX** — runtime에 남은 것 6개(모두 위 ③의 예약 파일). **코드 미참조** runtime 파일 10개(③과 같은 10개).
- **B. 일관성 시트** — 8장, 그림 1398장(runtime + 확정·미설치 inbox, 같은 픽셀은 한 번). 묶음 안 z-score ±2 밖 **97장**을 빨간 테두리로 표시.
- **C. 기계 결함** — 규격(캔버스·피벗·알파 바운딩) 검사 1148건 중 불일치 0(피벗이 그림 위 3 px 밖 1건, 낮음). 헤일로 기준에 걸린 것 3개(성벽 면 v2 — 눈으로 보면 빛 받은 윗면), 대신 눈 확인에서 말뚝 면 v2의 색 띠 1건. 빈 파일 0. 반투명 잔여 점 11개(최대 알파 1~6, 눈에 거의 안 보임). 설치 대장 행 없음 10(③과 같음). DPR·크기 파생 누락 0.

## A. runtime 대조

**방법.** `git ls-files public/assets` 전 파일과 빌드 파생(`scripts/keyartDerivatives.ts`의 `WEB_ART_DERIVATIVES`: Wave 8 키아트·Wave 16/17 삽화·초상 풀)을 대상으로 했다. 파일 SHA-256, caBX 청크를 뺀 SHA, 디코딩한 RGBA 픽셀 해시를 `assets-inbox` 2,867장과 맞춰 보고, 맞지 않으면 설치 대장(`docs/provenance/assets.csv`)의 `sourcePath`(inbox 경로 또는 `docs/asset-evidence` 원본 → 다시 해시 대조)로 연결했다. 연결된 INBOX 장부 행이 여럿이면 confirmed > candidate > superseded > retired > rejected 순으로 대표 상태를 정했다. "옛 버전"은 같은 파일 이름 줄기(`-vN` 앞)에 번호가 더 큰 confirmed 행이 장부에 있는 경우다.

### A1. 분류 (미분류 0)

| 분류 | `public/assets` 파일 | 빌드 파생(URL) |
|---|---|---|
| confirmed 최신본 | 718 | 323 |
| confirmed 옛 버전 — 새 확정본(-v 번호 큼)이 장부에 있음 | 7 | 0 |
| superseded — 옛 버전이 runtime에 남음 | 0 | 0 |
| rejected — 반려본이 runtime에 있음 | 0 | 0 |
| retired — 퇴역본이 runtime에 있음 | 0 | 0 |
| rework_pending — 재작업 대기 파일이 runtime에 있음 | 0 | 0 |
| candidate — 판정 전 파일이 runtime에 있음 | 0 | 184 |
| 장부 밖 — 설치 대장에만 있음(수제·초기) | 144 | 0 |
| 장부 밖 — 설치 대장에도 없음 | 10 | 0 |
| 메타데이터(json·gitkeep) | 6 | 0 |
| **합계** | **885** | **507** |

- 분류되지 않은 파일: `public/assets` 0, 빌드 파생 0.
- `confirmed인데 미설치(예정)` — 장부 쪽 목록이라 위 표(파일 기준)와 따로 셌다: 확정 그림(확인·기록 그림 제외) **388장**이 runtime 어느 파일과도 연결되지 않는다 → [`confirmed_not_installed.csv`](confirmed_not_installed.csv).

| Wave | 미설치 확정 그림 |
|---|---|
| walker-pilot2 | 88 |
| wave3 | 82 |
| wave12 | 60 |
| wave17 | 52 |
| wave13 | 34 |
| wave14 | 24 |
| wave20 | 20 |
| people-pilot1 | 18 |
| wave5a | 6 |
| derived-templates | 4 |

**판정 전 파일이 게임에 있음 (candidate).** 초상 풀 2차 `portrait-pool/pool2-20260926` 92장(I069~I100)은 INBOX 장부 `candidate`인데 CHRON-1이 설치해(`installed_by=CHRON-1`, 설치 대장 notes에도 "candidate — 판정 전"으로 적힘) 빌드 파생 184개(`assets/portraits/256/*.jpg`, `assets/portraits/96/*.jpg`)로 연대기·인물 카드에 나온다.

**옛 버전이 코드에 등록됨 (7).** 새 버전과 함께 매니페스트에 올라 있다(둘 다 `path (code)`).

| runtime 파일 | 연결된 장부 행 | 새 확정본 | 참조 |
|---|---|---|---|
| `road/earth_strip_a-v2.png` | wave4-pilot/road/earth_strip_a-v2.png | wave4b/road/earth_strip_a-v3.png | src/render/boundaryAssetManifest.ts |
| `road/earth_strip_b-v2.png` | wave4-pilot/road/earth_strip_b-v2.png | wave4b/road/earth_strip_b-v3.png | src/render/boundaryAssetManifest.ts |
| `wall/palisade_face_a-v1.png` | wave4-pilot/candidates-20260925/assets/wall/palisade_face_a-v1.png | wave4d/wall/palisade_face_a-v2.png | src/render/terrainVariantManifest.ts |
| `wall/palisade_face_b-v1.png` | wave4b/wall/palisade_face_b-v1.png | wave4d/wall/palisade_face_b-v2.png | src/render/terrainVariantManifest.ts |
| `wall/stone_face_a-v1.png` | wave4-pilot/candidates-20260925/assets/wall/stone_face_a-v1.png | wave4d/wall/stone_face_a-v2.png | src/render/terrainVariantManifest.ts |
| `wall/stone_face_b-v1.png` | wave4b/wall/stone_face_b-v1.png | wave4d/wall/stone_face_b-v2.png | src/render/terrainVariantManifest.ts |
| `wall/stone_face_c-v1.png` | wave4b/wall/stone_face_c-v1.png | wave4d/wall/stone_face_c-v2.png | src/render/terrainVariantManifest.ts |

**장부·설치 대장 어디에도 없음 (10)** — 모두 게임 코드가 읽지 않는다.

| runtime 파일 | caBX | 크기 | 테스트·스크립트 언급 |
|---|---|---|---|
| `buildings/historical-palisade-reserved/palisade_corner-v2.png` | 1 | 1774×887 | 없음 |
| `buildings/historical-palisade-reserved/palisade_cross-v2.png` | 1 | 1774×887 | 없음 |
| `buildings/historical-palisade-reserved/palisade_t_junction-v2.png` | 1 | 1774×887 | 없음 |
| `buildings/historical-palisade-reserved/palisade_terminal-v2.png` | 1 | 1774×887 | 없음 |
| `buildings/historical-palisade-reserved/palisade_watchtower-v2.png` | 1 | 1774×887 | 없음 |
| `runtime-reserved-v1/market_bread_basket-v2.png` | 1 | 1774×887 | 없음 |
| `ui/illumination_corner.png` | 0 | 128×128 | scripts/generateUiAssets.py, scripts/uiAssetManifest.ts, tests/courtConsoleContracts.test.ts, tests/phase13FullColourAssets.test.ts, tests/test_generate_ui_asse |
| `ui/parchment_texture.png` | 0 | 512×512 | scripts/generateUiAssets.py, scripts/uiAssetManifest.ts, tests/contrastGate.test.ts, tests/phase13FullColourAssets.test.ts, tests/test_generate_ui_assets.py |
| `ui/scroll_frame.png` | 0 | 512×512 | scripts/generateUiAssets.py, scripts/uiAssetManifest.ts, scripts/verifyUiAssets.ts, tests/phase13FullColourAssets.test.ts, tests/test_generate_ui_assets.py |
| `ui/wood_console.png` | 0 | 1920×160 | scripts/generateUiAssets.py, scripts/uiAssetManifest.ts, scripts/verifyUiAssets.ts, tests/phase13FullColourAssets.test.ts, tests/test_generate_ui_assets.py, tes |

**장부 밖, 설치 대장에만 있음 (144)** — Astra 이전에 Codex image_gen·ComfyUI·phase16 합성으로 만든 초기 에셋. 설치 대장에 행과 원본(`docs/asset-evidence`)이 있다.

| 폴더 | 파일 |
|---|---|
| `buildings` | 17 |
| `buildings/historical-facilities-v1` | 11 |
| `buildings/historical-gate` | 9 |
| `buildings/historical-houses` | 11 |
| `buildings/historical-wall` | 2 |
| `buildings/runtime-mill-v1` | 2 |
| `complete-art-v1/water-bridges` | 10 |
| `foliage` | 12 |
| `phase16-house-condition` | 33 |
| `phase16-landscape` | 3 |
| `runtime-actors-v1` | 11 |
| `runtime-construction-v1` | 9 |
| `runtime-icons-v1` | 8 |
| `terrain` | 5 |
| `ui` | 1 |

### A2. 중복 — 같은 내용 두 이름 / 같은 이름 다른 내용

- **같은 픽셀, runtime 두 이름: 0건.** 빌드 파생 원본이 두 URL에 쓰인 경우도 없다(초상 256·96 쌍은 의도).
- **같은 이름, runtime 안 다른 내용: 4쌍** — `stage_foundation_medium-v1.png` (wave11/kit_stone / wave11/kit_timber), `stage_frame_medium-v1.png` (wave11/kit_stone / wave11/kit_timber), `stage_plot_medium-v1.png` (wave11/kit_stone / wave11/kit_timber), `stage_roof_medium-v1.png` (wave11/kit_stone / wave11/kit_timber). 폴더가 달라 충돌은 없지만 이름만으로는 구분되지 않는다.
- **같은 이름, runtime↔inbox 다른 내용: 82건** — runtime 파일은 확정본과 바이트가 같고, 같은 이름의 다른 배치 파일(후보·옛 판)이 inbox에 따로 있는 경우다. 표는 (runtime 분류, 같은 이름 inbox 행의 상태)별 개수.

| runtime 분류 | 같은 이름 inbox 행 상태 | 건수 |
|---|---|---|
| confirmed | candidate | 39 |
| confirmed | superseded | 23 |
| 장부 밖 | candidate | 12 |
| confirmed | confirmed | 8 |

  - 장부 밖 12건은 초기 runtime 파일과 이름이 같은 Astra 후보: `buildings/house_l0.png`·`foliage/tree_oak_large.png`·`terrain/grass.png`(asset-trial 후보), `runtime-actors-v1/actor_*`(wave4e·wave5a 템플릿 후보 9). 이 후보들은 runtime 파일의 원본이 아니다(해시 다름).
  - 전체 목록: `runtime_reconcile.csv`에는 runtime 쪽만 있으므로, 이 82건은 [`same_name_different_content.csv`](same_name_different_content.csv)에 따로 적었다.

### A3. manifest 대조

manifest로 본 파일: 게임이 읽는 `src/**/*.generated.ts`·`src/**/*anifest*.ts`와 `public/assets/**/*.json`(이 JSON 5개는 게임 코드가 읽지 않고 생성 스크립트만 읽는다).

- **manifest에 없는데 파일이 있음: 19개**

| 폴더 | 파일 | 코드 참조 |
|---|---|---|
| `buildings/historical-palisade-reserved` | 5 | none |
| `runtime-icons-v1` | 8 | file name (dynamic path), stem in a quoted string (template path) |
| `runtime-reserved-v1` | 1 | none |
| `ui` | 5 | none, path (code) |

  - `runtime-icons-v1` 8개는 `src/ui/ResourceArtwork.tsx`가 `assets/runtime-icons-v1/${kind}.png`로 경로를 조립해 읽는다(manifest 없음, 참조 있음). `ui/seal_slot.png`는 코드가 직접 읽는다. 나머지 10개는 A1의 "어디에도 없음"과 같다.
- **manifest에 있는데 파일이 없음: 게임이 읽는 manifest 기준 0개.** 공개 JSON에는 파일 없는 경로 70개가 있으나 모두 기록용이다:
  - `public/assets/buildings/historical-wall/manifest.json` 3개 — `not_installed` 목록의 석벽 모서리·T자·끝(설치하지 않았다고 적힌 것)
  - `public/assets/world_asset_manifest.json` 67개 — `foliageSelections[].candidates[].path`(나무 후보 선별 기록 64)·`acceptedReferences[].path`(참조 3) — 선별 이력

### A4. runtime 파일의 C2PA caBX 청크

runtime PNG 879개 중 caBX가 남은 파일 **6개** — 모두 A1 "어디에도 없음"의 예약 파일이다. 나머지 873개는 caBX가 없다(설치 때 떼었거나 원래 없음). 빌드 파생(JPEG·반 크기 PNG)은 스크립트가 새로 인코딩하므로 청크를 옮기지 않는다(`scripts/keyartDerivatives.ts`).

| 파일 | caBX 청크 | 바이트 |
|---|---|---|
| `buildings/historical-palisade-reserved/palisade_corner-v2.png` | 1 | 847974 |
| `buildings/historical-palisade-reserved/palisade_cross-v2.png` | 1 | 903478 |
| `buildings/historical-palisade-reserved/palisade_t_junction-v2.png` | 1 | 834545 |
| `buildings/historical-palisade-reserved/palisade_terminal-v2.png` | 1 | 697563 |
| `buildings/historical-palisade-reserved/palisade_watchtower-v2.png` | 1 | 767431 |
| `runtime-reserved-v1/market_bread_basket-v2.png` | 1 | 1231351 |

### A5. 코드가 참조하지 않는 runtime 파일

`src/**`(ts·tsx·css·json)·`index.html`·`vite.config.ts`에서 ① `assets/…` 경로 문자열, ② 파일 이름, ③ 템플릿 경로(`${…}`)의 변수 값이 따옴표 문자열로 있는지 찾았다.

| 참조 방식 | PNG |
|---|---|
| path (generated manifest) | 634 |
| path (code) | 227 |
| none | 10 |
| stem in a quoted string (template path) | 7 |
| file name (dynamic path) | 1 |

미참조 10개는 A1 "어디에도 없음" 10개와 같다. 이 중 `ui/` 4개(`illumination_corner`·`parchment_texture`·`scroll_frame`·`wood_console`)는 Phase 13 UI 생성 스크립트(`scripts/generateUiAssets.py`·`scripts/uiAssetManifest.ts`)와 그 테스트만 언급한다. 예약 6개는 어디서도 언급되지 않는다.

**그리는 코드가 없는 등록 파일(코드 추적, grep 밖).** 위 grep에서는 "참조 있음"이지만 실제로 그려지는 경로를 찾지 못한 파일이다. 보조 에이전트가 그리기 코드를 따라가 찾았고, wave9·visibility 몇 개는 grep으로 표본 확인했다. 지울지는 예약 여부를 보고 판단해야 한다.

| 파일 | 근거 |
|---|---|
| `buildings/historical-palisade-reserved/*, runtime-reserved-v1/*` | 어디서도 참조 안 함 (A1 ③) |
| `buildings/stone_wall_segment.png` | manifest에만 있음 |
| `buildings/historical-gate/gate_part_doors_closed_*` | 읽지만 그리지 않음 |
| `runtime-construction-v1/construction_wall-v2·construction_salvage-v3·effect_smoke-v1` | 코드에 "reserved"로 적힘 |
| `complete-art-v1/water-bridges 돌다리·여울·강둑·water_shallow` | `bridgeWaterKit`만 부르는데 그 함수를 부르는 곳이 없음 |
| `module/ferry_landing-v1` | 등록만 |
| `shore/shoreline_a~f-v1, shallow_a~c-v1` | 등록만(로드 안 함) |
| `wall/*_face_*-v1 (v2가 그려짐)` | 등록만 — A1 옛 버전 7개와 겹침 |
| `runtime-actors-v1 civilian_man·civilian_woman·merchant·cleric·cart_ox` | `active:false` |
| `wave9 event_abandoned·event_plague_shut·fresh_graves·weeds_overgrown·funeral_bearers·royal_messenger·bier_shroud·scroll_royal·empty_granary_floor·hungry_queue` | 그리는 코드 없음(키가 생성 manifest에만 있음, 표본 grep 확인) |
| `wave7 plus_float, wave11 ramp_plank·kit_defense/*_gate` | 그리는 코드 없음 |
| `visibility-v1 roof_frame_thatch·fire_large·fire_small·work_carry_beam·work_pose_overlay_m` | `visibilityArtManifest.ts`에 등록만 |
| `wave8 loading_1337·loading_1348 키아트, minimap·objective·legend 틀, overlay 아이콘 일부, wave19 틀 일부` | UI에서 쓰는 곳을 찾지 못함 |
| `runtime-icons-v1 (stone_raw 제외 7)` | `ResourceArtwork`가 P0 시트로 대신 그려 보이지 않음(stone_raw만 보조 줄 16 px) |

## B. 일관성 시트 (8장)

각 시트는 **게임 줌 1.0의 CSS px 크기**로 그렸다. 설치된 파일은 그리기 코드의 배율, 미설치 확정본은 ① Astra 기록의 배율(`game_zoom_1_source_scale`·`native_to_world_scale`) → ② 설치된 같은 계열의 코드 배율 → ③ Astra 파이프라인 규격 "원본×0.5 = 줌 1.0"(Wave 12·13 README) 순서로 정했다. 워커 합성기를 거치는 워커 시트·손 소품은 기록값보다 합성기 규칙을 먼저 썼다. 라벨 둘째 줄의 `×값`이 파일 1 px당 화면 px이고, 계열별 근거는 [`display_scale_by_family.csv`](display_scale_by_family.csv)와 [`sheet_stats.csv`](sheet_stats.csv)의 `scale_basis`에 있다. 줌 1.0에서 DPR은 선명도만 바꾸고 크기는 바꾸지 않는다(`src/render/canvasRuntime.ts:57-71`, `src/render/worldSprite.ts:248-257`).

**밝기·채도·주조색.** 파일마다 보이는 픽셀(알파 가중)의 평균 밝기(Rec.709, 0–255)·평균 채도(HSV S)·주조색(알파≥128 픽셀을 8단계로 묶은 최빈 색)을 계산하고, **시트 안 묶음마다** z-score를 냈다(마스크처럼 한 색인 그림은 통계에서 뺐다). ±2 밖은 빨간 테두리와 빨간 숫자로 표시했다. 통계 이탈은 결함이 아니라 "사람이 볼 곳"이다(눈·서리·돌·연기는 의도로 튀는 경우가 많다).

| 시트 | 그림 | public 설치 | 빌드 파생 | 미설치 확정 | z ±2 밖 |
|---|---|---|---|---|---|
| [① 건물(발판 마름모)](sheets/1_buildings.jpg) | 272 | 171 | 0 | 101 | 26 |
| [② 워커(정면 SE 셀)·동물·수레](sheets/2_walkers_animals_carts.jpg) | 113 | 70 | 0 | 43 | 5 |
| [③ 소품·더미·적재물·기표](sheets/3_props_piles_loads_signs.jpg) | 230 | 134 | 0 | 96 | 15 |
| [④ 띠·면·자연](sheets/4_strips_surfaces.jpg) | 243 | 237 | 0 | 6 | 16 |
| [⑤ 효과·연기·불](sheets/5_effects.jpg) | 24 | 23 | 0 | 1 | 1 |
| [⑥ UI 아이콘 24 px + UI 조각](sheets/6_ui_icons_24px.jpg) | 192 | 163 | 0 | 29 | 8 |
| [⑦ 초상 96 px](sheets/7_portraits_96px.jpg) | 237 | 3 | 228 | 6 | 16 |
| [⑧ 삽화 썸네일](sheets/8_illustrations.jpg) | 87 | 24 | 43 | 20 | 10 |

포함 기준: runtime PNG 전부 + INBOX 장부 `confirmed`(확인·기록 그림 제외) + 빌드 파생 원본(판정 전 초상 풀 2차 포함). 같은 픽셀은 한 번(runtime 쪽). 아이콘 크기 사본(`-24`~`-64`)·커서 `-32`·초상 `-96`·`people-pilot1`의 `_96`/`_128`·walker-pilot2의 셀 조각·wave7 `original-assets`는 원본과 겹쳐 뺐다.

### 주요 배율 (줌 1.0, 파일 1 px당 화면 px)

| 계열 | 배율 | 계산 | 근거 |
|---|---|---|---|
| 주택 L0~L4·쌍집(`historical-houses`)·Wave 2 변형 | 0.497–0.500 | 불투명 상자 폭 = 0.88 × 64 × (w+h)/2, 바닥 = 발판 앞 꼭짓점 | `src/render/historicalHouseAssets.ts:73-89`, `houseCompoundAssets.ts:55-62` |
| 시설(`historical-facilities-v1`) | 0.498–0.533 | manifest `displayWidth` ÷ 원본 상자 폭 | `src/render/historicalFacilityAssets.ts:100-125` |
| 초기 평면 건물 well·logging_camp·storehouse·barn | 0.708 / 0.640 / 0.801 / 0.970 | 발판 맞춤(fill × (w+h) × 32 ÷ 불투명 폭) | `src/render/buildingSpriteFit.ts:18-55` |
| 집 상태 레이어(`phase16-house-condition`) | 0.336–0.450 | 집 사각형에 맞춰 잘라 그림 | `src/render/houseConditionOverlay.ts:44-139` |
| Wave 11 공사 킷 | 0.2(방어) · 0.498–0.801 | 해당 건물 사각형 / 탑 고정 0.2 | `src/render/constructionKits.ts:29-122` |
| 워커(`walkers-v2`·옛 actor·Wave 11 일꾼) | 0.26–0.43(셀 px) | 그림 높이를 17.6 px(0.55 × 32)로 맞춤 | `src/render/walkerComposer.ts:27-30,183-188` |
| **Wave 9 이야기 워커**(장례·떠나는 가족·청원자·전령) | **0.5(셀 px)** | `storyWorldProps` WALKER_SCALE — 일반 워커의 약 1.8배 크기 | `src/render/storyWorldProps.ts:20-31` |
| 손 소품(`walker-props-v1`·work 도구) | 0.17–0.28 | 0.65 × 운반자 배율 | `src/render/walkerComposer.ts:30,93-97` |
| 더미(Wave 7 `pile`) | 0.3 | PILE_SCALE | `src/render/stockPiles.ts:16` |
| 수레 짐(Wave 7 `cart_load`) | 0.269 | 17.6 × 0.55 ÷ 36 | `src/render/drawWalkers.ts:115-124` |
| 기표(Wave 7 `signifier`) | 0.4–0.5 | 고정 | `src/render/worldSigns.ts:127-169` |
| 목초지 동물(`zones/animals`) | 0.234–0.240 | `displayWidth` 30·46 | `src/render/zoneAssetManifest.ts:66-80` |
| 도로 띠(`earth_strip`-v3) | 약 0.363(타일 축 방향) | 5.2타일에 512 px, 폭 0.65타일 | `src/render/drawRoadRibbons.ts:376-582` |
| 이랑(`ridge_*`)·물가 띠 | 약 0.28(타일 축 방향) | 타일당 128 px | `src/render/drawArableFields.ts:31-208` |
| 성벽 면 띠(512×128) | 약 0.17(벽 방향) · 0.156(세로) | 타일당 205 px, 128행 → 20 px | `src/render/drawWallFaces.ts:45-169` |
| 숲 가장자리·계절 데칼 | 0.5 | DECAL_SCALE | `src/render/seasonalDecals.ts:22-23` |
| 과수(`zones/orchard_*`·Wave 15 과수) | 0.155–0.180 | 43 × prop scale | `src/render/zoneLayer.ts:206` |
| 연기(Wave 7)·완공 효과 | 0.3 · 0.55–1.1 | SMOKE_SCALE · (w+h) × 27 × 1.3 | `src/render/roofSmoke.ts:66`, `constructionCompletionEffects.ts:167-172` |
| 미설치 Astra(Wave 12·13·17·20 등) | 0.5 | Astra 기록 `game_zoom_1_source_scale`·`native_to_world_scale`(Wave 20 0.498–0.500) 또는 규격 기본 | Wave 12·13 README, Wave 17·20 `records/assets.csv` |

### 시트에서 보이는 것 (배율·밝기)

- **Wave 9 이야기 워커가 일반 워커보다 약 1.8배 크다.** 셀 × 0.5(그림 높이 약 32 px)로 그려지고, 일반 워커는 17.6 px다(② 시트 둘째 묶음 옆, `wk_funeral_bearers`·`wk_leaving_family`·`wk_petitioner_*`·`wk_royal_messenger`).
- **Wave 13 동물·수레를 규격(원본×0.5)대로 넣으면 지금 동물보다 두 배 넘게 크다.** 원본 1 px당 0.5 대 목초지 동물 0.234–0.240, 손수레는 폭 17.6 px(0.25)다(② 동물 묶음: W4c·W4e 대 W13). 설치(MOVE-2) 때 배율을 정해야 한다.
- **Wave 17 손 소품은 기록 배율이 0.5인데, 설치된 손 소품은 0.65 × 운반자(약 0.18)로 그려진다.** 기록대로 넣으면 지금 손 소품의 약 2.8배다. 시트는 합성기 규칙(0.18)으로 그렸다.
- **Wave 12 건물·Wave 20 집·Wave 3 건물(×0.5)은 설치된 집·시설(0.497–0.533)과 같은 배율이다.** 발판 마름모 대비 크기도 비슷하다(① 시트).
- **초상:** 파일럿 초상(`people-pilot1` P2·P5·P6, `pivot-pilot` P04·P09·P11·P18·P31·P33·P35)이 풀 1·2차(밝기 약 60–100)보다 밝고(밝기 118–140) 채도가 낮다. 풀 안에서는 빨간 옷의 I038·I084·I097이 채도 +2 이상.
- **UI:** 옛 자원 아이콘 `stone`·`stone_raw`(장부 밖)가 P0 아이콘보다 채도가 낮다. 문장·인장 마스크 48장은 한 색이라 통계에서 뺐다.
- 나머지 이탈 대부분은 의도로 보인다: 지붕 눈·서리·눈 더미(밝기 +2~+4), 돌 수레 짐·석회 더미(채도 −3), 검은 연기, 불 난 밤 장면(`event_fire`).

전체 이탈 목록은 D의 "Astra 재작업 후보(통계 이탈)"와 [`sheet_stats.csv`](sheet_stats.csv)(`outlier=yes`).

## C. 기계 결함 표

대상: runtime PNG 879 + 확정(또는 설치된) inbox 그림, 같은 픽셀은 한 번만 셌다(runtime 경로 우선, 같은 픽셀 사본은 `defects.csv`의 `same_pixels`). 전체 목록 [`defects.csv`](defects.csv).

| 결함 | 검사 방법 | 건수 |
|---|---|---|
| 규격: 캔버스 크기 불일치 | 게임 manifest 591건(파생 대장 `runtimeAssetDerivatives`의 원본→축소 관계, UI 틀의 `sourceScale` 반영) + Astra 기록 `records/*.csv` 557건 | 0 |
| 규격: 피벗·지면 기준점 vs 알파 바운딩 | manifest 피벗 205건 + Astra 기록 피벗 214건: 캔버스 밖, 알파(≥128) 좌우 밖, 바닥보다 캔버스 높이 25 % 넘게 아래, 위쪽 밖. 오버레이·UI 틀(좌상단 0,0 등록)은 제외 | 1 |
| 규격: 알파 바운딩 표기 불일치 | `alphaBounds`(알파≥8)·`BUILDING_SPRITE_ALPHA`(≥128) 19건, 허용 ±2 px(선언 좌표) | 0 |
| 헤일로(가장자리 밝음) | 가장자리(투명 픽셀에서 2 px 안, 알파≥32) 평균 밝기 > 내부(알파 255, 4 px 이상 안쪽) + 40 | 3 |
| 반투명 잔여 점 | 몸통(알파≥128)에서 2 px 넘게 떨어진, 6 px 이하·알파<128 외딴 점이 30개 이상. 효과·지면·초상·삽화 제외 | 11 |
| 빈 파일 | 0바이트, 완전 투명, 보이는 픽셀 16개 미만 | 0 |
| C2PA caBX 청크 잔존 | runtime PNG의 caBX 청크(A4와 같음) | 6 |
| 설치 대장: 행 없음 | runtime PNG인데 `docs/provenance/assets.csv`에 행이 없음 | 10 |
| 파생 대장: 크기·SHA 불일치 | `runtimeAssetDerivatives.generated.ts`의 width·height·sha256 vs 실제 파일(65건) | 0 |
| DPR·크기 파생 누락 | UI 아이콘 시트의 24·32·48·64·96 크기 세트, 커서·초상 1x/2x(2x가 1x의 두 배), UI 틀 `sourceScale` 표기 | 0 |
| 이름 규칙 | 문서화된 규칙이 없어 저장소 관례 `[a-z0-9_]+(-vN\|-크기)?.png` 기준 | 321 |
| 단색 그림(참고) | 보이는 픽셀이 모두 한 색 — 코드에서 색칠하는 마스크로 보이며 결함으로 세지 않음 | 48 |

**규격** — 불일치 0. 낮음 1건:

| 파일 | 범위 | 내용 | 같은 픽셀 |
|---|---|---|---|
| `wave15/season/snow_drift_a-v1.png` | runtime | snow_drift_a: pivot y 24 vs alpha top 27 |  |

**헤일로 3건 — 눈으로 보면 흰 테두리가 아니라 빛 받은 윗면(말뚝 끝·돌 윗면)이 밝은 것이다.** 기준(가장자리 > 내부 + 40)에는 걸리므로 표에 두되, 다른 결함을 함께 적는다:

| 파일 | 범위 | 내용 | 같은 픽셀 |
|---|---|---|---|
| `wall/palisade_face_a-v2.png` | runtime | edge luma 147 vs inner 90 (+57 > 40) | inbox:wave4d/wall/palisade_face_a-v2.png |
| `wall/palisade_face_b-v2.png` | runtime | edge luma 144 vs inner 93 (+51 > 40) | inbox:wave4d/wall/palisade_face_b-v2.png |
| `wall/stone_face_b-v2.png` | runtime | edge luma 157 vs inner 111 (+46 > 40) | inbox:wave4d/wall/stone_face_b-v2.png |

- 눈 확인에서 따로 찾은 것(기계 표 밖): `wall/palisade_face_a-v2.png` 왼쪽 끝 말뚝 3개 끝에 **보라·파랑·빨강 띠**(x 0–40, y 0–12, 채도 높은 픽셀 640개). `wall/stone_face_b-v1.png`·`stone_face_a/c-v1` 윗줄 20 px에 **반투명 띠**(알파 16–239 픽셀 1,054개, 첫 성가퀴가 비침) — v1은 A1의 옛 버전이다.

**반투명 잔여 점 11건** — 모두 최대 알파 1~6(게임에서 거의 안 보임): 예약 파일 6, 나무 다리·돌 강둑 2, 석벽 기둥 1, 겨울 사과나무 1, 전령 워커 1.

| 파일 | 범위 | 내용 | 같은 픽셀 |
|---|---|---|---|
| `buildings/historical-palisade-reserved/palisade_corner-v2.png` | runtime | 65 isolated specks (122 px, max alpha 2) >2 px from the body |  |
| `buildings/historical-palisade-reserved/palisade_cross-v2.png` | runtime | 80 isolated specks (117 px, max alpha 1) >2 px from the body |  |
| `buildings/historical-palisade-reserved/palisade_t_junction-v2.png` | runtime | 72 isolated specks (100 px, max alpha 2) >2 px from the body |  |
| `buildings/historical-palisade-reserved/palisade_terminal-v2.png` | runtime | 86 isolated specks (133 px, max alpha 1) >2 px from the body |  |
| `buildings/historical-palisade-reserved/palisade_watchtower-v2.png` | runtime | 106 isolated specks (153 px, max alpha 2) >2 px from the body |  |
| `complete-art-v1/water-bridges/bridge_wood_ne_sw-v2.png` | runtime | 89 isolated specks (176 px, max alpha 3) >2 px from the body |  |
| `complete-art-v1/water-bridges/riverbank_stone-v2.png` | runtime | 41 isolated specks (80 px, max alpha 1) >2 px from the body |  |
| `runtime-reserved-v1/market_bread_basket-v2.png` | runtime | 79 isolated specks (109 px, max alpha 1) >2 px from the body |  |
| `wall/stone_pillar_135-v1.png` | runtime | 41 isolated specks (66 px, max alpha 1) >2 px from the body | inbox:wave4e/wall/stone_pillar_135-v1.png |
| `wave15/orchard/orchard_apple_d_winter-v1.png` | runtime | 76 isolated specks (136 px, max alpha 1) >2 px from the body | inbox:wave15/candidates-20260926/assets/orchard/orchard_apple_d_winter-v1.png |
| `wave9/walker/wk_royal_messenger-v1.png` | runtime | 41 isolated specks (76 px, max alpha 6) >2 px from the body | inbox:wave9/candidates-20260925/assets/wk_royal_messenger-v1.png |

**설치 대장 행 없음 10** — A1 "어디에도 없음"과 같은 파일. **파생 대장·DPR 파생** — 불일치·누락 0(아이콘 시트 11종 모두 24/32/48/64/96, 커서 6·초상 4의 1x/2x 모두 있고 2x = 1x의 두 배, UI-P0 틀 18개·Wave 8 틀 6개 모두 `sourceScale: 2`).

**이름 규칙 321건** — 방향 접미 대문자(`_NE`·`_SW` — Wave 7·13·17은 소문자 `_ne`), 초상 ID 대문자(`P01`·`I037`), `-v1_96` 같은 접미 순서. 게임 동작과 무관한 표기 차이다.

| 묶음 | 사유 | 범위 | 건수 |
|---|---|---|---|
| `portrait-pool/pool1-20260926` | 대문자 | inbox | 92 |
| `walker-pilot2/candidates-v1` | 대문자 | inbox | 88 |
| `portrait-pool/pivot-pilot-20260926` | 대문자 | inbox | 48 |
| `walker-props-v1` | 대문자 | runtime | 32 |
| `wave5a/props` | 대문자 | inbox | 24 |
| `people-pilot1/candidates-v1` | 대문자, '-'가 버전·크기 접미 밖에 쓰임 | inbox | 12 |
| `wave4e/props` | 대문자 | inbox | 8 |
| `people-pilot1/candidates-v1` | 대문자 | inbox | 6 |
| `wave5a/portraits` | 대문자 | inbox | 6 |
| `wave12/candidates-20260926` | 대문자 | inbox | 3 |
| `derived-templates/checks` | '-'가 버전·크기 접미 밖에 쓰임 | inbox | 1 |
| `wave3/candidates-20260926` | '-'가 버전·크기 접미 밖에 쓰임 | inbox | 1 |

**단색 그림(참고) 48건**(runtime 43) — Wave 14 문장(charges·ordinaries·partitions)·상인 표식·도시 인장이 흰색 또는 검은색 한 색이다. UI-5가 `public/assets/wave14/`에 설치했고 `src/ui/heraldry/EmblemImage.tsx`가 색을 입히는 마스크라 결함으로 세지 않았다.

## D. 수정 후보 목록 (수정하지 않음 — 사용자 판정 후 ASSET-2)

전체: [`fix_candidates.csv`](fix_candidates.csv).

### 1. runtime에서 지울 것 (10)

| 파일 | 이유 |
|---|---|
| `buildings/historical-palisade-reserved/palisade_corner-v2.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조, caBX 남음 |
| `buildings/historical-palisade-reserved/palisade_cross-v2.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조, caBX 남음 |
| `buildings/historical-palisade-reserved/palisade_t_junction-v2.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조, caBX 남음 |
| `buildings/historical-palisade-reserved/palisade_terminal-v2.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조, caBX 남음 |
| `buildings/historical-palisade-reserved/palisade_watchtower-v2.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조, caBX 남음 |
| `runtime-reserved-v1/market_bread_basket-v2.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조, caBX 남음 |
| `ui/illumination_corner.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조 |
| `ui/parchment_texture.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조 |
| `ui/scroll_frame.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조 |
| `ui/wood_console.png` | 장부·설치 대장 모두 없음, 게임 코드 미참조 |

검토: 위 "그리는 코드가 없는 등록 파일"은 예약인지 확인한 뒤 지울지 정한다(이 목록에는 넣지 않았다).

### 2. 교체할 것 (8)

| 파일 | 이유 |
|---|---|
| `road/earth_strip_a-v2.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4b/road/earth_strip_a-v3.png |
| `road/earth_strip_b-v2.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4b/road/earth_strip_b-v3.png |
| `wall/palisade_face_a-v1.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4d/wall/palisade_face_a-v2.png |
| `wall/palisade_face_b-v1.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4d/wall/palisade_face_b-v2.png |
| `wall/stone_face_a-v1.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4d/wall/stone_face_a-v2.png |
| `wall/stone_face_b-v1.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4d/wall/stone_face_b-v2.png |
| `wall/stone_face_c-v1.png` | 옛 버전이 코드에 등록됨 → 새 확정본 wave4d/wall/stone_face_c-v2.png |
| 초상 풀 2차 92장 → 빌드 파생 184개 (assets/portraits/256·96/I069~I100) | INBOX 장부 candidate(판정 전)인데 CHRON-1이 설치 — confirmed 판정 또는 pool1로 대체 |

### 3. Astra 재작업 후보 — 결함 (9)

| 파일 | 이유 |
|---|---|
| `wall/palisade_face_a-v2.png` | 눈 확인: 왼쪽 끝 말뚝 3개 끝에 보라·파랑·빨강 띠(x 0–40, y 0–12) — 같은 픽셀 inbox wave4d/wall/palisade_face_a-v2.png |
| `wall/palisade_face_a-v2.png` | 헤일로 기준 초과: edge luma 147 vs inner 90 (+57 > 40) — 눈으로는 빛 받은 윗면, 재작업이 필요 없을 수 있음 |
| `wall/palisade_face_b-v2.png` | 헤일로 기준 초과: edge luma 144 vs inner 93 (+51 > 40) — 눈으로는 빛 받은 윗면, 재작업이 필요 없을 수 있음 |
| `wall/stone_face_b-v2.png` | 헤일로 기준 초과: edge luma 157 vs inner 111 (+46 > 40) — 눈으로는 빛 받은 윗면, 재작업이 필요 없을 수 있음 |
| `complete-art-v1/water-bridges/bridge_wood_ne_sw-v2.png` | 반투명 잔여 점: 89 isolated specks (176 px, max alpha 3) >2 px from the body |
| `complete-art-v1/water-bridges/riverbank_stone-v2.png` | 반투명 잔여 점: 41 isolated specks (80 px, max alpha 1) >2 px from the body |
| `wall/stone_pillar_135-v1.png` | 반투명 잔여 점: 41 isolated specks (66 px, max alpha 1) >2 px from the body |
| `wave15/orchard/orchard_apple_d_winter-v1.png` | 반투명 잔여 점: 76 isolated specks (136 px, max alpha 1) >2 px from the body |
| `wave9/walker/wk_royal_messenger-v1.png` | 반투명 잔여 점: 41 isolated specks (76 px, max alpha 6) >2 px from the body |

### 4. 통계 이탈 — 사람 판정 (83 Astra + 14 장부 밖)

시트에서 빨간 테두리로 표시한 그림이다. 이름으로 의도가 짐작되는 것은 괄호에 적었다(겨울 흰색·돌·연기·불·양모 등). 재작업으로 보낼지는 시트를 보고 정한다.

| 분류 | 파일 | 시트·묶음·값 |
|---|---|---|
| Astra | `inbox:wave20/candidates-20260926/assets/houses/house_l1_1400_a-v1.png` | 1_buildings · 주택(L0~L4·변형·Wave 2 변형·Wave 20 시대별): B 136 (z +2.1), S 0.52 (z +0.1) |
| Astra | `inbox:wave12/candidates-20260926/assets/bld/market_cross_stone-v1.png` | 1_buildings · 시설·공공 건물: B 130 (z +2.1), S 0.31 (z -1.5) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `inbox:wave3/candidates-20260926/assets/bld/dyehouse_state_active-overlay.png` | 1_buildings · 시설·공공 건물: B 145 (z +3.4), S 0.28 (z -1.7) |
| Astra | `inbox:wave3/candidates-20260926/assets/bld/fulling_mill_wheel_sheet.png` | 1_buildings · 시설·공공 건물: B 75 (z -2.4), S 0.63 (z +1.4) |
| Astra | `wave11/kit_stone/stage_foundation_large-v1.png` | 1_buildings · 공사 단계(기초·골조·지붕틀·비계): B 148 (z +2.5), S 0.31 (z -1.7) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wave11/kit_stone/stage_foundation_medium-v1.png` | 1_buildings · 공사 단계(기초·골조·지붕틀·비계): B 145 (z +2.4), S 0.29 (z -1.8) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `inbox:wave12/rework-20260926/assets/active/bridge_chapel-active-v1.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 98 (z -0.7), S 0.67 (z +2.1) |
| Astra | `inbox:wave12/rework-20260926/assets/active/chantry_chapel-active-v1.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 99 (z -0.7), S 0.66 (z +2.1) |
| Astra | `inbox:wave17/candidates-20260926/assets/event/raid_burning_quay-v1.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 94 (z -0.8), S 0.80 (z +3.0) — 불·밤 장면(의도일 수 있음) |
| Astra | `wave7/season/roof_snow_l0-v2.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 222 (z +2.4), S 0.05 (z -1.9) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/roof_snow_l1-v2.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 228 (z +2.5), S 0.05 (z -1.9) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/roof_snow_l2-v2.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 233 (z +2.7), S 0.04 (z -2.0) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/roof_snow_l3-v2.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 224 (z +2.4), S 0.06 (z -1.8) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/roof_snow_l4-v2.png` | 1_buildings · 집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어): B 223 (z +2.4), S 0.06 (z -1.9) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `walkers-v2/wk_labor_f_03-v1.png` | 2_walkers_animals_carts · 워커(정면 SE 셀): B 101 (z +1.1), S 0.70 (z +2.0) |
| Astra | `walkers-v2/wk_labor_f_01-v1.png` | 2_walkers_animals_carts · 워커(정면 SE 셀): B 112 (z +1.7), S 0.21 (z -2.0) |
| Astra | `walkers-v2/wk_monk_m_01-v1.png` | 2_walkers_animals_carts · 워커(정면 SE 셀): B 30 (z -3.0), S 0.22 (z -1.9) — 검은 수도복(의도) |
| Astra | `walkers-v2/wk_nun_f_01-v1.png` | 2_walkers_animals_carts · 워커(정면 SE 셀): B 44 (z -2.2), S 0.26 (z -1.6) — 검은 수도복(의도) |
| Astra | `inbox:wave13/candidates-v1/assets/animal_walk/horse_riding-v1.png` | 2_walkers_animals_carts · 동물·수레·무리: B 86 (z -0.6), S 0.31 (z -2.2) |
| Astra | `wave11/site/lime_heap-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 193 (z +3.4), S 0.14 (z -2.5) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `inbox:wave3/fix-20260926/assets/loads/cart_load_cloth_dyed_ne-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 94 (z -0.2), S 0.17 (z -2.3) |
| Astra | `inbox:wave3/fix-20260926/assets/loads/cart_load_cloth_dyed_nw-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 93 (z -0.2), S 0.19 (z -2.1) |
| Astra | `inbox:wave3/candidates-20260926/assets/pile/fleece_heap_1-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 180 (z +3.0), S 0.30 (z -1.3) — 양모(흰색, 의도일 수 있음) |
| Astra | `inbox:wave3/candidates-20260926/assets/pile/fleece_heap_2-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 169 (z +2.5), S 0.28 (z -1.4) — 양모(흰색, 의도일 수 있음) |
| Astra | `inbox:wave3/candidates-20260926/assets/pile/fleece_heap_3-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 174 (z +2.7), S 0.32 (z -1.1) — 양모(흰색, 의도일 수 있음) |
| Astra | `inbox:wave3/candidates-20260926/assets/props/work_shears_sw-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 82 (z -0.6), S 0.18 (z -2.2) |
| Astra | `inbox:wave3/candidates-20260926/assets/pile/yarn_skeins_1-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 173 (z +2.7), S 0.28 (z -1.4) — 양모(흰색, 의도일 수 있음) |
| Astra | `inbox:wave3/candidates-20260926/assets/pile/yarn_skeins_3-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 163 (z +2.3), S 0.29 (z -1.4) — 양모(흰색, 의도일 수 있음) |
| Astra | `zones/haycock_b-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 164 (z +2.4), S 0.58 (z +0.8) |
| Astra | `walker-props-v1/overlay_cloak_f-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 88 (z -0.4), S 0.17 (z -2.3) |
| Astra | `wave7/cart/cart_load_rawstone_ne-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 76 (z -0.8), S 0.04 (z -3.3) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wave7/cart/cart_load_rawstone_nw-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 72 (z -0.9), S 0.06 (z -3.2) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wave7/cart/cart_load_stone_ne-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 146 (z +1.7), S 0.08 (z -3.0) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wave7/cart/cart_load_stone_nw-v1.png` | 3_props_piles_loads_signs · 소품·더미·적재물·기표·손에 든 물건·작업 도구: B 149 (z +1.8), S 0.08 (z -3.0) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wave15/zones/orchard_spring_petals-v1.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 212 (z +2.8), S 0.12 (z -2.1) |
| Astra | `wave15/season/snow_drift_a-v1.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 184 (z +2.0), S 0.16 (z -1.8) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave15/season/snow_drift_b-v1.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 207 (z +2.6), S 0.11 (z -2.1) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/frost_patch_a-v2.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 255 (z +4.0), S 0.00 (z -2.9) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/frost_patch_b-v2.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 255 (z +4.0), S 0.00 (z -2.9) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/frost_patch_c-v2.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 255 (z +4.0), S 0.00 (z -2.9) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave7/season/leaves_a-v1.png` | 4_strips_surfaces · 지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼): B 90 (z -0.6), S 0.72 (z +2.2) |
| Astra | `wave15/foliage/field_stone_winter-v1.png` | 4_strips_surfaces · 나무·수풀·숲 가장자리: B 153 (z +1.6), S 0.14 (z -2.2) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `wave15/orchard/orchard_apple_c_spring-v1.png` | 4_strips_surfaces · 나무·수풀·숲 가장자리: B 170 (z +2.2), S 0.29 (z -1.1) |
| Astra | `wave15/orchard/orchard_apple_d_spring-v1.png` | 4_strips_surfaces · 나무·수풀·숲 가장자리: B 173 (z +2.3), S 0.28 (z -1.2) |
| Astra | `wave15/orchard/orchard_apple_g_spring-v1.png` | 4_strips_surfaces · 나무·수풀·숲 가장자리: B 178 (z +2.5), S 0.25 (z -1.4) |
| Astra | `wave15/orchard/orchard_plum_f_spring-v1.png` | 4_strips_surfaces · 나무·수풀·숲 가장자리: B 183 (z +2.7), S 0.24 (z -1.4) |
| Astra | `wall/stone_face_a-v1.png` | 4_strips_surfaces · 성벽·울타리·다리·교대: B 150 (z +2.4), S 0.22 (z -1.0) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wall/stone_face_b-v1.png` | 4_strips_surfaces · 성벽·울타리·다리·교대: B 150 (z +2.4), S 0.22 (z -1.0) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `wall/stone_face_c-v1.png` | 4_strips_surfaces · 성벽·울타리·다리·교대: B 150 (z +2.4), S 0.23 (z -0.9) — 돌·석회(무채색, 의도일 수 있음) |
| Astra | `yards/hurdle_three_quarter-v1.png` | 4_strips_surfaces · 성벽·울타리·다리·교대: B 114 (z +0.2), S 0.64 (z +2.0) |
| Astra | `wave9/fx/black_smoke_column_sheet-v1.png` | 5_effects · 효과·연기·불: B 67 (z -2.5), S 0.07 (z -0.9) — 연기(어두움, 의도) |
| Astra | `ui-p0/icon_alert_priority_sheet.png` | 6_ui_icons_24px · 아이콘(셀마다 24 px): B 152 (z +2.5), S 0.43 (z -1.1) |
| Astra | `wave8/icons/icon_overlay_rights.png` | 6_ui_icons_24px · 아이콘(셀마다 24 px): B 157 (z +2.8), S 0.49 (z -0.7) |
| Astra | `ui-p0/advisor_portrait_frame.png` | 6_ui_icons_24px · UI 조각(틀·버튼·질감·장식 — 높이 64 px로 축소): B 107 (z -0.8), S 0.87 (z +2.1) |
| Astra | `ui-p0/divider_manuscript_light.png` | 6_ui_icons_24px · UI 조각(틀·버튼·질감·장식 — 높이 64 px로 축소): B 219 (z +1.2), S 0.94 (z +2.4) |
| Astra | `wave14/heraldry/shield_surface_texture_screen.png` | 6_ui_icons_24px · UI 조각(틀·버튼·질감·장식 — 높이 64 px로 축소): B 23 (z -2.3), S 0.00 (z -1.7) |
| Astra | `wave8/time/pause_vignette.png` | 6_ui_icons_24px · UI 조각(틀·버튼·질감·장식 — 높이 64 px로 축소): B 24 (z -2.3), S 0.75 (z +1.6) — 어두운 가장자리 효과(의도) |
| Astra | `inbox:people-pilot1/candidates-v1/assets/portraits/pt_pilot_P2-v1.png` | 7_portraits_96px · 초상: B 125 (z +2.4), S 0.28 (z -1.4) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:people-pilot1/candidates-v1/assets/portraits/pt_pilot_P5-v1.png` | 7_portraits_96px · 초상: B 132 (z +2.9), S 0.24 (z -1.9) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:people-pilot1/candidates-v1/assets/portraits/pt_pilot_P6-v1.png` | 7_portraits_96px · 초상: B 140 (z +3.4), S 0.21 (z -2.4) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pool1-20260926/assets/portraits/I038_old.png` | 7_portraits_96px · 초상: B 68 (z -1.0), S 0.57 (z +2.4) |
| Astra | `inbox:portrait-pool/pool1-20260926/assets/portraits/I038_young.png` | 7_portraits_96px · 초상: B 70 (z -0.9), S 0.57 (z +2.4) |
| Astra | `inbox:portrait-pool/pool2-20260926/assets/portraits/I084_mature.png` | 7_portraits_96px · 초상: B 68 (z -1.0), S 0.56 (z +2.3) |
| Astra | `inbox:portrait-pool/pool2-20260926/assets/portraits/I084_old.png` | 7_portraits_96px · 초상: B 69 (z -1.0), S 0.57 (z +2.4) |
| Astra | `inbox:portrait-pool/pool2-20260926/assets/portraits/I097_child.png` | 7_portraits_96px · 초상: B 70 (z -0.9), S 0.54 (z +2.0) |
| Astra | `inbox:portrait-pool/pool2-20260926/assets/portraits/I097_young.png` | 7_portraits_96px · 초상: B 66 (z -1.1), S 0.56 (z +2.3) |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P04.png` | 7_portraits_96px · 초상: B 125 (z +2.4), S 0.24 (z -1.9) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P09.png` | 7_portraits_96px · 초상: B 123 (z +2.3), S 0.27 (z -1.6) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P11.png` | 7_portraits_96px · 초상: B 118 (z +2.0), S 0.26 (z -1.6) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P18.png` | 7_portraits_96px · 초상: B 119 (z +2.1), S 0.25 (z -1.8) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P31.png` | 7_portraits_96px · 초상: B 119 (z +2.1), S 0.36 (z -0.3) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P33.png` | 7_portraits_96px · 초상: B 121 (z +2.2), S 0.30 (z -1.1) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:portrait-pool/pivot-pilot-20260926/assets/portraits/P35.png` | 7_portraits_96px · 초상: B 120 (z +2.2), S 0.27 (z -1.6) — 파일럿 초상 — 풀보다 밝고 채도 낮음 |
| Astra | `inbox:wave16/candidates-v1/assets/chronicle/chronicle_first_fire.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 70 (z -2.1), S 0.42 (z +0.5) — 불·밤 장면(의도일 수 있음) |
| Astra | `inbox:wave16/candidates-v1/assets/chronicle/chronicle_first_mill.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 128 (z +2.6), S 0.34 (z -0.8) |
| Astra | `inbox:wave16/candidates-v1/assets/chronicle/chronicle_first_winter.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 126 (z +2.5), S 0.22 (z -2.6) — 겨울 흰색·무채색(의도일 수 있음) |
| Astra | `inbox:wave16/candidates-v1/assets/events/event_famine_omen.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 94 (z -0.1), S 0.24 (z -2.4) |
| Astra | `inbox:wave16/candidates-v1/assets/events/event_fire.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 60 (z -2.9), S 0.47 (z +1.2) — 불·밤 장면(의도일 수 있음) |
| Astra | `inbox:wave16/candidates-v1/assets/events/event_fire_warning.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 92 (z -0.3), S 0.52 (z +2.0) — 불·밤 장면(의도일 수 있음) |
| Astra | `inbox:wave8/candidates-20260925/assets/keyart/keyart_mode_select.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 103 (z +0.6), S 0.56 (z +2.6) |
| Astra | `inbox:wave8/candidates-20260925/assets/keyart/keyart_title_bg.png` | 8_illustrations · 회화 삽화(키아트·로딩·이벤트·연대기·결정·장): B 96 (z +0.0), S 0.24 (z -2.3) |
| Astra | `wave19/scenes_events/scene_charter.png` | 8_illustrations · Wave 19 장면 그림(투명 배경 소품형): B 178 (z +3.4), S 0.36 (z -2.4) |
| Astra | `wave19/scenes_build/scene_stone_shortage.png` | 8_illustrations · Wave 19 장면 그림(투명 배경 소품형): B 121 (z +0.9), S 0.36 (z -2.4) — 돌·석회(무채색, 의도일 수 있음) |
| 장부 밖 | `buildings/house_l1.png` | 1_buildings · 주택(L0~L4·변형·Wave 2 변형·Wave 20 시대별): B 135 (z +2.0), S 0.55 (z +0.6) |
| 장부 밖 | `buildings/house_l3.png` | 1_buildings · 주택(L0~L4·변형·Wave 2 변형·Wave 20 시대별): B 109 (z +0.0), S 0.35 (z -3.2) |
| 장부 밖 | `buildings/house_l4.png` | 1_buildings · 주택(L0~L4·변형·Wave 2 변형·Wave 20 시대별): B 115 (z +0.5), S 0.27 (z -4.8) |
| 장부 밖 | `buildings/church.png` | 1_buildings · 시설·공공 건물: B 113 (z +0.8), S 0.09 (z -3.4) |
| 장부 밖 | `buildings/keep.png` | 1_buildings · 시설·공공 건물: B 118 (z +1.1), S 0.14 (z -3.0) |
| 장부 밖 | `buildings/market.png` | 1_buildings · 시설·공공 건물: B 97 (z -0.6), S 0.24 (z -2.1) |
| 장부 밖 | `buildings/masonry.png` | 1_buildings · 시설·공공 건물: B 92 (z -1.0), S 0.23 (z -2.1) |
| 장부 밖 | `buildings/mill.png` | 1_buildings · 시설·공공 건물: B 121 (z +1.4), S 0.18 (z -2.6) |
| 장부 밖 | `buildings/quarry.png` | 1_buildings · 시설·공공 건물: B 109 (z +0.4), S 0.21 (z -2.3) |
| 장부 밖 | `buildings/historical-facilities-v1/quarry_active-v2.png` | 1_buildings · 시설·공공 건물: B 129 (z +2.1), S 0.31 (z -1.5) |
| 장부 밖 | `buildings/historical-facilities-v1/quarry_depleted-v2.png` | 1_buildings · 시설·공공 건물: B 131 (z +2.2), S 0.33 (z -1.3) |
| 장부 밖 | `runtime-construction-v1/construction_wall-v2.png` | 1_buildings · 공사 단계(기초·골조·지붕틀·비계): B 82 (z -2.1), S 0.35 (z -1.2) |
| 장부 밖 | `runtime-icons-v1/stone.png` | 6_ui_icons_24px · 아이콘(셀마다 24 px): B 120 (z +0.7), S 0.26 (z -2.7) — 돌·석회(무채색, 의도일 수 있음) |
| 장부 밖 | `runtime-icons-v1/stone_raw.png` | 6_ui_icons_24px · 아이콘(셀마다 24 px): B 108 (z +0.0), S 0.24 (z -2.9) — 돌·석회(무채색, 의도일 수 있음) |

## 관문

| 관문 | 결과 |
|---|---|
| ① runtime 전 파일 분류(미분류 0) | `public/assets` 885/885, 빌드 파생 507/507 분류 — [`runtime_reconcile.csv`](runtime_reconcile.csv) |
| ② 시트 8종 | [`sheets/`](sheets/) 8장(JPEG, 각 1.5 MB 이하), 통계 [`sheet_stats.csv`](sheet_stats.csv) |
| ③ 결함 표 | C절, [`defects.csv`](defects.csv) |
| ④ 문서만 커밋 | `docs/verification/asset-audit/`·`docs/STATUS.md`·`docs/ROADMAP.html`만. `src/`·`public/`·`assets-inbox/` 변경 0 |

## 한계

- 표시 배율은 그리기 코드를 읽어 정했다(파일·줄 근거는 `display_scale_by_family.csv`). 길·이랑·성벽 면·다리처럼 늘여 그리는 띠는 한 방향의 배율로 대표했다. 나무·덤불·효과처럼 인스턴스마다 달라지는 것은 기준값(중간)을 썼다.
- 미설치 그림의 배율은 규격값이라 설치 때 달라질 수 있다.
- 헤일로 기준(가장자리 > 내부 + 40)은 빛 받은 윗면도 잡는다. 걸린 3장은 눈으로 보면 흰 테두리가 아니다.
- "코드 미참조"는 grep이다. 그리는 경로가 없는 등록 파일은 코드 추적으로 따로 적었고, 모두 확인하지는 않았다(표본 grep).
- 시트 글꼴은 macOS AppleSDGothicNeo. 방법 스크립트는 [`method/`](method/).

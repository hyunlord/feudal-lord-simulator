# wave42-land-stages

분류 나; 50장; 예상 10–16h.

src/engine/land.ts:35 treeStage, :41 fallowStage, :47 landOf가 엔진데이터를 제공한다. GameState.forestHarvests와 land.footpaths/footfall/fallow를 읽는다. 현재 render/forestRecovery.ts:6 forestVisualStage는 1800/3600~7200틱 별도 표현 기준을 사용하므로 이것을 진실로 삼아 LG-3 단계와 중복시키지 않는다. src/render/drawTrees.ts:25 계절그리기, treeLayout의 stump descriptor에 새로운 단계 선택을 연결한다.

stumps8: 기존 벌목 위치, fresh/mossy는 harvestedAtTick과 stumpAgeAt, oak/ash는 엔진 수종이 없으면 seed+cell의 고정 표현종(게임 수종으로 주장하지 않음). regrowth12: treeStage sapling/grown을 기반으로 1–3/4–8 묘목·youngwood, logstack은 살아있는 벌목작업 근처 표현 소품으로만(재고라고 주장하지 않음). abandoned10: land.fallow의 since→fallowStage grass/scrub/sapling; 밭이력 있는 칸에 furrow, 기존 경계가 있던 칸에 collapsed fence. road/건물 새사용 즉시 숨김. paths12+connections8: land.footpaths의 4방향 연결 mask, footfall 밀도로 faint/clear, wet 날씨로 muddy. 사거리 없는 모양은 명시fallback으로 이어 붙이며 좌우반전 금지. metadata의 ports/connects_to/connection_rule JSON을 적용하여 끝점 정합, 여름·겨울 같은 pivot.

128소품 폭32world부터, path512×256은 pivot·ports를64×32 tile 투영에 맞춘 scale0.25부터 시작(원본 연결길이에 따라 실제끝점 검증), 동적 엔진상태 바뀔 때 캐시만 무효화. 줌0.6에는 주경로와 단계대표 하나만, stump/logsmall 생략. 검증: 벌목 직후/3년/8년, 방치 grass/scrub/sapling 및 재사용, 길직선/모서리/갈림·비/눈을 동일 카메라로 촬영. 엔진 규칙/문턱을 바꾸지 않는다.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave42/bramble-v3-20261002/assets/abandoned/abandoned_bramble_summer.png` | `public/assets/wave42/abandoned/abandoned_bramble_summer.png` | 128×160 | [64, 120] | summer |
| `wave42/bramble-v3-20261002/assets/abandoned/abandoned_bramble_winter.png` | `public/assets/wave42/abandoned/abandoned_bramble_winter.png` | 128×160 | [64, 120] | winter |
| `wave42/candidates-20261002/assets/abandoned/abandoned_collapsed_fence_summer.png` | `public/assets/wave42/abandoned/abandoned_collapsed_fence_summer.png` | 128×160 | [64, 120] | summer |
| `wave42/candidates-20261002/assets/abandoned/abandoned_collapsed_fence_winter.png` | `public/assets/wave42/abandoned/abandoned_collapsed_fence_winter.png` | 128×160 | [64, 120] | winter |
| `wave42/candidates-20261002/assets/abandoned/abandoned_overgrown_furrows_summer.png` | `public/assets/wave42/abandoned/abandoned_overgrown_furrows_summer.png` | 128×160 | [64, 120] | summer |
| `wave42/candidates-20261002/assets/abandoned/abandoned_overgrown_furrows_winter.png` | `public/assets/wave42/abandoned/abandoned_overgrown_furrows_winter.png` | 128×160 | [64, 120] | winter |
| `wave42/candidates-20261002/assets/abandoned/abandoned_saplings_summer.png` | `public/assets/wave42/abandoned/abandoned_saplings_summer.png` | 128×160 | [64, 120] | summer |
| `wave42/candidates-20261002/assets/abandoned/abandoned_saplings_winter.png` | `public/assets/wave42/abandoned/abandoned_saplings_winter.png` | 128×160 | [64, 120] | winter |
| `wave42/candidates-20261002/assets/connections/path_clear_corner_ne_summer.png` | `public/assets/wave42/connections/path_clear_corner_ne_summer.png` | 128×128 | [64, 80] | summer |
| `wave42/candidates-20261002/assets/connections/path_clear_corner_ne_winter.png` | `public/assets/wave42/connections/path_clear_corner_ne_winter.png` | 128×128 | [64, 80] | winter |
| `wave42/candidates-20261002/assets/connections/path_clear_corner_nw_summer.png` | `public/assets/wave42/connections/path_clear_corner_nw_summer.png` | 128×128 | [64, 80] | summer |
| `wave42/candidates-20261002/assets/connections/path_clear_corner_nw_winter.png` | `public/assets/wave42/connections/path_clear_corner_nw_winter.png` | 128×128 | [64, 80] | winter |
| `wave42/candidates-20261002/assets/connections/path_clear_fork_ne_summer.png` | `public/assets/wave42/connections/path_clear_fork_ne_summer.png` | 128×128 | [64, 80] | summer |
| `wave42/candidates-20261002/assets/connections/path_clear_fork_ne_winter.png` | `public/assets/wave42/connections/path_clear_fork_ne_winter.png` | 128×128 | [64, 80] | winter |
| `wave42/candidates-20261002/assets/connections/path_clear_fork_nw_summer.png` | `public/assets/wave42/connections/path_clear_fork_nw_summer.png` | 128×128 | [64, 80] | summer |
| `wave42/candidates-20261002/assets/connections/path_clear_fork_nw_winter.png` | `public/assets/wave42/connections/path_clear_fork_nw_winter.png` | 128×128 | [64, 80] | winter |
| `wave42/candidates-20261002/assets/paths/path_clear_ne_summer.png` | `public/assets/wave42/paths/path_clear_ne_summer.png` | 512×64 | [256, 32] | summer |
| `wave42/candidates-20261002/assets/paths/path_clear_ne_winter.png` | `public/assets/wave42/paths/path_clear_ne_winter.png` | 512×64 | [256, 32] | winter |
| `wave42/candidates-20261002/assets/paths/path_clear_nw_summer.png` | `public/assets/wave42/paths/path_clear_nw_summer.png` | 512×64 | [256, 32] | summer |
| `wave42/candidates-20261002/assets/paths/path_clear_nw_winter.png` | `public/assets/wave42/paths/path_clear_nw_winter.png` | 512×64 | [256, 32] | winter |
| `wave42/candidates-20261002/assets/paths/path_faint_ne_summer.png` | `public/assets/wave42/paths/path_faint_ne_summer.png` | 512×64 | [256, 32] | summer |
| `wave42/candidates-20261002/assets/paths/path_faint_ne_winter.png` | `public/assets/wave42/paths/path_faint_ne_winter.png` | 512×64 | [256, 32] | winter |
| `wave42/candidates-20261002/assets/paths/path_faint_nw_summer.png` | `public/assets/wave42/paths/path_faint_nw_summer.png` | 512×64 | [256, 32] | summer |
| `wave42/candidates-20261002/assets/paths/path_faint_nw_winter.png` | `public/assets/wave42/paths/path_faint_nw_winter.png` | 512×64 | [256, 32] | winter |
| `wave42/candidates-20261002/assets/paths/path_muddy_ne_summer.png` | `public/assets/wave42/paths/path_muddy_ne_summer.png` | 512×64 | [256, 32] | summer |
| `wave42/candidates-20261002/assets/paths/path_muddy_ne_winter.png` | `public/assets/wave42/paths/path_muddy_ne_winter.png` | 512×64 | [256, 32] | winter |
| `wave42/candidates-20261002/assets/paths/path_muddy_nw_summer.png` | `public/assets/wave42/paths/path_muddy_nw_summer.png` | 512×64 | [256, 32] | summer |
| `wave42/candidates-20261002/assets/paths/path_muddy_nw_winter.png` | `public/assets/wave42/paths/path_muddy_nw_winter.png` | 512×64 | [256, 32] | winter |
| `wave42/candidates-20261002/assets/regrowth/log_stack_a_summer.png` | `public/assets/wave42/regrowth/log_stack_a_summer.png` | 128×128 | [64, 108] | summer |
| `wave42/candidates-20261002/assets/regrowth/log_stack_a_winter.png` | `public/assets/wave42/regrowth/log_stack_a_winter.png` | 128×128 | [64, 108] | winter |
| `wave42/candidates-20261002/assets/regrowth/log_stack_b_summer.png` | `public/assets/wave42/regrowth/log_stack_b_summer.png` | 128×128 | [64, 108] | summer |
| `wave42/candidates-20261002/assets/regrowth/log_stack_b_winter.png` | `public/assets/wave42/regrowth/log_stack_b_winter.png` | 128×128 | [64, 108] | winter |
| `wave42/candidates-20261002/assets/regrowth/young_wood_a_summer.png` | `public/assets/wave42/regrowth/young_wood_a_summer.png` | 128×192 | [64, 172] | summer |
| `wave42/candidates-20261002/assets/regrowth/young_wood_a_winter.png` | `public/assets/wave42/regrowth/young_wood_a_winter.png` | 128×192 | [64, 172] | winter |
| `wave42/candidates-20261002/assets/regrowth/young_wood_b_summer.png` | `public/assets/wave42/regrowth/young_wood_b_summer.png` | 128×192 | [64, 172] | summer |
| `wave42/candidates-20261002/assets/regrowth/young_wood_b_winter.png` | `public/assets/wave42/regrowth/young_wood_b_winter.png` | 128×192 | [64, 172] | winter |
| `wave42/candidates-20261002/assets/stumps/stump_ash_small_fresh_summer.png` | `public/assets/wave42/stumps/stump_ash_small_fresh_summer.png` | 128×128 | [64, 108] | summer |
| `wave42/candidates-20261002/assets/stumps/stump_ash_small_fresh_winter.png` | `public/assets/wave42/stumps/stump_ash_small_fresh_winter.png` | 128×128 | [64, 108] | winter |
| `wave42/candidates-20261002/assets/stumps/stump_ash_small_mossy_summer.png` | `public/assets/wave42/stumps/stump_ash_small_mossy_summer.png` | 128×128 | [64, 108] | summer |
| `wave42/candidates-20261002/assets/stumps/stump_ash_small_mossy_winter.png` | `public/assets/wave42/stumps/stump_ash_small_mossy_winter.png` | 128×128 | [64, 108] | winter |
| `wave42/candidates-20261002/assets/stumps/stump_oak_large_fresh_summer.png` | `public/assets/wave42/stumps/stump_oak_large_fresh_summer.png` | 128×128 | [64, 108] | summer |
| `wave42/candidates-20261002/assets/stumps/stump_oak_large_fresh_winter.png` | `public/assets/wave42/stumps/stump_oak_large_fresh_winter.png` | 128×128 | [64, 108] | winter |
| `wave42/candidates-20261002/assets/stumps/stump_oak_large_mossy_summer.png` | `public/assets/wave42/stumps/stump_oak_large_mossy_summer.png` | 128×128 | [64, 108] | summer |
| `wave42/candidates-20261002/assets/stumps/stump_oak_large_mossy_winter.png` | `public/assets/wave42/stumps/stump_oak_large_mossy_winter.png` | 128×128 | [64, 108] | winter |
| `wave42/rework-20261002/assets/abandoned/abandoned_grass_summer.png` | `public/assets/wave42/abandoned/abandoned_grass_summer.png` | 128×160 | [64, 120] | summer |
| `wave42/rework-20261002/assets/abandoned/abandoned_grass_winter.png` | `public/assets/wave42/abandoned/abandoned_grass_winter.png` | 128×160 | [64, 120] | winter |
| `wave42/rework-20261002/assets/regrowth/sapling_1to3_summer.png` | `public/assets/wave42/regrowth/sapling_1to3_summer.png` | 128×192 | [64, 172] | summer |
| `wave42/rework-20261002/assets/regrowth/sapling_1to3_winter.png` | `public/assets/wave42/regrowth/sapling_1to3_winter.png` | 128×192 | [64, 172] | winter |
| `wave42/rework-20261002/assets/regrowth/sapling_4to8_summer.png` | `public/assets/wave42/regrowth/sapling_4to8_summer.png` | 128×192 | [64, 172] | summer |
| `wave42/rework-20261002/assets/regrowth/sapling_4to8_winter.png` | `public/assets/wave42/regrowth/sapling_4to8_winter.png` | 128×192 | [64, 172] | winter |


## 용량과 공통 처리

이 실행 묶음 50장: 메타데이터 제거 후 원본 합계 1.15 MiB, 원본 RGBA 한 벌 산술 합계 4.28 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

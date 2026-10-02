# 장부 정합성만 복구

분류 장부정리 · 59장 · 관련 작업 INSTALL-7 / UI-4 · 예상 0.5–1 작업시간(사람 시간, 실측 아님).

## 코드 근거

docs/provenance/assets.csv sourceSha256/sourcePath → runtimePath; src/render/wave7ArtManifest.generated.ts; src/render/wave9ArtManifest.generated.ts

## 연결·자리·선택

이미 설치된 동일 원본의 사본이다. 새 파일 복사·카탈로그 중복 추가 없이 existing_target를 유지한다. installed_by는 검증된 기존 작업 ID INSTALL-7 또는 UI-4만 기록한다. 감사 기록은 별도 비고/설치 보고서에 남긴다.

## 확인할 장면·줌·계절

기존 사용 장면 한 곳에서 0.6/1.0 확인. 이번 감사는 재설치 승인 아님.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave17/candidates-20260926/assets/prop/refugee_child_sheet-v1.png|public/assets/wave9/prop/leaving_child_sheet-v1.png|296×148|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_bread_ne-v1.png|public/assets/wave7/cart/cart_load_bread_ne-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_bread_nw-v1.png|public/assets/wave7/cart/cart_load_bread_nw-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_grainsack_ne-v1.png|public/assets/wave7/cart/cart_load_grainsack_ne-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_grainsack_nw-v1.png|public/assets/wave7/cart/cart_load_grainsack_nw-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_log_ne-v1.png|public/assets/wave7/cart/cart_load_log_ne-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_log_nw-v1.png|public/assets/wave7/cart/cart_load_log_nw-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_rawstone_ne-v1.png|public/assets/wave7/cart/cart_load_rawstone_ne-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_rawstone_nw-v1.png|public/assets/wave7/cart/cart_load_rawstone_nw-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_stone_ne-v1.png|public/assets/wave7/cart/cart_load_stone_ne-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/cart_load_stone_nw-v1.png|public/assets/wave7/cart/cart_load_stone_nw-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/construction/roof_frame_large-v1.png|public/assets/wave7/construction/roof_frame_large-v1.png|256×192|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/construction/roof_frame_medium-v1.png|public/assets/wave7/construction/roof_frame_medium-v1.png|192×144|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/construction/roof_frame_small-v1.png|public/assets/wave7/construction/roof_frame_small-v1.png|128×96|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/construction/roof_frame_stone_large-v1.png|public/assets/wave7/construction/roof_frame_stone_large-v1.png|256×224|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/fx/dust_puff_sheet-v1.png|public/assets/wave7/fx/dust_puff_sheet-v1.png|256×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/fx/oven_smoke_sheet-v1.png|public/assets/wave7/fx/oven_smoke_sheet-v1.png|256×96|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/fx/plus_float-v1.png|public/assets/wave7/fx/plus_float-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/fx/roof_smoke_sheet-v1.png|public/assets/wave7/fx/roof_smoke_sheet-v1.png|192×80|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/fx/roof_smoke_weak_sheet-v1.png|public/assets/wave7/fx/roof_smoke_weak_sheet-v1.png|192×80|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/bread_1-v1.png|public/assets/wave7/pile/bread_1-v1.png|64×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/bread_2-v1.png|public/assets/wave7/pile/bread_2-v1.png|64×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/bread_3-v1.png|public/assets/wave7/pile/bread_3-v1.png|64×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/crates_1-v1.png|public/assets/wave7/pile/crates_1-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/crates_2-v1.png|public/assets/wave7/pile/crates_2-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/crates_3-v1.png|public/assets/wave7/pile/crates_3-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/sacks_1-v1.png|public/assets/wave7/pile/sacks_1-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/sacks_2-v1.png|public/assets/wave7/pile/sacks_2-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/sacks_3-v1.png|public/assets/wave7/pile/sacks_3-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/sheaves_1-v1.png|public/assets/wave7/pile/sheaves_1-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/sheaves_2-v1.png|public/assets/wave7/pile/sheaves_2-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/pile/sheaves_3-v1.png|public/assets/wave7/pile/sheaves_3-v1.png|96×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/season/dry_grass_a-v1.png|public/assets/wave7/season/dry_grass_a-v1.png|96×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/season/dry_grass_b-v1.png|public/assets/wave7/season/dry_grass_b-v1.png|96×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/season/leaves_a-v1.png|public/assets/wave7/season/leaves_a-v1.png|96×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/season/leaves_b-v1.png|public/assets/wave7/season/leaves_b-v1.png|96×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/season/leaves_c-v1.png|public/assets/wave7/season/leaves_c-v1.png|96×48|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/signifier/empty_stall-v1.png|public/assets/wave7/signifier/empty_stall-v1.png|96×96|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/signifier/tall_grass_plot-v1.png|public/assets/wave7/signifier/tall_grass_plot-v1.png|128×64|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_breadbasket_ne-v1.png|public/assets/wave7/work/work_breadbasket_ne-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_breadbasket_nw-v1.png|public/assets/wave7/work/work_breadbasket_nw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_breadbasket_se-v1.png|public/assets/wave7/work/work_breadbasket_se-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_breadbasket_sw-v1.png|public/assets/wave7/work/work_breadbasket_sw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_coinpurse_ne-v1.png|public/assets/wave7/work/work_coinpurse_ne-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_coinpurse_nw-v1.png|public/assets/wave7/work/work_coinpurse_nw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_coinpurse_se-v1.png|public/assets/wave7/work/work_coinpurse_se-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_coinpurse_sw-v1.png|public/assets/wave7/work/work_coinpurse_sw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_plough_ne-v1.png|public/assets/wave7/work/work_plough_ne-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_plough_nw-v1.png|public/assets/wave7/work/work_plough_nw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_plough_se-v1.png|public/assets/wave7/work/work_plough_se-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_plough_sw-v1.png|public/assets/wave7/work/work_plough_sw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_seedbag_ne-v1.png|public/assets/wave7/work/work_seedbag_ne-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_seedbag_nw-v1.png|public/assets/wave7/work/work_seedbag_nw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_seedbag_se-v1.png|public/assets/wave7/work/work_seedbag_se-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_seedbag_sw-v1.png|public/assets/wave7/work/work_seedbag_sw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_waterbucket_ne-v1.png|public/assets/wave7/work/work_waterbucket_ne-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_waterbucket_nw-v1.png|public/assets/wave7/work/work_waterbucket_nw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_waterbucket_se-v1.png|public/assets/wave7/work/work_waterbucket_se-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|
|wave7/rework-v1/assets/original-assets/work/work_waterbucket_sw-v1.png|public/assets/wave7/work/work_waterbucket_sw-v1.png|32×32|per-frame/source registration: wave7/rework-v1/records/ (spec requirement; not guessed)|


## 용량과 공통 처리

이 실행 묶음 59장: 메타데이터 제거 후 원본 합계 0.46 MiB, 원본 RGBA 한 벌 산술 합계 1.70 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

# wave39-weather-ground

분류 나; 19장; 예상 6–10h.

engine weather 상태 연결: src/render/weatherLayers.ts:167 engineWeather가 src/engine/eventSchedule.ts weatherActive/weatherAt에서 wet/dry/cold/normal을 읽는다. src/render/weatherOverlay.ts:57 wetSpots, :77 drawWeatherGround와 src/render/weatherPlacement.ts:81 landSpots를 재사용하되 Wave23Key 고정 loader를 Wave39 manifest도 받도록 확장한다. 현재 Wave39는 등록되어 있지 않다.

웅덩이6·mudscar2는 도로/잔디 material별 저지대 지면에, wet 동안 증가·건조 때 감소시키는 표현 상태만 둔다. wet mask2는 해당 grass/soil 지면 마스크에 multiply; 물과 지붕 제외. cloud shadow2는 기존 cloud deck 흐름을 재사용. 땅낙엽6은 가을/수종별 forest-edge 결정해시로 배치, floating leaves는 물가에 제한한다. 한칸 모든그림을 겹치지 않으며 stable hash seed+tile+kind로 선택. 원본 CSV pivot·frame·alpha·speed 권고는 ../METADATA/nature.json에 보존. 월드 소품은 사람17.6world를 기준으로 작은/중간/큰 낙엽과 웅덩이 표시폭12/24/40world에서 시작, 실제 캡처로 확정. 줌0.6에는 windrow/큰웅덩이만 남기고 작은흔적 생략; 1.0/1.4 전체. 비 전/중/후, 가을낙엽/겨울눈에서 동일카메라15초 연속 캡처, 화면 끌 때 붙어움직이지 않는지 확인.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave39/candidates-20260930/assets/debris/floating_leaves-v1.png` | `public/assets/wave39/debris/floating_leaves-v1.png` | 64×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/debris/ground_leaves_large-v1.png` | `public/assets/wave39/debris/ground_leaves_large-v1.png` | 96×48 | [48, 24] | n/a |
| `wave39/candidates-20260930/assets/debris/ground_leaves_medium_birch_maple-v1.png` | `public/assets/wave39/debris/ground_leaves_medium_birch_maple-v1.png` | 64×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/debris/ground_leaves_medium_oak_beech-v1.png` | `public/assets/wave39/debris/ground_leaves_medium_oak_beech-v1.png` | 64×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/debris/ground_leaves_small-v1.png` | `public/assets/wave39/debris/ground_leaves_small-v1.png` | 32×16 | [16, 8] | n/a |
| `wave39/candidates-20260930/assets/debris/ground_leaves_windrow_a-v1.png` | `public/assets/wave39/debris/ground_leaves_windrow_a-v1.png` | 96×32 | [48, 16] | n/a |
| `wave39/candidates-20260930/assets/debris/ground_leaves_windrow_b-v1.png` | `public/assets/wave39/debris/ground_leaves_windrow_b-v1.png` | 96×32 | [48, 16] | n/a |
| `wave39/candidates-20260930/assets/puddles/mud_scar_large-v1.png` | `public/assets/wave39/puddles/mud_scar_large-v1.png` | 96×48 | [48, 24] | n/a |
| `wave39/candidates-20260930/assets/puddles/mud_scar_medium-v1.png` | `public/assets/wave39/puddles/mud_scar_medium-v1.png` | 64×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/puddles/puddle_large_a-v1.png` | `public/assets/wave39/puddles/puddle_large_a-v1.png` | 96×48 | [48, 24] | n/a |
| `wave39/candidates-20260930/assets/puddles/puddle_large_b-v1.png` | `public/assets/wave39/puddles/puddle_large_b-v1.png` | 96×48 | [48, 24] | n/a |
| `wave39/candidates-20260930/assets/puddles/puddle_medium_a-v1.png` | `public/assets/wave39/puddles/puddle_medium_a-v1.png` | 64×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/puddles/puddle_medium_b-v1.png` | `public/assets/wave39/puddles/puddle_medium_b-v1.png` | 64×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/puddles/puddle_small_a-v1.png` | `public/assets/wave39/puddles/puddle_small_a-v1.png` | 32×16 | [16, 8] | n/a |
| `wave39/candidates-20260930/assets/puddles/puddle_small_b-v1.png` | `public/assets/wave39/puddles/puddle_small_b-v1.png` | 32×16 | [16, 8] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_cloud_shadow_a-v1.png` | `public/assets/wave39/rain/rain_cloud_shadow_a-v1.png` | 512×256 | [256, 128] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_cloud_shadow_b-v1.png` | `public/assets/wave39/rain/rain_cloud_shadow_b-v1.png` | 512×256 | [256, 128] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_wet_mask_grass-v1.png` | `public/assets/wave39/rain/rain_wet_mask_grass-v1.png` | 128×64 | [64, 32] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_wet_mask_soil-v1.png` | `public/assets/wave39/rain/rain_wet_mask_soil-v1.png` | 128×64 | [64, 32] | n/a |


## 용량과 공통 처리

이 실행 묶음 19장: 메타데이터 제거 후 원본 합계 0.07 MiB, 원본 RGBA 한 벌 산술 합계 1.21 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

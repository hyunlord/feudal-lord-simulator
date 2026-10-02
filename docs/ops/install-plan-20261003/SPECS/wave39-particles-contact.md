# wave39-particles-contact

분류 다; 39장; 예상 16–24h.

기존 seasonFx.ts:33 drawSeasonFx는 낙엽 시트·화면공간 눈, weatherOverlay.ts:124 drawWeatherSky는 화면 시트다. 작은 낱개 rain streak·snowflake를 이 API에 추가만 하면 올바른 깊이/충돌이 생기지 않는다. world-coordinate particle emitter, 지붕/지면/수면 contact classifier, 지붕 앞뒤 합성, 수명/밀도 제한이 새 렌더 기능이다. 현재 엔진 날씨·달력은 weatherLayers.ts:167 engineWeather와 seasonArt.ts:35 seasonOf에서 읽는다. 게임 저장 경제 상태는 변경하지 않는다.

12빗줄기·6튐: seed/camera-independent 월드 emitter, 물질별 contact에서 흙/돌/지붕 splash 선택. 낙엽12: 나무좌표/수종 기반, 수명 후 땅층으로 전환. 바람낙엽2·지붕낙엽1·눈보라1·눈송이3·눈발자국2: 이동장/지붕마스크/워커접지이력 기능을 명시적으로 구현. 빗줄기 실제핵1px 권고, 줌0.6 사람보다 길게 읽히지 않음. CSV의 speedPxPerSec/lifetimeSeconds/frameWidth/frameHeight/frameCount/recommendedAlpha를 그대로 초기 데이터로 쓴다. particles per viewport 예산은 별도 성능실측으로 정한다(이 조사에서 측정하지 않음). 줌0.6 작은눈/낱잎/발자국 제외, 비 방향·덩어리는 유지. 비·눈 각 20초, camera pan/zoom·일시정지·x1/x4에서 속도/깊이/지붕 관통·화면고정 확인. 설치만으로 보장 가능한 기능이 아니므로 C.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave39/candidates-20260930/assets/debris/roof_leaves-v1.png` | `public/assets/wave39/debris/roof_leaves-v1.png` | 48×32 | [24, 16] | n/a |
| `wave39/candidates-20260930/assets/debris/wind_leaves_group_a-v1.png` | `public/assets/wave39/debris/wind_leaves_group_a-v1.png` | 384×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/debris/wind_leaves_group_b-v1.png` | `public/assets/wave39/debris/wind_leaves_group_b-v1.png` | 384×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_beech_brown-v1.png` | `public/assets/wave39/leaves/falling_beech_brown-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_beech_orange-v1.png` | `public/assets/wave39/leaves/falling_beech_orange-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_beech_yellow-v1.png` | `public/assets/wave39/leaves/falling_beech_yellow-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_birch_brown-v1.png` | `public/assets/wave39/leaves/falling_birch_brown-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_birch_orange-v1.png` | `public/assets/wave39/leaves/falling_birch_orange-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_birch_yellow-v1.png` | `public/assets/wave39/leaves/falling_birch_yellow-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_fieldmaple_brown-v1.png` | `public/assets/wave39/leaves/falling_fieldmaple_brown-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_fieldmaple_orange-v1.png` | `public/assets/wave39/leaves/falling_fieldmaple_orange-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_fieldmaple_yellow-v1.png` | `public/assets/wave39/leaves/falling_fieldmaple_yellow-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_oak_brown-v1.png` | `public/assets/wave39/leaves/falling_oak_brown-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_oak_orange-v1.png` | `public/assets/wave39/leaves/falling_oak_orange-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/leaves/falling_oak_yellow-v1.png` | `public/assets/wave39/leaves/falling_oak_yellow-v1.png` | 96×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_splash_roof_large-v1.png` | `public/assets/wave39/rain/rain_splash_roof_large-v1.png` | 96×16 | [12, 13] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_splash_roof_small-v1.png` | `public/assets/wave39/rain/rain_splash_roof_small-v1.png` | 64×12 | [8, 9] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_splash_soil_large-v1.png` | `public/assets/wave39/rain/rain_splash_soil_large-v1.png` | 96×16 | [12, 13] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_splash_soil_small-v1.png` | `public/assets/wave39/rain/rain_splash_soil_small-v1.png` | 64×12 | [8, 9] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_splash_stone_large-v1.png` | `public/assets/wave39/rain/rain_splash_stone_large-v1.png` | 96×16 | [12, 13] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_splash_stone_small-v1.png` | `public/assets/wave39/rain/rain_splash_stone_small-v1.png` | 64×12 | [8, 9] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_10px_1px_faint-v1.png` | `public/assets/wave39/rain/rain_streak_10px_1px_faint-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_10px_1px_strong-v1.png` | `public/assets/wave39/rain/rain_streak_10px_1px_strong-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_10px_2px_faint-v1.png` | `public/assets/wave39/rain/rain_streak_10px_2px_faint-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_10px_2px_strong-v1.png` | `public/assets/wave39/rain/rain_streak_10px_2px_strong-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_4px_1px_faint-v1.png` | `public/assets/wave39/rain/rain_streak_4px_1px_faint-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_4px_1px_strong-v1.png` | `public/assets/wave39/rain/rain_streak_4px_1px_strong-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_4px_2px_faint-v1.png` | `public/assets/wave39/rain/rain_streak_4px_2px_faint-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_4px_2px_strong-v1.png` | `public/assets/wave39/rain/rain_streak_4px_2px_strong-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_7px_1px_faint-v1.png` | `public/assets/wave39/rain/rain_streak_7px_1px_faint-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_7px_1px_strong-v1.png` | `public/assets/wave39/rain/rain_streak_7px_1px_strong-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_7px_2px_faint-v1.png` | `public/assets/wave39/rain/rain_streak_7px_2px_faint-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/rain/rain_streak_7px_2px_strong-v1.png` | `public/assets/wave39/rain/rain_streak_7px_2px_strong-v1.png` | 16×24 | [8, 12] | n/a |
| `wave39/candidates-20260930/assets/snow/blowing_snow_sheet-v1.png` | `public/assets/wave39/snow/blowing_snow_sheet-v1.png` | 384×32 | [32, 16] | n/a |
| `wave39/candidates-20260930/assets/snow/footprints_snow_a-v1.png` | `public/assets/wave39/snow/footprints_snow_a-v1.png` | 128×64 | [64, 32] | n/a |
| `wave39/candidates-20260930/assets/snow/footprints_snow_b-v1.png` | `public/assets/wave39/snow/footprints_snow_b-v1.png` | 128×64 | [64, 32] | n/a |
| `wave39/candidates-20260930/assets/snow/snowflake_large-v1.png` | `public/assets/wave39/snow/snowflake_large-v1.png` | 16×16 | [8, 8] | n/a |
| `wave39/candidates-20260930/assets/snow/snowflake_medium-v1.png` | `public/assets/wave39/snow/snowflake_medium-v1.png` | 12×12 | [6, 6] | n/a |
| `wave39/candidates-20260930/assets/snow/snowflake_small-v1.png` | `public/assets/wave39/snow/snowflake_small-v1.png` | 8×8 | [4, 4] | n/a |


## 용량과 공통 처리

이 실행 묶음 39장: 메타데이터 제거 후 원본 합계 0.04 MiB, 원본 RGBA 한 벌 산술 합계 0.33 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

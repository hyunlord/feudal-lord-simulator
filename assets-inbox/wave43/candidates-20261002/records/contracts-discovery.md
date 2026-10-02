# Wave43 현재 참조 계약 조사

소스 `/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill`, HEAD bdf84129013651de9daa9c638d455dba2b9409ac. 이미지 생성 전 읽기 전용 조사. 의뢰 `/Users/rexxa/Downloads/ASTRA_Wave43_spring.md`.

## 일반 나무6

여름 원본은 모두 `public/assets/foliage/{ID}.png`. 겨울은 `public/assets/wave15/foliage/{ID}_winter[-생략]_...`가 아니라 아래 정확한 suffix를 사용한다.

|ID|캔버스|피벗|겨울 suffix|기존 봄|
|---|---|---|---|---|
|tree_oak_large|88×112|(44,112)|_winter-v1.png 또는 _winter_snow-v1.png|_spring-v1.png 있음|
|tree_oak_small|64×80|(32,80)|_winter-v1.png 또는 _winter_snow-v1.png|_spring-v1.png 있음|
|tree_birch|60×96|(30,96)|_winter-v1.png|_spring-v1.png 있음|
|tree_pine_tall|64×120|(32,120)|_winter_snow-v1.png|없음|
|tree_pine_short|56×88|(28,88)|_winter_snow-v1.png|없음|
|tree_dead|56×80|(28,80)|_winter_snow-v1.png|없음|

근거 `src/render/worldAssetManifest.generated.ts:293–394`, `seasonArtManifest.generated.ts`, `seasonArt.ts:11–14,39–43`. 이미 봄3종과 과수 봄판은 실제 seasonVariant에 등록되어 있다. ‘봄은 여름 그대로’는 모든 나무에 적용되는 현소스 설명이 아니다.

제안: 정확한 기존6종을 유지한다. 참나무2·자작나무는 연두 새잎, 소나무2는 침엽 수관을 그대로 두고 끝의 은은한 봄 새순만. 고사목은 죽은 가지·실루엣을 유지하고 젖은 목질과 기존 이끼 색 정도만 봄화한다. 고사목을 살아 있는 다른 나무로 바꾸거나 잎을 붙이지 않는다.

## 과수 및 Wave41 승인 참조

모두256×256. `src/render/zoneAssetManifest.ts:43–46`:
- orchard_apple_c 피벗(128,246)
- orchard_apple_d 피벗(123,246)
- orchard_pear_e 피벗(123,246)
- orchard_plum_f 피벗(141,246)

설치 여름은 `public/assets/zones/{ID}-v1.png`, 설치 겨울은 `public/assets/wave15/orchard/{ID}_winter-v1.png`, 기존 봄은 같은 폴더 `{ID}_spring-v1.png`.

승인된 새 재료 참조는 `assets-inbox/wave41/candidates-20261002/assets/11-orchard_apple_c-v1-wave41-v1.png`, `12-orchard_apple_d-v1-wave41-v1.png`, `13-orchard_pear_e-v1-wave41-v1.png`, `14-orchard_plum_f-v1-wave41-v1.png`. `docs/ASSET_INBOX.md:308` confirmed, 게임 미설치. 사과2·배1·자두1이며 벚은 아니다.

벚 원본/시즌 등록은 발견하지 못했다. 의뢰 과수4종은 사과·배·자두·벚이므로 사과c/배e/자두f를 승인 참조로 삼고 벚은 신규 종류로 분명히 기록해야 한다. 벚을 사과d의 기존 정체성과 혼동하지 말 것. 필요 시 사과d를256×256/(123,246) 크기·접지 배치의 기하 템플릿으로만 쓰는 것은 제작 결정이며 기존 벚 원본 존재 증거가 아니다.

## 강가 봄 채움 참조

강가는 Wave22 heath가 아니다. `src/render/archetypeGroundModel.ts:64–67`에서 RIVERSIDE_ARCHETYPE은 Wave22 landGround를 사용하지 않는다. 기존 `grass` 원본은 `public/assets/terrain/grass.png` 실측256×256, 피벗(0,0). 계절형식 참조는 `public/assets/wave15/terrain/grass_winter_fill-v1.png` 실측256×128; `seasonGround.ts:5–7,45–46`은256×128 2×2 world-aligned seasonal fill을0.5 배율로 사용한다. 봄은 의뢰 공통규격256×128 XY반복으로 신규 grass_spring_fill을 만들되 여름256×256 원본을 같은규격이라 주장하지 않는다. 여름은 재질참조, 겨울은 계절 fill규격 참조다.

## ground8 제작 결정

5개256×128 XY반복/pivot(0,0): `riverside_grass_spring_a`, `coastal_grass_spring_a`, `chalk_down_spring_a`, `woodland_floor_spring_a`, `fen_spring_a`. 뒤4개 대응 Wave22 `public/assets/wave22/terrain/{base}_{summer,winter}_a.png`.

밭3개512×64 X반복/pivot(0,0) 텍스처: `ridge_ploughed_spring_a`, `ridge_seedling_spring_a`, `ridge_seedling_spring_b`. 기존 `public/assets/fields/ridge_ploughed_a-v1.png`, `ridge_seedling_a-v1.png`, `ridge_seedling_b-v1.png`를 각각 기하참조. `zoneAssetManifest.ts:20–23`의 strip 규격 유지. 해당 시즌 겨울 별도판은 없어 비교용 `public/assets/wave15/fields/ridge_fallow_winter-v1.png`는 동일상태 겨울판이 아닌 겨울 휴경 재질참조로 표기한다.

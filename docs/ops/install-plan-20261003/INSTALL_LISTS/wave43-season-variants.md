# wave43-season-variants

분류 가; 9장; 예상 1.5–3h.

INSTALL_LISTS/wave43-season-variants.fragments.ts를 SEASON_IMAGES(src/render/seasonArtManifest.generated.ts)에 key별 병합한다. 이미 있는 key는 교체하고 없는 pine/dead key만 추가한다. seasonArt.ts:22–31가 bases×season 인덱스를 만들고 :40 seasonVariant, :66 preloadSeasonArt가 전체 항목을 자동 소비한다. drawTrees.ts:25 drawSeasonalSprite가 나무6종을 선택하고 zonePropSprites.ts:36 seasonalProp가 사과C·배E·자두F 3종을 선택한다.

나무 캔버스/피벗은 원본 CSV 그대로, 여름 spriteMeta의 renderScale·anchor를 상속. 과수별 (128,246)/(123,246)/(141,246)과 표시폭43 유지. 봄 그림만 교체하고 기존 겨울/가을/여름 선택을 유지한다. 나무/과수 stable salt는 기존 구현을 유지하고 광원 반전 금지. 소품추가가 아니므로 줌0.6도 기존 base의 LOD를 따른다. 기존 과수 geometry/plum_j를 사용한 벚나무는 species 의미가 달라 별도 B로 두었다. 봄 이전/도중/이후의 동일 나무를 찍어 단계적 전환과 알파등록 확인.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave43/candidates-20261002/assets/orchard/orchard_apple_spring.png` | `public/assets/wave43/orchard/orchard_apple_spring.png` | 256×256 | [128,246] | spring |
| `wave43/candidates-20261002/assets/orchard/orchard_pear_spring.png` | `public/assets/wave43/orchard/orchard_pear_spring.png` | 256×256 | [123,246] | spring |
| `wave43/candidates-20261002/assets/orchard/orchard_plum_spring.png` | `public/assets/wave43/orchard/orchard_plum_spring.png` | 256×256 | [141,246] | spring |
| `wave43/candidates-20261002/assets/trees_broadleaf/tree_birch_spring.png` | `public/assets/wave43/trees_broadleaf/tree_birch_spring.png` | 60×96 | [30,96] | spring |
| `wave43/candidates-20261002/assets/trees_broadleaf/tree_oak_large_spring.png` | `public/assets/wave43/trees_broadleaf/tree_oak_large_spring.png` | 88×112 | [44,112] | spring |
| `wave43/candidates-20261002/assets/trees_broadleaf/tree_oak_small_spring.png` | `public/assets/wave43/trees_broadleaf/tree_oak_small_spring.png` | 64×80 | [32,80] | spring |
| `wave43/candidates-20261002/assets/trees_other/tree_dead_spring.png` | `public/assets/wave43/trees_other/tree_dead_spring.png` | 56×80 | [28,80] | spring |
| `wave43/candidates-20261002/assets/trees_other/tree_pine_short_spring.png` | `public/assets/wave43/trees_other/tree_pine_short_spring.png` | 56×88 | [28,88] | spring |
| `wave43/candidates-20261002/assets/trees_other/tree_pine_tall_spring.png` | `public/assets/wave43/trees_other/tree_pine_tall_spring.png` | 64×120 | [32,120] | spring |


## 용량과 공통 처리

이 실행 묶음 9장: 메타데이터 제거 후 원본 합계 0.28 MiB, 원본 RGBA 한 벌 산술 합계 0.89 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

기존 여름 base에 연결된 봄·가을·겨울 key/URL/크기는 [계절 짝 목록](existing-season-pairs.json)의 byBase에서 확인한다. Wave43은 해당 base의 spring만 이 묶음 조각으로 바꾸고 autumn/winter를 보존한다. 계절 짝이 없는 그림은 반전·색조 변경으로 임의 생성하지 않는다.

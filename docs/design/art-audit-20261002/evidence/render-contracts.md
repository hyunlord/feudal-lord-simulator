# 오버레이·사람/문 비율 코드 계약 재확인

대상 HEAD10678bb94b85. 제품 파일 변경 없이 코드만 확인. 아래는 그림 담당자의 문 높이 측정을 독립 재측정한 결과가 아니라, 그 측정값을 게임에 적용하는 변환 계약 검증이다.

## 1. 오버레이는 각각 alpha bbox로 재정렬되지 않는다

**결론: 질문의 Wave26/30/32는 같은 캔버스에 원좌표로 포개는 비교가 유효하다.** 각 파일을 불투명 bbox로 별도 확대/중앙정렬한 비교는 무효다. 런타임은 레이어 내부의 잘못된 축소·이동을 자동 교정하지 않는다.

- `src/render/wave26HouseArt.ts:72` `wave26HouseRect`: 승인 base bounds에 대한 variant.crop의 차이를 같은 world 배율로 옮긴다. 이는 variant 몸체 전체의 등록 범위를 넓히는 공통 좌표 변환이다.
- 같은 파일80–88 `drawWave26House`: base는 `variant.crop`을 `target`으로 그린다.
- 같은 파일99–106 `drawWave26HouseLayers`: fresh/weathered/boarded/snow 모두 **같은 variant.crop, declared frame, target**을 `layers.drawOnReference`로 전달한다. 오버레이 고유 bbox 검색은 없다.
- `src/render/manifestArt.ts:45` `drawOnReference`: `kx = meta.width / declared.width`, `ky = meta.height / declared.height`; crop 좌표·폭·높이에 배율만 곱하고, 전달받은 rect에 그대로 그린다. pivot 재계산/alpha trim/레이어별 자동 fit이 없다.
- `src/render/runtimeAssetCoordinates.ts:25` / `:32`: base variant의 실제 축소 PNG도 승인 full canvas 비율대로 샘플링 좌표만 바뀐다. overlay와 다른 정렬 연산을 하지 않는다.
- `src/render/buildingOverlays.ts:63` 단독 집과 `:86` 합필 집이 위 경로를 호출한다.

확인한 manifest 동일 캔버스:

| 본체 및 해당 레이어 | 공통 파일 캔버스 |
|---|---:|
| Wave26 house_l0_c + fresh |153×153|
| Wave26 house_l3_c + fresh |142×142|
| Wave26 house_l4_c + fresh |161×161|
| Wave30 house_pair_l2_horizontal_c + snow |195×156|
| Wave30 house_pair_l4_horizontal_e + snow |204×204|
| Wave32 granary_b + weathered |160×144|

Wave32는 더욱 직접적이다: `src/render/wave32GranaryArt.ts:16` CANVAS=0,0,160,144; `:50`에서 모든 레이어를 `drawOnReference(context,key,CANVAS,CANVAS,rect)`로 그린다. `buildingOverlays.ts:72`가 본체와 같은 `fittedBuildingSpriteRect("barn", building)`를 공급하며 본체는 `buildingSpriteFit.ts:54`에서 full image→동일 rect로 그린다.

**판정 경계:** 레이어의 alpha bbox가 본체보다 작은 것 자체는 결함이 아니다(눈/문판/마모는 일부만 덮음). 그러나 의도된 처마·문·벽 모서리에 선이 이중으로 생기거나 전체 레이어가 축소/이동된 그림은 이 런타임에서 그대로 어긋난다. 코드 검증만으로 개별 그림의 시각적 오정렬을 확정하지 말고 같은 캔버스 합성 증거와 결합한다. 실제 시뮬레이션에서 해당 레이어 선택 시점까지 재현한 것은 아니다.

## 2. 17.6은 명목상 사람의 세로 키이다

- `src/render/walkerComposer.ts:31`: `VILLAGER_WORLD_SCALE=0.55`, `WALKER_FIGURE_PX=32*0.55`.
- 같은 파일149: 몸체는 74×74 원본 셀로 합성한다.
- 같은 파일219–229: `factor = 32 * scale / frame.figureHeight`; 합성 셀을 factor로 확대/축소하고 발 좌표를 world 발점에 맞춘다. 따라서 manifest의 세로 figureHeight가 world `32*scale`이 된다. 폭 기준이 아니다. 패딩 포함 셀 자체가 17.6px인 것도 아니다.
- `scripts/buildWalkerSheetManifest.py:112`–122: 성인 template의 source.height를 74px 프레임 단위로 환산하여 figureHeight를 기록한다. 별도 실루엣형은 같은 파일167–181의 주석/코드대로 최상 alpha행부터 발행까지 세로 높이다.
- `src/render/drawWalkers.ts:38`: z≥0.8에서 scale0.55; 저줌에서 scale0.55×0.8/z. 명목 화면키 z0.5=14.08, z1=17.6, z1.4=24.64px.

**주의:** 17.6은 manifest가 정의한 몸체 높이 정규화 값이다. 반투명 가장자리·망토·소품이 더 튀어나오는 픽셀까지 매번 실측해17.6으로 맞추는 것은 아니다. '성인의 실제 알파키 전원17.6px 실측'이라고 쓰면 과장이다.

## 3. 집 폭56.32와 문 높이 환산

- `src/render/iso.ts:1`: TILE_W=64.
- `src/render/historicalHouseAssets.ts:77`–82: world width=64×0.88=56.32, world height=width×declared alphaHeight/alphaWidth. 이56.32는 **단독 집의 승인 alpha crop 폭**이다. 전체1254px 캔버스 폭이나 문 폭이 아니다.
- `historicalHouseAssetManifest.generated.ts:4`: L0 원좌표1254², alpha width924; L1은1254², alpha width1019.
- `runtimeAssetDerivatives.generated.ts:3`의 대응 L0축소153², L1축소139². `runtimeAssetCoordinates.ts:8`–19와32가 정확한 샘플링 폭을 계산한다.

따라서 게임이 사용하는 derivative crop 폭은 L0 `924*153/1254=112.73684`, L1 `1019*139/1254=112.95136`px이다. 관찰된113px와 반올림 범위에서 일치한다.

|그림|제공된 수동 문높이|코드 환산 world 문높이(z1화면px)|문/명목 성인키|
|---|---:|---:|---:|
|house_l0-v3.png|25±2px|12.490±0.999|0.710±0.057|
|house_l1-v2.png|24±2px|11.967±0.997|0.680±0.057|

숫자는 **문 측정값이 맞다면** 유효하다. 문의 수동 측정은 그림 담당자 증거를 인용해야 한다. 저줌 사람 보정 때문에 z0.5의 상대 문높이는 표 비율의0.625배로 더 작아진다. 집이 Wave26 variant나 합필 집으로 대체된 경우 이 문 측정값을 그 그림에 일반화하지 않는다.

### 감사 문장 권고

“승인 기본 집 L0/L1의 문을 원본 파생본에서 수동 측정하고 렌더의 alpha crop 배율을 적용하면 z1에서 약12.5/12.0px다. 이는 성인 manifest의 명목 세로키17.6px보다 약29%/32% 작다. 수동 측정 오차±1world px 수준이며, 저줌에서 사람 가독성 보정이 격차를 키운다. 기본 집 비율 재검토와 저줌 보정 검토를 분리한다.”

## 4. 광원 반전 위험을 설명할 단일 파일 예

`public/assets/foliage/tree_oak_large.png`.

- `src/render/worldAssetManifest.generated.ts:293` key `tree_oak_large`가 위 파일을 가리킨다(88×112, renderScale4/7).
- `src/render/treeLayout.ts:65`의 숲 수종 분포에 해당 key가 들어 있다. 같은 파일135가 생성 descriptor에 `treeFlipX(...)`를 넣으며258–259는 해시≥0.5를 true로 한다.
- `src/render/drawTrees.ts:75`가 그 flipX를 sprite options로 전달한다.
- `src/render/worldSprite.ts:118`이 실제 X축 반전 변환을 한다. 이때 그림에 구워진 하이라이트/그림자 픽셀도 함께 반전된다.

이는 이 파일을 쓰는 개체가 좌우 반전될 수 있다는 **코드 확정**이다. 이 나무의 특정 하이라이트가 반전되어 실제 장면에서 오광원으로 읽힌다는 판정은 원본 그림/배치 비교와 결합해야 한다. 모든 나무가 잘못됐다는 주장이 아니며, 겨울에는 같은 등록의 계절변형 이미지가 대신 쓰일 수 있다.

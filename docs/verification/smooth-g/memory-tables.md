## big-town

| 시점 | 날짜 | 픽셀(살아 있는 캔버스·비트맵·그림) MB | JS 힙(강제 GC 뒤) MB | Blink 힙(강제 GC 뒤) MB | GC 예산: 전역 소비 / 한도 / old gen MB | Blink 쪽 할당 MB/s | major GC(30초) | 렌더러 RSS MB | GPU RSS MB |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| loaded | 1380년 여름 | 876.9 | 85.7 | 39.2 | 1263.3 / 1295.9 / 96.6 | 86.6 | 7 | 582 | 195 |
| played | 1382년 봄 | 754.5 | 465 | 40.2 | 2621.2 / 2654.4 / 481.8 | 87.6 | 2 | 1082 | 199 |
| camera | 1382년 봄 | 754.5 | 464.5 | 40.3 | 2623.9 / 2640.6 / 484.6 | 87.7 | 2 | 824 | 80 |

Blink 객체를 만드는 호출(초당, 30초 창):

- loaded: `CanvasRenderingContext2D.getTransform` 71263/초 · `Element.getBoundingClientRect` 480/초 · `OffscreenCanvasRenderingContext2D.getTransform` 1/초
- played: `CanvasRenderingContext2D.getTransform` 71157/초 · `Element.getBoundingClientRect` 472/초 · `CanvasRenderingContext2D.createPattern` 0/초
- camera: `CanvasRenderingContext2D.getTransform` 71333/초 · `Element.getBoundingClientRect` 473/초

### 픽셀 붙잡이 (camera)

| # | 붙잡이(만든 src 파일) | 캐시 | 종류 | 살아 있는 수 | MB | 가장 큰 것 | 만든 함수(← 부른 곳) MB |
|---:|---|---|---|---:|---:|---|---|
| 1 | `src/render/groundChunkCache.ts` | 지면 청크 캐시 | canvas | 59 | 497.8 | 2052x1028 | browserChunkCanvas ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 354.4; browserChunkCanvas ← src/render/drawTerrainBoundaryV2.ts:run 143.4 |
| 2 | `src/render/terrainVariantAssets.ts` |  | image, canvas | 40 | 40.1 | 1774x887 | (anonymous) ← src/render/drawWallFaces.ts:drawWallFaceSlice 37.5; (anonymous) ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 2.2; shoreSurface ← src/render/drawShoreline.ts:(anonymous) 0.4 |
| 3 | `src/render/manifestArt.ts` |  | image | 374 | 35.7 | 512x384 | art ← src/render/preloadGameArt.ts:preloadFrameArt 27.5; art ← src/render/preloadGameArt.ts:preloadChapterArt 5.3; Object.art ← src/render/countrysideArt.ts:drawCountryBlit 2 |
| 4 | `src/render/walkerComposer.ts` | 걷는 사람 합성 캐시 | bitmap, image | 607 | 32.9 | 312x156 | composedCanvas ← src/render/drawWalkers.ts:drawComposedWalkerWithCart 23.9; imageFor ← src/render/drawWalkers.ts:drawComposedWalkerWithCart 9 |
| 5 | `src/render/worldRasterCache.ts` | worldRasterCache(그림 래스터) | canvas | 195 | 24.7 | 220x266 | trimTransparentMargin ← src/render/drawPalisadeSegments.ts:drawPalisadeSegment 24.7 |
| 6 | `node_modules/react-dom/cjs/react-dom-client.production.js` |  | 화면 캔버스 | 1 | 22.5 | 3200x1754 | completeWork 22.5 |
| 7 | `src/render/worldSprite.ts` | 스프라이트 색조 캐시 | offscreen | 196 | 12.9 | 582x279 | createTintCanvas ← src/render/worldSpriteRaster.ts:rasterizeWorldSprite 12.4; createTintCanvas ← src/render/drawTrees.ts:drawSeasonalSprite 0.4; createTintCanvas ← src/render/villageLifeDraw.ts:rasterize 0.1 |
| 8 | `src/render/weatherArt.ts` | 계절·날씨 그림 | image, canvas | 19 | 10.5 | 1024x256 | weatherImage ← src/render/weatherOverlay.ts:(anonymous) 6.5; cellCanvas ← src/render/weatherOverlay.ts:drawFill 4 |
| 9 | `src/render/gateArtAssets.ts` | 벽 캐시 | image | 8 | 8.4 | 512x512 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 8.4 |
| 10 | `src/render/houseConditionArt.ts` |  | image | 33 | 6.7 | 271x271 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 6.7 |
| 11 | `src/render/seasonArt.ts` | 계절·날씨 그림 | image | 65 | 6.3 | 256x256 | preloadSeasonArt ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 6.3 |
| 12 | `src/render/bridgeWaterAssets.ts` |  | image | 10 | 6.3 | 512x512 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 6.3 |
| 13 | `src/render/waterMotionArt.ts` |  | image, canvas | 55 | 6.1 | 2048x128 | waterImage ← src/render/drawWaterMotion.ts:fillWorldAligned 2.1; browserCanvas ← src/render/drawWaterMotion.ts:fillWorldAligned 2.1; browserCanvas ← src/render/drawWaterMotion.ts:drawBand 0.5 |
| 14 | `src/render/zoneAssets.ts` |  | image | 56 | 5.8 | 256x256 | (anonymous) ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 5.8 |
| 15 | `src/render/buildingVariantAssets.ts` |  | image | 52 | 4.9 | 224x224 | record ← src/render/preloadGameArt.ts:preloadGameArt 3.2; record ← src/render/wave26HouseArt.ts:(anonymous) 1.7 |
| 16 | `src/render/constructionArtAssets.ts` |  | image | 9 | 4.7 | 512x256 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 4.7 |
| 17 | `src/render/stripJoin.ts` |  | canvas | 14 | 4.7 | 1536x128 | canvas2d$1 ← src/render/drawArableFields.ts:joinStrips 2.4; canvas2d$1 ← src/render/drawWallFaces.ts:gateFaceCanvas 0.8; canvas2d$1 ← src/render/drawWallFaces.ts:faceCanvas 0.5 |
| 18 | `src/render/worldAssets.ts` |  | image | 34 | 4.3 | 512x512 | createImage ← src/render/preloadGameArt.ts:preloadGameArt 4.3 |
| 19 | `src/render/historicalFacilityAssets.ts` |  | image | 24 | 4.1 | 384x192 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 4.1 |
| 20 | `src/render/drawRoadRibbons.ts` |  | canvas | 10 | 2.7 | 2048x64 | canvas2d ← src/render/drawBuildingGrounds.ts:drawAprons 2.1; canvas2d ← src/render/drawTerrainBoundaryV2.ts:(anonymous) 0.6 |

### 캐시별 픽셀 MB (시점마다)

| 캐시 | loaded | played | camera |
|---|---:|---:|---:|
| 지면 청크 캐시 | 599.1 | 497.8 | 497.8 |
| (그 밖) | 177.7 | 155.9 | 155.9 |
| 걷는 사람 합성 캐시 | 32.3 | 32.9 | 32.9 |
| worldRasterCache(그림 래스터) | 24.7 | 24.7 | 24.7 |
| 스프라이트 색조 캐시 | 12.9 | 12.9 | 12.9 |
| 계절·날씨 그림 | 16.5 | 16.8 | 16.8 |
| 벽 캐시 | 12.8 | 12.8 | 12.8 |
| 그림 축척 캐시 | 0.6 | 0.6 | 0.6 |
| 삽화·UI 그림 | 0.4 | 0.4 | 0.4 |

### JS 힙 붙잡이 (힙 스냅숏, 자기 크기 합 485.3 MB, 살아 있는 게임 상태 15625개)

가장 짧은 경로의 앞 이름별 자기 크기(모듈 변수 → 필드):

| # | 경로 | MB | 객체 수 |
|---:|---|---:|---:|
| 1 | `roadDistanceCache → 6` | 56.5 | 15692 |
| 2 | `PRESENTED → walkers` | 49.2 | 716269 |
| 3 | `PRESENTED → buildings` | 38.2 | 728110 |
| 4 | `PRESENTED → walkers → path` | 35.6 | 652382 |
| 5 | `PRESENTED → walkers → position` | 30.4 | 3450585 |
| 6 | `buildingSignatures` | 25.7 | 7809 |
| 7 | `PRESENTED → autoplayRecurringDelivery → homes` | 17.3 | 390350 |
| 8 | `PRESENTED → houses` | 14.5 | 251798 |
| 9 | `cache$4` | 14.4 | 15618 |
| 10 | `PRESENTED → walkers → resident` | 11.2 | 311849 |
| 11 | `tendingMemo → zones` | 10 | 87402 |
| 12 | `blink::WebLocalFrameImpl::WebLocalFrameI → get value → script` | 9.6 | 11 |
| 13 | `PRESENTED → autoplayFoodFlow → current` | 7.7 | 225662 |
| 14 | `PRESENTED → autoplayFoodFlow → rolling` | 6.1 | 96124 |
| 15 | `document` | 4.5 | 40097 |

지금 게임 상태의 필드별 크기(먼저 닿은 필드에 셈):

| 필드 | MB | 객체 수 |
|---|---:|---:|
| tiles | 17.1 | 521998 |
| pathCache | 1.6 | 77795 |
| history | 1.4 | 60700 |
| persons | 1.4 | 56776 |
| (그 밖의 상태 15624개가 더한 것) | 412.6 | 10686126 |

| # | 모듈 변수 | 종류 | 유지 MB |
|---:|---|---|---:|
| 1 | `entries` | object Array | 1.8 |
| 2 | `masks` | object Map | 1.3 |
| 3 | `last$1` | object Object | 1.1 |

| 노드 종류 | 이름 | 수 | 자기 MB |
|---|---|---:|---:|
| object | Object | 5178234 | 204.3 |
| array | - | 463344 | 144 |
| string | - | 3095077 | 53.2 |
| number | - | 2248843 | 26.2 |
| code | - | 116993 | 16.9 |
| native | system / ExternalStringData | 850 | 9.1 |
| object | Array | 372653 | 6 |
| native | system / PropertyArray | 132997 | 5.1 |
| native | blink::ImageResource | 861 | 2.5 |
| concatenated string | - | 103075 | 2.1 |
| native | system / JSArrayBufferData | 9 | 1.3 |
| object shape | - | 22878 | 1.2 |

## new-game

| 시점 | 날짜 | 픽셀(살아 있는 캔버스·비트맵·그림) MB | JS 힙(강제 GC 뒤) MB | Blink 힙(강제 GC 뒤) MB | GC 예산: 전역 소비 / 한도 / old gen MB | Blink 쪽 할당 MB/s | major GC(30초) | 렌더러 RSS MB | GPU RSS MB |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| loaded | 1300년 여름 | 487.7 | 23.4 | 31.5 | 593.6 / 626.8 / 25.7 | 68.5 | 18 | 421 | 172 |
| played | 1301년 여름 | 505.1 | 45.7 | 29.8 | 699.7 / 733 / 49.4 | 60.2 | 11 | 478 | 179 |
| camera | 1301년 겨울 | 241.4 | 59.1 | 11.3 | 462.5 / 495.3 / 62.8 | 90.7 | 13 | 528 | 188 |

Blink 객체를 만드는 호출(초당, 30초 창):

- loaded: `CanvasRenderingContext2D.getTransform` 13508/초 · `Element.getBoundingClientRect` 484/초 · `CanvasRenderingContext2D.createPattern` 6/초 · `OffscreenCanvasRenderingContext2D.getTransform` 3/초
- played: `CanvasRenderingContext2D.getTransform` 13444/초 · `Element.getBoundingClientRect` 479/초 · `new DOMMatrix` 57/초 · `CanvasRenderingContext2D.createPattern` 6/초 · `CanvasRenderingContext2D.getImageData` 0/초 · `CanvasRenderingContext2D.putImageData` 0/초
- camera: `CanvasRenderingContext2D.getTransform` 19205/초 · `Element.getBoundingClientRect` 472/초 · `CanvasRenderingContext2D.createPattern` 11/초

### 픽셀 붙잡이 (camera)

| # | 붙잡이(만든 src 파일) | 캐시 | 종류 | 살아 있는 수 | MB | 가장 큰 것 | 만든 함수(← 부른 곳) MB |
|---:|---|---|---|---:|---:|---|---|
| 1 | `src/render/groundChunkCache.ts` | 지면 청크 캐시 | canvas | 52 | 71 | 824x414 | browserChunkCanvas ← src/render/drawTerrainBoundaryV2.ts:run 71 |
| 2 | `src/render/manifestArt.ts` |  | image | 360 | 32.9 | 512x384 | art ← src/render/preloadGameArt.ts:preloadFrameArt 27.5; art ← src/render/preloadGameArt.ts:preloadChapterArt 3.4; Object.art ← src/render/countrysideArt.ts:drawCountryBlit 1.3 |
| 3 | `node_modules/react-dom/cjs/react-dom-client.production.js` |  | 화면 캔버스 | 1 | 22.5 | 3200x1754 | completeWork 22.5 |
| 4 | `src/render/walkerComposer.ts` | 걷는 사람 합성 캐시 | bitmap, image | 324 | 17.4 | 308x154 | composedCanvas ← src/render/drawWalkers.ts:drawComposedWalkerWithCart 13.8; imageFor ← src/render/drawWalkers.ts:drawComposedWalkerWithCart 3.6 |
| 5 | `src/render/worldSprite.ts` | 스프라이트 색조 캐시 | offscreen | 191 | 12.6 | 582x279 | createTintCanvas ← src/render/worldSpriteRaster.ts:rasterizeWorldSprite 12.1; createTintCanvas ← src/render/drawTrees.ts:drawSeasonalSprite 0.4; createTintCanvas ← src/render/villageLifeDraw.ts:rasterize 0.1 |
| 6 | `src/render/weatherArt.ts` | 계절·날씨 그림 | image, canvas | 19 | 10.5 | 512x512 | weatherImage ← src/render/weatherOverlay.ts:(anonymous) 6.5; cellCanvas ← src/render/weatherOverlay.ts:drawFill 4 |
| 7 | `src/render/gateArtAssets.ts` | 벽 캐시 | image | 8 | 8.4 | 512x512 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 8.4 |
| 8 | `src/render/houseConditionArt.ts` |  | image | 33 | 6.7 | 271x271 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 6.7 |
| 9 | `src/render/seasonArt.ts` | 계절·날씨 그림 | image | 65 | 6.3 | 256x256 | preloadSeasonArt ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 6.3 |
| 10 | `src/render/bridgeWaterAssets.ts` |  | image | 10 | 6.3 | 512x512 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 6.3 |
| 11 | `src/render/waterMotionArt.ts` |  | image, canvas | 44 | 5.9 | 2048x128 | waterImage ← src/render/drawWaterMotion.ts:fillWorldAligned 2.1; browserCanvas ← src/render/drawWaterMotion.ts:fillWorldAligned 2.1; browserCanvas ← src/render/drawWaterMotion.ts:drawBand 0.5 |
| 12 | `src/render/zoneAssets.ts` |  | image | 56 | 5.8 | 256x256 | (anonymous) ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 5.8 |
| 13 | `src/render/buildingVariantAssets.ts` |  | image | 52 | 4.9 | 224x224 | record ← src/render/preloadGameArt.ts:preloadGameArt 3.2; record ← src/render/wave26HouseArt.ts:(anonymous) 1.7 |
| 14 | `src/render/constructionArtAssets.ts` |  | image | 9 | 4.7 | 512x256 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 4.7 |
| 15 | `src/render/worldAssets.ts` |  | image | 34 | 4.3 | 512x512 | createImage ← src/render/preloadGameArt.ts:preloadGameArt 4.3 |
| 16 | `src/render/historicalFacilityAssets.ts` |  | image | 24 | 4.1 | 384x192 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 4.1 |
| 17 | `src/render/drawRoadRibbons.ts` |  | canvas | 8 | 2.6 | 2048x64 | canvas2d ← src/render/drawBuildingGrounds.ts:drawAprons 2; canvas2d ← src/render/drawTerrainBoundaryV2.ts:(anonymous) 0.6 |
| 18 | `src/render/terrainVariantAssets.ts` |  | image, canvas | 19 | 2.6 | 256x192 | (anonymous) ← src/render/drawTerrainBoundaryV2.ts:drawTerrainBoundaryV2 2.2; shoreSurface ← src/render/drawShoreline.ts:(anonymous) 0.4 |
| 19 | `src/render/stoneWallAssets.ts` | 벽 캐시 | image | 2 | 2.1 | 512x512 | (anonymous) ← src/render/preloadGameArt.ts:preloadGameArt 2.1 |
| 20 | `node_modules/react-dom/cjs/react-dom-client.production.js assets/buildings/historical-facilities-v1/` |  | image | 8 | 1.2 | 266x266 | completeWork 1.2 |

### 캐시별 픽셀 MB (시점마다)

| 캐시 | loaded | played | camera |
|---|---:|---:|---:|
| 지면 청크 캐시 | 337.5 | 337.5 | 71 |
| (그 밖) | 110.1 | 111.2 | 111.4 |
| 스프라이트 색조 캐시 | 12.5 | 12.6 | 12.6 |
| 벽 캐시 | 11.5 | 11.5 | 11.5 |
| 걷는 사람 합성 캐시 | 6.8 | 17.4 | 17.4 |
| 계절·날씨 그림 | 8.4 | 14.1 | 16.8 |
| 그림 축척 캐시 | 0.6 | 0.6 | 0.6 |
| 삽화·UI 그림 | 0.4 | 0.4 | 0.4 |

### JS 힙 붙잡이 (힙 스냅숏, 자기 크기 합 77.2 MB, 살아 있는 게임 상태 6863개)

가장 짧은 경로의 앞 이름별 자기 크기(모듈 변수 → 필드):

| # | 경로 | MB | 객체 수 |
|---:|---|---:|---:|
| 1 | `blink::WebLocalFrameImpl::WebLocalFrameI → get value → script` | 9.6 | 11 |
| 2 | `PRESENTED → autoplayFoodFlow → rolling` | 5.2 | 50212 |
| 3 | `document` | 4.3 | 40872 |
| 4 | `PRESENTED → buildings` | 3 | 68272 |
| 5 | `PRESENTED` | 2.4 | 41127 |
| 6 | `PRESENTED → houses` | 2.3 | 68541 |
| 7 | `PRESENTED → autoplayFoodFlow → current` | 1.9 | 61635 |
| 8 | `buildingSignatures` | 1.8 | 6857 |
| 9 | `document → __reactFiber$toeftdlih2s → sibling` | 1.5 | 9368 |
| 10 | `document → __reactFiber$toeftdlih2s → __proto__` | 1.2 | 11485 |
| 11 | `cache$1` | 1.2 | 39614 |
| 12 | `cache$4` | 1.1 | 13712 |
| 13 | `PRESENTED → walkers` | 0.7 | 18392 |
| 14 | `PRESENTED → buildings → tx` | 0.7 | 109128 |
| 15 | `cache$5 → houses → 6` | 0.7 | 27420 |

지금 게임 상태의 필드별 크기(먼저 닿은 필드에 셈):

| 필드 | MB | 객체 수 |
|---|---:|---:|
| tiles | 2 | 42289 |
| (그 밖의 상태 6862개가 더한 것) | 34.9 | 1189649 |

| # | 모듈 변수 | 종류 | 유지 MB |
|---:|---|---|---:|

| 노드 종류 | 이름 | 수 | 자기 MB |
|---|---|---:|---:|
| object | Object | 476888 | 16.6 |
| code | - | 104100 | 13.5 |
| array | - | 102955 | 11.3 |
| native | system / ExternalStringData | 918 | 9 |
| string | - | 337155 | 5.5 |
| native | system / PropertyArray | 71119 | 2.6 |
| number | - | 228339 | 2.4 |
| native | blink::ImageResource | 773 | 2.3 |
| object | Array | 93513 | 1.5 |
| concatenated string | - | 72456 | 1.4 |
| native | blink::FontResource | 372 | 1.1 |
| native | blink::HeapHashTableBacking<blink::HashTable<blink::FontCach | 376 | 0.9 |

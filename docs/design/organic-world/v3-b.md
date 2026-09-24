# 유기적인 땅 v3 — 격자 판정 위의 연속 경계

**읽기 전용 구조 설계 · 2026-09-24 · 구현/성능 합격 보고서 아님**

| 분석 기준 | 값 |
|---|---|
| 본선 M | `cc20defbec1f05f548d43e3698963939ccc1cfe5` (`origin/codex/phase15-organic-ground`를 이 커밋으로 고정) |
| 저장 브랜치 B | `dd1998653207951e934ea9e98326d24e7f54c442` (`claude/b8-save`, 별도 미병합 코드로 분석) |
| 분석 작업 공간 | `/tmp/fls-design-astra-20260924`, detached HEAD, 조사 완료 후 제거 |
| 산출물 | `~/feudal-lord-analysis/organic-world/astra-v3-20260924/` |
| 범위 | 코드 읽기, 설계 문서, 직접 작성한 기술 도식. 제품 코드·브랜치·커밋·게임 설치·이미지 생성 없음 |
| 아트 기준 | `S_England_1300_1450_v1` / `AB_2026-09-19_v1`, 잉글랜드 남부 1300–1450 |

**근거 표기:** `M:path:function`은 본선, `B:path:function`은 저장 브랜치의 실제 코드다. 타입·상수는 함수 대신 해당 선언명을 쓴다. 행 번호보다 이 커밋과 심볼을 우선한다. §2만 현재 구현의 분석이며, §3–10의 계약·숫자·타입·파일 신설은 별도 표시가 없어도 **권고안/실행 전 명세**다. 사용자 관측과 예산은 실측으로 바꾸어 쓰지 않았다. 기존 테스트는 읽었으며 이 설계 작업에서 실행하지 않았다.

## 1. 원칙 한 문장

> **도로 frontage와 지형에서 연속 경계를 만들고, 그 경계를 버전이 고정된 결정론적 격자 판정으로 컴파일하여, 보이는 땅과 실제 행동이 같은 계약을 따르게 한다.**

권고는 **(나) 격자 + 연속 곡선 경로와 구역 형상**이다. 공유하는 것은 좌표·경계·결정론·편집 트랜잭션이며, 도로·성벽·구역의 서로 다른 판정을 하나의 범용 충돌식으로 대체하지 않는다. 건물은 현재 축 정렬 footprint를 유지한다. 부드럽게 만들 수 없는 성문·교차로·짧은 벽 모서리는 명확한 각을 남긴다.

## 2. 현재 구조와 곡선이 깨뜨리는 가정

### 2.1 좌표·도로·성벽

| 현재 코드에서 확인한 사실 | `파일:함수` 근거 | 곡선 도입 시 깨지는 가정 |
|---|---|---|
| 셀은 정수 tx/ty, 배열 인덱스는 행 우선이다. Tile에는 terrain/buildingId/hasRoad가 있고 zone 필드는 없다. | M:`src/world/grid.ts:isInBounds,getTile`; `src/world/world.types.ts:Tile`; `src/engine/engine.types.ts:GameState` | float 위치를 기존 배열 조회에 넣을 수 없다. 새 구역 상태와 파생 캐시를 분리해야 한다. |
| 64×32는 **셀 하나의 등각 표시 px**, 맵의 셀 수가 아니다. 셀 중심 투영은 `(32(tx−ty),16(tx+ty))`다. | M:`src/render/iso.ts:tileToScreen,screenToTile`; `src/render/picking.ts:containsPointInTile,pickTile` | 세계 좌표와 화면 px를 혼용하면 배율별 판정이 바뀐다. |
| 벽 모서리 좌표는 위 투영에서 화면 y를 16 뺀다. | M:`src/render/palisadeRenderGeometry.ts:palisadeScreenPath`; `src/render/drawTerrain.ts:traceTerrainDiamond` | 공통 좌표를 단순 합치면 반 셀 이동이 생긴다. §4.1 어댑터가 필요하다. |
| roadLine은 우세 축의 직선 한 줄이며 dx=dy면 가로다. 도로 그래프는 직교 인접 셀을 전부 검사한다. | M:`src/world/roadGraph.ts:roadLine,getOrthogonalRoadNeighbors,findExistingRoadPath,labelRoadComponents` | 곡선 표본의 대각 접촉은 연결이 아니다. 가까운 두 선의 셀이 변을 공유하면 의도와 무관하게 연결된다. |
| 드래그 평가는 기존/신규 셀을 나눈다. 새 셀이 없으면 placeRoadLine은 완전 무동작, 새 셀이 있으면 한 번 revision을 올리고 캐시를 비운다. | M:`src/engine/roadPlacement.ts:roadPlacementAssessment`; `src/engine/gameActions.ts:placeRoadLine` | 신규 비용만 청구하는 A⁵ 동작을 곡선에서도 보존해야 한다. |
| 땅 위 도로 설치는 완공 벽을 가로질러도 설치될 수 있지만 통행은 벽이 막는다. 물이 없으면 도로 평가가 일찍 반환한다. | M:`src/engine/roadPlacement.ts:roadPlacementAssessment`; `tests/roadDragRules.test.ts`의 벽 횡단 사례 | 현재 설치 가능과 통행 가능은 다르다. 새 곡선 도구의 접속 경고/거절을 기존 API의 동작이라고 설명하면 안 된다. |
| 다리는 직선 축, 양쪽 grass+road 교두보, 물 최대 8셀, 두 축 교차는 무효다. 철거는 span으로 확장된다. 신규 물 셀 비용은 4다. | M:`src/world/bridges.ts:bridgeAt,canTraverseRoadBoundary,bridgeRemovalTiles`; `src/engine/roadPlacement.ts:roadPlacementAssessment` | 물을 가로지르는 자유 곡선 다리를 곧바로 허용할 수 없다. 기존 bridge adapter를 잠근다. |
| 건물 접근은 footprint 주위 직교 도로를 모아 ty/tx 순 정렬한다. 건물 간 캐시는 ID 정규 방향으로 탐색한 뒤 역방향 요청을 뒤집는다. | M:`src/engine/routing.ts:buildingRoadAccessTiles,buildingPairCacheKey,resolveBuildingRoute` | 곡선 호 길이를 기존 거리로 바꾸거나 입력 방향에 따라 BFS tie를 바꾸면 서비스/운반 결과가 달라진다. |
| 경로 키에는 roadRevision과 완공 벽/문 topology가 들어간다. 벽 공사장 경로는 타일 장애물 signature도 사용한다. | M:`src/world/roadTopologySignature.ts:roadTopologySignature`; `src/engine/routing.ts:wallSiteTileSignature,resolveBuildingToConstructionSiteRoute` | geometry 수정이 실제 셀/벽 topology를 바꿀 때만 적절히 무효화해야 한다. 캐시를 화면 곡률로 키잉하지 않는다. |
| 목책 경로는 정수 모서리와 45° 대각을 허용한다. 일반 검증의 기본 포위율과 실제 선포의 100% 설정은 다르다. 건물 여유는 1셀, 물 횡단을 검사한다. | M:`src/world/palisadeGeometry.ts:snapPalisadeStroke,rasterSegment,validatePalisadeCandidate,palisadePathHasBuildingClearance,stepCrossesWater`; `src/engine/palisade.ts:projectPalisadeProclamation` | 순수 직교 tile-edge 경로라고 축약하면 대각 차단/운반 사례를 잃는다. 핵심 건물 100% 포위는 호출부 설정까지 보존해야 한다. |
| 공사 구간은 max축 거리 기준 4step씩 나누며 구간 순서·ID와 성문을 관리한다. | M:`src/engine/palisadeSegments.ts:segmentPalisadePathForConstruction`; `src/engine/palisade.ts:orderedSegments,createWallSites,chooseGate`; `src/engine/palisadeGates.ts:additionalRoadGates` | 곡선 호 길이로 다시 나누면 자재·공사 진행·ID가 달라진다. |
| 완공 벽 선분과 셀 중심 이동 선분으로 통행을 막는다. 성문 반폭은 max축 기준 0.8, from=to 자기쌍 검사도 의미가 있다. | M:`src/world/wallTraversal.ts:solidSegments,canTraverseWallBoundary`; `src/world/bridges.ts:canTraverseRoadBoundary`; `src/world/roadGraph.ts:isRoadTile` | 대각 벽이 셀 중심을 지나는 경우 네 이웃만 비교하면 불일치를 놓친다. |
| 벽 운반은 벽 안쪽 빈 논리 셀망을 이용한다. 대각에는 열린 직교 코너가 필요하다. 도로 밖 Manhattan 거리 비용은 2배이므로 대각 한 step 비용은 4다. | M:`src/engine/wallCarryRoute.ts:wallNetwork,openDiagonalCorner,roadPaths,wallCarryRoute`; `src/agents/carterTravelCost.ts:stepCost`; `src/agents/deliveryStep.ts:stepCarters` | “곡선 벽 위를 호 길이로 이동”하는 새 모델로 바꾸면 A⁵와 다르다. |
| 직접 긋기·정점 편집·지우기·취소를 intent로 처리하며 검사한다. | M:`src/render/palisadeDraftInteraction.ts:applyPalisadeIntent` | 추천 경로를 자동 확정하거나 드래프트를 곧바로 영속 공사로 취급하면 안 된다. |

### 2.2 배치·서비스·입력

| 현재 사실 | `파일:함수` 근거 | 깨지는 가정 |
|---|---|---|
| 건물은 축 정렬 직사각형, houseLot은 2×1 또는 1×2 합필이다. footprint 전체의 지형·도로·점유·공사·벽 여유를 검사한다. | M:`src/geometry/buildingFootprint.ts:buildingFootprint,houseLotArea`; `src/world/placement.ts:footprintTiles,hasOccupiedFootprint,footprintsIntersect,hasBuildingWallClearance,canPlaceBuilding` | burgage 필지와 houseLot은 같은 개념이 아니다. 곡선 접선대로 집을 돌릴 수 없다. |
| 수동 canPlaceBuilding 자체에는 도로 접촉 필수 조건이 없다. 실제 도로 접근 판정은 별도다. | M:`src/world/placement.ts:canPlaceBuilding`; `src/engine/roadAccess.ts:buildingHasRequiredRoadAccess`; `tests/placement.test.ts` | 새 ZoneFillAgent의 frontage 필수 조건을 기존 수동 배치의 불문율로 주장하면 안 된다. |
| 합필은 사람/식량을 보존하고 도로 revision/cache도 갱신한다. | M:`src/engine/houseMerge.ts:houseReason,mergeReason,mergeHouses` | 필지 편집이 합필 상태나 기존 거주민을 암묵적으로 재배치하면 안 된다. |
| 서비스 거리에는 직사각 footprint 간 Manhattan gap을 사용한다. 서비스 수요/용량 배분은 별도다. | M:`src/geometry/buildingDistance.ts:axisGap,buildingFootprintDistance`; `src/population/serviceAllocation.ts:HOUSEHOLD_SERVICE_CONFIG,allocateHouseServices`; `src/population/marketAccess.ts:marketAccessDiagnosis` | 도로 곡선 길이 또는 zone 면적으로 서비스를 재정의하지 않는다. |
| Dev autoplay는 전역 후보를 찾고 직접 건설/주택 행동을 결정한다. 도로 확장 검사는 직교 reachable 공간을 본다. | M:`src/engine/autoplay.ts:findBuildSite,buildAction,housingAction,decideNextAction`; `src/engine/autoplayActions.ts:autoplayCommandToGameAction`; `src/engine/autoplayExpansion.ts:reachableRoadSpace,preserveReachableSpace,preserveRoadExpansion` | 전역 DevAutoPlayer를 이름만 바꿔 ZoneFillAgent로 사용할 수 없다. 권한 경계를 새로 둔다. |
| Canvas 이벤트는 mouse/key/wheel 연결이며 공통 터치/컨트롤러 추상화는 아직 아니다. 클릭 선택과 도로 드래그 확정이 분리돼 있다. | M:`src/render/gameCanvasEvents.ts:bindGameCanvasEvents`; `src/render/worldSelection.ts:selectWorldAtTile`; `src/render/canvasClickResolution.ts:resolveCanvasClick`; `src/render/canvasDragResolution.ts:finishedRoadAttempt` | 터치 두 손가락 전환·컨트롤러 가상 커서는 구현 항목이다. hover-only 정보도 intent 검수 대상이다. |

### 2.3 렌더와 저장

| 현재 사실 | `파일:함수` 근거 | 깨지는 가정 |
|---|---|---|
| 렌더는 ground→objects→overhang→overlay. 지면 안에서는 수면/기본/전이/경관/frontage/도로·다리/접지 그림자 순이다. | M:`src/render/renderer.ts:renderFrame`; `src/render/drawTerrain.ts:drawTerrain` | 도로를 overlay에 그리면 건물을 덮는다. |
| 기본 지형은 직접 pattern fill이며 save/restore는 남는다. 도로 패턴에는 clip이 남아 있다. | M:`src/render/drawTerrain.ts:fillTerrainPattern`; `src/render/drawTerrainDetails.ts:drawRoadPath,fillRoadPattern` | “모든 clip 제거 완료”가 아니다. 새 구역별 매 프레임 clip은 성능 회귀 위험이다. |
| 패턴은 컨텍스트/재질/회전 캐시이며 8×8 지역 seed로 사분 회전한다. 자동 top-down→iso 단위 변환은 아니다. | M:`src/render/terrainPatterns.ts:getTerrainPattern,terrainPatternQuarterTurn,patternTransform` | 농경 축과 물리 반복 크기를 따로 계약해야 한다. |
| 해안/숲 전이는 셀 이웃 기반이며 전체 공유 윤곽 구조가 아니다. 수면 본체는 합친 path를 채운다. | M:`src/render/drawTerrainSeams.ts:terrainSeamFor,drawTerrainTransitions,drawForestFringe`; `src/render/drawWater.ts:drawHistoricalWater` | land/water를 독립 smoothing하면 틈/중복이 생긴다. |
| 지피는 빈 grass에 seed 기반 소품을 제한 배치한다. townLandscape는 완공 석벽 안 빈 grass의 순수 장식이며 기존 orchard도 지면 패스다. | M:`src/render/groundCoverLayout.ts:buildGroundCover,constrainToDiamond`; `src/render/townLandscape.ts:townLandscapeAt`; `src/render/townLandscapeAssets.ts:drawTownLandscape`; `src/render/townLandscapeManifest.generated.ts:townLandscapeManifest` | 장식을 생산 상태로 해석하지 않는다. 새 과수는 객체 큐로 이동해야 한다. |
| 정적 객체 캐시는 큐 배열이다. 기본 depth 정렬 뒤 벽-건물 제약을 추가한다. walkers는 문/다리 예외 밖에서 마지막에 그려진다. | M:`src/render/renderObjectFrameCache.ts:objectRenderItemsForFrame,staticObjectRenderItemsForFrame,objectRenderCacheKey`; `src/render/objectRenderSort.ts:sortRenderItems,compareRenderItems`; `src/render/drawObjectRenderItems.ts:drawObjectRenderItems` | 긴 곡선 벽 한 객체는 정렬 불가. 현재도 보행자 전부가 완전한 depth 순서를 따르지는 않는다. |
| 가시 셀 조회가 있고, 건물 가림은 sprite rect와 커서 셀의 교차다. | M:`src/render/renderVisibility.ts:computeVisibleTileRange,visibleTilesInDrawOrder`; `src/render/occlusionModel.ts:buildingSpriteOverlapsCursorTile` | 건물 가림 함수는 zone picking 함수가 아니다. |
| 석벽 두 축 소스/조각 변환, 완료 목책 객체, 벽 래스터 캐시가 있다. 래스터 캐시는 8Mpx 상한이며 trim에 readback을 쓴다. | M:`src/render/stoneWallGeometry.ts:stoneWallPieces,stoneWallTransform`; `src/render/palisadeObjectRenderItems.ts:palisadeSegmentRenderItem`; `src/render/drawPalisadeSegments.ts:drawPalisadeSegment`; `src/render/worldRasterCache.ts:rasterCacheKey,drawCachedWorldRaster,trimTransparentMargin,worldRasterCacheDiagnostics` | 큰 곡선 PNG 늘이기, 연속 zoom별 캐시 생성, 넓은 지면 readback은 피해야 한다. |
| zoom≤0.5 blocks, ≤0.7 simplified. 지피는 full에서만 포함한다. CPU draw 작업 시간은 별도로 기록한다. | M:`src/render/buildingVisualState.ts:renderDetailLevel`; `src/render/renderer.ts:renderFrame`; `src/render/useGameCanvasRuntime.ts:useGameCanvasRuntime` 내부 `drawFrame` | 0.6배 텃밭 식별을 기존 지피 정책에 맡기면 안 된다. CPU draw 시간은 rAF 간격이 아니다. |
| M에는 src/save가 없고, B의 schema v1은 GameState 전체를 snapshot으로 저장한다. toSnapshot은 상태를 그대로 반환하므로 pathCache도 들어간다. | B:`src/save/saveTypes.ts:SAVE_SCHEMA_VERSION,GameStateSnapshot,SaveEnvelope`; `src/save/saveCodec.ts:toSnapshot,encodeSave` | 새 derived 배열을 GameState에 넣고 “저장하지 않는다”는 설명은 성립하지 않는다. |
| B decode는 migrate 후 검증하며 checksum 비교가 current version에 한정된다. 검증은 geometry용 깊은 검증이 아니다. | B:`src/save/saveCodec.ts:decodeSave,validateEnvelope,assertGameStateSnapshot,jsonSafetyIssues` | 단순 v2 상수 변경은 v1 checksum 검사를 건너뛸 수 있다. 마이그레이션 전 원본 검사 필요. |
| B에는 0→1 migration, 스키마 fingerprint, 구버전 백업/대체 slot 로드가 있다. fingerprint는 사용되지 않은 nested optional 형태까지 보장하지 않는다. | B:`src/save/migrations/v0ToV1.ts:migrateV0ToV1`; `src/save/migrations/index.ts:SAVE_MIGRATIONS,migrateSaveToLatest`; `src/save/schemaFingerprint.ts:schemaShape,declaredGameStateKeys`; `src/save/saveService.ts:backupOlderSchema,writeEncoded,loadFirst` | 새 geometry fixtures·버전 registry·백업 실패 시 재시도가 별도 검수 항목이다. |

상세 조사 및 기존 테스트 이름은 [도로·성벽](evidence/roads-walls.md), [배치·구역](evidence/placement-zones.md), [렌더·에셋](evidence/render-assets.md), [저장](evidence/save-contract.md)에 있다. 이 보조 메모의 제안보다 본문 최종 계약을 우선한다.

## 3. 구조 비교와 권고

| 비교 항목 | (가) 격자 + 렌더만 smoothing | **(나) 격자 + 연속 형상 + compiler** | (다) 자유 좌표 |
|---|---|---|---|
| 구현 비용 | 낮음. 셀 윤곽 후처리 중심 | 중간~높음. source/compile/검증/저장/입력 필요 | 매우 높음. 충돌·routing·service·save 재구축 |
| 저장 호환 | 기존 셀 중심, 표현만 재생성 | schema v2, legacy 셀 source로 보존 가능 | 전체 의미 상태 이행 및 검증 비용 큼 |
| Canvas 성능 | 윤곽 캐시가 있으면 유리 | 편집 때 compile, 정적 chunk blit. 정렬 비용 관리 필요 | 렌더 외 공간 질의/탐색 비용까지 증가 |
| 입력 | 손으로 그린 곡선을 보존하기 어려움 | 원본 곡선·스냅·드래프트와 수용 결과 설명 가능 | 자유도 높으나 안정된 스냅/접속 규칙은 더 복잡 |
| 검증 | 셀과 표시 불일치 위험을 통제해야 함 | 컴파일 결정론+topology 동등성+표시 오차를 분리 검증 | 연속 충돌까지 결정론을 새로 입증해야 함 |
| frontage/성장 흔적 | 기존 셀 모양에 종속 | 도로 station·공유 경계·확정 plot 이력으로 보존 | 표현에는 적합하나 현재 논리와 비용이 불일치 |
| 최근 결정과 정합 | 구역 원본 보존 요구를 충분히 충족하지 못함 | **직접 긋기, 격자 membership, A⁵ 비용/skip 보존 가능** | 격자 판정 제약과 직접 충돌 |
| 용도 | 도입 초기/문제 시 표시 fallback | **최종 권고** | 현 의뢰에서는 채택하지 않음 |

(나)는 모든 선을 매끄럽게 허용하는 약속이 아니다. 격자에서 표현할 수 없는 가는 통로·근접 비접속·성문 이동은 거절하거나 직선 잠금 구간으로 남긴다. 그래야 도시의 자연스러운 윤곽과 클릭/통행의 신뢰를 함께 유지할 수 있다.

## 4. 데이터 계약

### 4.1 좌표와 결정론

**EdgeGrid E**를 공통 세계 좌표로 둔다. 논리 셀 `(tx,ty)`의 사각형은 `[tx,tx+1]×[ty,ty+1]`, 중심은 `(tx+.5,ty+.5)`다. 표시 변환은 다음과 같다.

```
P_E(x,y) = (32(x−y), 16(x+y)−16)       // zoom=1, camera translation 전
P_E(tx+.5,ty+.5) = tileToScreen(tx,ty) // 기존 셀 중심과 정확히 일치
```

- 원본 좌표는 타일의 1/256 단위 정수(Q256). 화면 float, DPI, zoom, timestamp는 원본에 넣지 않는다.
- cubic Bézier와 line으로 된 chain. B-spline의 전역 영향보다 국소 수정/직선 접속/잠금 knot가 명확한 표현을 택한다.
- flatten은 고정소수점 de Casteljau, 허용 편차 1/256셀, 좌표 중간값은 음수까지 정의한 round-to-nearest/ties-to-even. 최대 재귀 16, chain 당 출력 4096 segment. 초과는 단순화 안내 후 confirm 거절.
- 이 한계는 최초 입력 예산이며 성능 측정 뒤 **compiler 버전과 함께** 조정한다. 맵 좌표 허용 범위·정수 overflow를 decode에서 검사한다. 기하 predicate는 정확한 정수/BigInt 경로를 사용하고 렌더에서만 float로 변환한다.
- polygon 내부 판정은 half-open ray rule. 방향/순열의 비의미 차이는 정규화하지만, **다른 사용자 편집 이력까지 같은 ID로 만들 필요는 없다.** 동일 source+명령열+compiler에 대한 동일 결과가 목표다.
- ID는 저장된 monotonic serial로 발급한다. 순회 순서는 stable ID, cell `(ty,tx)`로 고정한다. hash는 콘텐츠 식별용이며 충돌 시 원본 비교, 게임 규칙에 hash 충돌을 허용하지 않는다.

### 4.2 타입 초안: 영속 원본과 파생 결과

아래는 설계용 TypeScript 표기다. 제품 코드에 추가하지 않았다. `CellId`의 실제 인덱스는 저장된 map width를 사용한다.

```ts
type Id = string;
type CellId = number;
type Q256 = number; // decode: finite safe integer, world bounds 확인
interface PointQ { readonly x: Q256; readonly y: Q256 }
type CurvePiece =
  | { readonly kind: 'line'; readonly a: PointQ; readonly b: PointQ }
  | { readonly kind: 'cubic'; readonly a: PointQ; readonly c1: PointQ;
      readonly c2: PointQ; readonly b: PointQ };
interface Boundary {
  readonly id: Id;
  readonly pieces: readonly CurvePiece[];
  readonly owners: readonly { readonly layer: 'zone' | 'plot';
    readonly faceId: Id }[]; // 층별 최대 한 owner, layer 내 유효 face를 참조
}
interface BoundaryRef { readonly id: Id; readonly reversed: boolean }
interface Ring { readonly edges: readonly BoundaryRef[] }
interface ZoneGeometry { readonly outer: Ring; readonly holes: readonly Ring[] }
type RoadSource =
  | { readonly kind: 'legacy-cells'; readonly id: Id;
      readonly cells: readonly CellId[] }
  | { readonly kind: 'curve'; readonly id: Id;
      readonly centerline: readonly CurvePiece[];
      readonly widthQ: Q256; readonly rasterVersion: number;
      readonly junctionIds: readonly Id[];
      readonly excludedCells: readonly CellId[] };
interface ZoneSource {
  readonly id: Id;
  readonly kind: 'burgage' | 'open-field';
  readonly geometry: ZoneGeometry;
  readonly fillPermission: 'none' | 'existing-house-only';
  readonly axis: PointQ; // 0벡터 금지, 시각 띠/뒤뜰 축; 새로운 생산 상태 아님
  readonly styleId: string;
}
interface JunctionSource {
  readonly id: Id; readonly cell: CellId;
  readonly roadIds: readonly Id[]; // 현재 grid가 실제 만드는 인접과 일치해야 함
}
interface ConfirmedPlot {
  readonly id: Id; readonly zoneId: Id;
  readonly geometry: ZoneGeometry;
  readonly historicFrontageRoadId: Id; readonly frontageStationQ: Q256;
  readonly historicFrontageAnchor: PointQ; // 확정 당시 관계; 현재 접근은 파생
  readonly buildingId: string | null; // 기존 Building.id와 같은 타입
}
interface WallDisplaySource {
  readonly logicalSegmentId: string;
  readonly curve: readonly CurvePiece[];
  // 기존 논리 edgePath/문/공사 상태를 대체하지 않음
}
interface OrganicWorldSource {
  readonly compilerVersion: number;
  readonly nextId: number;
  readonly boundaries: readonly Boundary[];
  readonly roads: readonly RoadSource[];
  readonly retiredRoadIds: readonly Id[]; // 확정 plot 이력을 위한 tombstone
  readonly junctions: readonly JunctionSource[];
  readonly zones: readonly ZoneSource[];
  readonly confirmedPlots: readonly ConfirmedPlot[];
  readonly wallDisplay: readonly WallDisplaySource[];
}
// 저장 대상 아님. GameState 밖 renderer/simulation adapter의 파생 view.
interface CompiledZone {
  readonly tileMembership: readonly CellId[];
  readonly interiorPlacementTiles: readonly CellId[];
  readonly frontageSeeds: readonly CellId[];
}
interface CompiledWorldView {
  readonly sourceHash: string; readonly compilerVersion: number;
  readonly roadMask: ReadonlySet<CellId>;
  readonly ownersByCell: ReadonlyMap<CellId, readonly Id[]>;
  readonly zones: ReadonlyMap<Id, CompiledZone>;
  // adjacency/index/contour/layout도 파생; Path2D/bitmap은 렌더 전용 별도 캐시
}
```

stage 1에는 holes·confirmed plot 편집·wallDisplay를 UI에 노출하지 않아도 decoder와 계약의 의미는 고정한다. 교구/시장/공방/공유지 종류는 이번에 승인하거나 enum에 선제 추가하지 않는다. `styleId`는 묘사만 바꾸며 수확·생산량을 만들지 않는다.

### 4.3 곡선 도로: 4연결 셀과 접속

1. 양끝 `(y,x)` 사전순으로 chain을 정규 방향화한다. 같으면 control sequence 사전순, stage 1 폐곡선은 거절한다.
2. flatten된 선의 셀 경계 통과 순서를 정수로 구한다. 정확한 격자 꼭짓점 tie는 **정규 방향에서 X-before-Y**로 중간 셀 하나를 택한다. 이것은 full supercover가 아니라 **ordered 4-connected raster**다.
3. 첫 시제품의 도로 폭은 논리 1셀. 커브 자체뿐 아니라 실제 셀 중심 연결 선분 전체를 포함하는 포장 polygon을 만든다. 셀 코너를 매번 그대로 그리는 대신 이 제약 아래 곡률을 조절한다.
4. 곡률 시작 한계는 반경 2셀 이상, 접속 주변 1셀은 직선 잠금. 반전/뾰족 cusp는 코너 knot로 표시하거나 거절. 곡률 판정도 정수 flatten 결과로 고정하며 이 한계는 미적·입력 제약이지 통행 비용이 아니다.
5. 새 mask와 기존 도로의 **모든 induced orthogonal adjacency**를 확인한다. 의도 없는 평행 근접 접속은 거절하거나 junction 확정 의도로 다시 받는다. 보기에는 끊겼지만 graph는 이어지는 상태를 허용하지 않는다.
6. 교차점은 하나의 cell/junction polygon으로 소유한다. 기존 직선 도로도 legacy-cells source를 통해 같은 합집합에 참여한다. 광장은 명시 선택된 road cell 집합과 그 포장 면이며 새 서비스/경제 종류가 아니다.
7. stage 1은 물·벽 횡단을 거절한다. stage 2 다리는 기존 직선 span과 교두보에 스냅하고 곡선은 교두보 바깥에서 끝낸다. 신규 물 셀 비용4, 최대8셀, 기존 span skip을 유지한다.
8. 새 셀 0이면 source도 추가하지 않는 완전 noop. 일부 신규면 기존 셀에 재과금하지 않으며 source coverage는 공유 owner가 될 수 있다.
9. 기존 한 셀 철거는 그 셀(다리이면 기존 span 확장)을 **모든 owner에서 삭제/제외**한다. 곡선의 excludedCells는 사용자 철거 이력인 원본이다. 표시도 같은 cut을 반영한다. load 후 도로가 부활하면 실패다.
10. 선 전체 삭제는 별도 후속 명령으로만 허용하며 그 source만 제거한다. 다른 owner가 있는 셀은 남는다. 곡선 이동은 stage 1에서 금지, 이후 remove-old/add-new 원자 트랜잭션으로 재검증한다.

### 4.4 구역과 frontage 필지

- `zone.geometry`가 원본. 셀 **중심**이 안에 있으면 `tileMembership`, 셀의 닫힌 사각형 **전체**가 안에 있으면 `interiorPlacementTiles`다. 둘 다 파생이며 시뮬레이션 adapter는 이 셀 집합만 읽는다.
- 건물 후보의 모든 footprint 셀은 `interiorPlacementTiles`에 있어야 한다. 이어서 기존 canPlaceBuilding 및 실제 road access를 검사한다. 곡선 함수를 매 tick 배치 reducer에 직접 넣지 않는다. 경계의 남은 쐐기 땅은 마당/빈 공간으로 남긴다.
- 같은 의미 층에서 zone interior 중첩은 거절한다. 공유 경계는 하나의 Boundary를 반대 방향으로 참조한다. 경계 위 중심은 zone 층 owner, 세 구역 vertex는 incident zone ID 최소값이 소유한다. plot은 별도 의미 층이며 같은 부모 zone 안에서 plot interior 중첩을 금지하고, 공유 plot edge의 owner와 vertex 최소 ID를 plot 층에서 따로 결정한다. 하나의 경계 geometry를 여러 층이 참조해도 층별 face 소유권을 혼합하지 않는다. 지도가 끝나는 곳에 가짜 이웃을 만들지 않는다.
- membership는 지형과 별개인 허용 영역이다. water/road/building/site는 기존 판정 또는 eligibility mask로 배제한다. 영역을 그렸다고 물을 땅으로 바꾸거나 건물을 철거하지 않는다.
- 최초 UI는 한 4연결 성분, 자기교차 없음. holes는 후속 편집에서만 노출하고, geometry와 grid 양쪽의 hole/연결 성분이 보존될 때만 수용한다. 가는 꼬리/작은 구멍은 membership가 남더라도 오차 검사에서 거절될 수 있다.
- 경계 수정은 old/new AABB 합+1셀 halo에서 membership를 다시 계산한다. 공유 경계 양쪽은 함께 commit. **frontage seed가 변하면 해당 zone/component 전체의 미확정 plot layout을 재계산**한다. 국소 갱신과 full rebuild 결과가 같아야 한다.

**Frontage 생성 순서**

1. 실제 통행 가능한 도로에 변으로 닿은 zone 내부 셀을 접근 seed로 모은다. 물/벽/문/점유를 기존 grid 규칙으로 검사한다.
2. `(roadId, 정규 station, side, ty, tx)` 순서로 seed를 정렬한다. 중복 셀은 한 owner를 고른다.
3. 허용된 기존 주택 footprint 후보를 도로 변에 붙인다. 직사각형 방향은 기존 지원 방향만 허용한다. 접선은 **필지 앞선·뒤뜰·이랑의 방향**에 사용하며 주택 회전 기능을 만들지 않는다.
4. 고정 neighbor 순서 N,E,S,W의 multi-source flood로 뒤쪽 셀을 배분한다. 동점은 위 seed 순서. 앞선과 뒤선 사이의 경계는 같은 boundary compiler로 표현하고, 실제 내부 mask로 최종 검증한다. 얇거나 막힌 나머지는 비워 둔다.
5. 후보는 파생. 플레이어/허용된 fill 실행으로 확정된 plot은 geometry·frontage 관계·buildingId를 저장한다. 도로 변경 뒤 **기존 건물/확정 plot은 이동하지 않는다**. 접근 상실 진단을 표시하고 빈 후보만 다시 만든다. 확정 당시 도로 ID/station/지면 anchor는 역사 참조이며, 현재 접근 가능한 road ID는 파생 view에서 별도로 구한다. source 전체 삭제 시 그 ID는 retiredRoadIds에 남겨 저장 참조를 유효하게 보존한다. active와 retired ID는 중복 불가, 재사용 금지다. tombstone을 현재 통행 가능한 도로로 해석하지 않는다.
6. ZoneFillAgent는 `허용→선호→형태` 순서. 허용된 zone/kind/기존 비용 검사에만 건설 명령을 보낸다. 구역·정책·도로·자원·생산 규칙을 생성하지 않는다. DevAutoPlayer와 상태/명령 진입점을 분리한다.

경작지 시제품은 시각 layout만 채운다. 성밖을 기본으로 하고 성내 대형 밀밭은 거절하되, “대형”의 제품 기준은 §10 결정 항목으로 남긴다. 그 기준 확정 전에는 **성내 신규 open-field 자체를 허용하지 않는 보수적 규칙**을 시제품에 사용한다. 텃밭과 과수는 burgage 뒤뜰의 묘사이지 새 생산 시스템이 아니다.

### 4.5 성벽: 기존 논리 경로를 감싸는 제한된 곡선

- 원본은 기존 정수 edgePath·대각·구간 ID·4step 공사 분할·문 anchor·완공 상태다. 새 곡선은 **표시 원본**으로 그 위에 붙으며 논리 경로를 대체하지 않는다.
- 논리 선과 표시 중심선의 쌍방향 Hausdorff `d∞≤1/8셀`. zoom1 화면 성분 상한 x8px/y4px. 이 수치만으로 통행 일치를 주장하지 않는다.
- gate gap을 적용한 후, 국소 범위의 **모든 셀 자기쌍 + N/E 무방향 이웃쌍**의 차단 boolean이 같아야 한다. 공사 완료 구간의 조합별로도 동일해야 한다.
- gate gap은 기존 max축 반폭0.8의 endpoint를 매핑한다. 곡선 호 길이0.8로 재정의하지 않는다. gate 주변은 직선 잠금, 건물 1셀 여유·핵심100% 포위·물 횡단 금지 유지.
- wallCarryRoute가 읽는 polygon은 논리 원본이다. 기존/신규 표시 비교에서 운반망 `(nodes, transitions, access, cost)`가 완전히 같아야 한다. 벽 밖 그림이 운반 가능한 지름길로 보이면 거절한다.
- 공사량/운반 비용은 현재 규칙, 호 길이는 텍스처 UV만 담당한다. 한 논리 공사 구간을 여러 표시 fragment로 나누어도 자재/진행/ID는 분할하지 않는다.
- 조건을 만족하는 곡선이 없으면 해당 모서리를 남긴다. 이것이 grid 보존에 따른 명시적 미적 한계다.

### 4.6 해안·숲 경계

terrain cells가 원본이고 윤곽은 파생이다. 먼저 셀 union의 경계를 추출하고 고정된 saddle 규칙으로 4연결 성분/구멍을 보존한 뒤, marching-squares 계열의 국소 선분과 제한된 cubic으로 정리한다. 대각 접촉을 다리처럼 연결하지 않는다. 숲/땅, 물/땅은 **공유 선 하나**를 반대 방향으로 사용한다.

물가의 교두보·건물 접촉·통행 목은 잠금점으로 둔다. road와 building footprint를 물로 보이게 덮는 smoothing은 거절한다. 숲의 수확·장애물 의미는 기존 terrain/forest 상태를 유지한다. 윤곽만 바꾸며 나무 수·자원·개간 규칙을 만들지 않는다.

### 4.7 표시와 판정의 허용 오차

![경계와 격자 판정](diagrams/02-boundary-contract.svg)

| 대상 | 수용 조건 | 의미 |
|---|---|---|
| 도로·구역·해안·숲의 면 경계 | 표시 경계와 논리 셀 union 경계의 **쌍방향** Hausdorff `d∞≤0.5셀`; 성분/holes 보존 | 임의 입력 보장이 아니라 confirm gate. 가는 꼬리도 검사한다. |
| 기능적 연결·차단 | 도로 adjacency, 벽 자기쌍/이웃쌍, gate, 운반망 **오차 0** | 곡선이 실제 접속을 거짓으로 보여서는 안 됨 |
| 보행 경로/건물 | 실제 셀 중심 이동 선분 전체는 포장 내부, zone 건물 footprint 전체는 interior mask 내부 | 반 셀 band를 건물 침범 면제로 쓰지 않음 |
| 벽 중심선 | `d∞≤0.125셀` + 위 기능 동등성 | 부드러움보다 문/차단/운반 보존 우선 |
| 클릭 | normal picking은 inverse projection→cell/edge ID. 경계 band에서 대상·실제 대상 셀을 명시하고 confirm | 픽셀만 맞춘 가짜 선택 금지 |

0.5셀의 최악 화면 성분 오차는 zoom0.6/1/1.35에서 x **19.2/32/43.2 CSSpx**, y **9.6/16/21.6 CSSpx**다. 작은 오차라고 숨기지 않는다. 초기 권고를 0.5로 둔 이유는 격자 구조를 보존하면서 곡선 수용 가능성을 확인하기 위해서다. §10에서 0.25셀을 택하면 동일 계산이 절반이 되고 거절되는 곡선은 늘어난다. 사용자 그림과 accepted outline을 편집 화면에 둘 다 보여 주고, 허용치 초과는 확정하지 않는다.

거리 gate는 표본점 몇 개만 검사하지 않는다. flatten의 control-hull 편차와 정수 반올림 오차의 상한을 더해 실제 곡선의 양방향 거리 상한을 인증한다. 경계 선분별 최댓값을 interval subdivision으로 좁히고, 예산 내에 임계값 이하임을 증명하지 못하면 거절한다.

경계 band에서 픽셀상 보이는 zone과 cell owner가 다르면, 클릭 즉시 잘못된 행동을 실행하지 않는다. `inspect`에서 보이는 후보와 실제 셀 소유자를 설명하고 `confirm` 때 실제 영향을 받는 면/셀을 강조한다. normal view에서는 소유 경계를 보여 주되 모든 타일 격자를 상시 표시하지 않는다.

### 4.8 저장 v2와 캐시 계약

**저장 전략:** B8을 A⁵ 본선에 통합한 기준을 먼저 고정한다. 그때 current schema가 이미 변했으면 다음 정수 버전으로 올린다. 아래 v2는 현재 B의 v1을 기준으로 한 이름이다.

- `GameState.organicWorld`에는 위 원본만 추가. 새 membership/index/layout/Path2D/bitmap은 GameState 밖 `CompiledWorldView`에 둔다.
- 기존 `tiles.hasRoad`는 B8 snapshot 호환용 **materialized projection**으로 유지한다. curve 영역에서는 중복 저장이라는 예외를 명시한다. v2 roadSources가 원본이며 모든 writer가 source와 projection을 함께 갱신한다.
- v1→v2는 현재 hasRoad true 셀을 legacy-cells source로 정확히 복사하고 곡선/구역을 빈 배열로 만든다. invalid bridge, 진행 중 운반, 자재·예약·건물 ID를 자동 수리하지 않는다.
- load는 원본 버전의 구조/checksum 검증→백업 가능 여부 확인→migration→target 깊은 검증→저장된 compiler로 compile→roadMask와 snapshot hasRoad **비트 비교**→playable publish 순서다. 불일치/지원하지 않는 compiler/미래 schema는 명시 오류, 자동 덮어쓰기 없음.
- 원본 checksum 검사 전 migrate하지 않는다. B8 backupOlderSchema의 실패 후 재시도 상태도 검수한다. 백업 실패 시 오래된 원본을 새 버전으로 덮어쓰지 않는다.
- decoder는 finite integer/range, 배열 수 제한, ID 유일성, active/retired road ID와 역사 참조, 층별 face owner, dangling boundary refs, closed ring, 자기교차, direction, owner, holes, source/target map dimensions, compiler version을 검증한다. 신뢰하지 않은 JSON으로 Path2D를 먼저 만들지 않는다.
- compiler 변경은 cache clear가 아니다. old compiler 유지 또는 explicit legacy-cell/확정 mask source로 동결하는 migration이 필요하다. 같은 원본을 새 compiler로 조용히 바꾸지 않는다.
- 기존 pathCache는 이번에 즉시 제거하지 않는다. B가 전체 상태를 저장하므로 warm/cold semantic hash뿐 아니라 실제 선택 경로 동등성을 검증한 다음 별도 DTO 전환에서 제거할 수 있다. 성능 캐시가 게임 의미 상태처럼 굳는 문제를 새 geometry 캐시에 반복하지 않는다.
- rollback은 기능 flag로 입력 중지+동일 compiled mask의 보수적 표시, v2 데이터 보존. v2를 v1로 무손실 저장할 수 있다고 주장하지 않는다. 구버전 실행은 원본 v1 backup을 별도 slot에서만 연다.

| 데이터 | 원본/파생 | 저장 | 무효화 키·영향 |
|---|---|---|---|
| curve/공유 boundary/zone geometry/확정 plot | 원본 | 예 | content revision + compilerVersion |
| legacy road cells / curve excludedCells | 원본 | 예 | 도로 명령 transaction, owners/mask 재생성 |
| tileMembership / interiorPlacementTiles | 파생 | 아니오 | geometry/sharedBoundary revision + rasterVersion + map dimensions |
| zone eligibility/frontage 후보 | 파생 | 아니오 | 위 키 + occupancy/sites/roadTopology/wall completion + 허용/선호 revision |
| hasRoad | 호환용 파생 예외 | 예 | road source와 동시 갱신, load exact 비교 |
| 기존 wall edgePath/문/진행 | 논리 원본 | 기존 snapshot | 기존 topology signature + 상태 revision |
| wall display curve/fragments | 표시 원본/파생 | curve만 | logical segment/gate state + display revision + style |
| 해안·숲 contour | 파생 | 아니오 | terrain revision + contourVersion; old/new bounds 영향 |
| ground chunk / Path2D / object queue | 파생 | 아니오 | §5 키, camera translation은 제외 |

새 revision은 단순 렌더 tick이 아니라 해당 내용이 바뀔 때만 증가한다. draft compile→검증→필수 표시 준비→**한 번에 source·projection·view publish**한다. rebuild 중에는 이전 확정 상태와 분명한 draft만 보인다. 시뮬레이션이 새 도로를 쓰는데 화면은 이전 도로인 프레임을 만들지 않는다.

### 4.9 입력 의도와 스냅

`select/confirm/cancel/inspect/pan/zoom/strokeBegin/strokeMove/strokeEnd/undo`가 도구 공통 action ID다. device event는 좌표/pressure 등 필요한 payload와 그 순간 camera transform만 어댑터에서 변환한다. raw pointer 이동 sample 수에 의존하지 않도록 동일 control points를 확정하는 명령을 저장/재생한다.

- mouse: 도구 선택→stroke→노드/접선 조절→confirm. 우클릭/ESC cancel, inspect는 클릭 가능한 UI에도 둔다.
- touch: 두 손가락은 항상 pan/zoom. 두 번째 접촉 시 현재 미확정 stroke gesture를 취소하고 이미 확정한 draft knots는 보존한다. 손가락을 떼도 자동 도로 확정하지 않는다.
- controller: 가상 커서+노드 배치/이동, angle modifier, confirm/cancel/undo의 같은 ID. focus 순서와 토글 inspect, 입력 설명이 필요하다.
- snap 우선순위: 기존 접속 node/교두보/문 잠금점→격자→선택적 45°. screen 진입8px/이탈12px hysteresis, world snap 이동 상한0.25셀. 다중 후보는 거리→kind priority→stable ID. locked target 외 강제 스냅은 사용자가 해제 가능.
- 45°는 입력 보조이며 자유곡선 내부를 매45°로 꺾지 않는다. grid/45/접속 스냅 상태와 거절 이유는 hover 없이도 표시한다.
- controller/touch의 큰 hit target은 UI 선택 여유다. 실제 건설/철거 셀을 몰래 넓히지 않는다.

## 5. 렌더링과 성능

### 5.1 지면 채우기 선택

| 방식 | 장점 | 약점 | 적용 결정 |
|---|---|---|---|
| 반복 무늬 + 공유 경계 path/마스크 | 넓은 면, UV 유지, 적은 draw 수 | 작은 디테일 축소, 반복 도장, 잘못 쓰면 clip 비용 | 경작 띠 상태/흙/목초 기본/도로/수면. direct path fill 우선, 마스크는 dirty chunk bake 때만 |
| 소품 배치 | 이랑·과수의 형태를 저배율에서도 강조 | 밀도가 높으면 정렬/가림/draw 비용 | croft 이랑 pack, 과수, 제한된 pasture patch. 낱잎 단위 배치 금지 |
| 셀별 전이 조각(autotile) | 판정과 붙이기 쉽고 기존 자산 활용 | 조합 수, 격자 윤곽, 자유 경계와 불일치 | 범용 신규 세트 불채택. 기존 bridge/gate 접속의 국소 adapter에 한정 |

**띠 경작지:** zone axis에 평행한 띠 polygon을 생성하고, 끝은 zone boundary로 자른다. 폭은 frontage/구역 유효 폭을 나눈 잔여 분배로 정한다. 짧은 끝/길이가 달라지되 seed로 선을 흔들지 않는다. 폭 시작 범위 0.75–2셀, 좁은 잔여는 인접 띠로 합치거나 비운다. 고랑은 geometry의 얕은 흙 경계다. soil/shoots/wheat/fallow는 시각 descriptor이며 새 밀 성장 단계나 생산 로직이 아니다. 구역 전체를 여러 띠가 이미 그려진 PNG 한 장으로 반복하지 않는다.

**텃밭:** house anchor와 실제 접근 edge 뒤의 남은 plot 공간을 정리하여, 짧은 이랑 pack을 그 축으로 배치한다. 각 pack의 footprint와 통행 여유를 파생 mask로 검사한다. source별 결정 순서를 고정하고 zoom 변화로 배치가 재추첨되지 않게 한다. 흙 plate는 ground, 잎 덩어리는 낮은 객체. 0.6배 simplified에서도 큰 이랑은 남긴다.

**목초지:** 기본 grass와 다른 낮게 뜯긴 밝은 올리브 면, 드문 넓은 다짐 흔적, 경계의 거친 풀 덩어리를 조합한다. 다짐 흔적은 packed-earth 도로보다 좁고 대비가 낮으며 도로 접속/선택 affordance를 갖지 않는다. 울타리/동물/꽃으로 식별성을 대신하지 않는다.

**도로·해안:** 도로는 실질 연결 셀을 포장하는 union surface, 물/땅은 하나의 공유 경계. 일반 smoothing의 번짐으로 틈을 덮지 않는다. 정상 안티앨리어싱을 제외한 경계 blur는 쓰지 않는다.

### 5.2 패스와 가림

![원본·컴파일·렌더 분리](diagrams/01-architecture.svg)

1. ground: 수면→기본 지형→구역 soil/띠/pasture→yard/frontage→도로/bridge deck→접지 그림자.
2. objects: 건물/과수/이랑 잎/벽 fragment/관련 보행자. 나무는 줄기 지면 피벗을 depth anchor로 사용한다.
3. overhang: 기존 지붕 등. overlay: 선택/드래프트/실제 셀·edge 설명만.

곡선 벽은 **depth 단조 fragment**로 나누고 문/재질/건물 겹침 경계에서 추가 분할한다. fragment ID는 `logicalSegmentId + station interval`이며 자재 운반 ID와 분리한다. 화면 bounds에는 벽 높이·수관을 포함한다. 공간 index로 근처 건물만 제약을 만들고, 순환 정렬 제약이 나오면 더 잘게 분할한다. 무작위 우선순위로 순환을 감추지 않는다.

보행자 앞뒤는 성문·다리뿐 아니라 곡선 벽 인접 범위에서 동일 객체 큐로 검증한다. 현재 walker 마지막 그리기 예외는 §2의 근거대로 존재하므로, 이 예외와 새 fragment가 충돌하는 경우 해당 범위만 수정하는 단계로 둔다. 모든 렌더러 정렬을 한 번에 교체하지 않는다.

### 5.3 캐시와 비용 모델

Canvas2D를 유지한다. **256×256 world-screen-pixel chunk**를 시작안으로 삼는다. 이것은 논리 셀 격자와 다르고, iso 투영 후 zoom 전 좌표의 바둑판이다. 겹치는 2–4 device px gutter를 bake하되 최종 chunk 소유 rect만 합성하여 이중 알파 경계를 피한다. UV 원점은 세계/구역 축에 고정하고 chunk마다 다시 시작하지 않는다.

- `shapeKey = compilerVersion + geometry/sharedBoundary revision + rasterPolicyVersion`.
- `chunkKey = chunkId + shapeKey + terrain/style/frontageLayout revision + assetManifestHash + LOD + resolutionBucket`.
- `objectKey = 기존 object key + zoneLayoutRevision + wallDisplayRevision`.
- camera pan은 키에서 제외. source 내용 변화로 old/new bounds 양쪽을 invalidate한다. 객체의 높이 bounds도 포함한다.
- resolution bucket 시작값 `0.75/1/1.5/2/3`; 필요한 `DPR×zoom` 이상을 택하고 최고3. 확대 중 연속 숫자마다 캐시를 만들지 않는다. bucket 교체 시 한 번에 전체 맵을 중복 보유하지 않는다.
- hot frame에 polygon union/래스터화/픽셀 readback 없음. geometry는 편집·load 때, Path2D는 shape 변경 때, clip/mask는 필요한 dirty chunk 생성 때만.
- dirty rebuild는 2–3ms/frame **제안 예산**으로 분할한다. confirm은 기존 상태 유지+정확한 draft 표시 후 준비된 새 상태를 원자 publish. 최종 반영 대기에는 명시적 진행 표시와 cancel을 제공한다.

**메모리 하한:** `4 × Σ ceil(chunkWidth×r) × ceil(chunkHeight×r)` bytes. 1280×800, zoom1에서 한 chunk 여유를 포함하면 `(ceil(1280/256)+2)×(ceil(800/256)+2)=42`장 예시, r1 약10.5MiB/r2 약42MiB. zoom0.6에서는 viewport를 zoom으로 나눈 world 범위로 chunk 수를 다시 계산해야 한다. 42장을 모든 배율의 상한이라고 쓰지 않는다. 기존 벽 8Mpx의 RGBA 하한은 약30.5MiB다.

지면+벽+보조 canvas의 논리 버퍼 예산은 처음 **96MiB**. GPU 복제/브라우저 메모리는 별도 측정한다. 초과 시 화면 밖 LRU 퇴출→낮은 우선순위 bucket 축소→dirty 작업 속도 조절. 화면 안 geometry 누락이나 경계 placeholder는 금지한다. 품질을 유지할 수 없으면 합격 처리하지 않는다.

**호출 비용 추정:** 곡선이 Z개인 매 프레임 clip은 대략 `F×Z`번의 state/path 작업을 더한다. 캐시안은 편집 때 `dirtyChunks × intersectingShapes`의 bake 비용을 내고, 안정 프레임은 대략 `visibleChunks`번 drawImage와 기존 객체 그리기다. 정확한 ms는 경로 command 수·브라우저·DPR에 의존하므로 호출 수만으로 속도를 보장하지 않는다. hot-frame 목표 복잡도는 `O(C + O log O + 근접 wall/building 제약 수)`다.

Canvas clip은 현재 clipping region과 교집합을 만들며 복원에 상태 관리가 필요하다. 재사용 Path2D·offscreen rendering은 API로 가능하지만 성능 합격은 별도 측정이다. [MDN clip](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip), [Canvas 최적화](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [Path2D](https://developer.mozilla.org/en-US/docs/Web/API/Path2D), [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas). Worker OffscreenCanvas는 첫 단계 필수 조건이 아니다.

### 5.4 측정 명세와 WebGL 판단

사용자의 최신 관측 **render 작업 p50≈34ms(M4 Max)**를 입력으로 받았다. 이 값만으로 최소 목표도 만족한다고 할 수 없다. 현재 drawFrame 계측은 CPU 작업 시간이며 rAF와 다르다(§2 근거). 저장소 과거 Phase17의 1600×1100 보고서도 현재 1280×800 p95 합격을 증명하지 않는다(`docs/verification/phase17/performance.md`, 과거 조건의 보고서).

| 항목 | 후속 구현 시 합격 기준/수집값 |
|---|---|
| 최소 목표 | 1280×800에서 실제 rAF interval p95≤33.33ms, 보조 CPU frame-work p95≤25ms 제안 예산 |
| 권장 목표 | 1920×1080 rAF p95≤16.67ms. 미달이면 최소 합격과 별도 보고 |
| 환경 | 기준/후보 HEAD, fixture SHA, Electron/Chrome, 기기/전원/GPU, DPR, viewport, seed, camera 고정 |
| 조건 | DPR1/2 × zoom0.6/1/1.35, paused/running/pan(200CSSpx/s)/연속 zoom/편집확정, cold/hot 별도 |
| 수집 | 40프레임 준비 뒤 300프레임×3회 순차; p50/p95/p99/max, deadline 초과율, CPU/rAF 분리 |
| 내부 비용 | clip/save/restore/fill/path commands/drawImage, cache hit/miss/eviction/bytes, compile/bake ms, objects/fragments 수 |
| 편집 | confirm-to-publish p95≤100ms 시작 목표(소형 stage1). 초과 시 기존 상태 유지+진행 표시, 거짓 완료 금지 |
| 시각 검사 | 성능 측정과 분리. 정상 그림/셀 mask/blocked edge/선택 overlay 병치. 픽셀 readback을 벤치마크에 끼우지 않음 |

WebGL/PixiJS 수직 비교를 시작하는 조건은 **3회 중 2회 이상 최소 p95 미달**, profile상 Canvas draw/composite가 주 병목, chunk/국소 갱신/fragment 제한을 적용해도 지속, 메모리 안에서 품질 유지 조정 불가의 네 가지가 모두 성립할 때다. simulation/geometry compile이 병목이면 WebGL로 해결된다고 판단하지 않는다. 전환 시에도 같은 source/compiled grid를 사용한 한 지면+벽 장면만 비교하며 엔진 전체 교체를 선행하지 않는다.

## 6. 에셋 체계·수량·Astra 파일럿 평가

### 6.1 파일럿의 채택 범위

입력은 2026-09-24 사용자가 제공한 파일럿 평가다. 이번 설계에서 새 이미지나 게임 내 측정을 만들지 않았다.

| 파일럿 | 살릴 것 | 본 제작에서 바꿀 것/채택 관문 |
|---|---|---|
| open field | 낮은 채도·따뜻한 흙·붓질 | 균일 다중 띠 PNG를 완성 지면으로 승계하지 않음. 절차적 띠+상태별 재질로 나누고 땋은 밀 모양 제거 |
| croft | 색 관계의 견본 | seamless의 작은 작물 대신 이랑 silhouette·흙 간격. 0.6배에서 밭갈이 흙과 구별돼야 함 |
| pasture | 늦여름 올리브/저주파 질감 | 기본 grass와 구별되는 뜯김·다짐·경계 덩어리. 동물/울타리 없이 식별 |
| apple/pear | 수형 차이·붓질 | 지면 대비/줄기 공간. 기존 orchard 폭40px 기준과 병치하고 수관이 묻히면 수정 |

1024px 원본을 2×2셀(가로 bounding 약128px)에 넣으면 가로만 8배 축소다. top-down→iso 변환의 최소 축 스케일은 zoom1에서 약22.627CSSpx/셀, zoom0.6에서13.576이다. **최악 방향의 핵심 덩어리 0.30셀≈4.07CSSpx**가 출발점이다. 원본 px 증가만으로 표시 형태가 커지지 않는다.

핵심 형태≥4CSSpx(zoom0.6), 핵심 간격≥2CSSpx, 주요 이랑/띠 폭≥6CSSpx를 발주 기준으로 삼는다. microtexture는 작게 사라져도 되지만 작물 종류/도로 구분을 맡기지 않는다. DPR2는 샘플 수를 늘릴 뿐 CSS 크기를 키우지 않는다.

### 6.2 자산 규격과 조건부 본 제작 견적

| 유형 | 원본·반복·피벗·알파 | 수량 |
|---|---|---:|
| 띠 상태 재질 | 256² top-down, 2×2셀, 4변 seamless, 불투명 RGB. soil/shoots/wheat/fallow, local x축 방향. 띠 경계/큰 고랑은 그림에 굽지 않음 | 4 |
| croft 흙 | 256² top-down, 2×2셀, 4변 seamless, RGB | 1 |
| pasture 기본 | 256² top-down, 4×4셀, 큰 저대비 덩어리, 4변 seamless, RGB | 1 |
| 이랑 pack | 256×128 RGBA, 시작 footprint1.5×0.5셀. 배추/콩/파·허브 묶음×기존 두 축. 피벗은 지면 footprint 중심, 메타 polygon 포함 | 6 |
| 사과/배 | 512² RGBA 원본, 줄기 지면 접점 피벗. 표시 폭 apple40/pear32–36CSSpx 시작안. 투명 bounds 기록, 약한 접지 그림자 | 2 |
| 목초 보조 | 256×128 RGBA, 뜯긴 패치/눌린 길 2종, 지면 중심 피벗, 반복 도장 피하는 제한 배치 | 2 |
| 도로 재질 | 256² RGB seamless. 기존 packed-earth 재사용 우선. 도로 폭/edge는 geometry | 신규 0–1 |
| 목책/석벽 측면·상단 | 각각 side/top 256×64 strip, 반복 축 seamless. 높이·두께·UV원점·기준 baseline 메타, silhouette 밖 RGBA. 기존 자산 재사용 여부를 stage3에서 결정 | 신규 0–4 |
| 경계 마스크 | 공유 geometry에서 생성하는 Path2D/단일 채널 runtime mask. 직접 그린 PNG 아트 아님 | 0 |
| 일반 autotile 전이 세트 | 신규 47조각 세트 미발주. gate/bridge는 기존 자산 재사용, 추가 결함 확인 시 별도 견적 | 0 |
| **합계** | **기본 16장 + 도로0–1 + 벽0–4. 과수 2장 재사용에 합격하면 새로 그리는 기본 수량은 14장** | **사용 자산16–21장, 신규 제작14–21장** |

이것은 후속 제작 비용 산정을 위한 범위다. **stage1은 기존 그림/파일럿/단색 geometry로 검증하고 위 세트를 양산하지 않는다.** 건물·사람·동물·울타리 세트·새 밀 성장 단계는 수량에 없다. 네 띠 상태는 해당 구역을 묘사하는 재질이며 새 성장 시스템이 아니다.

곡선 벽 side/top의 임의 각도 광원 문제는 stage3의 한 구간 시각 시제품으로 먼저 검증한다. 미리 그린 방향 그림자가 접선 회전에서 어긋나면 약한 중립 재질+geometry 음영 또는 추가 방향 자산의 **별도 견적**으로 돌아간다. 이 최대4장만으로 모든 각도를 보장하지 않는다.

### 6.3 납품·승인 기준

- 프로필/색/시대 유지, 좌상단 부드러운 광원. 지면은 강한 방향 cast shadow 없음. 외부 상용 게임/타인 그림/Alfdreim 이미지를 참조 입력으로 쓰지 않는다.
- stable asset ID와 버전 분리: 예 `zone_field_wheat-v1.png`, `zone_croft_bed_cabbage_ne-v1.png`, `orchard_tree_apple-vN.png`. 기존 원본 덮어쓰기 금지.
- manifest: source dimensions/hash, crop bounds, worldSizeTiles, repeatPeriodTiles, localForwardAxis, pivotInSourcePx, footprintPolygon, heightAtZoom1, minFeaturePxAtZoom06, profile, assetRevision. source와 runtime 축소본을 구분한다.
- RGBA는 실제 투명 alpha. 투명 margin과 sampling bleed 규칙을 명시하며 체크무늬가 그려진 배경은 반려한다. 원본 resample과 alpha 처리 기록을 남긴다.
- `assets.template.csv` 양식: ID, 도구, 표시되면 모델, 생성일, **실제 사용 프롬프트 전문**, 프로젝트 참조 파일명/hash, 후보수/선택 이유, 수작업 수정, candidate 상태. 수작업/절차 생성도 도구와 명령·규칙 버전 기록.
- 검수 4개를 별도 판정: ①3×3 반복의 시임/도장 ②zoom0.6/1/1.35 형태 ③기존 `wheat_farm_ripe-v4`/vegetable/pasture/orchard와 색·크기 병치 ④geometry/실제 mask 일치. 첫째만 통과해도 나머지가 실패하면 본 제작 승인 아님.
- 블라인드 A/B에서 croft↔ploughed, pasture↔grass를 이름/동물/울타리 없이 구분하는지 확인한다. 작은 파일럿 평가자는 최소3명, 각10쌍 중8쌍 이상을 출발 기준으로 제안한다. 객관적 역사 고증 합격으로 과장하지 않는다.

## 7. 파일 단위 로직 영향

아래 기존 심볼은 §2와 보조 증거에 근거한다. **신규 경로는 제안 이름이며 현재 존재한다고 주장하지 않는다.**

| 영역·파일/심볼 | 계획 변경 | 보존/검증 |
|---|---|---|
| `world/grid.ts`, `render/iso.ts`, `render/picking.ts` | EdgeGrid/Q256 adapter를 곁에 추가, 기존 cell API 유지 | 반 셀 정합·camera/zoom 무관성 |
| 신규 `geometry/organic/{types,canonicalize,compile}.ts` | source validation, fixed-point flatten, zone/road/contour compiler | 버전 고정, 안정 순서, bounded complexity |
| `engine/engine.types.ts:GameState` | 영속 organicWorld만 추가 | 새 파생 캐시는 외부 view, B8 스키마 변경 |
| `world/roadGraph.ts:roadLine,getOrthogonalRoadNeighbors` | 기존 직선 함수 유지, 곡선은 compiled cells를 별도 명령에 공급 | N/E/S/W graph 및 induced adjacency |
| `engine/roadPlacement.ts:roadPlacementAssessment` | 임의 ordered cell 후보용 공통 비용/충돌 평가 분리 | 기존 straight API의 벽횡단 legacy 예외를 몰래 변경하지 않음 |
| `engine/gameActions.ts:placeRoadLine,removeRoad` 및 도로 writer 호출부 | source/projection 원자 갱신, cell cutout, bridge span 삭제 | existing skip/noop, 신규 비용만, revision 한 번 |
| `engine/routing.ts`, `world/roadTopologySignature.ts` | 기존 grid 탐색 유지; geometry transaction의 topology 변화로 invalidate | canonical 역방향 tie, warm/cold path, building footprint 변경 |
| `world/bridges.ts` | 곡선 양끝을 기존 span adapter에 연결 | 8셀/직선/교두보/비용/철거 규칙 |
| `world/palisadeGeometry.ts`, `engine/palisade.ts`, `engine/palisadeSegments.ts` | 논리 경로와 display curve를 매핑 | 1셀 여유·100% 포위·물 금지·4step IDs |
| `world/wallTraversal.ts`, `engine/wallCarryRoute.ts`, `agents/carterTravelCost.ts` | 원칙상 규칙 변경 없음. 표시 수용 validator와 회귀 fixture 추가 | 자기쌍/문 gap/운반 network와 비용2 |
| `world/placement.ts`, `geometry/buildingFootprint.ts`, `engine/houseMerge.ts` | ZoneFill adapter에서 interior mask/기존 검사를 결합 | 직사각형/합필/거주민/식량/수동 배치 의미 |
| `population/serviceAllocation.ts`, `geometry/buildingDistance.ts`, `population/marketAccess.ts` | 거리/수요/용량 변경 없음. 구역 자동배치의 결과만 입력 | 동일 건물 상태에서 서비스 hash 동일 |
| 신규 `engine/zones/{frontage,zoneFillAgent}.ts` | allowed→preferred→shape 후보, 기존 action만 실행 | 정책/도로/구역 생성 권한 없음, Dev autoplay와 분리 |
| `engine/autoplay*.ts` | 기존 도로 writer를 transaction 경유, 검증 모드에서 zone 명령 replay 가능 | 전역 자동성장 정책을 제품 ZoneFill로 승격하지 않음 |
| `render/drawTerrain.ts`, `drawTerrainDetails.ts`, `terrainPatterns.ts`, `drawTerrainSeams.ts`, `drawWater.ts` | zone surface 삽입, 방향 UV, 공유 contour, dirty chunk fill | 매 프레임 clip 추가 금지, land/water 틈 없음 |
| `render/groundCoverLayout.ts`, `townLandscape.ts`, `townLandscapeAssets.ts` | zone가 차지한 곳의 기존 장식 중복 억제, 이랑/과수 layout | 생산 효과 없음, 저배율 macro 형태 유지 |
| `render/renderObjectFrameCache.ts`, `objectRenderSort.ts`, `drawObjectRenderItems.ts`, `occlusionModel.ts` | geometry revision, fragment/나무 큐, 근접 walker 가림 | 건물 가림과 zone picking 분리, 안정 정렬 |
| `render/stoneWallGeometry.ts`, `palisadeObjectRenderItems.ts`, `drawPalisadeSegments.ts`, `worldRasterCache.ts` | logical segment→display fragment, bucket/LRU 계측 | 공사 ID 보존, readback 없는 지면 cache 별도 |
| `render/gameCanvasEvents.ts`, `canvasClickResolution.ts`, `canvasDragResolution.ts`, `worldSelection.ts`, `palisadeDraftInteraction.ts` | device adapter→공통 intent→draft transaction | 두 손가락 pan, confirm/inspect 접근성, 기존 cell 철거 |
| B:`src/save/saveTypes.ts`, `saveCodec.ts`, `migrations/*`, `schemaFingerprint.ts`, `saveService.ts` | v2 등록, 원본checksum 먼저, deep validation, road proof, backup 실패 처리 | v1 raw 보존/unknown version 거절, load 전 compile |
| `render/useGameCanvasRuntime.ts` 및 기존 성능 harness | CPU/rAF 분리, cache/geometry 계측 추가 | 측정용 readback과 정상 성능을 혼합하지 않음 |

**추가 전역 점검:** 구현 착수 때 `hasRoad`를 쓰는 모든 reducer/fixture/초기화 writer를 다시 검색한다. 일부 writer가 source 없이 projection만 수정하면 v2는 성립하지 않는다. 이는 설계의 필수 완료 조건이며 현재 소스를 수정한 결과가 아니다.

## 8. 단계별 실행 계획과 테스트 명세

모든 단계는 별도 구현 의뢰에서 시작한다. 이번 작업은 명세 작성까지다. 순서는 **저장 기준 고정→stage1 수직 검증→stage2 접속→stage3 벽/해안→stage4 도시 성능**이다. 기능 flag는 공통 source/compiler 계약을 제거하는 우회가 아니라 입력/표시의 점진 노출 수단이다.

### 8.1 준비 관문 P0

- B8+A⁵ 통합 HEAD 고정, 기존 테스트/저장 fixture 기준 hash 기록. 현재 브랜치들이 이미 통합돼 있다고 가정하지 않는다.
- schema/current compiler version, source checksum-before-migrate, backup 실패 재시도 명세를 먼저 확인한다.
- 기존 v1 저장 3종: 빈 도시/합필+완공벽/벽 운반 진행 중. 각 원본 bytes·semantic hash·실제 경로를 보존한다.
- geometry 단위 테스트 harness와 fake clock/seed를 사용한다. 새 경제 규칙이나 의존성 도입을 P0에 포함하지 않는다.
- **완료:** 통합 기준/마이그레이션 책임자/fixture가 고정됨. **롤백:** 준비 코드 미노출, 원본 저장과 현 렌더 유지.

### 8.2 1단계 수직 시제품 — 범위와 정확한 명세

**보일 결과:** 한 굽은 도로를 따라 축 정렬 집 앞선과 서로 다른 깊이의 뒤뜰이 생기고, 별도 open-field에는 구역 축을 따르는 띠가 있으며, 숲 한 덩어리의 경계가 사각 계단에만 종속되지 않는 장면. 도로에 따라 집 자체가 회전하는 결과는 포함하지 않는다.

| 항목 | 명세 |
|---|---|
| fixture | 32×32 map, 고정 seed17, Q256. grass 바탕, forest는 x2…7/y22…27의 6×6셀 블록에서 (7,22),(7,23),(2,27)을 뺀 33셀. 물/벽 없음. |
| 도로 | E좌표 A=(4.5,12.5), C1=(10.5,6.5), C2=(19.5,6.5), B=(25.5,12.5)의 cubic 1개. 폭1셀. 기존 직선 road cells (tx2…4,ty12)와 접속. 컴파일 결과를 최초 검토 후 golden fixture로 고정하며 임의 예상 cell 수를 합격값으로 쓰지 않음. |
| burgage | 위 도로의 north-side 포장 경계 중 x6…24 구간을 공유 frontage로 사용. 양끝에서 y2 뒤선으로 연결한 닫힌 ring. 경계 compiler 결과를 수용 검사 후 고정. 도로/기존 점유 셀은 fill eligibility에서 제외. |
| 건물 채우기 | 기존 kind의 1×1 주택 후보만, 실제 기존 비용/재고 검증. 시험 재고는 fixture에 명시. 최대6 후보를 stable seed 순으로 확정, 나머지는 뒤뜰/빈 공간. 집의 진입 edge를 inspect로 확인 가능. |
| open-field | ring E[(15,19),(26,18),(28,23),(25,28),(15,27)]에 line/corner를 사용, axis=(1,0). 중간 긴 변을 허용 corridor 내 cubic으로 조절하는 편집 1회. 시각적 띠만, 생산/성장 없음. |
| 숲 | 위 forest 셀의 파생 윤곽 한 곳. obstacle/harvest 의미 유지, 공유 경계 검증. |
| 아트 | 기존 재질/파일럿/단색 geometry. 새 양산·imagegen 없음. 뒤뜰은 큰 이랑 placeholder로 표시 밀도 먼저 확인. |
| 입력 | mouse/touch/controller가 같은 저장 명령을 만들 수 있는 intent adapter. controller hardware가 없으면 가상 cursor replay+키보드 매핑까지만 검증하고 실제 장치 gap을 기록. |
| 저장 | organic source v2, v1 migration, save/load/replay. undo는 **미확정 draft knot/경계 편집만** 되돌린다. 확정 건설의 환불·예약 취소는 이번 단계에서 만들지 않는다. |
| 제외 | 곡선 이동·폐곡선 도로·다리·벽 smoothing·임의 건물 회전·새 경제 규칙·복잡한 holes UI |

![1단계 fixture 개념도](diagrams/03-stage1-fixture.svg)

**시나리오 실행 방식:** 아래 S01–S20은 32×32 fixture와 작은 변형, seed/fake clock 고정, 각 0–120tick, 논리 assertion만으로 통상 수 초 내 실행하도록 설계한다. 실기기의 실행 시간은 구현 후 기록하며 지금 통과했다고 표기하지 않는다. 렌더 캡처/성능은 별도 세션이다.

| ID | 입력/행동 | 기대 assertion |
|---|---|---|
| S01 좌표 | E의 셀 중심·모서리→screen→inverse, zoom0.6/1/1.35 | 기존 pickTile와 중심 일치, half-cell 오프셋0 |
| S02 정규 방향 | 같은 curve를 양방향 control sequence로 입력 | ordered mask/geometry hash 동일, cost/adjacency 동일 |
| S03 꼭짓점 tie | 정확한 격자 꼭짓점을 지나는 대각 및 ±1Q 이동 | X-before-Y 한 bridge cell 규칙, 4연결, full-supercover 오확장 없음 |
| S04 근접 도로 | 별도 평행선의 mask가 기존 road와 변 접촉 | 의도 junction 없으면 confirm 거절, adjacency를 몰래 추가하지 않음 |
| S05 기존 skip | 기존 도로만 trace, 이후 일부 신규 trace | 첫 명령 state/revision/source 수 noop; 둘째 신규만 과금/revision1회 |
| S06 철거 지속 | 곡선 중간 셀 제거→저장→load→120tick | 제외 셀 부활 없음, source/projection exact 일치 |
| S07 경계 반증 | 가는 꼬리/작은 hole/자기교차 zone | 각각 거리·topology·유효성 이유로 거절, 기존 상태 불변 |
| S08 전체 포함 | 중심은 안, 셀 모서리는 밖인 zone 경계 | membership에는 있음, interior mask에는 없음, 건물 후보 거절 |
| S09 소유권 | 두 zone 공유 edge와 세 zone vertex에 셀 중심 일치; 배열 순열 | 한 owner, load/순열 동일, 중복 membership 없음 |
| S10 frontage | 동일 road/zone, 배열 역순; 한 zone 안 두 확정 plot 공유 edge를 save/load | 후보/anchor 동일, 접근 가능, plot 층 경계 owner 유일·저장 후 동일 |
| S11 권한 | fillPermission none, 정책/도로가 필요한 후보 | 건설0, 정책/도로/zone 생성0, 진단만 반환 |
| S12 점유 보존 | 합법 기존 building/site/road를 zone에 포함 | 철거/이동0, 전체 footprint 충돌 없음, 잔여는 빈 공간 |
| S13 국소 편집 | shared boundary 1개 변경, road seed1개 변경 | local membership와 full compile 동일; 해당 zone plot full 재생성도 동일 |
| S14 load proof | v1 fixture→v2; v2 hasRoad 1bit 불일치; unknown compiler | 정상은 기존 의미 상태 보존, 나머지는 명시 오류·원본 유지 |
| S15 checksum/backup | 손상 v1, 백업 write 실패 후 재시도 | 손상은 migrate 전에 거절, 실패 시 원본 overwrite0, 재시도 성공 후 진행 |
| S16 warm/cold | 캐시 비움/채움, zoom/pan/LOD 변경 뒤 동일120tick | canonical source/semantic state/선택 경로 동일; render cache만 다름 |
| S17 undo/replay | 미확정 knots/zone edge 편집→undo→cancel; 별도 fresh fixture에서 확정 명령열 replay | draft undo/cancel은 재고·예약·영속 ID 변화0, 확정 로그 replay hash 동일. 확정 건설 undo는 노출하지 않음 |
| S18 다중 입력 | 같은 확정 knots를 mouse/touch/controller intent로 replay | 같은 source/mask; 두 번째 손가락 pan 중 건설0; cancel 미확정 비용0 |
| S19 경계 클릭 | band 안/밖, 가림 건물 밑 도로, inspect/confirm | 실제 cell owner/영향 범위 설명, 즉시 오작동0, hidden hover 의존0 |
| S20 숲/서비스 | 숲 윤곽 표시 on/off, 동일 건물 상태 service allocation | terrain/수확/서비스 결과 동일, 성분/holes·경계 허용치 충족 |

**1단계 완료 기준**

- S01–S20 모두 통과. 5개 seed(1–5)의 추가 작은 fixture와 seed17에서 source/mask/경로 동등성 확인.
- 독립 시각 검토: 세 배율에서 도로 접속·앞선/뒤뜰·경작 띠·숲 윤곽을 읽을 수 있고 normal/판정 overlay 불일치가 허용치 안. 사각 건물과 곡선 필지가 공존하는지 확인.
- 최소 viewport의 stage1 성능 기준 충족 또는 병목·수치가 기록된 명시적 미합격. 성능 미합격이면 stage2로 범위를 늘리지 않는다.
- v1 원본 보존, source/projection 불일치0, 새 저장 데이터의 schema fingerprint와 nested fixtures 포함.
- **롤백:** 새 입력 flag off. 저장 v2 source는 보존하고 compiled membership를 셀 지면으로 보수적으로 표시. 기존 집/도로/재고를 되돌리는 파괴적 변환 없음.

### 8.3 2단계 — 연결 일반성

**명세:** T/Y/X junction, 작은 광장, 기존 직선 접속, 직선 bridge adapter, road cell 철거/재설치, 별도 source 전체 삭제, 기존 plot 접근 상실 진단. 굽은 다리와 주택 회전은 제외.

| ID | 수 초짜리 시나리오 | 합격 |
|---|---|---|
| C01 | junction 입력 순서/양방향 replay | 의도 graph와 induced adjacency 일치, canonical path 동일 |
| C02 | 두 source 공유 셀에서 한 source 삭제 vs 한 셀 삭제 | 전자는 남은 owner 유지, 후자는 모든 owner cutout, 저장 후 동일 |
| C03 | 1/8/9 water cells, 잘못된 bank, 기존 span 포함 drag | 기존 bridge 유효성/최대8/신규비용4/skip 보존 |
| C04 | bank 삭제→span 삭제→재설치→save/load | 단편 다리 부활 없음, 원자 비용·revision |
| C05 | 완공벽 횡단 legacy 직선과 신규 curve | legacy 예외 회귀 없음; 신규 도구는 명시 차단/문 접속 안내 |
| C06 | 도로 source 전체 삭제→save/load→새 도로 접속 | 기존 집/plot 이동0, historic ID는 tombstone으로 유효, active access만 갱신, 빈 후보만 재생성 |
| C07 | 광장 주변 혼잡 후보, 미허용 자동도로 요구 | 기존 placement/service 유지, ZoneFill 권한 초과0 |

**완료:** C01–C07+stage1 회귀, gate/bridge 합성 시각 검사, warm/cold 및 save 동등성. **롤백:** 접속 확장 도구만 비활성, 이미 저장된 source/graph는 해석 가능하게 유지, legacy 표시 fallback.

### 8.4 3단계 — 성벽·해안

**명세:** 현재 logical wall을 유지하는 제한 곡선, 문 잠금·display fragment, 공동 water/land contour, 교두보 고정. 목책/석벽 한 구간씩 검증 후 확장한다.

| ID | 수 초짜리 시나리오 | 합격 |
|---|---|---|
| W01 | 대각 완공벽이 road cell 중심 통과 | 자기쌍+N/E 차단 집합 동일, 그림만 통로가 열리지 않음 |
| W02 | gate 부근 곡률 증가와 공사완료 조합 | max축 gap 매핑 유지; 달라지면 confirm 거절/각 유지 |
| W03 | 도로가 한 구간만 닿은 벽, 막힌 내부/열린 대각 corner | carry nodes/transitions/access/cost 동일, offroad×2 및 대각4 |
| W04 | 4step 구간 공사 중 save/load, 운반 복귀 | ID/진행/예약/자재/return route 보존 |
| W05 | 건물1셀 clearance, 핵심 건물 누락, 물 횡단 | 기존 유효성 거절 유지, 자동 추천은 확정 아님 |
| W06 | 문을 지나는 walker, 벽 앞/뒤 집과 나무 | 정상 그림의 occlusion 순서, fragment logical ID 추적 가능 |
| W07 | 2×2 saddle 해안, 좁은 육교, 교두보 | land/water 공동선, 성분/통행 topology 동일, 틈/가짜 다리0 |

**완료:** 모든 판정 집합 동등성+§4 오차 gate+§5 성능, side/top 아트 시험에서 접합/광원 합격. **롤백:** wallDisplay/contour smoothing을 끄고 동일 원본 edgePath/terrain 셀 표시. 공사와 운반은 계속 같은 논리 상태 사용.

### 8.5 4단계 — 대형 도시 성능

**명세:** 실제 큰 저장도시 1개와 고정 synthetic stress fixture 1개를 사용한다. 시작 stress 크기는 128×128셀, road coverage 4096셀 이하, zones128, 기존 kind 건물1000, 표시 wall fragments2000으로 정한다. placement 가능한 fixture 생성 결과를 파일/hash로 고정하고, 달성하지 못한 객체 수를 조용히 채웠다고 보고하지 않는다. 이것은 성능 부하이지 새 경제 설계가 아니다.

- §5.4의 전체 매트릭스 실행. source/terrain 전체를 바꾸는 worst-case 편집, 빠른 pan/zoom, load 첫 프레임, cache eviction 반복을 추가한다.
- P01: cache residency≤96MiB 논리 예산, 밖으로 pan 후 복귀에서 빈 chunk/이중 경계0.
- P02: 변경 없는 300프레임에서 geometry compile0, 신규 ground clip0, frame당 호출수/메모리 안정.
- P03: 연속 zoom bucket 이동 시 source/semantic hash 불변, bounded eviction, LOD 팝과 경계 이동 검사.
- P04: 100개 경계 편집 replay 후 incremental/full compile 동일. 큰 fixture 전체 hash와 경로 표본 비교.
- P05: 24,000tick 장기 결정론 비교는 기존 안정성 게이트와 연결하는 **별도 장시간 회귀**. “수 초 테스트” 목록에 섞지 않는다.
- **완료:** 최소 해상도 p95 합격, 권장 해상도는 별도 등급, 모든 기능/저장 회귀와 시각검수. 미달이면 §5 WebGL 조건을 판단한다.
- **롤백:** 품질을 훼손하지 않는 cache/bucket 조정 및 해당 입력 노출 제한. 데이터 계약을 버리는 엔진 교체나 저장 자동 축소는 하지 않는다.

## 9. 제약 대조표와 납품 관문

| 사용자 제약 | 만족시키는 설계 | 반증/검증 근거 |
|---|---|---|
| 1 판정은 격자 | 고정 compiler→roadMask/membership/interior mask, 기존 routing/placement/service/carry 유지 | §4.1–6, S02/S08/S16/S20/W03. 시뮬레이션이 curve float를 직접 읽으면 실패 |
| 2 화면=실제 | 경계 오차0.5셀 수용 gate, 벽0.125셀, topology 오차0, footprint/이동선 전체 포함, band inspect | §4.7, S04/S07–09/S19/W01–02/W07. 작은 오차라고 과장하지 않음 |
| 3 저장 호환 | v2 원본·버전·v1 migration, checksum-first, backup, hasRoad 중복 예외 exact proof | §4.8, S06/S14–17/C02–04/W04. silent rebuild/overwrite 금지 |
| 4 성능 | Canvas2D, dirty chunk/direct fill, bounded memory, CPU/rAF 분리 계측 | §5, stage4 P01–05. 수치는 예산이며 현재 달성 아님 |
| 5 입력 | common intents, 기존 접속/grid/45 snap, 2finger pan, controller cursor, inspect/confirm | §4.9, S18–19. hover 전용 정보/자동 확정 금지 |
| 6 점진 이행 | P0→stage1~4, legacy cells adapter, 단계별 flag/fallback, source 보존 | §8. 기존 엔진·저장 전체 교체를 선행하지 않음 |
| 7 최근 결정 유지 | wall 직접 긋기/추천 구분, logical carry×2, existing road skip/noop | §4.3/5, S05/C03/W03–05. 곡선 길이로 비용 재정의 금지 |

**설계 납품 관문**

| 요구 산출물 | 본문 위치 |
|---|---|
| 원칙 한 문장 | §1 |
| 현재 구조 + 깨지는 가정 + 파일:함수 | §2, 증거 메모 4부 |
| 세 구조 비교·권고 | §3 |
| 원본/파생/저장/무효화 + 타입 | §4 |
| 채우기/정렬/성능 | §5 |
| 규격/수량/파일럿 채택 기준 | §6 |
| 로직 영향 파일표 | §7 |
| 단계별 명세/테스트/완료/롤백, stage1 | §8 |
| 7개 제약 대조 | §9 |
| 사용자 결정 질문 | §10 |

위 표는 설계의 포함 여부다. **새 기능 작동, 테스트 통과, 게임 내 아트 승인, 성능 달성은 이번 납품의 사실이 아니다.** 후속 구현의 실행 관문과 분리한다.

## 10. 사용자 결정 질문

문서를 읽을 때 결정할 항목이다. 이번 읽기 전용 설계를 끝내기 위해 답을 기다릴 필요는 없다. 기본 권고와 영향이 있으며, 경제·정치 권한을 새로 승인하는 질문은 포함하지 않았다.

| 질문 | 선택지 | 기본 권고와 영향 |
|---|---|---|
| Q1 경계의 허용 오차를 어디까지 허용할까? | A 0.5셀 + 편집 band 설명 / B 0.25셀 + 더 많은 거절 | **A로 stage1 비교**. A도 zoom1 최악x32px라 반드시 시각 판정 필요; B는 정확하지만 각진 잔여가 늘 수 있음 |
| Q2 경작지의 성내 예외를 초기부터 둘까? | A 성내 신규 open-field 모두 금지 / B “대형” 한계와 소규모 예외를 별도 확정 | **A로 시제품**. B는 면적 기준/경계 straddle 기준이 필요하며 성내 대형 밀밭 금지는 유지 |
| Q3 frontage 집의 축 정렬이 보이는 것을 받아들일까? | A 집은 기존 방향, 앞선/뒤뜰로 곡선 읽힘 / B 건물 회전 아트·footprint 별도 연구 | **A**. B는 현재 단계 범위를 벗어나며 이 계획에 자동 포함되지 않음 |
| Q4 도로 삭제 도구를 확장할까? | A 기존 셀/다리 span 삭제 유지 / B 이에 더해 선 전체 source 삭제 별도 버튼 | **A부터**, B는 stage2 선택. 공유 셀 처리 의미가 달라 명확한 confirm 필요 |
| Q5 저배율 텃밭을 얼마나 크게 읽히게 할까? | A 0.6배에도 큰 이랑 silhouette 유지 / B 아주 낮은 배율은 흙 면 위주 | **A**. 소품 수/가림 예산은 증가하지만 파일럿의 croft 구분 실패를 해결하기 쉬움 |
| Q6 성벽 곡선이 제한되는 구간을 어떻게 보일까? | A 논리 corridor 밖은 명확한 각 유지 / B 경로 편집을 요구해 더 완만한 원본을 다시 그리게 함 | **A 기본, B 선택 안내**. 화면만 바꿔 문/차단/운반을 어긋나게 하는 선택은 없음 |

## 부록 A. 근거와 검증의 범위

- 소스 사실은 고정된 M/B 코드에서 읽었다. 자세한 행 번호/기존 테스트는 `evidence/*.md`에 있다. 커밋은 분석 중 최신 이동을 추종하지 않았으므로 이후 A⁵ 변경은 별도 재검토 대상이다.
- 저장 브랜치는 본선과 분리된 비교 대상이다. B의 저장 구현과 M의 canonical routing을 합친 런타임을 실행한 것처럼 서술하지 않는다.
- [계약 반증 검토](evidence/contract-challenge.md)의 ordered raster, 양방향 오차 gate, interior mask, 벽 자기쌍/운반망, road source/projection 보완을 본문에 반영했다.
- SVG 3개는 관계/fixture 설명용 기술 도식이며 생성형 아트가 아니다. 스케치의 smooth 선은 실제 compiler 실행 결과나 golden mask가 아니다.
- 파일럿 PNG를 재생성하거나 게임에 설치하지 않았다. Alfdreim 등 외부 그림을 읽거나 참조 이미지로 넣지 않았다.
- 분석 worktree의 초기/최종 status, HEAD, branch 목록 비교, 산출물 검사 결과는 `evidence/`에 포함한다. 기존 본선/사용자 작업 공간의 선행 untracked 파일은 수정하지 않았다.

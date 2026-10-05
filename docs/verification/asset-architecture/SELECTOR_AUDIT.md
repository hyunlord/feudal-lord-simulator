# 이미지 선택 지점 정적 감사

판정: **기존 선택 구조 조사 완료, 새 계약 구현·런타임 검증은 진행 중**. 기준은 2026-10-04, 이전 전 HEAD `ba44840b5a24f79b3a242d9a09f709c08571b240`다. 아래 줄 번호와 '현재/기존' 판정은 이 baseline 선택 경로를 가리킨다. 병행 구현이 같은 파일을 이전하므로 새 동작의 설치 증거로 쓰지 않는다. [계약 문서](../../design/art-contract.md)와 [시각 아키텍처 §4](../../design/visual-architecture.md)를 함께 읽는다.

조사 입력은 `.omo/drafts/selection-audit-world.md`, `.omo/drafts/selection-audit-actors-ui.md`, `.omo/drafts/selector-scan-files.txt`, `.omo/evidence/selector-audit-coverage.json`이다. 마지막 자료는 후보 89/89, missing=[]를 보고한다. 이 문서는 그 표를 제품 종류별로 합치고 정규식 밖 의미 선택 경로를 보충했다. 제품 파일 수정, 이미지 설치, 브라우저 캡처, 전체 회귀 실행은 이 감사의 행위가 아니다.

분류: **데이터**는 지원되는 의미 영역에서 자료와 재사용 조회기가 선택한다. **혼합**은 자료가 그림을 제공하지만 후보 자격·우선순위·명명·가족 분기가 코드다. **고정**은 특정 조건과 이미지 이름이 직접 연결된다. **로더/기하**는 선택자가 아니라 캐시·등록점·crop·draw 소비자다. TS 자료표도 데이터이며, 데이터라는 분류가 외부 CSV/JSON 계약 완성을 뜻하지 않는다. **등록됨 ≠ 선택됨 ≠ 요청됨 ≠ 디코드됨 ≠ 그려짐 ≠ 설치 검증됨**이다.

## 구현 변경분 — 2026-10-05 정적 재확인

아래는 최신 기반 `d4973e85d3d4039cf6f8091c33c1047239e443ee`의 **작업 트리**에서 확인한 변경이다. 뒤의 89개 baseline 조사 표와 분류는 당시 기록으로 보존한다. 새 코드의 존재와 설치/런타임 통과를 구분한다. 현재 runtime 검증은 기준 실행 오류 수정 후 재실행 중이다.

| 연결 | 현재 자료·입력·소비 | 확인 경계 |
|---|---|---|
| 공통 catalog/registry | `src/render/art/catalog.json` bundle 배열 → `wave42Registry.ts:1,6` startup immutable registry → `artAdapters.ts:41`/`artImageLoader.ts:15` | 데이터 계약. 전체 set 검증과 이미지 decode 수명은 별도. UI 3종은 descriptor 인계이며 Render A 연결 완료가 아님 |
| Wave42 tree/fallow | `landStageModel.ts:29,50`이 실제 treeStage/fallowStage·경과 연도·단계 비율·hash·plot·season으로 선택; `landStageItems.ts:23,33,69,98`에서 여름/겨울 선택 ID를 queue→draw까지 전달 | 조건/variant는 데이터, 엔진 사실 및 depth/LOD/cache는 adapter·기하. 선택된 ID를 이름 재구성으로 덮어쓰지 않음. 픽셀 회귀 미판정 |
| 길 strip/connector | `bundles/footpath-layouts.json` → `footpathModel.ts:65` 16 topology 검사; `wave42StageArt.ts:13,39` 공통 scale 및 connector 선택은 path family만 | 자료 접속표+기하. 다른 land family는 자기 scale 사용. thinning·terrain·연결 strip 변환은 코드 |
| single house 본체 | `artSelection.ts:9` allowlist에 calendarYear/lot/eligible; `contractHouseArt.ts:27,38`이 stateCalendar·houseBodyEligible·builtLevel·유효 season과 기존 textRandom seed로 house-body 선택 | 혼합: 자격/실제 사실은 코드, 제공된 slot의 규칙/variant는 데이터. compound·미자격은 기존 경로. 새 묶음 runtime 미판정 |
| 본체와 상태층 | `contractHouseArt.ts:45,50,54,69` 실제 body의 target membership, 필수 layer 전체 ready 확인, immutable draw receipt. `historicalHouseAssets.ts:115` → `drawBuildings.ts:161` → `buildingOverlays.ts:51`로 실제 body rect/ID/layer 전달 | geometry 정합성만으로 선택 target 적합성을 가정하지 않음. 같은 pass에서 재선택하지 않는 원자 소비 구조. 로딩/무깜빡임·캡처 증명은 별도 |
| 파일 provenance 관문 | `scripts/checkArtCatalog.ts:19,27,57` 전체 registry 검증 후 저장소 내부 realpath·원본/runtime SHA·runtime 치수·디코드 RGBA 동일 검사 | offline 검증 도구의 코드 확인. 실행/통과나 selected/load/draw/installed를 이 감사에서 주장하지 않음 |

향후 Wave20 신규 32개 계획 묶음은 [계약의 data-only 추가 절차](../../design/art-contract.md#data-only-추가-절차--wave20-신규-32개-계획-묶음)를 따른다. `tests/fixtures/art-house-bundle.json`의 `wave20-era`는 36 entries(신규 32개+기존 층 재사용 4개)이며 32는 테스트 수가 아니다. catalog 배열에 bundle을 추가하고 원본/그림/provenance/증거를 기록하되 종류별 TS 분기를 추가하지 않는 별도 검증 단계다. 아직 32개 설치 수량으로 집계하지 않는다. 미공급 UI/인물/성장/운송 사실은 계약 필드가 존재해도 unbound다.

최신 [CHARTER](../../CHARTER.md:32)의 무거운 실행 규약은 `scripts/remote/run.sh`의 **동시 2개 slot과 대기열**이다. 이 문서 갱신은 소스 대조와 문서 정적 검사만 수행하며 캡처/회귀 결과를 대신하지 않는다.

## 1. 건물·상태층·공사 (Render B)

아래 파일명은 별도 표기가 없으면 `src/render/` 기준이다.

| 선택자/자료 | 분류·엔진 입력·코드 경계 | catalog → loader → 실제 소비 |
|---|---|---|
| `buildingVariantManifest.ts:10`, `buildingVariants.ts:28,50,73,102` | 혼합. 종류/level/lot 15 pools, seed/좌표 가중 선택, inside_wall, family 연속성, 인접 반복 밀기. weight0의 농가 working/winter는 일반 추첨 밖 | `buildingVariantAssets.ts:19,77`→`preloadGameArt.ts:40`→`historicalHouseAssets.ts:100`, `houseCompoundAssets.ts:83`, `historicalFacilityAssets.ts:162` |
| `houseVariantChoice.ts:40,56,84,93,151` | 혼합. Wave26/30 level/lot 후보, roof 순서·부 조건·seed/household, 화재/alehouse 예외, 인접 중복 회피, 완료 이력/나이/식량/임대로 fresh/weathered | `wave26HouseArt.ts:21,99`→집 body/overlay 소비. 기존 roof-family 의미를 단순 weight로 대체하면 안 됨 |
| `granaryVariantChoice.ts:35,55,65,74` | 혼합. seed/building id body, 재고 2/3·1/5 임계 full/half/empty, 중지/미납/인력·계절→boarded/weathered/snow, 고정 layer 순서 | `wave32GranaryArt.ts:15,50`→barn body/overlay |
| `historicalFacilityManifest.ts:1`, `historicalFacilityAssets.ts:105` | 혼합. `src/content/buildingCatalog.ts:86` facilityArt id/variants/seasonal/quiet-active 형태. hash·계절·판매 후보·생산/도로 조건 | loader `:43`, body `:144`→`drawBuildings.ts:162`, ghost `constructionGhost.ts:45`. market quiet variant 미준비시 base quiet(:162) |
| `historicalHouseAssetManifest.generated.ts:3`, `historicalHouseAssets.ts:90` | level→metadata는 데이터, body 우선순위는 혼합: base ready 필요→Wave26→alehouse→Wave2→base | loader `:35`, rect `:77`, draw `:101`→`drawBuildings.ts:161`, ghost `constructionGhost.ts:43` |
| `houseCompoundAssetManifest.generated.ts:3`, `houseCompoundAssets.ts:65,74` | level/axis 데이터, Wave30→base-ready→Wave2/base 혼합. single house와 readiness 순서가 다름 | loader `:27`, rect `:56`→`drawBuildings.ts:148` |
| `farmsteadArt.ts:19,64` | 혼합. field work의 ripe-working→winter→frame variant→첫 pool 순서. weight0 상태 그림의 명시적 도달 경로 | `buildingVariantManifest.ts:321`→variant loader→`farmsteadArt.ts:70` fitted draw |
| `buildingOverlays.ts:45,50,92` | 고정 selector. plague-shut와 boards, house/pair/granary/storehouse 분기, 준비 여부/빈집/계절 전환/LOD, burning/burnt/soot/doused/가까운 우물 방향 | Wave7/9/26/30/32/storehouseSnow→`manifestArt.ts:46` reference crop→`drawBuildings.ts:127` |
| `wave26HouseArt.ts:103`, `wave32GranaryArt.ts:50`, `storehouseSnowArt.ts:21` | 혼합 layer adapter. fresh/weathered→boarded→snow 이름·순서, 실제 준비된 body와 일치하는 snow fallback | 각 generated manifest→공통 loader/reference draw. 독립 fit 금지 |
| `houseConditionArt.generated.ts:2`, `houseConditionArt.ts:15,18,40` | 데이터 exact-key registry/loader. level:lot:condition, native 치수 검증, ready만 반환. 조건 의미는 상류 | `preloadGameArt.ts:37` 등록→`houseConditionOverlay.ts:50` 소비 |
| `constructionKits.ts:29,43,60,91` | 혼합. BUILDING_CATALOG.kit + 고정 family/stage, defense 예외, timber/stone/public별 site props | body registration `:30`→Wave11 reference draw `:72`, props `:114`→`drawConstructionSites.ts:127`; worker 선택은 §3 |
| `constructionArtAssets.ts:10,43,58` | 혼합 loader/고정 generic stage. FILES/URL와 1774×887 등록, stage 예외. wall/salvage/smoke 예약 row는 활성 증거 아님 | loader `:21`→`drawConstructionSites.ts:128`, completion roof/dust |
| `constructionPlaque.ts:30,205,214,220` | 고정 이미지 선택. blocker icon, wood/stone pile 단계, sign, well 3칸. plaque shape/text 자체는 절차적 | `visibilityArtManifest.ts:8`→`drawGroundSprite:195`→`drawConstructionSites.ts:127` |
| `constructionCompletionEffects.ts:115,153` | 고정 timeline. 완료/나이/속도, dust4칸, roof fade, <350ms sparks, 350–950ms burst, 600ms 이후 ok icon | constructionArtAssets/visibility→`renderer.ts:151`; 절차 ellipse fallback |
| `animatedMill.ts:8,31,68,73` | 고정 전문 loader/기하. body+sails URL/hub, production progress/cycle 회전, mill 전용 | `historicalFacilityAssets.ts:147`; windmill variant 예외 |
| `buildingSpriteFit.generated.ts:2` | 데이터 등록점/alpha bounds. URL loader나 의미 selector 아님 | `buildingSpriteFit.ts:27,31`, construction kit storehouse reference |

## 2. 지형·땅 소품·길·벽·날씨 (Render B)

| 선택자/자료 | 분류·엔진 입력·코드 경계 | loader·draw 연결 |
|---|---|---|
| `boundaryAssetManifest.ts:5,28,45`, `roadRibbonStyle.ts:34` | earth/stone strip set 선택은 데이터, 전체 경계는 혼합. strip 배열/rows/rut contrast와 선택 버전, 검증된 earth URL override | `boundaryAssets.ts:9`→`drawTerrainBoundaryV2.ts:106` preload→`drawRoadRibbons.ts:372` repeat |
| `drawGroundBoundaries.ts:16,56,61` | 혼합. forest fringe 목록·modulo 선택은 고정, season replacement 후 base fallback | boundary/season adapters→`:74` draw |
| `backyardDecals.ts:69,94,106,124,214,262` | 혼합. `src/content/backyardConfig.ts:24` 직업/threshold/props 데이터, crafts→head/spouse/other, winter→vacant→hungry→newcomer→occupation→형편 우선순위, hash A/B, 도로/벽/자유 셀 배치 | Wave27→`drawBackyardDecals.ts:31,42,64` anchor/scale/clip→`renderer.ts:128`; `doorProps.ts:68` 배치 충돌 방지 공유 |
| `seasonArt.ts:23,66,94,127` | 데이터 base→season candidates/salt 선택, 등록·raster는 전문 adapter | seasonArtManifest→이미지/raster→base/prop/boundary. `seasonGround.ts:11,37` chunk allowlist·여름 빈 토큰은 고정 |
| `archetypeGroundModel.ts:63,71,111,125` | 혼합. archetype/seed/terrain/drainage, riverside 제외, 9 strip family allowlist, spring→summer와 key grammar | Wave22→`archetypeGroundDraw.ts:36,49,110,166,232,247`→`drawTerrainBoundaryV2.ts:221` |
| `landEdgeBand.ts:36,59,62,87,129` | 혼합. forest edge→woodland floor, 여름a/b·겨울 분기. DEEP_WOODLAND_EDGE는 등록됐지만 미선택 | Wave41→manifestArt→stripImage. 등록/선택 구별의 구체적 예 |
| `terrainVariantManifest.ts:70,103` | 데이터 catalog+활성/load subset. retired/ferry/옛 shoreline 등은 등록만으로 그려지지 않음 | `terrainVariantAssets.ts:14,53`→`drawShoreline.ts:126,146,163,220,291,320` shallow/deep/hash/family/fallback |
| `seasonalDecals.ts:24,50,64,87,100` | 고정 계절 목록·seed 밀도·grass/road/building 제외, 봄꽃/겨울 puddle/벽 눈/orchard petals/wet replacement | Wave7/9/season→`drawSeasonalDecals:89` zoom/crossfade→`renderer.ts:128` |
| `weatherLayers.ts:86,114,139,150,167` | 혼합. DEFS와 weather→layer 표, wet timeline, engine weather/season/tick+enabled/rain switches | Wave23→`weatherArt.ts:16,41,133`→`weatherOverlay.ts:24,77,115` ground/sky. renderer ground·wetSummer sky |
| `waterMotionModel.ts:41,65,81,107` | 혼합. effect keys/mirror, zoom/weather/season, archetype 제한, animation/fish phase | Wave29→`waterMotionArt.ts:20,66,88`→`drawWaterMotion.ts` |
| `landStageModel.ts:18,32,49`, `landStageItems.ts:31,64,90` | 이전 전 고정 selector. engine 기간·tree stage/age/hash→stump/sapling/young wood, fallow plot/field/season. 시간 경계와 cache 함께 이전 필요 | Wave42→`wave42StageArt.ts:12,17`→`drawBuildings.ts:88`. 새 계약 이전/검증은 진행 중 |
| `footpathModel.ts:44,65`, `footpathDraw.ts:31,85,110` | 이전 전 고정 접속표/key grammar. ports→straight/corner/fork, 계절, axis. thinning/terrain/strip transform은 재사용 기하 | Wave42 stageArt→`drawTerrainBoundaryV2.ts:232`. 새 자료표 이전은 별도 회귀 필요 |
| `landWorksModel.ts:61,100,119`, `wave34Art.ts:19,24`, `landWorksDraw.ts:32` | 혼합. ford axis, drainage stage/region size, season/width/axis/stage key, digging cart/heap/sluice/plank | Wave34+Wave41 ford merged catalog→`:150` splash와 chunk draw |
| `landRockRegions.ts:102` | 기하/cache helper + 고정 rock pattern | ground region draw; 독립 variant registry 아님 |
| `farmProps.ts:43,79,125` | 혼합. pasture/seed/spacing, 고정 cattle 1/3 vs sheep family, woodland/common pig, ploughed→ox team/harvested→hay cart | zoneAssetManifest/ZONE_VARIANTS→`:164`→`renderObjectFrameCache.ts:121`, `drawBuildings.ts:94` |
| `drawYardProps.ts:11,19` | 데이터 family 소비. 이미 계산된 bed.variant→croftBed, orientation flip/anchor/scale; 배치는 world/boundary/yardProps 책임 | zoneAssets→`drawTerrainBoundaryV2.ts:234` |
| `zonePropSprites.ts:16,36,44` | 혼합. 객체 계절과 raster fallback, legacy orchard_tree→townLandscape 특수 연결 | zoneAssets/season/town→`drawBuildings.ts:92` |
| `zoneLayer.ts:70,107,176,208` | 혼합. zone-kind floor, seed/ordinal·인접 반복 회피, orchard edge/quincunx/jitter, pasture haycock density | ZONE_VARIANTS→ground 및 zonePropSprites |
| `drawArableFields.ts:80,109,226,250` | 혼합. engine arable stage, barley remap, wet/blight/flood, ridge[state], unavailable→growing, fallow만 season override | zone/Wave9/Wave3/season→ridge/furrow draw `:129` |
| `townLandscape.ts:11`, `townLandscapeAssets.ts:48` | 고정 vacant grass/road/building/stone enclosure/인접 제외와 hash→vegetable/orchard/pasture, orchard season 예외 | townLandscapeManifest→assets loader `:13,36`→sprite draw |
| `countrysideArt.ts:30,38,43,48` | 혼합 family scale/season key(spring→summer), strip repeat/prop pivot/hash jitter | Wave28→`countrysideDraw.ts:64` |
| `roofSmoke.ts:33,50,71,97` | 혼합. 가구 거주/식량/압력과 production/work_fire, 실제 body URL→roof anchor, facility flue 예외, oven/weak/normal→smoke_a/b fallback | Wave7/visibility+ROOF_SMOKE_ANCHORS→연기 frame draw |
| `gateArtRenderer.ts:28,50,60,94` | 혼합. material/axis→v3→v2→legacy, 공유 opening 제외, 고정 doors_open, axis crop/mirror | terrainVariantAssets+gateArtAssets→gate draw. closed 등록은 실제 닫힘 증거 아님 |
| `drawWallFaces.ts:328,337,344,405` | 혼합. module/crop/anchor/height, hash tower, turn pillar, material→face/top/diagonal/gate ashlar | terrain loaders→drawModuleSprite`:356`; procedural masonry fallback`:370` |
| `stoneWallAssets.ts:7,12,46`, `timberWallAssets.ts:7,27`, `gateArtAssets.ts:4,11,31` | 고정 family/axis 로더. timber 고정 1254², gate parts×axes URL 조합. 의미 선택 권한은 상류 | stone masonry/drawWallFaces, timberGateRenderer`:50`, gateArtRenderer |
| `bridgeWaterAssets.ts:4,18` | 작은 데이터 catalog loader. wood/stone x/y, bank/ford/water/shallow 등록 | `drawWater.ts:17` water, `drawBridges.ts:33,50` wood axis, `bridgeWaterKit.ts:17` region. 모든 row 선택 주장 금지 |
| `worldAssets.ts:42,51,153`, `worldAssetManifest.generated.ts:1` | 검증된 catalog loader. key/category/path/dimensions/renderScale/anchor/footprint; 자체 엔진 selector 없음 | 호출자가 key 선택. `:209` base URL resolution |
| `zoneAssets.ts:10,33,45`, `zoneAssetManifest.ts:12` | catalog image/raster/readiness 로더. 의미 선택은 zoneLayer/farm/yard/field | `ZONE_ASSETS`/`ZONE_VARIANTS` 소비 |

`drawTerrainBoundaryV2.ts`는 ground pass 조합·preload·chunk invalidation, `drawRoadRibbons.ts`는 반복 기하 소비, `drawBackyardDecals.ts`는 anchor/LOD/clip draw다. 이를 독립 의미 selector로 중복 집계하지 않는다. generated 파일은 값 공급이며 런타임 도달성 증거가 아니다.
## 3. 세계 워커·짐 (Render B)

| 선택 지점 (현재 소스) | 입력 → 선택 / 소비 경로 | 분류와 계약화 대상 |
|---|---|---|
| `src/render/walkerLook.ts:83` `walkerOccupation` | resident.occupation, walker.kind, cargo 또는 reservation.resource → 직업. 자원은 resourceEntry(resource).carrier 사용 | 혼합. 직업 분기 + 자원 등록기 |
| `src/render/walkerLook.ts:39` `OCCUPATION_BANDS`, `:102` `walkerCandidates`, `:128` `walkerLook` | 직업·가구 성별/연령·walker.id·seed → 가중 classBand 풀 → walkerSheetManifest의 sex/classBand/legacy 필터 → sheetId. elder·child 예외 | 혼합. 시트 정보는 데이터지만 직업별 가중치/legacy 예외/template 제외는 코드 |
| `src/render/walkerLook.ts:111` `trinketFor` | textile/servant band와 hash → 천·양모·실·주전자·ale jug | 하드코딩. band별 소품 후보 규칙 |
| `src/render/walkerLook.ts:156` `walkerHeldProp`, `:171` `workProp` | holdsTool, builder 공사 stage, 직업, cargo, 계절/dayOfYear → shovel/hammer/basket/bucket/purse/plough/seedbag/sickle/loaf/axe/trinket | 혼합. 소품 메타데이터와 선택 정책 분리 필요 |
| `src/render/walkerLook.ts:182` `walkerCloak` | 겨울이면 선택 sheet.cloak, 그 외 null | 혼합. 데이터 cloak 참조 + 고정 season 3 조건 |
| `src/render/walkerComposer.ts:188` `walkerAppearance` | kit worker 우선 → ale worker → cloth worker → 일반 look. constructionSites, home building, resident 직업 사용 | 하드코딩 우선순위. 단일 풀만 외부화하면 이 우회 경로가 남음 |
| `src/render/constructionKits.ts:132` `kitWorker` | kind의 kit.family, stage → wk_carpenter + work_adze/work_saw 또는 wk_mason + work_trowel | 혼합. kit family와 stage 경계 연결 |
| `src/render/aleWorldArt.ts:73` `aleWorkerSheet` | resident alewife/maltster, carter의 home malt_kiln → wk_alewife/wk_maltster | 하드코딩 |
| `src/render/clothWorkerSheet.ts:21` `clothWorkerSheet` | carter home building.kind: pastoral_farm/fulling_mill/dyehouse/tenter_yard → shepherd/fuller/wool_merchant | 하드코딩 |
| `src/render/walkerComposer.ts:48` `imageFor`, `:67` `lookImages`, `:114` `composedCell`, `:223` `drawComposedWalker` | 선택 sheet/prop/cloak → 각 manifest URL, direction+gait 프레임, 손/발 기준점 → 캐시 셀 → drawCroppedWorldSprite | 데이터 주도 프레임/등록점 소비. 캐시·합성은 실행 메커니즘. 몸체는 완성 시트, 초상 레이어 합성과 무관 |
| `src/render/walkerPresentation.ts:20` `walkerPresentationFor`, `:28` `roleForWalker`, `:47` `resourceRole` | walker kind/resource/path → 4 legacy role + 방향 + 보행프레임 | 하드코딩 fallback 역할 정책 |
| `src/render/runtimeActorAssets.ts:21` `actorFrameFor`, `:83` `drawRuntimeActor`, `:100` `drawRuntimeHandcart` | role+direction+gait → runtimeActorManifest 프레임; handcart는 고정 id. active 항목 preload → crop/raster → drawCroppedWorldSprite | 혼합. 프레임/foot/handles는 데이터, role/handcart·줌 gate는 코드 |
| `src/render/drawWalkers.ts:59` `drawWalker` | viewMode/zoom/loaded 여부 → silhouette 또는 composed → legacy runtime actor → procedural walker; cargo 표시 분기 | 하드코딩 fallback/LOD 정책. manifest 추가만으로 fallback 정책은 변경되지 않음 |
| `src/render/drawWalkers.ts:120` `cartLoadArt` | resourceEntry.storage/cartLoadKey/cartPileKey + 방향 → cart_load_${key}_${axis}, generic sack/crate 또는 없음 | 혼합. 자원 등록기 선택 자료는 있으나 파일 명명·축/폭·generic 매핑은 코드 |
| `src/render/aleWorldArt.ts:63` `aleCartLoad`, `src/render/clothWorldArt.ts:59` `clothCartLoad` | barley/malt/ale 또는 fleece/cloth/dyed cloth + direction → wave3 적재물 키 | 하드코딩 가족별 연결 |
| `src/render/drawWalkers.ts:129` `drawCartPayload`, `:148` `drawCargoIcon`, `:154` `drawComposedWalkerWithCart` | ale → cloth → wave7 → visibility pile 순서, resource cargoIconCell → ui 아이콘. zoom >= 0.8 적재물, close zoom 아이콘 | 혼합. registry는 data, 가족 우선순위·crop/scale/LOD는 code. Render B 소비가 Render A uiArt를 참조하므로 공동 인터페이스 변경 필요 |

## 4. 세계 사건 연출 (Render B)

| 선택 지점 | 엔진 사실 → 그림 / draw 연결 | 분류 |
|---|---|---|
| `src/render/storyWorldProps.ts:54` `petitionGathering`, `:63` `drawStoryProps` | openPetitions, legacy.family, keep/church/chapel/house/market → gate crowd + 남녀 petitioner. house.leavingSinceTick/abandonedTick → bundle + leaving family | 하드코딩 사건 키/건물 우선순위/인원/배치. Wave9/7 manifestArt 소비 |
| `src/render/storyWorldProps.ts:84` `drawDepartures` | 최근 abandonedTick, plague vacant 제외, building door → map edge, 12초 presentation 경로 → family sheet | 하드코딩. registry event id → 연출 계약 아님 |
| `src/render/storyWorldProps.ts:27` `FIGURE_HEIGHT`, `:35` `drawCell` | story walker key → 높이 표; 방향 4열 + gait 2행 crop | 혼합. 프레임 메타데이터 일부 사용하지만 높이 표·방향 레이아웃 별도 상수 |
| `src/render/warWorldProps.ts:166` `warProps`, `:198` `drawWarProp` | beaconLit, raid 위치/피해 house → beacon_idle/lit, quay, raid_burning_quay, raid_smoke_column_sheet. 위치는 해안/건물 탐색. nowMs → smoke frame | 하드코딩 상태 분기 + 데이터 draw. drawObjectRenderItems.ts:99가 normal 모드에서 소비 |
| `src/render/plagueWorldProps.ts:63` `computeGraves`, `:114` `plagueProps`, `:125` `drawPlagueProp` | plague 사망/교회/seed → grave_a/b; queue의 plague_prop → Wave9 draw | 혼합. 등록기 이벤트만의 generic effect contract 아님 |
| `src/render/plagueWorldProps.ts:211` `drawFuneralProcession` | plagueStage arrival, church path, nowMs → wk_funeral_bearers + 방향별 bier_shroud | 하드코딩 stage/배치/지속/actor 종류. wetSummer.ts:24 → 이 함수 |
| `src/render/reorgWorldProps.ts:121` `reorgProp`, `:173` `drawReorgOverlays` | reorganisation → guildhall(건물 담당과 중복 경계), textileStreetTick → 첫 두 weaver_house 사이 남녀 petitioner | 하드코딩. Wave9 및 Wave12 manifest loader |
| `src/render/reorgWorldProps.ts:205` `CHASERS`, `:209` `drawCollectorChase` | rebellion.outcome chased + 1계절 이내 → tax_collector + petitioner 3명, market→keep/church, 9초 loop | 하드코딩. collectorWalker.ts:16 → WAVE17_WALKER_IMAGES의 wk_tax_collector 방향/gait crop |
| `src/render/alehouseCrowd.ts:81` `aleDrinker`, `:122` `withAlehouseCrowd`, `:142` `drawAleDrinker` | alehouse stand·seed·presentation time → 슬롯 짝홀 남녀 petitioner, 출입/서있기 → object queue | 하드코딩 role pool/주기, 프레임은 Wave9 데이터 |

연출 공통 소비: `src/render/wetSummer.ts:21`의 drawStoryWorldOverlays가 departure/funeral/reorg를 호출한다. 세계 객체는 `drawObjectRenderItems`로 깊이 정렬되어 소비된다. 현재는 '연출 종류·무리·자리·지속'을 하나의 계약으로 선언하지 않고 여러 모듈의 상태 분기와 시간 상수가 결정한다.

## 5. UI 사건 삽화 (Render A — B에서 수정하지 않음)

| 선택 지점 | 엔진 사실 → 선택 / 화면 연결 | 분류 |
|---|---|---|
| `src/ui/eventStory.ts:79` `storyBeats` | fire/events/famine/calendar/petition/right/town state → event_fire, aftermath, warning, wet_summer, bad_harvest, famine, first_winter 등 | 하드코딩. 상태 조건과 그림 id가 동일 함수에 있음 |
| `src/ui/eventStory.ts:193` `warBeats`, `:231` `plagueBeats`, `:306` `reorgBeats`, `:375` `legacyBeats`, `:438` `interludeBeats` | 각 챕터의 engine state/기록 시각/결정 결과 → 각 Wave 그림. interlude는 interlude_${id} 규칙도 사용 | 혼합. 챕터별 adapter와 id 규칙 |
| `src/ui/petitionPresentation.ts:55` `PRESENTATIONS`, `:336` `petitionPresentation`, `:351` `petitionArtOf` | petition.defId → 고정 table의 {sheet,id}. 미등록 defId는 DEV throw, release art:null | 혼합. table은 TS 코드이며 외부 사건 등록기와 별개 |
| `src/ui/decisionModels.ts:33` `famineDecisionView` | choice → decision_${choice} | 혼합. 명명 계약이 있으나 특정 wave 타입에 결합 |
| `src/ui/chronicleModel.ts:98` `chronicleIllustration` | ledger record template/params/chapter → 사건/결정/챕터 끝 삽화 | 하드코딩 선택 adapter |
| `src/ui/seasonLedgerScenes.ts:24` `EVENT_SCENE`, `:32` `recordScene`, `:89` `numberScenes`, `:111` `seasonLedgerScenes` | 기록 template/params와 ledger 수치 변화/가중치 → Wave19 scene 선택 | 하드코딩 record→scene와 수치→장면 정책 |
| `src/ui/storyArt.ts:17` `storyArtStyle` | id ∈ WAVE33/31/21/17, 그 외 Wave16 → wave별 URL/CSS aspect style | 혼합. 메타데이터 조회는 data, wave dispatcher는 code |
| `src/ui/legacy/legacyScreenModel.ts:111` `illustrationArt`, `:121` `installedArt` | engine이 기록한 illustration id → 설치 manifest membership 검사 → ChronicleArt 또는 null | 혼합. 허용 wave 목록이 별도 수동 목록; storyArt와 동일 단일 등록기가 아님 |

소비: `src/ui/hud/EventCards.tsx:29`는 beat.illustration을 storyArtStyle에 전달. `src/ui/hud/StoryModals.tsx:72` PetitionArt가 sheet별 화면 처리, `:173` 연대기 항목은 storyArtStyle 사용. `src/ui/chronicle/ChronicleArtView.tsx:11`도 별도 kind dispatcher. Wave16/17/21/31/33 및 Wave19 generated manifest는 URL/width/height 자료를 제공한다. UI의 URL/CSS 소비는 브라우저가 필요할 때 이미지를 요청하므로 세계 canvas preload와 별개다.

## 6. 초상 (엔진 + Render A)

- `src/content/portraitPool.ts`: 이미 데이터 풀. `src/engine/portraits.ts:105` choosePortraitIdentity / `:117` chooseFactionPortraitIdentity / `:127` bestIdentity는 성별, age band, classBand, traits, occupation/tags/role, build, aging-chain 길이, 사용량, seed/person.id로 점수·동률을 계산한다. **혼합**: 데이터 후보 + 하드코딩 점수와 fallback 정책.
- `src/engine/portraits.ts:162` portraitFor: 저장된 portraitIdentity와 age band/age → 해당 노화 단계, under-8 own/common pool, 없으면 infant/child silhouette. 혈통/노화 사슬은 풀에 연결되어 있지만, 이 경로에는 연대에 따른 시대판 선택 인자가 없다. 새로운 시대판 자동 소비가 이미 구현됐다고 판정할 수 없다.
- `src/ui/portraitArt.ts:21` imageOf: PORTRAIT_IMAGES → silhouetteUrl → steward tone 순서. `:33` drawnPortraitId는 steward 직책이면 풀 선택을 고정 steward_neutral/concern/success로 교체한다. **혼합** 및 고정 초상 예외.
- `src/ui/portraitArt.ts:37` portraitUrl / `:43` portraitStyle는 generated manifest의 96/256 파일을 size 기준으로 URL/image-set CSS에 연결한다. URL 선택은 **데이터 주도**, DPR/96 기준과 fallback dispatch는 코드.
- 실제 소비 확인: `src/ui/persons/PersonViews.tsx:49`, `src/ui/chronicle/BiographyPage.tsx:43`, `FactionPage.tsx:57`, `FactionTab.tsx:71`, `FamilyTree.tsx:86`, `ChronicleArtView.tsx:18`. 엔진 portrait selector 변경은 Render B 단독 범위 밖이다.

## 7. 지역 지도 (현재 계약/런타임 연결 없음)

- Graft의 `region-atlas`, `atlas`, `map_`, `neighbor` 전수 검색 및 src 파일명 목록을 조사했다. `region-atlas`는 inbox 도구만, `map_region`은 lord-components 생성 도구만 나타났다. 보충 검색 `rg -n 'region-atlas|map_region|neighbor-world' src public/assets --glob '*.ts' --glob '*.tsx' --glob '*.json'`는 0건(exit 1). 현재 checkout에서 손그림 지도 id·terrain·slot·seed→estate 할당을 하는 제품 selector/loader/draw 연결을 확인하지 못했다.
- 후보 데모는 `assets-inbox/region-atlas/candidates-20261003/records/tools/render-neighbor.cjs:12`: mapId='open_field-01' 고정, 18 estate를 allowedKinds/거리/미사용 slot에 오프라인 배치하며 결과 자체가 `visual-slot-assignment-demo-not-engine-world`라 명시한다. 런타임 설치 증거가 아니다.
- 존재하는 지도 화면 `src/ui/chronicle/SnapshotMapView.tsx:49`는 history snapshot의 팔레트 인덱스를 canvas ImageData로 복원한다. `:29` large/small Wave19 frame 선택은 **하드코딩**. 이는 지역 지도 atlas가 아니다.
- §4 지역 지도 계약은 신규 adapter/consumer가 필요하다. UI 소비/상호작용은 A, 카탈로그 데이터/파일 공급은 B, seed·estate 배정/여행 거리 같은 엔진 의미는 엔진 협업이다.

## 8. manifest·loader·preload 공통 구조 (B 소유, UI 교차 import 주의)

1. `src/render/manifestArt.ts:11`은 Record<key,{url,width,height,pivot,frames?}>를 받아 lazy Image cache(`:14`), preload(`:31`), pivot draw(`:35`), reference crop overlay(`:46`)를 제공한다. data key를 draw할 수 있지만 **엔진 조건 → key를 선택하지 않는다**. missing/loading은 null/false 반환. 이 API만으로 §4의 선언적 선택 시스템은 완성되지 않는다.
2. `src/render/preloadGameArt.ts:35`은 world/historical/compound/wall/runtime actor/mill/construction/gate/bridge/town/variant/house/granary loader를 고정 Promise.all로 기다린다. `:50` preloadFrameArt는 visibility/Wave7/Wave11/ale/cloth/house layers/granary layers/UI canvas icons를 fire-and-forget 호출한다. 새 loader family는 여기 수동 추가가 필요하다.
3. `src/render/preloadGameArt.ts:66` CHAPTER_SCOPED_MANIFESTS는 Wave9/17world/21/31/33/endings/guildhall/collector의 고정 목록. `src/render/chapterArt.ts:32` CHAPTER_ART는 wave prefix/manifest chapter로 분류하고 `:55` chapterOfArt는 미등록 URL을 chapter 1로 취급한다. 데이터의 chapter와 수동 family dispatch가 혼재한다.
4. `src/render/runtimeActorAssets.ts:33` 전용 loader는 active만 로드, registerRuntimeAsset로 규격을 검증하고 frame raster cache를 만든다. 일반 manifestArt와 같은 구현이 아니다.
5. `src/render/walkerComposer.ts:48` 전용 lazy loader와 composedCell cache도 별도. `walkerWarmup.ts`가 currentWalkerLooks의 distinct look을 준비한다. 전체 manifest preload 여부와 실제 선택된 look이 준비됐는지는 다르다.
6. `src/ui/wave21Art.ts:22` 등 UI preload는 별도 이미지 요청이며 draw는 CSS URL. portraitArt는 별도 manifest 및 silhouette/steward 분기를 갖는다.

가장 작은 계약화 단위: 먼저 공통 key→asset URL/frames/pivot 계약과 **resource/role/event→key 선택 규칙**을 구분한다. 워커/cargo를 외부화할 때 legacy fallback·kit/ale/cloth override·chapter preload 등록을 누락하지 않아야 한다. UI용 사건/초상/지도는 B 단독 코드 변경 대상이 아니다.
추가 소스 확인:

- **Village life — 혼합/하드코딩**: `villageLife.ts:120` townLife는 실제 거주·비폐허 집, persons household의 child/woman/elder, 집 level, seed, 계절, 건물/도로/zone 장애물을 읽는다. :172 chair/barrel, :192 clothesline/toys, :204 level별 hen/cat/dog 가중 표, :206 각 변형, :217 pigeon, :225 well bucket을 고른다. :253 villageLife는 뷰/계절별 동물 수와 비행 bird를 제한한다. 위치·종·인원·배치 가능 조건은 TS, displayScale은 WAVE23_IMAGES. `villageLifeDraw.ts:40` sheetOf는 manifest frame grid, :64 lifeArt는 독립 lazy Image/raster cache, :166 drawVillageLifeItem은 still/walk/flight/perch motion과 zoom을 적용한다. 새 동물 파일/row만 추가해도 후보 목록·종 가중치·규모·이동 정책이 자동 확장되는 구조는 아니다.
- **Construction dust — 하드코딩**: `constructionMoments.ts:60` drawSiteDust는 stage/placement age가 DUST_MS 미만일 때 `dust_puff_sheet` 4프레임 Wave7 → 로드 실패 시 visibilityArt(`dust_puff`) 정지 이미지로 fallback. duration/frame count/crop/scale 전부 코드다.
- **World signs — 하드코딩**: `worldSigns.ts:52`는 도로 끊김, foodShortSinceTick, leaving/abandoned, operationSuspended/curacyVacant, marketHasSaleCandidate, empty burgage parcel를 sign enum으로 만든다. :130 drawWorldSigns는 tall_grass_plot + stake, dotted track/procedural track, bundle_family_prop + food icon, bar_latch + chapel icon, empty_stall을 고른다. 상태 흔적 계약의 중요한 별도 경로이며 event registry가 아니다.
- **UI 연대기 추가 adapter — 하드코딩**: `src/ui/chronicle/chronicleScreenModel.ts:409` recordArt는 stone-town 직접 그림 → chapterFiveArt(:378)→chapterFourArt(:365)→chapterThreeArt(:389)→chapterTwoArt(:337)→person portrait→rumour/sign→chronicleIllustration으로 dispatch. 기존 위 표의 chronicleModel과 별도 selector라 반드시 둘 다 포함해야 한다.
- **Ending — 데이터 주도 id lookup**: `src/ui/endingArt.ts:7`은 LegacyEndingId→ENDING_IMAGES[id].url, :10 preloadEndingArt는 chapter include filter를 읽는다. engine ending 선택 자체는 렌더 계약 밖, 소비는 `src/ui/legacy/LegacyEndingScreen.tsx`다.

정규식 후보 목록 밖에서 발견하고 본문에 포함한 핵심 파일: `walkerPresentation.ts`, `walkerWarmup.ts`, `aleWorldArt.ts`, `clothWorldArt.ts`, `storyWorldProps.ts`, `plagueWorldProps.ts`, `wetSummer.ts`, `alehouseCrowd.ts`, 모든 `src/ui` 사건/초상/지도 selector 및 `src/engine/portraits.ts`/`src/content/portraitPool.ts`. 따라서 89개만 읽고 '전수'라 부르면 이 경로들이 빠진다.

추가 generated family provenance: Wave7/9/11/17World/17Walker/23/3Ale/3Cloth manifest는 위 wrapper/model이 소비하며, 파일명마다 별도 engine selector가 있는 것은 아니다. UI Wave16/17/19/21/31/33/portrait/ending generated manifests 역시 위 UI adapter의 data source다. `resourceChainArt.ts`는 자원 chain 아이콘 시트 소비(핵심 §4 이미지군 밖 인접 UI), 문장/프레임/일반 HUD 아이콘 전체는 이번 actor·story 범위의 전수 주장에 넣지 않는다.

## 89개 후보 대조와 자료 공급자

위 의미 경로와 다음 보조 표의 합집합이 `.omo/drafts/selector-scan-files.txt`의 **89개 경로 전부**를 이름으로 대응한다. 89는 그림 수·selector 함수 수·설치 수가 아니라 정규식이 반환한 파일 수다. coverage JSON의 `scanned:89,covered:89,missing:[]`와 일치한다. 같은 파일이 여러 종류를 다루면 한 번만 후보 수에 센다.

| 보조 후보 파일 (`src/render/`) | 판정과 연결 |
|---|---|
| `wave7Art.ts:6`, `wave9Art.ts:6`, `wave11Art.ts:6` | 데이터 wrapper. 각 generated manifest→manifestArt를 노출하며 자체 엔진 선택 조건은 없음 |
| `walkerSheetManifest.generated.ts` | 데이터: class/sex/legacy/frame/foot/hand/prop/cloak. walkerLook와 walkerComposer가 소비 |
| `runtimeActorManifest.generated.ts` | 데이터: active legacy actor/handcart의 URL/crop/foot/handles. runtimeActorAssets가 소비 |
| `townLandscapeManifest.generated.ts:2` | 데이터: id/url/size/displayWidth/groundAnchor. townLandscapeAssets 소비; 공터·석벽 자격 규칙은 없음 |
| `wave3AleArt.ts:16,26,33` | 혼합: folder별 PIVOTS와 alehouse prefix, 아이콘 셀 순서 상수로 generated metadata 보강→manifestArt |
| `wave3ClothArt.ts:18,32` | 혼합: weaver/fulling wheel/mill/farm prefix별 pivot, folder별 anchor 보강→manifestArt |
| `canvasRuntime.ts:187,196,202` | 기하 helper: openingSpriteKey→runtimeWorldAssetManifest 크기를 시작 camera framing에 사용. 이미지 로드/draw/의미 선택자가 아님 |

추가 generated 공급자를 종류별로 묶으면 건물·상태는 Wave26/30/32/storehouseSnow 및 historical/compound/condition, 소품은 Wave27/zone, 지형은 season/Wave22/28/29/34/41/42, 세계 actor/연출은 Wave3/7/9/11/17World/17Walker/23, UI는 Wave16/17/19/21/31/33/portrait/ending이다. 각 wrapper를 위 소비자까지 추적했으며 generated 행 자체를 설치 증거로 세지 않았다.

정규식 밖 필수 보충 경로는 `buildingVariantManifest.ts`, `boundaryAssetManifest.ts`, `buildingOverlays.ts`, `weatherOverlay.ts`, `weatherPlacement.ts`, `seasonGround.ts`, `landStageModel.ts`, `landStageItems.ts`, `landWorksModel.ts`, `footpathModel.ts`, `src/content/backyardConfig.ts`, actor/UI 본문의 추가 경로다. 이미지 이름 없이 engine 상태만 넘기는 함수도 있으므로 regex 검색만으로 '모든 미래 selector까지 없음'을 증명하지 않는다.

## 보존 사항과 검증 한계

이전 시 seed/salt/identity와 인접 반복 회피, wall 자격, household craft/member 우선순위, winter/vacant/hungry 순서, body/reference crop, 준비되지 않은 이미지 fallback, active/retired 구별, 계절 crossfade/readiness cache invalidation, 도로/벽/물/필드 제외, 땅 단계 시각, zoom gate를 보존해야 한다. URL/metadata를 JSON으로 복사하는 것만으로 선택 규칙이 데이터화되지 않는다.

조사는 Graft map(3,056 files/14,681 symbols/55,073 edges), ask/skeleton/grep/callers 후 실제 소스 범위를 확인하는 방법으로 수행됐다. world 담당의 Graft 표시 추정은 4,802,620, actor/UI 담당은 최소 5,484,918 tokens다. 전체 repo 읽기를 가정한 map 기준선이 포함된 도구 추정이며 실제 비용/시간 절감 측정이 아니다.

이 통합 문서 작성자는 제품 테스트를 실행하지 않았다. 브라우저 decode·DPR·시각 품질·노출 빈도·성능·모든 engine 조건의 runtime reachability·원본/설치 바이트 일치는 이 inventory만으로 확인되지 않는다. `INBOX_LEDGER.csv`의 빈 installed_by, alias 바이트, catalog 등록, unit 통과는 설치 판정의 대체물이 아니다. 소스→runtime 파일→catalog→선택→loader→draw→실제 장면 증거를 별도 관문으로 남긴다.

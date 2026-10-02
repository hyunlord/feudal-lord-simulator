# 랜드마크 성장 — 현재 엔진 대응표

판정: **읽기 전용 소스 확인 완료 / 후보 아트는 미설치 / 런타임 검증 미실시**.

- 저장소: `/Users/rexxa/fls-astra-landmarks`
- 확인 HEAD: `c2460918ecb13cdd6475f25f3e4809b3a352b01d` (조회 당시). 클론/LFS checkout 진행 중이므로 git status의 대량 D/??는 변경 검증으로 해석하지 않았다.
- 범위: 아래 모든 경로는 위 저장소 기준. 실제 코드 상태와 제안 아트 단계를 구분한다. 제안 단계 번호는 엔진 tier가 아니다.
- Graft 먼저 수행: 없는 로컬 그래프를 `GRAFT_NO_STATUSLINE=1 graft build`로 생성, 2,811 파일/16,819 nodes/52,847 edges. 이후 `graft ask "buildingConfig buildingCatalog chapel church market gate bridge keep guildhall inn tier sprite visual church extension charter guild wealth chapter" --source` 1회. 도구 추정 절감 **14,915 tokens (98%)**, pack 321 대 해당 8개 전체 파일 15,236. 검색 결과 뒤 실제 소스 확인. 로컬 생성 캐시 외 게임 변경·설치·커밋·푸시 없음.

## 7계열 실제 상태와 후보 단계

| 계열 | 실제 kind / tier / 선택 상태 | 후보로 필요한 성장 단계(제안) | 기존 트리거·소스 | 통합 공백 |
|---|---|---|---|---|
| 예배당→교회 | `chapel`과 `church`는 별도 BuildingKind. chapel 1×1, church 2×2. 일반 Building에 성장 tier 없음. 기본 아트 각각 1종, 사제 공석은 `curacyVacant`. | 작은 예배당→교구 교회→확장된 신랑. 각 단계는 같은 footprint로 억지 확대하지 말고 등록 규격을 별도 명시. | `src/content/buildingConfig.ts:6-30,71-86,200-212,353-365`; `src/content/buildingCatalog.ts:94-95,113-114`. 실제 증축: `CHURCH_REBUILDING_PETITION_ID` 수락 시 비용 지출 후 `legacy.naveRebuilt=true` (`src/engine/legacy.ts:196-200`). 청원 예정 1396년 봄, 비용300 (`src/content/legacyConfig.ts:110-111`), chapter5 진입이 너무 늦으면 생략(`src/engine/legacy.ts:270-295`). | chapel→church 자동변환 경로 또는 공통 tier를 확인하지 못했다. `naveRebuilt`는 저장되지만 렌더에서 읽지 않음; 시설 선택은 고정 church ID(`src/render/historicalFacilityAssets.ts:105-108`). 증축 그림은 상태 연결 작업 필요. |
| 시장 | `market`, 2×2. `market_quiet`/`market_active`는 성장 단계가 아니라 판매 가능 활동상태. Wave2 변형도 있음. | 작은 노점 집합→특허 장터→성숙한 시장 건물/교차점. | 시장 활동은 `marketHasSaleCandidate` (`src/render/historicalFacilityAssets.ts:29-39,119-121`). 시장권 청원:1305–1308년, 최소6 lot, 수락에 따라 권리와 세율 변경 (`src/content/chapterConfig.ts:88-99`). 자치특허 수락은 시장세/통행세 권리를 도시로 이동 (`src/engine/reorganisation.ts:241-245`). | 특허/장별 시각 tier 없음. 거래 활동과 건물 성장 단계를 혼동하지 말 것. 새 후보단계는 rights/정착 단계 등의 별도 선택 설계 필요. |
| 성문 | BuildingKind 아님. 성벽 node와 segment의 material `timber`/`stone`, 축 두 방향. 완료 문은 논리적으로 열린 상태. | 목책 문→석조 아치 문→큰 문루 후보. | 석조도시 선포는 기존 완료벽에 교체공사를 생성, 기존 material 유지(`src/engine/era.ts:108-138`); 완료에서 stone 설정(`src/engine/constructionLifecycle.ts:225`). 렌더 material 분기(`src/render/drawPalisadeSegments.ts:68-88`), 문 그림 material/축 선택(`src/render/gateArtRenderer.ts:60-74`). | 문루 3단계 tier 없음. 석조 선포 즉시 모든 문을 석조로 바꾸면 현재 완료 상태와 어긋남. 닫힌문 후보는 실제 통행폐쇄 명령을 뜻하지 않음(`gateArtRenderer.ts:92-95`). |
| 다리 | BuildingKind 아님. 물 위 road의 양쪽 육지 둑을 가진 직선 span, axis x/y, 최대 물8칸. 별도 tier/material 필드 없는 `BridgeSpan`. 여울은 별도 통과상태. | 좁은 목교→넓은 목교→석조 아치교 후보. | `src/world/bridges.ts:4-11,23-54`; 현재 deck/rail은 `woodX`/`woodY`를 선택 (`src/render/drawBridges.ts:31-45,49-62`). 도시의 bridge_tolls 권리는 존재(`src/engine/reorganisation.ts:241-245`)하나 구조 재료를 바꾸지 않음. | 석교 업그레이드 명령/저장 tier를 확인하지 못했다. 자치특허가 석교를 만든다고 표기 금지. 다리는 통짜 건물 한 장이 아니라 tile deck와 앞/뒤 난간 분할 렌더. |
| 영주관 | `manor_house`,2×2, 지도 시작/구형 세이브 이행 시 사전배치. 성장 tier 없음. `keep`와 다른 종류. 현행 catalog는 sprite/facilityArt 등록 없이 절차형 body(폭72,높이56,지붕24,shed). | 소박한 영주관→확장 영주관→부유한 영주관 후보. 비어 있음은 성장단계와 별도 상태. | 정의와 직접건설 제외(`src/content/buildingConfig.ts:127-136,429-435`). 배치: 마을 인근 빈2×2, 적지가 없으면 생략(`src/state/openingVillage.ts:177-225`). `manorVacant`는 manor 가구 사람이 없는지 검사(`228-234`). 장5 가족 상태는 자치특허 수락 시 departed, 아니면 stayed(`src/engine/legacy.ts:498-500`). | `src/content/buildingCatalog.ts:139-142`는 manor a/b·empty 후보가 inbox에 있음을 주석으로만 설명하고 실제 facilityArt를 등록하지 않음. 렌더 소스에서 manorVacant/영주관 전용 selector 미발견. `legacy.family`와 `manorVacant`는 다른 판정이며 자동 동치로 취급 불가. chapter/가문 부에 따른 manor tier 명령·그림 전환 없음. |
| 길드홀 | `guildhall`은 BuildingKind가 아니라 표시 전용 `ReorgPropKind`. 길드 없으면 안 보임; 있으면 시장 근처 빈3×2 자리 탐색. 본체+active 오버레이를 함께 그림. | 모임용 소규모 홀→인가 길드홀→부유한 길드홀 후보. | 길드인가 수락은 `reorganisation.guild={foundedTick,headId}` 생성 (`src/engine/reorganisation.ts:234-239`), `guildOf`는 해당 필드 반환(`133-135`). prop 표시 검사와 배치 (`src/render/reorgWorldProps.ts:57-110,120-126`), 두 레이어 동시 그리기(`112-117`). | 현재 존재/부재 2상태만 확인. active 레이어가 추가 성장단계는 아님. 길드 wealth에 따른 tier 및 실제 엔진 점유 건물 연결 없음. 3×2는 렌더가 빈 곳을 찾는 배치규격이며 건설 가능한 BuildingDefinition이 아님. |
| 여관 | 독립 `inn` BuildingKind 없음. `house` L4 single 풀의 `id:"inn"`, family trade,161×161 그림. | 작은 숙소→길가 여관→부유한 상인 여관 후보. | `src/render/buildingVariantManifest.ts:160-197`. level/lot 풀 선택(`src/render/buildingVariants.ts:28-30`), seed와 family 기반 확률선택(`80-95`). wealth는 주택 그림 roof 확률에 사용(`src/render/houseVariantChoice.ts:55-74`); rich=merchant/gentry/artisan 또는 builtLevel≥4(`src/content/houseVariantConfig.ts:25-29`). | 부유해지면 반드시 inn이 되는 규칙 없음. Wave26 선택이 기존 그림으로 돌아온 경우만 Wave2 variant/alehouse 경로(`houseVariantChoice.ts:14-25`). 여관 영업·여관 성장 command 없음. 술집(alehouse)과 여관을 같은 엔진업종으로 가정하지 말 것. |

## 현행 렌더 등록값

시설 공통: `historicalFacilitySpriteRect`는 footprint 중심의 screen x에 displayWidth/2를 빼고, footprint 앞 꼭짓점에 cropped sprite의 바닥을 맞춘다. 높이=`displayWidth×source.height/source.width`. 이는 1254×1254 원본의 중앙바닥 pivot을 그대로 쓰는 방식이 아니다 (`src/render/historicalFacilityAssets.ts:132-141`). 아래 px는 카메라 zoom 전 world/screen 단위 계산치이며 브라우저 실측 아님.

| 항목 | 엔진 footprint | 원본/ crop(x,y,w,h) | zoom1 그리기 폭×높이 | 근거 |
|---|---|---|---|---|
| chapel |1×1|1254² /126,55,1060,1134|56×59.91|`src/render/historicalFacilityManifest.ts:47-60`|
| church |2×2|1254² /47,83,1163,1077|108×100.01|동일파일`:62-75`|
| keep (비교용, 요청 성장계열 아님) |2×2|1254² /223,41,832,1155|94×130.49|동일파일`:77-90`|
| market quiet/active |2×2|1254² /35,50,1213,1146|108×102.03|동일파일`:92-105,122-135`|
| manor_house |2×2|현재 전용 래스터 등록 미확인; catalog 절차형 body|body 폭72/높이56/roof24, shape 중심 기준 정렬. 래스터 pivot 없음|`src/content/buildingCatalog.ts:139-142`; `src/render/buildingVisualState.ts:94-102,212-218`; `src/render/buildingFallbackShapes.ts:33-40,56-73`; `src/render/drawBuildings.ts:162-200`|
| guildhall |render plot3×2|352×300, pivot(107,291)|176×150, scale0.5. 바닥점=tileToScreen(tx,ty+2)|`src/render/wave12GuildhallManifest.generated.ts:5-6`; `src/render/reorgWorldProps.ts:30-32,112-117`|
| stone gate v3 |성벽 개구부|512×384,pivot(252,249), portal204px|scale51.2/204≈0.25098;128.50×96.38. strip mode 경로에서 사용|`src/render/gateArtRenderer.ts:42-55,65-68`|
| timber gate |성벽 개구부|material/axis별 registration; v2는512²|고정 건물 rect 없음, portal panel affine 정합|`src/render/gateArtRenderer.ts:12-24,67-85`|
| bridge |road tile 연속 span|woodX/woodY crop+affine|tile별 deck, 난간 전후 분리; 통짜 건물 pivot 없음|`src/render/drawBridges.ts:20-45,49-62`|
| inn |house single(L4)|161×161 variant|기존 L4 house 등록틀 상속; 이번 조사에서 최종 house rect 수치는 미확인|`src/render/buildingVariantManifest.ts:160-187`; `src/render/buildingVariantAssets.ts:91-99`|

## 적용 경계

- 이번 문서는 후보 아트 제안과 현재 엔진 사이 대응표이다. 열거한 빈 단계의 gameplay 구현·manifest 설치를 승인하거나 수행하지 않는다.
- chapter는 일부 자산 preload 범위를 제한한다(`src/render/historicalFacilityAssets.ts:42-49`). preload chapter와 성장 단계 선택은 별개다.
- 수치는 소스 계산과 메타데이터 확인이다. 실제 화면의 occlusion, 충돌, 경로통행, DPR, 줌별 판독, 성능은 미검증이다.

## 영주관 보완 조사

- 사용자의 성장 대상은 `manor_house` 영주관이다. keep 성채는 비교 정보만 유지했다. keep는2×2 단일 시설 art로 별도 정의(`src/content/buildingConfig.ts:366-378`, `src/content/buildingCatalog.ts:115-116`).
- 추가 Graft `grep manor_house` 1회:19개 파일37 hits, 추정38,688 tokens 절감(97%,출력1,280 대 전체39,968). 이번 작업 총 Graft 절감 추정 **53,603 tokens**(첫 ask14,915+추가 grep38,688).
- 영주관 그림 설치·성장 command는 새로 만들지 않았다. `manorVacant`가 참인 경우와 장5 `legacy.family=departed`를 하나의 상태로 묶지 않았다.

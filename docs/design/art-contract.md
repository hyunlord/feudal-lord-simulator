# 그림 묶음 계약 v1

상태: **ASSET-ARCH-1 구현 중, 설치·런타임 관문 미판정**(2026-10-05). 설계 정본은 [시각 아키텍처 §4](visual-architecture.md#4-에셋-구조-제안--데이터-주도), 경계는 [foundation](foundation.md)다. 이 문서는 초안의 필드 이름을 실제 `src/render/art/artContract.ts`와 `artContract.schema.json`에 맞춘 구현 계약이다. 전체 selector 현황은 [SELECTOR_AUDIT](../verification/asset-architecture/SELECTOR_AUDIT.md)에 기록한다.

## 1. 봉투와 좌표

`ArtBundle`은 `schemaVersion:1`, `bundleId`, `entries[]`, `rules[]`다. 공통 entry는 `id`, 판별자 `kind`, `image:{url,width,height}`, `provenance:{inboxFile,sourceSha256,runtimeSha256}`만 요구한다. `inboxFile`은 받은 원본의 정확한 경로, 두 SHA는 원본과 런타임 바이트를 구별한다. 출처 필드가 있다는 사실만으로 파일의 존재·해시·설치를 검증했다고 하지 않는다.

세계 그림의 `geometry`는 `pivot`, 양수 균일 `scale`, 선택 `crop`/논리 타일 `footprint`, `allowMirror:false`다. `pivot`과 `crop`은 원본 이미지 픽셀 좌표이며 `footprint`는 타일 단위다. 축별 임의 늘이기와 미승인 반전을 허용하지 않는다. 프레임의 `sourceRect`는 이미지 기준, `pivot`은 프레임 내부 좌표, `durationMs`는 시각 프레임 기간이다. UI 3종에는 가짜 세계 scale/발판/발 피벗을 채우지 않는다. 워커의 foot과 짐의 grip도 서로 다른 attachment다.

## 2. 열 종류

| kind | 실제 종류 필드 | 배치 및 지원 경계 |
|---|---|---|
| `building-body` | `buildingKinds[]`, `levels[]`, `variantId`, 세계 geometry; 선택 `season`,`facing` | 완성 본체. 기존 seed·family continuity·neighbor push는 별도 의미 보존 대상 |
| `state-overlay` | `targetBodyIds[]`, `layer`=snow/boarded/worn/wealth/era, `transform:inherit-body`, `order`, 세계 geometry | 대상 body/landmark와 canvas/pivot/scale/crop 일치 검증. 소비자가 준 실제 body sourceRect/targetRect를 그대로 상속 |
| `ground-prop` | `archetypes[]`, `occupations[]`, `placement`=front-yard/back-yard/yard/street/frontage, 선택 `wealthRange`, 세계 geometry | 그림 선택과 합법 배치 계산을 구분. 길·물·다른 소품 충돌은 소비자의 실제 기하 사실 필요 |
| `walker-cargo` | `role`=walker/cargo, `cargoKinds[]`, `frames[]`, `facing`, `scale`, `allowMirror:false`, `attachment` | walker는 foot, cargo는 grip. frame별 피벗 사용; attachment.pivot을 추가 offset으로 중복 더하지 않음 |
| `land-stage` | `family`, `stage`, `layout`=single/strip/connector, 세계 geometry, 선택 season/facing | single은 선택 ports, strip은 start/end 필수, connector는 SW/NW/SE/NE 포트. 포트는 소스 픽셀 좌표이며 접속 mask가 아님 |
| `landmark` | `family`, `growthStage`, `expansion`=none/approved-footprint, 세계 geometry | 성장 조건은 엔진이 제공해야 함. 달력만으로 증축을 발명하지 않음 |
| `event-scene` | `eventIds[]`, `group`, `placement`=target/building/road, `duration`, 선택 `frames[]`, 세계 geometry | duration은 while-active 또는 visual-ms/milliseconds. 시각 지속이며 엔진 사건의 발생/종료를 바꾸지 않음 |
| `event-illustration` | `eventIds[]`, `fit`=contain/cover, `altTextKey` | image 비율과 UI fit 사용. Render A 인계 descriptor, 세계 draw가 아님 |
| `portrait` | `pool`, 선택 `personIds[]`,`lineage`, `ageStage`, `era`, `derivatives[{size:96|256,assetId}]` | 완성 초상·노화 사슬. derivative는 portrait 참조와 실제 선언 크기 검증. 얼굴 부품 합성 금지 |
| `regional-map` | `mapId`, `landTypes[]`, `coordinateSpace{width,height}`, `slots[{id,x,y,landType}]` | 완성 지도+명명 슬롯. 슬롯 ID/범위/landType 확인; 영지 생성·클릭·경로 탐색을 대신하지 않음 |

정확한 union은 `artContract.ts:2`의 ArtKind와 `:28` 이후 각 Entry, `:93` 이후 ArtRule/ArtBundle을 따른다. 표의 선택 필드는 schema에서 허용되는 생략을 뜻한다. schema와 TypeScript가 바뀌면 유효/무효 fixture로 둘의 일치를 함께 확인해야 한다.

## 3. 제한 선택 문법

`ArtRule`은 `id`, `kind`, `slot`, `priority`, `conditions[]`, `variants[{assetId,weight}]`, `fallback:'none'`다.

- conditions는 전부 AND. `eq(field,value)`, `in(field,values)`, `range(field,min?,max?)`만 허용한다. 범위는 **[min,max)**, 최소 한 경계가 필요하다. OR는 규칙을 나눠 표현한다. 빈 conditions는 무조건 일치다.
- 큰 priority가 우선이다. 같은 kind/slot/priority에서 교집합이 있는 규칙은 거부한다. 파일 순서로 충돌을 숨기지 않는다. 참조 누락/종류 불일치/중복 variant/불가능한 AND 조건도 거부한다.
- 필드는 `artSelection.ts:8`의 `ART_CONTEXT_FIELDS` 폐쇄 목록과 타입을 따른다. 누락·undefined·비유한 수치·getter는 non-match이며 0/false로 바꾸지 않는다. 임의 GameState 경로, 함수명, 실행 문자열은 받지 않는다.
- weight와 합계는 양의 안전 정수. 소비자가 준 안전 정수 seed의 양의 나머지를 선언된 variant 순서에 배분한다(`artRegistry.ts:55`). 엔진 RNG를 호출하지 않는다. 기존 알고리즘과의 등가는 별도 회귀 증명이 필요하다.
- no-match는 null. 현재 fallback은 **none만** 지원한다. 명시 asset fallback, alias chain, priority 아래 규칙 재시도 같은 기능을 지원한다고 문서화하지 않는다. 이미지 로드 실패 역시 다른 그림으로 자동 대체하지 않는다.
- `boundaries`와 `nextChange`는 같은 규칙의 수치 경계를 읽는다. `nextChange`는 다른 필드 조건을 고정하고 실제 선택 rule이 달라지는 다음 경계를 반환한다. cache 무효화도 같은 경계를 사용해야 한다.

## 4. 필드 공급과 바인딩 상태

allowlist는 가능한 계약 어휘이지 모든 사실이 제품에서 공급된다는 선언이 아니다. 현재 작업 트리에는 Wave42와 single house 본체/상태층의 제품 연결 코드가 있다. 아래는 `d4973e85` 기반 작업 트리를 2026-10-05에 읽은 정적 확인이며, runtime 통과 판정이 아니다. `wave42Registry.ts:6`이 startup catalog를 만들고 `landStageModel.ts:29,50`이 tree/fallow를 선택한다. `landStageItems.ts:23,33,69,98`은 선택된 여름/겨울 asset ID를 queue의 editions에 보존하여 draw에 전달한다. stage 이름으로 ID를 다시 만들어 선택 결과를 잃지 않는다.

| 종류/필드 | 공급 원천·단위·변경 계기 | 소유/상태 |
|---|---|---|
| land-stage `family`,`stage` | treeStage/fallowStage의 기존 결과, tree/fallow/path 분류. `landStageModel.ts:32,49`, `footpathModel.ts:65` | B가 읽음, 엔진 단계 계산 변경 금지. Wave42 선택 코드 연결, 회귀 미판정 |
| `ageYears`,`stageProgress` | tick-harvestedAtTick, `PRESSURE_BALANCE.seasonTicks`, STUMP/GROWN 기간에서 계산. engine-year/단계 비율; tick 전진/역행 시 변경 | Wave42 selector 연결 확인, 시각 하위 경계는 JSON 규칙에서 읽음; 회귀 미판정 |
| `parity`,`plot` | 기존 `cellHash(tx,ty)`의 modulo 2와 plot/field 구분 | Wave42 selector 연결 확인. hash·identity 보존 검증 필요 |
| `season` | 기존 stageSeason 및 seasonForObject의 유효 계절/crossfade | stageSeason 규칙 연결 확인. 객체 전환/회귀 증명 필요 |
| `layout`,`connectionMask` | 실제 footpath ports/인접 관계 → single/strip/connector와 mask | 접속표는 JSON, `footpathModel.ts:65`에서 검증. 이 두 필드가 rule context로 직접 공급된다는 뜻은 아님. thinning·합법 지형·양의 strip 변환은 기하 알고리즘 |
| building-body `buildingKind`,`level`,`season`,`calendarYear`,`lot`,`eligible` | `contractHouseArt.ts:27`의 building.kind/builtLevel, seasonForObject, stateCalendar(state).year. houseBodyEligible 통과·single lot만 `lot:single`,`eligible:true`; tick/건물/가구 변경 시 다시 읽음 | `house-body` slot 연결. calendarYear는 달력 연도이며 경과 engine-year와 다름. compound/미자격/유효 tick 없는 입력은 계약 선택 밖 |
| state-overlay `bodyId`,`layer`,`season`,`vacant`,`ageYears`,`wealth`,`era` | 실제 선택 본체와 가구/건물 읽기 모델 필요 | `contractHouseArt.ts:38`이 실제 선택 bodyId·유효 계절·housePressureStatus의 abandoned를 공급하여 boarded/snow를 선택. ageYears/wealth/era는 이 adapter에서 미공급(unbound) |
| ground-prop `archetype`,`occupation`,`wealth`,`season`,`placement` | 실제 필지·가구·배치 slot 읽기 모델 | 기존 backyard 경로 존재. trade-world 확장은 사실/배치 adapter별 검토 |
| walker-cargo `role`,`cargoKind`,`facing`,`frame` | 실제 Walker.cargo/reservation와 이동 방향/프레임 | ResourceType와 TradeGood를 혼동하지 않음. 새 cargo 연결은 미검증 |
| landmark `family`,`growthStage`,`season` | 칙허·후원·증축을 반영한 엔진 성장 읽기 모델 | 미래/미연결. 엔진 공급 없으면 unbound |
| event-scene `eventId`,`group`,`placement`,`active` | 사건 등록기 ID·활성 여부·실제 대상 | 미래/미연결. renderer가 사건 생성 금지 |
| event-illustration `eventId` | UI 사건 등록기 읽기 모델 | Render A 인계, 현재 UI가 이 새 계약을 소비한다고 주장하지 않음 |
| portrait `personId`,`pool`,`lineage`,`ageStage`,`era` | 인물·노화 사슬·시대 읽기 모델 | Render A/엔진. 기존 portraitFor는 시대판 새 adapter의 대체물이 아님 |
| regional-map `mapId`,`landType` | seed에 따른 지도 선택 및 영지 slot 배정 | Render A/엔진. 원본 atlas 데모는 제품 바인딩이 아님 |

미연결 항목은 `schema-valid`, `adapter-ready`, `binding-ready`, `runtime-proven`을 구별하여 보고한다. 이 상태들은 보고·인계 판단이며 entry에 그런 bool을 넣어 스스로 활성화하는 API는 없다. `createArtRegistry`는 10종의 구조/참조를 검증하지만 그 데이터의 engine binding 존재를 자동 증명하지 않는다.

## 5. 원자 검증과 이미지 수명

`createArtRegistry(bundles)`(`artRegistry.ts:40`)는 전체 set의 schema→참조/기하→선택 규칙 검사를 마친 후 clone/freeze하여 immutable snapshot을 반환한다. 모든 ID는 bundle/entry/rule 전체에 걸쳐 유일해야 한다. `ArtRegistryStore.replace`는 새 snapshot 생성 실패 시 이전 참조를 유지한다. registry 검증은 Image 생성이나 장부 쓰기를 수행하지 않는다.

**운용은 startup-only, 변경 시 전체 reload**로 제한한다. replace API는 원자성 검증/새 snapshot 구성의 도구이며 기존 렌더 캐시를 실시간 갱신하는 hot reload 제품 기능이 아니다. loader는 registry 인스턴스 하나에 귀속된다. hot swap/unload를 추가하려면 object/chunk/mip/readiness cache와 오래된 onload까지 별도 설계해야 한다.

`createArtImageLoader`(`artImageLoader.ts:15`)는 idle/loading/ready/missing/unavailable을 구별한다. image(id)는 lazy 요청을 시작하지만 status(id)는 요청하지 않는다. onload 뒤 `decode()`와 naturalWidth/naturalHeight 일치를 확인해야 ready다. 요청 실패·디코드 실패·치수 불일치는 사유를 가진 missing, 알 수 없는 ID/Image API 부재는 unavailable다. 구조 검증 성공, 이미지 준비, 실제 draw 성공, 설치 판정은 각각 다른 사건이다.

`createArtAdapters`(`artAdapters.ts:41`)는 descriptor/placement/draw를 제공한다. UI 3종은 ui-handoff를 반환하고 world draw는 false다. land strip/connector는 land-primitive로 기존 기하 소비자에게 넘긴다. world single/body/props/landmark와 명시 프레임은 `drawCroppedWorldSprite`를 사용한다. elapsedMs/grip/body geometry는 소비자가 명시적으로 공급한다.

single house 소비자는 `contractHouseArt.ts:38,54,69`에서 본체와 필요한 boarded/snow를 한 묶음으로 선택·요청한다. overlay는 실제 본체가 `targetBodyIds`에 포함되어야 하며, 필수 이미지가 모두 ready일 때만 계약 본체를 그린다. `drawBody`의 immutable receipt는 **실제로 그린 본체 ID/sourceRect/targetRect, anchor와 layer ID**를 고정한다. `historicalHouseAssets.ts:115` → `drawBuildings.ts:161` → `buildingOverlays.ts:51`이 receipt를 넘겨 같은 draw pass에서 층을 다시 추첨하지 않는다. 준비되지 않으면 기존 house 경로를 유지한다. 이것은 정적 원자 소비 구조의 확인이지 브라우저 무깜빡임/동일 픽셀 증명이 아니다.

길의 공통 scale 제약은 `wave42StageArt.ts:13`에서 **family=path만** 대상으로 한다. `footpathModel.ts:65`의 16 topology 검증과 `wave42StageArt.ts:39`의 connector 해석도 path family로 제한된다. 다른 land family의 single 그림은 자기 geometry.scale을 사용하므로 새 land 묶음까지 길의 0.5 배율로 강제하지 않는다.

## 6. JSON Schema 방언과 data-only 설치 경계

`schemaValidation.ts`는 **제한된 JSON Schema 컴파일러**다. 전체 표준 구현이 아니다. `$defs`/루트 로컬 `$ref`, type/required/properties/additionalProperties, const/enum, oneOf/anyOf, items/배열 수·유일성, 문자열 길이/pattern, 숫자 경계를 지원한다. schema 메타데이터 `$schema/$id/title/description`은 문자열로 검사한다. 미지원 keyword, 원격/cyclic ref, 잘못된 schema는 `ArtSchemaDefinitionError`; 데이터 위반은 path/message issue다. 사용되지 않는 정의/선택되지 않는 alternative도 compile한다. non-JSON 객체/accessor/symbol/sparse/cyclic/nonfinite 값은 계약 밖이며 거부한다. 임의 Proxy trap에 대한 sandbox 구현은 아니다.

추가 의존성 없이 운영한다. 새 keyword가 필요하면 지원·거부 시험과 문서를 함께 바꾸며 조용히 무시하지 않는다. source/runtime SHA 바이트 대조, 파일 존재·PNG/JPEG 규격 검사는 registry 구조 검증과 별도의 파일 검증 단계다.

최초 입력은 `src/render/art/catalog.json`의 **bundle 배열**이다. 새 catalog row/bundle을 배열 데이터에 추가하는 선택은 의도적이다. 묶음마다 TS import를 추가하는 목록을 설치 절차로 삼지 않는다. `wave42Registry.ts:1,6`은 이미 JSON 배열을 한 번 import하여 startup registry를 구성한다. 이 고정 진입점과 adapter를 먼저 완성한 뒤, 새로운 bundle 추가는 JSON·그림·provenance·장부·증거만 바뀌는 별도 단계로 증명한다. `bundles/footpath-layouts.json` 같은 접속 데이터와 image catalog의 책임도 구분한다.

### data-only 추가 절차 — Wave20 신규 32개 계획 묶음

`tests/fixtures/art-house-bundle.json`에는 `wave20-era` bundle의 **36 entries = 신규 이미지 32개 + 기존 상태층 재사용 4개**가 있다. 32는 테스트 수가 아니라 신규 에셋 수다. [등록 근거](../verification/asset-architecture/wave20-registration.md)와 [설치 계획 CSV](../verification/asset-architecture/wave20-install-plan.csv)가 준비 단계의 정확한 원본/대상/해시 및 재사용 근거를 기록한다. 20개 본체, boarded-v3 6개, roof_snow-v4 6개가 신규 대상이며 L0/L1의 기존 boarded/snow 4개는 신규 수량에 포함하지 않는다. fixture 존재와 정적 선택 검증은 catalog 편입·신규 설치·제품 표시 완료가 아니다.

1. generic consumer 변경을 먼저 고정하여 이후 data-only 단계의 비교 기준으로 삼는다. 승인된 원본 32개의 ID·정확한 inbox 경로·SHA·치수·종류/기하/조건을 확정하고 원본을 보존한다. 기존 slot과 실제 공급 필드로 표현 가능한 범위인지 확인한다. 새 엔진 사실이나 adapter가 필요하면 그 작업은 data-only 추가가 아니다.
2. 원본 픽셀을 보존한 runtime 파일과 provenance를 준비하고 `src/render/art/catalog.json` 배열에 완전한 bundle 하나를 추가한다. 종류별 TS import/분기/ID 목록을 추가하지 않는다. 코드 변경 없이 표현되는지를 diff로 검사한다.
3. 전체 catalog의 registry/schema/참조/조건 검증 후 `npx tsx scripts/checkArtCatalog.ts src/render/art/catalog.json <보고서.json>`으로 파일 관문을 실행한다. 이 도구는 realpath의 저장소 내부 제한, 양쪽 SHA, runtime 선언 치수, 원본/runtime 디코드 RGBA 동일을 검사한다. PNG는 기존 디코더, JPEG는 PATH의 ffmpeg를 제한 시간·출력 크기 안에서 호출해 실제 디코드한다. JPEG는 승인 원본의 바이트도 그대로 보존해야 하며, 기존 초상의 PNG→축소 JPEG 파생은 이 무손실 설치 관문과 별도다. **파일 관문 통과는 실제 선택·load·draw 증거가 아니다.**
4. startup-only 계약에 따라 전체 reload 후 실제 입력 또는 명시된 준비 fixture로 선택 ID → 요청/decoded-ready → draw → 캡처를 확인한다. 모든 32개가 필요한 범위이면 각 행의 증거를 기록하고 미도달 행을 숨기지 않는다. fixture 도달과 자연 플레이 도달은 별도다.
5. data-only 단계의 제품 실행 TS diff 0, 경계 조건/오류 검증, runtime 증거가 모인 뒤에만 provenance/설치 장부 판정을 갱신한다. 등록 수나 빈 installed_by로 완료 수량을 계산하지 않는다.

## 7. 미완료 관문

이 문서 작성은 테스트 실행이나 설치 승인 기록이 아니다. 구현이 진행 중이며 최종 결과는 verification 보고서가 소유한다. 필요한 증거는 전체 bundle 거부의 원자성, 10종 유효/무효 구조, Wave42 36 ID와 16 mask의 선택·기하·시간 경계 회귀, lazy/decode 수명, 여름/겨울×줌1.0/0.6의 A/A 안정성 후 A/B RGBA 동일, 새 묶음의 제품 실행 코드 diff0, 실제 선택→load→draw coverage다. 자연 플레이와 준비 fixture는 구별한다. 장부 공란·카탈로그 행·unit 통과만으로 installed 수량을 늘리지 않는다.

무거운 회귀·브라우저·캡처는 최신 [CHARTER](../CHARTER.md)의 실행기 규약을 따른다(`d4973e85`, 32행): `scripts/remote/run.sh`의 동시 2개 slot과 대기열을 사용하며 작업 Mac은 단위 시험·린트·개발 서버 범위다. 현재 런타임 검증은 기준 실행 오류 수정 후 재실행 중이며, 이 문서 갱신에서 테스트를 실행하거나 통과를 판정하지 않았다.

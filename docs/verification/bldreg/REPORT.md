# BLD-REG 건물 목록을 한 곳으로 — 새 건물 = 목록 한 줄 — 보고서

관문: 통과 — ① 가짜 건물 한 종류(엔진 줄 + 목록 두 줄)로 사본 tsc 깨끗·렌더·메뉴 시험 144/144 · ② 목록 밖 전수 표·kind switch 0 · ③ C25 판 그대로(재기록 없음)·스킨 감사 0 / 909·면적 5.9 % / 6 %·튜토리얼 22 = 22·B9·TOUCH 14/14 · ④ 병합 전 검사·DGX 전체 회귀 3,286/3,286·클론 `44291d5` 3,286/3,286

## 1. 목록
- `src/content/buildingCatalog.ts`: 건물 종류마다 한 줄. 엔진의 `BuildingKind`로 키를 건 전수 표(`satisfies { [K in BuildingKind]: … }`)라서, 엔진이 종류를 더하고 목록에 줄이 없으면 타입 검사가 **이 파일 한 곳**을 가리킨다. 줄 순서가 건설 메뉴 그룹 안의 순서다(지금은 엔진 설정 순서와 같다).
  - `category`(UX-1 메뉴 분류: 생활·길·생업·저장유통·공공신앙·방어), `group`(메뉴 모델: 주거·생산·저장·서비스)
  - `glyph`(없으면 분류 글리프 `CATEGORY_GLYPH`), `thumbnail`(첫 집 그림·시설 그림·초기 파일, 없으면 `menuIcon`, 그것도 없으면 글리프), `signIcon`(공사 팻말)
  - `spriteKey`(종류와 다를 때: 곡창 → barn), `facilityArt`(시설 그림 id 하나, 또는 조용함·가동 둘을 시장 거래·생산 가동으로 — Wave 12 가동 상태), `kit`(Wave 11 공사 키트)
  - `body`(블록 몸체: 크기·지붕·팔레트 토큰), `details`(절차 세부: 바퀴·깃발·통…), `smoke`(집 화덕 / 일하는 불 — 방앗간 화덕)
  - `placementOverlay`(놓는 동안 켜는 오버레이: 우물 → 물), `service`(배치 카드의 서비스 줄)
- `src/content/buildingCatalog.ko.ts`: 이름·건설 카드 한 줄·도구 용도·인스펙터 용도·세계 안내("여기에 … 지으세요")·연대기 이름(원장 문장은 집·벌목장·석공장). 이름은 엔진 이름과 같다(시험).
- 엔진 규칙 `buildingConfig.ts`는 그대로다.

## 2. 목록에서 파생한 것
| 전에 있던 표 | 이제 |
|---|---|
| `BuildGlyph` `GLYPH_PATHS`(종류별) | 글리프 키별 표, 종류는 목록의 `glyph` |
| `buildMenuModel` `TOOL_GROUPS`·`TOOL_PURPOSES`, 메뉴 순서 | `group`·`purpose`, 목록 순서 |
| `buildMenuCopy.ko` `BUILD_CARD_PURPOSE`·`BUILD_TOOL_PURPOSE` | 목록 `.ko`의 `card`·`purpose`(길은 `ROAD_TOOL_COPY`) |
| `buildMenuPresentation` `buildCategory` 표·`buildThumbnail` 분기 | `category`·`thumbnail` |
| `onboardingWorldGuidanceCopy.ko` `ONBOARDING_BUILDING_TARGET_LABELS` | `worldTarget` |
| `buildingInspectorCopy.ko` `BUILDING_INSPECTOR_PURPOSE` | `inspector` |
| `historyCopy.ko` `HISTORY_BUILDING_NAMES`(성채 빠짐) | `history`(성채 기록이 이제 "성채") |
| `buildingVisualState` `nonHouseBodyProfile` switch | `body`(없으면 발판 폭의 목조 몸체) |
| `historicalFacilityAssets` `historicalFacilityAssetId` switch | `facilityArt` |
| `drawBuildingDetails` `drawBaseKindDetail` switch | `details`(부분별 그리기 표) |
| `constructionGhost` `SIGN_ICON`, `constructionKits` `KITS` | `signIcon`, `kit`(키트 키별 표) |
| `BuildMenu` `TOOL_ICON`, `placementAutoOverlay` `AUTO_OVERLAY`, `placementPrediction` `SERVICES` | `menuIcon`, `placementOverlay`, `service` |
| `tutorialModel` `FOOTPRINT`(설정 폭의 사본) | 엔진 설정의 폭 |
| `buildingSprites`·`canvasRuntime` 곡창 → barn 분기 | `spriteKey` |
| `roofSmoke` `millOvenBurning`(방앗간 고정) | `smoke: "work_fire"`와 그 생산의 입력 |

## 3. 그림 없는 새 건물
- 스프라이트·시설 그림이 없으면 지도에 발판 폭의 목조 몸체(흙색 벽·짙은 흙색 외쪽지붕, 타일당 36 px)와 **이름 칩**(공사 팻말과 같은 양피지·먹 테두리·12 px)을 그린다(`render/buildingNameChip.ts`).
- 메뉴는 썸네일이 없으면 `menuIcon`, 없으면 분류 글리프(생활 → 오두막, 생업 → 헛간, 저장유통 → 창고, 공공신앙 → 예배당, 방어 → 성채).
- 공사 키트가 없으면 공통 네 단계 그림, 팻말 아이콘이 없으면 없음(기존과 같다).

## 4. 관문
- ① `tests/buildingCatalogExtensibility.test.ts`: 소스 사본에 가짜 건물 `test_hall`을 넣는다.
  - 엔진 줄: `BuildingKind`, 규칙 정의, 건축 틱, 해금 단계, 공사장 종류 switch의 case(엔진 두 파일).
  - 목록 줄: `buildingCatalog.ts` 한 줄(`{ category: "public", group: "service" }` — 그림·글리프·몸체 없음), `.ko.ts` 한 줄.
  - 사본에서 소스와 렌더·메뉴 시험 17파일을 타입 검사하고 돌린다: tsc 깨끗, 144개 통과. 탐침: 메뉴에 이름·용도로 있고, 공공신앙 분류, 예배당 글리프, 썸네일 없음, 그림 없음, 목조 몸체 폭 36, 이름 칩에 "시험 회관".
  - 엔진 자체의 전수 고정값 시험(공사 비용·건축 틱)은 엔진 세션이 새 종류와 함께 늘리는 것이라 사본의 타입 검사에서 뺐다.
- ② `tests/buildingCatalog.test.ts`의 원천 검사: `src`(엔진 규칙 폴더와 목록·규칙 파일 제외)에서 `Record<BuildingKind|PlacementTool`(Partial 제외)·그 매핑 타입 0, 종류 case 둘 이상의 kind/tool switch 0, 종류 이름 여섯 이상을 키로 가진 객체 0(글리프 키 표·튜토리얼 단계 id는 이름만 같아 제외). `zoneConfig`의 `Partial` 배치 규칙은 엔진 규칙이다.
- ③ C25 판(`tests/c25Board.test.ts`) 그대로 — 지금 있는 종류의 그림·몸체·세부는 한 픽셀도 달라지지 않는다(세부 순서도 그대로). 스킨 감사·면적·UX-3 회귀·튜토리얼은 7절.
- ④ 7절.

## 5. 새 건물 추가하는 방법(엔진 세션 C4·C5용)
1. 엔진: `BuildingKind`에 종류, `BUILDING_CONFIG_BY_KIND`에 규칙, `CONSTRUCTION.REQUIRED_BUILDER_TICKS`에 틱, 시나리오 단계 `unlocks`, 공사장 종류 switch 두 파일(`economy/constructionSiteAccessors.ts`, `population/builderLabourWalkers.ts`)에 case. 엔진 전수 고정값 시험(`constructionModel`·`constructionPlacement`)에 한 줄씩.
2. 목록: `src/content/buildingCatalog.ts`에 한 줄 — 최소 `{ category, group }`. 그림이 오면 `thumbnail`·`facilityArt`·`kit`·`body`를 채운다.
3. 목록 문구: `src/content/buildingCatalog.ko.ts`에 한 줄 — `name`(엔진 이름과 같게), `card`, `purpose`, `inspector`, `worldTarget`, `history`.
4. 그밖에 UI·렌더 파일은 고치지 않는다.
- 엔진에 제안: 공사장 switch 두 곳은 `kind in BUILDING_CONFIG_BY_KIND` 같은 검사로 바꾸면 1번에서 빠진다(엔진 파일이라 손대지 않았다).

## 6. C4(엿기름 가마)와 합칠 때
C4 가지(`claude/c4-ale-chain`)의 가마 6줄 예외(결정 AL6)는 목록 두 줄이 된다. 충돌하면 목록 쪽을 따른다: C4의 `BuildGlyph`·`buildMenuCopy.ko` 두 줄·`buildMenuModel`·`buildMenuPresentation`·`onboardingWorldGuidanceCopy.ko`·`buildingInspectorCopy.ko`·`buildingVisualState`·`historicalFacilityAssets` 줄은 버리고 다음을 넣는다.
```ts
// buildingCatalog.ts (엔진 설정 순서대로 keep 뒤 — 목록 순서 시험이 엔진 순서와 같은지 본다)
malt_kiln: { category: "trade", group: "production", glyph: "mill",
  body: { width: 52, height: 34, roof: 18, fill: "parchmentDark", roofColor: "earthDark", roofShape: "cone" } },
// buildingCatalog.ko.ts
malt_kiln: { name: "엿기름 가마", card: "보리를 엿기름으로", purpose: "보리를 싹 틔워 말려 엿기름을 만듭니다. 집집의 아낙이 에일로 빚습니다",
  inspector: "보리를 엿기름으로 말립니다", worldTarget: "여기에 엿기름 가마를 지으세요", history: "엿기름 가마" },
```
- 썸네일·시설 그림은 없다(글리프). INSTALL-3이 Wave 3 가마 그림을 설치할 때 `thumbnail`·`facilityArt`(또는 스프라이트)·`smoke: "work_fire"`를 채운다.
- C4가 고친 `buildMenuContracts`의 가마 건너뛰기는 이제 필요 없다(썸네일 없는 종류는 목록이 정한다).

## 7. 검증
- 로컬: typecheck, lint, 관련 시험 43파일 293/293(메뉴·인스펙터·안내·배치·시설 그림·키트·팻말·렌더), 확장성 관문.
- DGX 전체 회귀 `569b68d`: 3,286/3,286(C25 판 포함, 고정값 재기록 없음).
  - 첫 실행 `862d197`은 3,285/3,286이었다: `drawBuildings.ts`가 본선에서 이미 렌더 파일 250줄 한도였고 이름 칩 호출로 255줄이 됐다(`renderSourceGuards`). 칩을 대체 지붕과 함께 그리도록 옮겨 `drawBuildings.ts`는 본선과 같다.
- DGX UI 관문 `862d197`, 본선 `4e87f62f` 대비([gates.json](gates/gates.json)): 면적 1280 5.9 % / 6 %, 태블릿 6.4 % / 8 %, 튜토리얼 22 = 22, B9·TOUCH 14/14, 게임패드·초점 복귀, 터치 대상·글자 위반 0.
- 스킨 감사 `569b68d`: 0 / 909(26개 상태), 본선 0 / 788([audit.json](audit/audit.json)). 첫 실행은 23번째 상태 뒤 개발 서버가 연결을 한 번 끊어(`ECONNRESET`) 페이지 경로 처리기의 거부가 실행 전체를 끝냈다(그때까지 23개 모두 0). 장면 주입 경로가 끊김에 세 번까지 다시 묻는다. `gates/exit-codes.txt`의 감사 1은 첫 실행 값이다.
- 깨끗한 클론 `44291d5`(DGX): npm ci, typecheck, 3,286/3,286, build. `npm run check:merge` 통과.
- 시간: 02:54(작업 가지 생성) → 03:43(클론 통과, KST 벽시계), 약 49분.
- 증거 0.2 MB.

## 8. 결정
BLDREG-D1~D4([결정 목록](../../decisions/README.md)).

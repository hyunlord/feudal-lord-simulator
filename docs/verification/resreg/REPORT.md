# RES-REG 자원 목록을 한 곳으로 — 보고서

관문: 통과 — ① 가짜 자원 한 줄을 넣은 복사본이 다른 파일 수정 없이 tsc·렌더/UI 시험 115개 통과 ② 목록 파일 밖 `Record<ResourceType` 전수 표 0개(시험 관문) ③ C25 판 동일(재기록 없음)·스킨 감사 0 / 714·UX-3 회귀 세트·튜토리얼 22 = 22 ④ DGX 전체 회귀 3,197/3,197·깨끗한 클론(아래)

## 1. 목록
- **`src/content/resourceCatalog.ts`** — 자원마다 한 줄: `id`, `storage`(granary/storehouse/none), `group`(food/raw/goods/money), `hudPriority`(장부 서랍 줄 순서), `carrier`(길 위의 운반인 모습), `cartLoadKey`·`cartPileKey`(수레 적재물), `iconKey`(`runtime-icons-v1`), `sheetCell`(HUD 24px 칸), `cargoIconCell`(가까운 줌의 짐 아이콘), `color`(`SEMANTIC_PALETTE` 토큰 이름), `bulk`(수레 적재 계수, 아직 읽는 곳 없음).
- **`src/content/resourceCatalog.ko.ts`** — 이름·단위·짧은 설명. 목록의 모든 자원이 한 줄씩 있어야 타입 검사가 통과한다.
- `ResourceType`, `StorableResourceType`, `RESOURCE_TYPES`, `STORABLE_RESOURCE_TYPES`, `STORAGE_KIND_BY_RESOURCE`, `isStorableResource`는 목록에서 파생한다. `src/content/resourceConfig.ts`는 re-export 한 줄이다(엔진 import 경로 그대로).
- 목록 순서는 지금 순서(밀·빵·통나무·목재·원석·석재·돈)이다. 엔진의 자원 순회 순서가 그대로라 결정론이 같다.

## 2. 흩어진 표 → 목록 조회
- 새 자원을 넣으면 깨지던 29개 파일(렌더·UI 23곳, 엔진 3곳, 스크립트 2곳, 시험 1곳)을 목록 조회로 바꿨다.
  - 이름 표 15곳(엔진 1곳 포함) → `resourceName()`: HUD 장부, 배치 칩, 인물 카드, 공사 카드·팻말·진단, 건물 조사창, 배치 피드백, 건설 메뉴, 경고, 창고 조사창, 계절 결산.
  - 창고 이름(곡창/창고) → `storage`에서.
  - 수레 짐 색 → `color`. 수레 적재물·짐 아이콘 → `cartLoadKey`·`cargoIconCell`. 운반인 모습 → `carrier`.
  - 장부 "버팀" 칸(식량만) → `group === "food"`. 장부 줄 순서 → `hudPriority`.
  - 합계 형 `Record<ResourceType, number>` → `ResourceTotals`(목록 파일의 매핑 타입)와 `emptyResourceTotals()`.
- 엔진 파일 셋은 목록 조회만 바꿨다(규칙 0줄): `economy/storage.ts`·`agents/deliveryBuildingCandidates.ts`의 같은 `isStorableResource` 분기 둘 → 목록의 것, `economy/construction.ts`의 이름 표 → `resourceName()`.
- **자원별 규칙 분기는 그대로 둔 곳:** 식량 버팀 수식(빵 + 방앗간이 빻을 밀), 원자재 반입 한도(곡창의 밀, 창고의 통나무·원석), 계절 결산 장면(방앗간·인구·시장 조건). 규칙이지 표가 아니고, 새 자원이 들어와도 깨지지 않는다(그 자원은 해당 없음). C4가 보리·말트를 이 규칙에 넣을지 정한다.

## 3. 그림이 없는 새 자원
- 수레: 목록에 `cartLoadKey`가 없으면 Wave 7 범용 더미 — 곡창 물품은 자루(`pile_sacks_1`), 창고 물품은 상자(`pile_crates_1`).
- UI 그림(`ResourceArtwork`): `iconKey`가 없거나 그림을 못 읽으면 같은 자루·상자 그림 + 이름 칩(12px).
- 짐 아이콘·HUD 칸: 없으면 그리지 않는다(지금 통나무·원석과 같다).
- 시험 `tests/resourceCatalog.test.ts`는 목록의 모든 자원을 돌며 그림(제 것 또는 범용+이름), 수레 적재물, 짐 색, 운반인, 장부 줄, 비용 줄을 확인한다.

## 4. 관문 ① 확장성 시험
- `tests/resourceCatalogExtensibility.test.ts`가 소스를 임시 폴더에 복사한다. 그 복사본의 목록에 `test_ore`(창고 물품, 그림 없음) 한 줄과 이름 한 줄을 넣는다.
- 그 복사본에서 `tsc --noEmit`이 오류 0개다. 이어 자원을 도는 렌더·UI 시험 17파일과 탐침 1파일, 모두 115개가 통과한다. 탐침은 새 자원이 범용 상자와 이름 칩으로 그려지는 것을 본다.
- 그 과정에서 자원 전체 목록을 고정하던 시험 둘을 목록 무관으로 바꿨다(`phase9Config`, `ledgerModel`). 결정 RESREG-D4.

## 5. 관문 ② 전수 표 0
- `tests/resourceCatalog.test.ts`의 grep 관문: `src`·`scripts`·`tests`에서 목록 두 파일 밖의 `Record<ResourceType…>`·`Record<StorableResourceType…>`(`Partial<` 안 제외)와 자원 매핑 타입 `[K in ResourceType]`이 0개다. 병합 전 검사 대신 시험 모음에 뒀다. `scripts/checks/mergeChecks.mjs`는 CODE-1b(REMOTE 세션)가 규칙을 더하는 중이라 겹치지 않게 했다.

## 6. 덤: 캡처·감사의 저장은 코덱으로만
- 원인: `scripts/ui5States.ts`·`ux0b2States.ts`·`audio1States.ts`가 결정론 고정 저장(`final-state.json`, v12 전 맨 GameState)을 `JSON.parse`로 게임에 넣었다(UI-KIT-1 연대기 캡처의 1469 동시 진입).
- `scripts/loadSaveFile.ts`: 스크립트는 저장 파일을 `decodeSave`로 읽는다. 맨 파일은 코덱 규칙대로 v0이라 이주 사슬 전체를 거친다. 세 생산 스크립트를 이것으로 바꿨다.
- `scripts/sceneInjection.mjs`: 브라우저 스크립트 여섯 곳(openScene, 성능 벤치, 터치 대상 감사 둘, AUDIO-1 캡처, 콜드 스타트)이 스토어 초기 상태를 이 한 함수로 바꾼다. 페이지 안에서 `admitSceneState`가 돈다.
  - 봉투(저장 헤더가 있는 것)는 `decodeSave`: 체크섬, 제 스키마부터의 이주 사슬, 검증.
  - 맨 상태는 사슬이 더할 키가 없을 때만 받는다: 오늘 새 게임의 키 전부, 틱 0 뒤라면 첫 틱과 사슬이 함께 쓰는 키(시대·계절·사건·인물)까지. 아니면 `StaleSceneStateError`로 페이지가 곧바로 실패한다.
  - 받은 상태는 바꾸지 않는다. 코덱은 `/src`에서 가져와 본선 전 빌드(기준 비교)에서도 돈다.
- 시험 `tests/sceneStateGuard.test.ts`: 옛 맨 저장 거부, 같은 파일을 코덱으로 읽으면 통과, 현재 상태(틱 0·1·1,000·3,000)와 봉투 통과, 한 번도 안 돈 틱 400,000 수제 상태 거부, 다른 방식의 스토어 교체와 생산 스크립트의 `JSON.parse` 저장 읽기 0.
- 실제 페이지(DGX): 옛 고정 저장은 0.5초 만에 거부, `chapter-end`(틱 77,500)는 1.1초에 통과([scene-refusal.json](gates/scene-refusal.json)).
- **엔진에 넘길 것(발견):** `src/save/migrations/v9ToV10.ts:202`의 `process.env.MIG_DEBUG`는 브라우저에서 `ReferenceError: process is not defined`를 던진다. 게임에서 v10 전 저장을 불러오는 플레이어도 같은 곳에서 멈출 것이다. 저장 이주는 엔진 범위라 고치지 않았다(가드는 옛 상태를 사슬 전에 거부해 이 줄에 닿지 않는다).

## 7. 검증
- DGX 전체 회귀 `918b21f`: typecheck, 3,197/3,197(`tests/c25Board.test.ts` 포함, C25 재기록 없음).
- DGX 스킨 감사·UX-3 회귀 세트 `44f13bc`, 본선 `2ad309df` 대비, 상태는 새 `ui5States`(코덱 경유)로 다시 만들었다.
  - 스킨 없는 요소 0 / 714(19개 상태), 본선도 0([audit.json](audit.json), [audit-base.json](audit-base.json)).
  - 면적 24/24, 튜토리얼 22 = 22, B9·TOUCH 14/14, 터치 대상·글자 위반 0, 패드·포커스([gates.json](gates/gates.json)).
  - 성능: HUD 프레임 p95 98.2 %, 건설 서랍 98.1 %(유효 5/5, rAF 16.7 ms), [perf.json](gates/perf.json).
  - 장부 서랍 캡처: [ledger-after.jpg](ledger-after.jpg)(통나무).
- 로컬: typecheck, lint(`npm run lint`), 관련 시험 141파일 1,050/1,050.
- 깨끗한 클론: 아래 STATUS·로드맵 항목에 적는다.

## 8. 엔진 세션에 — 목록에 줄 추가하는 방법(C4)
1. `src/content/resourceCatalog.ts`의 `RESOURCE_CATALOG`에 한 줄: `{ id: "barley", storage: "granary", group: "raw", hudPriority: 8, carrier: "farmer", color: "gold", bulk: 1 }` (그림 키는 그림이 설치될 때 더한다. 그 전엔 범용 자루·상자와 이름). 돈 줄보다 앞에 둔다.
2. `src/content/resourceCatalog.ko.ts`의 `RESOURCE_COPY`에 한 줄: `barley: { name: "보리", unit: "자루", short: "…" }`. 빠지면 타입 검사가 알려 준다.
3. 끝. 새 자원 때문에 고칠 렌더·UI 파일은 없다. 규칙(식량 버팀·반입 한도·결산 장면에 넣을지)은 엔진이 정하고, 저장 지문은 `<resource>` 자리표시라 그대로다.

## 9. 결정
RESREG-D1~D5([결정 목록](../../decisions/README.md)).
- D1 이름 하나: HUD 장부·배치 칩·인물 카드의 "원목"이 "통나무"가 됐다(건설 메뉴·공사 카드와 같게). 튜토리얼 본문의 "원목"은 그대로다(다음 후보).
- D2 목록 칸: 지시서의 `ledgerSceneKey`는 뺐다. 결산 장면은 자원 하나가 아니라 방앗간·인구·시장 조건이라 `seasonLedgerScenes`에 남겼다. 새 자원은 장면이 없다. 대신 실제로 읽는 `carrier`·`sheetCell`·`cargoIconCell`·`cartPileKey`를 더했다. `bulk`는 아직 읽는 곳이 없다.
- D3 그림 폴백 = Wave 7 자루·상자 + 이름 칩.
- D4 시험 고정값: `walkerPresentation`의 완전 분기 수 6 → 5(자원 분기가 목록 조회로), `phase9Config`·`ledgerModel`의 자원 전체 목록 → 목록 무관.
- D5 장면 저장은 코덱으로만(6절).

## 10. 다음 후보
- 튜토리얼 본문의 "원목" → "통나무"(문구 판정).
- `v9ToV10.ts`의 `process.env`(엔진).
- 쓰지 않는 옛 `ResourceBar`(마운트 안 됨)의 고정 목록 "밀·원목·원석".

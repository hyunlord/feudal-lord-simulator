# EB-GROW 공급 정체: 읽기 진단 (2026-10-11)

기준 코드: `d703a6e10b732955ccd702502ed9a33ea59415c2`, `codex/engine-b-grow`.
이 문서는 제품 수정이나 관문 통과가 아니다. 단일 상태 재현 전의 코드 증거와 구분 실험 계약이다.

## 가설과 판별할 값

| 가설 | 구분 증거 | 현재 판정 | 고침 후보 |
|---|---|---|---|
| H1. 아직 배치 못 한 시대/서비스 필수 건물의 자재 수요가 생산 확장에 전달되지 않는다 | seed18/1320의 church missing, 교회 비용100 timber/60 stone, 미배치, spendable timber20; BT6 waitingTimberNeed와 생산량, S8-F1 wallNeed, planner needs | 코드상 경로 확인. 실제 저장 미확보로 런타임 재현 미완료 | 미배치 필수 건설 수요를 데이터로 산출 |
| H2. 선택 산업 공사가 진행에 필요한 공급 시설보다 자재를 먼저 받는다 | 같은 실제 저장에서 각 site ID/종류/need, source stock, spawnSiteDelivery 선택. 필수 시설이 실제 후보였는지도 확인 | 사이트 ID 순서가 비벽 건설 선택을 결정함은 확인. seed별 원인 여부는 미확인 | 필요 공사의 공급 사슬 우선 |
| H3. 생산 확장 미발생은 수요 누락이 아니라 일손·창고·운송 제한 때문이다 | idleWorkers, 시설별 workers, storageCapacityBlock, available vs reserved/on-cart stock, 노선, 생산 창 기록. 제재소30 timber와 현재20 비교 | 보호 조건이 존재. 실제 상태 값 미확인 | 관측된 제한만 수정; 공급을 억지로 주지 않음 |
| H4. seed18 집 수 정체에는 밭 집터 병목이 독립적으로 겹친다 | interior.placeableOffField2 vs lotsNeeded11, house church service; 교회 뒤 인구/L4 변화와 필지 수 분리 | 엔진 요청서의 관측 주장. 원자료 재확인 전 | 밭 규칙은 엔진2b에 유지 |

## 소스에서 확인한 사실

- `src/engine/autoplayTimberDemand.ts:23`: `waitingTimberNeed`는 성벽만이 아니라 **모든 기존 constructionSites**의 미달 목재를 더한다. 따라서 요청서의 "BT6도 성벽만"은 정확한 구현 설명이 아니다. 미배치 교회의 수요는 여기 들어가지 않는다.
- 같은 파일 `:70`: 실측 창 생산 대비 기존 건설 수요를 보고 확장한다. 미완 벌목장/제재소, 일손, 창고, 건설비 조건이 모두 추가된다. `campAllowed`는 제재소당 벌목장2개와 통나무 한 창(137) 비축 상한이다(`:44–68`).
- `src/engine/autoplayTimberRecovery.ts:37–65`: S8-F1에는 명시적으로 `wallNeed === 0` 거부가 있다. 후속 필수 건설은 열어 주지 않는다.
- `src/content/buildingConfig.ts:256–356`: 벌목장 목재15/일손3, 제재소 목재30/일손2, 채석장 목재50/일손4, 석공소 목재45/일손3, 교회 목재100+돌60/일손0. 생산은 logs→timber와 stone_raw→stone이며 input/output/rate를 데이터에서 읽을 수 있다.
- `src/engine/autoplayServices.ts:40–99`: 열린 서비스이며 집 서비스가 부족해도, canPlaceBuildingBeforeRoad/canPlaceBuilding 및 길/일손/공간 조건을 통과해야 공사 후보가 생긴다.
- `src/agents/deliveryConstruction.ts:119`: 건설 후보는 site ID, 자원, source ID 순서다. `:58–65`는 첫 비벽 후보를 먼저 선택하고, 비벽이 없을 때만 벽 후보의 길이를 비교한다. 이 경로에는 시대 필수/선택 산업 구분이 없다.
- 같은 파일 `:209–231`의 supplierKeep는 production.input/output으로 사슬을 읽지만 반환값은 필요한 공급자의 **목재 건설비 최대값 하나**이다. `:235–256`의 charterTimberContext와 벽 배달 제한에서 쓰며, 모든 비벽 산업 사이의 우선순위가 아니다.
- `src/engine/autoplayCivicReserve.ts:7–24`: 기존 교회 보호 예산은 stone_town에서만 동작하고 미래 교회 비용을 계산한다. 사용처는 식량 수송/범위 확장 및 수출 보존이다. 이를 새 규칙과 중복 구현하지 않도록 검토해야 한다.

## 실제 입력 확보 상태

`docs/requests/engine-B-grow.md`는 seed18/1320을 최종2a Mac 저장으로 명시한다. 그러나 엔진 checkout의 저장 파일 및 scripts/tmp와 /private/tmp의 제한된 파일명 조회에서 해당 저장의 경로를 확인하지 못했다. `scripts/tmp/s18.ts` 진단 스크립트만 확인했다. 원본 실행 헤더·해시가 없으므로 요청서 숫자를 이 작업에서 직접 재현한 값으로 쓰지 않는다.

공식 예정 입력: `engine-GROW2a-stallsaves-e99731a`의 `output/stall/saves/seed18-year-1320.save.json` 및 seed1/1322, seed11/1325, seed13/1325. 입력 도착 뒤 decodeSave와 read-only 함수 호출만 하는 단일 상태 실험으로 H1–H4를 구분한다. 상태를 수정해서 자원을 넣거나 seed21–40을 진단에 사용하지 않는다.

## 관측 도구의 주의점

`growthStallCauses.mjs:19–24`는 fields를 먼저 분류하고, 무벽이면 실패횟수를 확인하며, 벽이 있으면 전체 wallYears>10 또는 null을 공사 대기로 분류한다. 따라서 해당 정체 구간이 실제 공사 기간과 겹치는지 별도로 보아야 한다. wallYears가 긴 seed의 모든 후속 정체를 자동으로 공사 원인이라고 단정할 수 없다.

## 작업 흔적

제품 파일 수정0, 저장 수정0, 장기 실행0, 원격 job 제출0. 이 읽기 증거 문서 외 임시 probe/디버거/프로세스를 만들지 않았다.

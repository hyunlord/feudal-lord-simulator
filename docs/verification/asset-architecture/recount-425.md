# 원본 나425: 현재 소비자 연결 기준 재집계

원본425개 source path와 original_classification=나를 그대로 보존했다. `disposition`, `data_only_candidate_after_adapter`, `current_engine_binding`은 종전 계획 값이며 **현재 가능 수량으로 읽으면 안 된다**. `previous_disposition`도 명시적으로 보존했다. 현재 판정은 새 `current_binding`, `current_capability`, `current_capability_reason`, `binding_evidence`, `data_only_add_now` 열이다. 최신 소스의 정적 연결 감사이며 설치·런타임 성공 판정은 아니다.

## 현재 분리 집계

| 현재 판정 | 행 수 |
|---|---:|
| binding-present-registration-unverified | 3 |
| screen-or-input-consumer-handoff | 160 |
| unmigrated-consumer | 98 |
| existing-byteproof | 42 |
| retired | 16 |
| unresolved-fact-or-placement-contract | 73 |
| consumer-boundary-unresolved | 1 |
| data-only-add-now | 32 |
| **합계** | **425** |

**지금 데이터 추가만으로 연결 가능한 검증된 후보는 Wave20 전체32장이다.** 신규32+기존 재사용 overlay4의 등록 초안은36 entries이며 재사용4는 신규425행 계산에 더하지 않는다. 현재 catalog 등록/설치/런타임 통과라는 뜻은 아니다. 기존281 조건부 후보 중32만 이 판정을 받았다.

원본425 source/dimension/provenance 대조는 이전 감사 결과를 보존한다: 기존 byteproof42=Wave4236+hurdles2+queue1+storehouse snow3; retired16; 나머지 active pending367. 본 갱신은 이42의 해시 재검증을 반복하지 않았다. 신규 설치 여부는 부모 설치 회차에서 재확인해야 한다.

## 실제 연결과 한계

- `contractHouseArt.ts:27-36`은 house/single lot/eligible 및 연도·레벨·계절·빈집·결정적 seed를 읽는다. `:41-50`은 house-body, house-boarded, house-snow를 선택하고 정확한 targetBodyIds를 검사한다. `:55-60`은 본체와 필요 overlay 모두 준비될 때만 표시한다. historicalHouseAssets.ts:116 → drawBody, buildingOverlays.ts:55 → drawLayers가 실제 소비자 연결이다.
- Wave20은 준비된 원본 registration/compatibility에 근거한다. era-houses3의1420 body는 같은 슬롯을 쓸 수 있지만 IoU .979/.987/.984와137/142/161 canvas만으로 눈/빈집 레이어 호환을 보장하지 않는다. 따라서 별도3장 보류이며 source compatibility를 먼저 검증한다.
- Wave42 land는 tree/fallow/path 읽기 연결이 있다. 미설치14장의 collapsed fence2·faint/muddy path8·log stack4에 필요한 개별 의미/배치는 이 연결에서 자동 공급되지 않는다.
- storehouse snow3는 기존 byteproof다. house-body가 storehouse를 받아들이지 않으므로 신규 주택 연결의 성공 수량에 포함하지 않는다.
- artAdapters.ts:39 이후 모든 종류의 geometry/request/draw 또는 UI descriptor가 존재해도 해당 객체·사건의 선택 사실과 위치 소비자는 별개다. Generic switch만으로 ground props/walkers/manor/signs/weather를 데이터만 추가 가능한 것으로 세지 않았다.
- **소유권 정정:** Wave37 세계 소품32는 B의 원본/계약/세계 소비자/설치 대상이며 LM-R1의 A UI 작업과 협업한다. A 독점 인계가 아니다. `doorProps.ts`는 현재 Wave3 방적 소품4종을 다루므로 Wave37 전체32의 generic 소비자 연결 증거가 아니다.32를 unmigrated-consumer로 이동하여98이다. `.omo/drafts/next-world-bindings.md`의 판정과 일치한다.
- 화면/입력 소비자 인계160=UI auxiliary 중124+portrait36. **그림 계약·파일·설치 소유는 전부 B, 화면·입력 소비자 소유만 A**다. trait12 의미 미확정 및 bordure1 UV 미확정은 행별로 유지한다. Wave18 pattern4는 화면 고정 UI가 아닌 세계 좌표의 배치/서비스 입력 피드백이다.
- 추가 발견: `merchant_carved_texture`1은 원본이 문/통 표면에 새긴 표식용으로 규정한다. 현재 UI composeMark는 ink texture만 소비한다. 따라서 기존 wave14-ui 분류를 독점 A 소유로 해석하지 않고 consumer-boundary-unresolved1로 분리했다. 원본 group/contract_kind는 역사 보존을 위해 변경하지 않았다.
- 전160행의 사양과 surface를 확인했다: era-portraits18/people-pilot18는 portraitArt·초상 화면, lord-components24는 상태/trait 아이콘, wave14 bordure1+UI14는 EmblemImage·프레임/권리/세력 화면, wave18 HUD41은 HudShell·툴바·배치 입력 피드백, receipt4는 whyHere 영수증 화면, wave38 40은 DOM 버튼/입력 스킨. AGENTS99–107의 화면/입력 경계이며 asset 설치까지 A에게 넘기는 근거가 아니다.
- unresolved73은 종전86에서 A 인계13을 제외한 수량이다. 엔진 사실 자체 부재와 행위/placement 의미 미확정을 섞어 “엔진 기능73장 없음”이라고 주장하지 않는다. unmigrated98도 사실 가용성을 이번에 새로 증명한 수량이 아니다.

## 그룹별 행 근거

| 원본 group | 전체 | 현재 판정 분포 | 대표 원본 row ID |
|---|---:|---|---|
| era-houses | 3 | binding-present-registration-unverified: 3 | `era-pilot/candidates-20261003/assets/houses/house_l2_1420.png` |
| era-portraits | 18 | screen-or-input-consumer-handoff: 18 | `era-pilot/candidates-20261003/assets/portraits/I037_1300.png` |
| era-signs | 8 | unmigrated-consumer: 8 | `era-pilot/candidates-20261003/assets/signs/sign_ale_1300.png` |
| lord-components-ui | 24 | screen-or-input-consumer-handoff: 24 | `lord-components/candidates-20261002/assets/alert_deadline_32x32.png` |
| people-pilot1 | 18 | screen-or-input-consumer-handoff: 18 | `people-pilot1/candidates-v1/assets/portraits/pt_pilot_P1-v1.png` |
| storehouse-snow | 3 | existing-byteproof: 3 | `storehouse-corner/candidates-20261003/assets/storehouse_a_snow-v1.png` |
| strip-corners | 16 | retired: 16 | `strip-corners/candidates-20261003/assets/corner_palisade_east_summer-v3.png` |
| walker-pilot2-final | 20 | unmigrated-consumer: 20 | `walker-pilot2/candidates-v1/assets/props/held_basket_NE-v1.png` |
| wave12-manor | 4 | unmigrated-consumer: 2; unresolved-fact-or-placement-contract: 2 | `wave12/candidates-20260926/assets/bld/manor_house_a-v1.png` |
| wave12-quay | 1 | unresolved-fact-or-placement-contract: 1 | `wave12/rework-20260926/assets/active/quay-active-v1.png` |
| wave13-workers | 12 | unresolved-fact-or-placement-contract: 12 | `wave13/candidates-v1/assets/work/work_goad_ne-v1.png` |
| wave14-bordure | 1 | screen-or-input-consumer-handoff: 1 | `wave14/candidates-v1/assets/heraldry/ordinary_bordure.png` |
| wave14-ui | 15 | screen-or-input-consumer-handoff: 14; consumer-boundary-unresolved: 1 | `wave14/candidates-v1/assets/seals/seal_town_center_bridge.png` |
| wave17-war | 27 | unresolved-fact-or-placement-contract: 27 | `wave17/candidates-20260926/assets/bld/muster_field-v1.png` |
| wave18-hud | 41 | screen-or-input-consumer-handoff: 41 | `wave18/candidates-v1/assets/crisis/crisis_construction_blocked.png` |
| wave20-era | 32 | data-only-add-now: 32 | `wave20/candidates-20260926/assets/houses/house_l0_1350_a-v1.png` |
| wave3-pasture | 3 | unmigrated-consumer: 3 | `wave3/candidates-20260926/assets/pasture/shearing_pen-v1.png` |
| wave3-tools | 16 | unresolved-fact-or-placement-contract: 16 | `wave3/candidates-20260926/assets/props/work_distaff_ne-v1.png` |
| wave35-receipts | 4 | screen-or-input-consumer-handoff: 4 | `wave35/candidates-20260930/assets/E_receipts/reason_bar_cap_minus.png` |
| wave37 | 32 | unmigrated-consumer: 32 | `wave37/candidates-20260930/assets/condition_newcomer_cart_a.png` |
| wave38 | 40 | screen-or-input-consumer-handoff: 40 | `wave38/candidates-20260930/assets/button_danger_disabled.png` |
| wave39-weather-ground | 19 | unmigrated-consumer: 19 | `wave39/candidates-20260930/assets/debris/floating_leaves-v1.png` |
| wave41-hurdles | 2 | existing-byteproof: 2 | `wave41/candidates-20261002/assets/15-hurdle_straight-v1-wave41-v1.png` |
| wave41-queue | 1 | existing-byteproof: 1 | `wave41/candidates-20261002/assets/23-hungry_queue-v1-wave41-v1.png` |
| wave42-land-stages | 50 | existing-byteproof: 36; unresolved-fact-or-placement-contract: 14 | `wave42/bramble-v3-20261002/assets/abandoned/abandoned_bramble_summer.png` |
| wave43-ground-props | 15 | unmigrated-consumer: 14; unresolved-fact-or-placement-contract: 1 | `wave43/candidates-20261002/assets/ground/chalk_down_spring_a-v1.png` |

## 검증 경계

425 unique original source IDs, 나 분류425, 기존 열 보존, 새 분류 합계425를 검증했다. PNG/ledger/public/catalog 변경 없음. 이번 소비자 소스 조회 전 Graft source lookup1회, 보고된 절감8,265 tokens; 소스 파일로 실제 연결을 다시 확인했다. 이전 감사 절감122,431 및 더 이전142,694와 합산하지 않는다. runtime_verified_this_audit는 전 행False이며 runtime_pending은 retired16 외409행True다. 기존42의 이번 감사 런타임 미검증과 신규32의 설치 미완료를 분리한다.

소유권 보정 회차: 이전 current_capability를 previous_current_capability에 보존하고 asset_contract_install_owner/consumer_owner/ownership_evidence를 추가했다. Graft1회 절감15,485 tokens 후 현재 AGENTS·DISPATCH·소비자 원본으로 대조했다. 종전 needed_adapter에 남은 “A owned front props”는 역사적 오분류이며 현재 소비자/소유권 열로 명시적으로 폐기한다. 이전 분류 열은 수정하지 않았다.

# 아직 없는 시설과 활동 겹침

분류 C · 49장 · 관련 작업 향후 시설 확장 · 예상 24–56 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/content/buildingConfig.ts:6 BuildingKind; src/content/buildingCatalog.ts:74 facilityArt; src/render/historicalFacilityAssets.ts:101 historicalFacilityAssetId; src/render/manifestArt.ts:11 manifestArt

## 연결·자리·선택

inn·smithy·tannery·butcher·병원·수도시설 등의 독립 building kind가 없다. 직업 이름과 건물 kind를 동일시하지 않는다. 기관/생산/접근성/비용/위험의 엔진 계약 후 설치한다. records/buildings.csv의 footprint와 비대칭 pivot 그대로 사용; active는 별도의 투명 overlay이고 본체 대체 PNG가 아니다. 모든 overlay는 본체 rect 그대로, 전면 마당이 다른 필지를 침범하지 않게 한다.

## 확인할 장면·줌·계절

시설별 idle/active 각각, 물가 조건/거리 조건, 여름/겨울 0.6/1.0/1.4. 현재 엔진에 없는 scene은 기능 전까지 NOT_RUN.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave12/candidates-20260926/assets/active/charcoal_clamp-active-v1.png|public/assets/wave12/active/charcoal_clamp-active-v1.png|144×160|(74,151) native px; footprint 1x1|
|wave12/candidates-20260926/assets/active/communal_oven-active-v1.png|public/assets/wave12/active/communal_oven-active-v1.png|144×160|(91,151) native px; footprint 1x1|
|wave12/candidates-20260926/assets/active/lime_kiln-active-v1.png|public/assets/wave12/active/lime_kiln-active-v1.png|288×264|(133,255) native px; footprint 2x2|
|wave12/candidates-20260926/assets/active/pottery_kiln-active-v1.png|public/assets/wave12/active/pottery_kiln-active-v1.png|288×252|(201,243) native px; footprint 2x2|
|wave12/candidates-20260926/assets/bld/almshouse-v1.png|public/assets/wave12/bld/almshouse-v1.png|288×200|(76,191) native px; footprint 3x1|
|wave12/candidates-20260926/assets/bld/bridge_chapel-v1.png|public/assets/wave12/bld/bridge_chapel-v1.png|160×192|(59,183) native px; footprint module|
|wave12/candidates-20260926/assets/bld/butcher_shambles-v1.png|public/assets/wave12/bld/butcher_shambles-v1.png|224×176|(67,167) native px; footprint 2x1|
|wave12/candidates-20260926/assets/bld/chantry_chapel-v1.png|public/assets/wave12/bld/chantry_chapel-v1.png|160×176|(64,167) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/charcoal_clamp-v1.png|public/assets/wave12/bld/charcoal_clamp-v1.png|144×160|(74,151) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/communal_oven-v1.png|public/assets/wave12/bld/communal_oven-v1.png|144×160|(91,151) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/conduit_house-v1.png|public/assets/wave12/bld/conduit_house-v1.png|160×176|(69,167) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/cordwainer-v1.png|public/assets/wave12/bld/cordwainer-v1.png|137×137|(82,128) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/ditch_drain-v1.png|public/assets/wave12/bld/ditch_drain-v1.png|128×64|(81,52) native px; footprint module|
|wave12/candidates-20260926/assets/bld/hospital-v1.png|public/assets/wave12/bld/hospital-v1.png|352×272|(273,263) native px; footprint 3x2|
|wave12/candidates-20260926/assets/bld/inn_a-v1.png|public/assets/wave12/bld/inn_a-v1.png|352×280|(164,271) native px; footprint 3x2|
|wave12/candidates-20260926/assets/bld/inn_b-v1.png|public/assets/wave12/bld/inn_b-v1.png|352×280|(206,271) native px; footprint 3x2|
|wave12/candidates-20260926/assets/bld/lime_kiln-v1.png|public/assets/wave12/bld/lime_kiln-v1.png|288×264|(133,255) native px; footprint 2x2|
|wave12/candidates-20260926/assets/bld/market_cross_stone-v1.png|public/assets/wave12/bld/market_cross_stone-v1.png|144×176|(71,167) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/market_cross_wood-v1.png|public/assets/wave12/bld/market_cross_wood-v1.png|144×160|(69,151) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/pilgrim_shrine-v1.png|public/assets/wave12/bld/pilgrim_shrine-v1.png|144×160|(72,151) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/pottery_kiln-v1.png|public/assets/wave12/bld/pottery_kiln-v1.png|288×252|(201,243) native px; footprint 2x2|
|wave12/candidates-20260926/assets/bld/priory_cell-v1.png|public/assets/wave12/bld/priory_cell-v1.png|480×352|(284,343) native px; footprint 4x3|
|wave12/candidates-20260926/assets/bld/smithy_a-v1.png|public/assets/wave12/bld/smithy_a-v1.png|137×137|(80,128) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/smithy_b-v1.png|public/assets/wave12/bld/smithy_b-v1.png|137×137|(83,128) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/tailor-v1.png|public/assets/wave12/bld/tailor-v1.png|137×137|(76,128) native px; footprint 1x1|
|wave12/candidates-20260926/assets/bld/tannery_a-v1.png|public/assets/wave12/bld/tannery_a-v1.png|288×228|(249,219) native px; footprint 2x2|
|wave12/candidates-20260926/assets/bld/tannery_b-v1.png|public/assets/wave12/bld/tannery_b-v1.png|288×228|(172,219) native px; footprint 2x2|
|wave12/candidates-20260926/assets/bld/tithe_barn-v1.png|public/assets/wave12/bld/tithe_barn-v1.png|416×264|(116,255) native px; footprint 4x2|
|wave12/candidates-20260926/assets/bld/tolbooth-v1.png|public/assets/wave12/bld/tolbooth-v1.png|288×292|(104,283) native px; footprint 2x2|
|wave12/rework-20260926/assets/active/almshouse-active-v1.png|public/assets/wave12/active/almshouse-active-v1.png|288×200|(76,191) native px; footprint 3x1|
|wave12/rework-20260926/assets/active/bridge_chapel-active-v1.png|public/assets/wave12/active/bridge_chapel-active-v1.png|160×192|(59,183) native px; footprint module|
|wave12/rework-20260926/assets/active/butcher_shambles-active-v1.png|public/assets/wave12/active/butcher_shambles-active-v1.png|224×176|(67,167) native px; footprint 2x1|
|wave12/rework-20260926/assets/active/chantry_chapel-active-v1.png|public/assets/wave12/active/chantry_chapel-active-v1.png|160×176|(64,167) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/conduit_house-active-v1.png|public/assets/wave12/active/conduit_house-active-v1.png|160×176|(69,167) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/cordwainer-active-v1.png|public/assets/wave12/active/cordwainer-active-v1.png|137×137|(82,128) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/hospital-active-v1.png|public/assets/wave12/active/hospital-active-v1.png|352×272|(273,263) native px; footprint 3x2|
|wave12/rework-20260926/assets/active/inn_a-active-v1.png|public/assets/wave12/active/inn_a-active-v1.png|352×280|(164,271) native px; footprint 3x2|
|wave12/rework-20260926/assets/active/inn_b-active-v1.png|public/assets/wave12/active/inn_b-active-v1.png|352×280|(206,271) native px; footprint 3x2|
|wave12/rework-20260926/assets/active/market_cross_stone-active-v1.png|public/assets/wave12/active/market_cross_stone-active-v1.png|144×176|(71,167) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/market_cross_wood-active-v1.png|public/assets/wave12/active/market_cross_wood-active-v1.png|144×160|(69,151) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/pilgrim_shrine-active-v1.png|public/assets/wave12/active/pilgrim_shrine-active-v1.png|144×160|(72,151) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/priory_cell-active-v1.png|public/assets/wave12/active/priory_cell-active-v1.png|480×352|(284,343) native px; footprint 4x3|
|wave12/rework-20260926/assets/active/smithy_a-active-v1.png|public/assets/wave12/active/smithy_a-active-v1.png|137×137|(80,128) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/smithy_b-active-v1.png|public/assets/wave12/active/smithy_b-active-v1.png|137×137|(83,128) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/tailor-active-v1.png|public/assets/wave12/active/tailor-active-v1.png|137×137|(76,128) native px; footprint 1x1|
|wave12/rework-20260926/assets/active/tannery_a-active-v1.png|public/assets/wave12/active/tannery_a-active-v1.png|288×228|(249,219) native px; footprint 2x2|
|wave12/rework-20260926/assets/active/tannery_b-active-v1.png|public/assets/wave12/active/tannery_b-active-v1.png|288×228|(172,219) native px; footprint 2x2|
|wave12/rework-20260926/assets/active/tithe_barn-active-v1.png|public/assets/wave12/active/tithe_barn-active-v1.png|416×264|(116,255) native px; footprint 4x2|
|wave12/rework-20260926/assets/active/tolbooth-active-v1.png|public/assets/wave12/active/tolbooth-active-v1.png|288×292|(104,283) native px; footprint 2x2|


## 용량과 공통 처리

이 실행 묶음 49장: 메타데이터 제거 후 원본 합계 2.03 MiB, 원본 RGBA 한 벌 산술 합계 10.04 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

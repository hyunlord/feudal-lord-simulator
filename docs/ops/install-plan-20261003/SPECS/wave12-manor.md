# 영주관 본체·활동 겹침

분류 B · 4장 · 관련 작업 LM-R3 / FIX-11 · 예상 5–9 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/content/buildingConfig.ts:30 manor_house; src/content/buildingCatalog.ts:141 manor_house; src/render/historicalFacilityAssets.ts:132 historicalFacilitySpriteRect; src/render/manifestArt.ts:11 manifestArt

## 연결·자리·선택

이미 있는 manor_house 건물 tx/ty를 사용한다. seed+building.id로 A/B 고정. 416×328 캔버스 피벗 A(249,319)/B(251,319)를 footprint 전면 접점에 맞춘다. 기존 historicalFacilitySpriteRect의 수평중앙 방식에 바로 끼우면 어긋나므로 native pivot draw 경로를 연결한다. 활동 overlay는 같은 캔버스/동일 rect로만. lord 있음/없음의 정확한 state 기준은 LM-R3 빈 영주관 묶음 사양과 공동 확정하고 기능값 없는 추정 on/off 금지.

## 확인할 장면·줌·계절

새 영주 모드 영주관·빈 영주관, A/B 각 여름/겨울, 0.6/1.0/1.4. body는 전 줌 유지하고 active 잡동사니는 0.6 생략 가능.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave12/candidates-20260926/assets/bld/manor_house_a-v1.png|public/assets/wave12/bld/manor_house_a-v1.png|416×328|(249,319) native px; footprint 3x3|
|wave12/candidates-20260926/assets/bld/manor_house_b-v1.png|public/assets/wave12/bld/manor_house_b-v1.png|416×328|(251,319) native px; footprint 3x3|
|wave12/rework-20260926/assets/active/manor_house_a-active-v1.png|public/assets/wave12/active/manor_house_a-active-v1.png|416×328|(249,319) native px; footprint 3x3|
|wave12/rework-20260926/assets/active/manor_house_b-active-v1.png|public/assets/wave12/active/manor_house_b-active-v1.png|416×328|(251,319) native px; footprint 3x3|


## 용량과 공통 처리

이 실행 묶음 4장: 메타데이터 제거 후 원본 합계 0.41 MiB, 원본 RGBA 한 벌 산술 합계 2.08 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

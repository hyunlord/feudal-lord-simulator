# 직물 회관 새 시설

분류 C · 1장 · 관련 작업 향후 직물 시설 · 예상 12–24 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/content/buildingConfig.ts:6 BuildingKind; src/content/buildingCatalog.ts:74 facilityArt; src/render/historicalFacilityAssets.ts:101 historicalFacilityAssetId

## 연결·자리·선택

cloth_hall은 현재 BuildingKind에 없다. 별도 건물 비용/고용/권리/footprint 규칙을 먼저 정의해야 한다. weaver_house로 임의 대체 금지. 승인 뒤 buildingCatalog와 facilityArt 등록, footprint front anchor에 지정 피벗 정렬.

## 확인할 장면·줌·계절

새 시설 건설·가동·정지·폐쇄; 사방 인접 건물, 0.6/1.0/1.4 여름/겨울. 기능 대기이며 현재 설치로 완료할 수 없다.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave3/candidates-20260926/assets/bld/cloth_hall.png|public/assets/wave3/bld/cloth_hall.png|200×160|per-frame/source registration: wave3/candidates-20260926/records/ (spec requirement; not guessed)|


## 용량과 공통 처리

이 실행 묶음 1장: 메타데이터 제거 후 원본 합계 0.05 MiB, 원본 RGBA 한 벌 산술 합계 0.12 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

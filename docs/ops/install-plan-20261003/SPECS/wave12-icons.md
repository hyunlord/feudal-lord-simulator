# 새 시설용 아이콘 시트

분류 C · 3장 · 관련 작업 향후 시설 UI · 예상 2–4 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/ui/uiArt.ts:13 UI_ICON_SHEETS; src/ui/uiArt.ts:46 uiIconStyle; src/content/buildingConfig.ts:6 BuildingKind

## 연결·자리·선택

96px 셀 좌표는 records/buildings.csv icon_x/y/w/h를 그대로 사용한다. 3개 시트에서 아직 구현되지 않은 시설 버튼을 미리 활성화하지 않는다. 기능이 들어온 항목만 메뉴와 thumbnail lookup 연결.

## 확인할 장면·줌·계절

시설 메뉴 24/32/48 CSSpx·44px 터치영역, 작은 뷰포트 넘침. 월드 줌과 무관.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave12/candidates-20260926/assets/icons/buildings_AB-96.png|public/assets/wave12/icons/buildings_AB-96.png|1344×96|per-frame/source registration: wave12/candidates-20260926/records/ (spec requirement; not guessed)|
|wave12/candidates-20260926/assets/icons/buildings_C-96.png|public/assets/wave12/icons/buildings_C-96.png|480×96|per-frame/source registration: wave12/candidates-20260926/records/ (spec requirement; not guessed)|
|wave12/candidates-20260926/assets/icons/buildings_D-96.png|public/assets/wave12/icons/buildings_D-96.png|960×96|per-frame/source registration: wave12/candidates-20260926/records/ (spec requirement; not guessed)|


## 용량과 공통 처리

이 실행 묶음 3장: 메타데이터 제거 후 원본 합계 0.35 MiB, 원본 RGBA 한 벌 산술 합계 1.02 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

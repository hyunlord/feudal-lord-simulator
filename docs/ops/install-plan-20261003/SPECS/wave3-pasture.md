# 목축 마당의 작업 소품

분류 B · 3장 · 관련 작업 CLOTH-UI / LM-R3 · 예상 4–8 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/render/wave3ClothArt.ts:18 PIVOTS; src/render/zoneLayer.ts:95 buildZoneLayer; src/content/buildingConfig.ts:25 pastoral_farm

## 연결·자리·선택

pastoral_farm의 보유 마당 안에서 shearing_pen/sheepfold를 겹치지 않게 고정 hash로 선택하고 wash_pool은 물 인접에만. 건물 footprint·도로와 충돌하면 생략한다. pasture 폴더를 WAVE3_CLOTH_IMAGES/PIVOTS에 명시 추가; 등록만으로 현재 draw는 선택하지 않는다.

## 확인할 장면·줌·계절

여름 방목지/겨울 방목지, 물 없는 필지와 물 옆 필지. 0.6 주요 울타리만, 1.0/1.4 전부. 원근 확대 금지.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave3/candidates-20260926/assets/pasture/shearing_pen-v1.png|public/assets/wave3/pasture/shearing_pen-v1.png|256×192|[128, 184] native px|
|wave3/candidates-20260926/assets/pasture/sheepfold-v1.png|public/assets/wave3/pasture/sheepfold-v1.png|256×192|[128, 184] native px|
|wave3/candidates-20260926/assets/pasture/wash_pool-v1.png|public/assets/wave3/pasture/wash_pool-v1.png|192×128|[96, 120] native px|


## 용량과 공통 처리

이 실행 묶음 3장: 메타데이터 제거 후 원본 합계 0.17 MiB, 원본 RGBA 한 벌 산술 합계 0.47 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

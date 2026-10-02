# 부두 작업 겹침

분류 B · 1장 · 관련 작업 LM-R3 / 기존 UI-6 · 예상 2–4 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/render/warWorldProps.ts:24 WarPropKind; src/render/warWorldProps.ts:166 warProps; src/render/manifestArt.ts:11 manifestArt

## 연결·자리·선택

기존 quay 본체와 같은 shore placement와 pivot(68,119). quay-active는 idle body를 바꾸지 않고 같은 rect에 한 장 겹친다. 왕실 징발/운송 실제 데이터가 있을 때만 보이고 raid_burning_quay와 동시 가동 금지.

## 확인할 장면·줌·계절

해안 평시 징발/공습 전후, 0.6 active 생략·body 유지, 1.0/1.4 접합 확인, 여름/겨울.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave12/rework-20260926/assets/active/quay-active-v1.png|public/assets/wave12/active/quay-active-v1.png|256×128|(68,119) native px; footprint module|


## 용량과 공통 처리

이 실행 묶음 1장: 메타데이터 제거 후 원본 합계 0.02 MiB, 원본 RGBA 한 벌 산술 합계 0.12 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

# 직물 워커의 소지품

분류 B · 16장 · 관련 작업 CLOTH-UI / LM-R3 · 예상 3–6 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/render/walkerComposer.ts:188 walkerAppearance; src/render/walkerLook.ts:156 walkerHeldProp; src/render/wave3ClothArt.ts:18 PIVOTS

## 연결·자리·선택

기존 직물 워커 kit 경로에서 shepherd→crook, shearing→shears, spinning→distaff, dyeing→paddle를 실제 작업 상태에만 선택한다. 4방향 URL을 walkerPropManifest에 추가하고 grip pivot을 셀 손 좌표에 연결한다. 새로운 장식 인구 생성 금지.

## 확인할 장면·줌·계절

4방향×보행2프레임·직물 운반/작업 정지 양쪽; 0.6 소품 생략 가능, 1.0 손접점, 1.4 픽셀 등록 확인.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave3/candidates-20260926/assets/props/work_distaff_ne-v1.png|public/assets/wave3/props/work_distaff_ne-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_distaff_nw-v1.png|public/assets/wave3/props/work_distaff_nw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_distaff_se-v1.png|public/assets/wave3/props/work_distaff_se-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_distaff_sw-v1.png|public/assets/wave3/props/work_distaff_sw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_dye_paddle_ne-v1.png|public/assets/wave3/props/work_dye_paddle_ne-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_dye_paddle_nw-v1.png|public/assets/wave3/props/work_dye_paddle_nw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_dye_paddle_se-v1.png|public/assets/wave3/props/work_dye_paddle_se-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_dye_paddle_sw-v1.png|public/assets/wave3/props/work_dye_paddle_sw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shears_ne-v1.png|public/assets/wave3/props/work_shears_ne-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shears_nw-v1.png|public/assets/wave3/props/work_shears_nw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shears_se-v1.png|public/assets/wave3/props/work_shears_se-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shears_sw-v1.png|public/assets/wave3/props/work_shears_sw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shepherd_crook_ne-v1.png|public/assets/wave3/props/work_shepherd_crook_ne-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shepherd_crook_nw-v1.png|public/assets/wave3/props/work_shepherd_crook_nw-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shepherd_crook_se-v1.png|public/assets/wave3/props/work_shepherd_crook_se-v1.png|32×32|[16, 20] native px hand-grip|
|wave3/candidates-20260926/assets/props/work_shepherd_crook_sw-v1.png|public/assets/wave3/props/work_shepherd_crook_sw-v1.png|32×32|[16, 20] native px hand-grip|


## 용량과 공통 처리

이 실행 묶음 16장: 메타데이터 제거 후 원본 합계 0.01 MiB, 원본 RGBA 한 벌 산술 합계 0.06 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

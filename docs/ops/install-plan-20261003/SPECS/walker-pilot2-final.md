# 초기 워커 재스킨·소지품

분류 B · 20장 · 관련 작업 기존 V2 walker · 예상 4–8 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/render/walkerSheetManifest.generated.ts:1; src/render/walkerLook.ts:102 walkerCandidates; src/render/walkerLook.ts:156 walkerHeldProp; src/render/walkerComposer.ts:167 rightHand; :223 drawComposedWalker

## 연결·자리·선택

최종 4 sheets만 296×148, cell74×74, NE/SE/SW/NW×2. 기존 template hand/foot 좌표를 참조하되 README의 손 재묘사 미확정 사항을 셀마다 확인하여 frame metadata 작성. prop-anchors.json의 16 grips을 direction별 연결한다. 기존 prop 키와 중복인 basket/purse/sack/staff는 variant registry와 안정적인 선택 규칙 추가 필요. template/master68장은 제품 아님.

## 확인할 장면·줌·계절

각 sheet8셀×빈손/소지품/겨울cloak 0.6/1.0/1.4, 손 접합과 지붕 가림, 동일 seed/save 재실행. 픽셀 등록 미확정은 설치 후 관문으로 남긴다.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|walker-pilot2/candidates-v1/assets/props/held_basket_NE-v1.png|public/assets/walker-pilot2/props/held_basket_NE-v1.png|32×32|[16.27, 6.9] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_basket_NW-v1.png|public/assets/walker-pilot2/props/held_basket_NW-v1.png|32×32|[15.5, 6.9] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_basket_SE-v1.png|public/assets/walker-pilot2/props/held_basket_SE-v1.png|32×32|[15.59, 6.9] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_basket_SW-v1.png|public/assets/walker-pilot2/props/held_basket_SW-v1.png|32×32|[16.06, 6.9] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_purse_NE-v1.png|public/assets/walker-pilot2/props/held_purse_NE-v1.png|32×32|[14.57, 10.12] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_purse_NW-v1.png|public/assets/walker-pilot2/props/held_purse_NW-v1.png|32×32|[16.6, 10.12] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_purse_SE-v1.png|public/assets/walker-pilot2/props/held_purse_SE-v1.png|32×32|[16.77, 10.12] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_purse_SW-v1.png|public/assets/walker-pilot2/props/held_purse_SW-v1.png|32×32|[14.64, 10.12] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_sack_NE-v1.png|public/assets/walker-pilot2/props/held_sack_NE-v1.png|32×32|[15.79, 12.4] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_sack_NW-v1.png|public/assets/walker-pilot2/props/held_sack_NW-v1.png|32×32|[14.65, 12.4] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_sack_SE-v1.png|public/assets/walker-pilot2/props/held_sack_SE-v1.png|32×32|[16.26, 12.4] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_sack_SW-v1.png|public/assets/walker-pilot2/props/held_sack_SW-v1.png|32×32|[14.59, 12.4] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_staff_NE-v1.png|public/assets/walker-pilot2/props/held_staff_NE-v1.png|32×32|[15.4, 16] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_staff_NW-v1.png|public/assets/walker-pilot2/props/held_staff_NW-v1.png|32×32|[15.5, 16] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_staff_SE-v1.png|public/assets/walker-pilot2/props/held_staff_SE-v1.png|32×32|[15.4, 16] native px hand-grip|
|walker-pilot2/candidates-v1/assets/props/held_staff_SW-v1.png|public/assets/walker-pilot2/props/held_staff_SW-v1.png|32×32|[15.4, 16] native px hand-grip|
|walker-pilot2/candidates-v1/assets/workers/wk_reskin_P1_merchant_m-v1.png|public/assets/walker-pilot2/workers/wk_reskin_P1_merchant_m-v1.png|296×148|[{"direction":"NE","gaitFrame":0,"foot":[32.3182,66.0198]},{"direction":"SE","gaitFrame":0,"foot":[44.239,66.6287]},{"direction":"SW","gaitFrame":0,"foot":[28.2652,66.69]},{"direction":"NW","gaitFrame":0,"foot":[40.4467,66.0146]},{"direction":"NE","gaitFrame":1,"foot":[31.1136,65.7819]},{"direction":"SE","gaitFrame":1,"foot":[45.5944,66.0041]},{"direction":"SW","gaitFrame":1,"foot":[27.908,66.0401]},{"direction":"NW","gaitFrame":1,"foot":[43.8282,65.5995]}]|
|walker-pilot2/candidates-v1/assets/workers/wk_reskin_P4_labour_m-v1.png|public/assets/walker-pilot2/workers/wk_reskin_P4_labour_m-v1.png|296×148|[{"direction":"NE","gaitFrame":0,"foot":[40.3321,64.9851]},{"direction":"SE","gaitFrame":0,"foot":[44.8825,65.4937]},{"direction":"SW","gaitFrame":0,"foot":[29.1586,65.2502]},{"direction":"NW","gaitFrame":0,"foot":[33.3445,65.3259]},{"direction":"NE","gaitFrame":1,"foot":[39.9818,65.0975]},{"direction":"SE","gaitFrame":1,"foot":[45.6813,65.2225]},{"direction":"SW","gaitFrame":1,"foot":[29.1582,65.0667]},{"direction":"NW","gaitFrame":1,"foot":[33.7068,64.9416]}]|
|walker-pilot2/candidates-v1/assets/workers/wk_reskin_P5_labour_f-v1.png|public/assets/walker-pilot2/workers/wk_reskin_P5_labour_f-v1.png|296×148|[{"direction":"NE","gaitFrame":0,"foot":[34.0681,64.8588]},{"direction":"SE","gaitFrame":0,"foot":[43.2763,65.1904]},{"direction":"SW","gaitFrame":0,"foot":[31.5944,65.1992]},{"direction":"NW","gaitFrame":0,"foot":[38.7156,64.8427]},{"direction":"NE","gaitFrame":1,"foot":[33.9349,64.3659]},{"direction":"SE","gaitFrame":1,"foot":[45.3701,64.0532]},{"direction":"SW","gaitFrame":1,"foot":[27.7734,64.0]},{"direction":"NW","gaitFrame":1,"foot":[40.1556,64.3577]}]|
|walker-pilot2/candidates-v1/assets/workers/wk_reskin_P6_widow_f-v1.png|public/assets/walker-pilot2/workers/wk_reskin_P6_widow_f-v1.png|296×148|[{"direction":"NE","gaitFrame":0,"foot":[34.0681,64.8588]},{"direction":"SE","gaitFrame":0,"foot":[43.2763,65.1904]},{"direction":"SW","gaitFrame":0,"foot":[31.5944,65.1992]},{"direction":"NW","gaitFrame":0,"foot":[38.7156,64.8427]},{"direction":"NE","gaitFrame":1,"foot":[33.9349,64.3659]},{"direction":"SE","gaitFrame":1,"foot":[45.3701,64.0532]},{"direction":"SW","gaitFrame":1,"foot":[27.7734,64.0]},{"direction":"NW","gaitFrame":1,"foot":[40.1556,64.3577]}]|


## 용량과 공통 처리

이 실행 묶음 20장: 메타데이터 제거 후 원본 합계 0.14 MiB, 원본 RGBA 한 벌 산술 합계 0.73 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

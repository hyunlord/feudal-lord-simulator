# 가축 견인 수레·짐승 짐·기승

분류 C · 8장 · 관련 작업 향후 운송 시각화 · 예상 16–32 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/agents/walker.types.ts; src/render/walkerComposer.ts:223 drawComposedWalker; src/render/manifestArt.ts:11 manifestArt

## 연결·자리·선택

현재 사람 운반 워커의 cargo만으로 말/소 견인·기승 상태가 없다. 별도 transport presentation을 도입하여 animal→saddle/load→rider/cart를 방향별 attachment에 맞춰 겹친다. 실제 운송 객체가 없으면 장식 수레를 생성하지 않는다.

## 확인할 장면·줌·계절

적재/빈수레 각 방향, 문 통과/교량/모퉁이/급정지, 0.6 단일 조합 silhouette, 1.0/1.4 바퀴·발·짐 기준점.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave13/candidates-v1/assets/cart/barrow_body-v1.png|public/assets/wave13/cart/barrow_body-v1.png|256×96|{"cell":[64,48],"pivot":[32,44]}|
|wave13/candidates-v1/assets/cart/handcart_body-v2.png|public/assets/wave13/cart/handcart_body-v2.png|384×148|{"cell":[96,74],"pivot":[48,70]}|
|wave13/candidates-v1/assets/cart/horse_cart_body-v1.png|public/assets/wave13/cart/horse_cart_body-v1.png|512×192|{"cell":[128,96],"pivot":[64,92]}|
|wave13/candidates-v1/assets/cart/ox_cart_body-v1.png|public/assets/wave13/cart/ox_cart_body-v1.png|512×192|{"cell":[128,96],"pivot":[64,92]}|
|wave13/candidates-v1/assets/pack/packsaddle_cloth-v1.png|public/assets/wave13/pack/packsaddle_cloth-v1.png|384×160|{"cell":[96,80],"pivot":[48,76]}|
|wave13/candidates-v1/assets/pack/packsaddle_sacks-v1.png|public/assets/wave13/pack/packsaddle_sacks-v1.png|384×160|{"cell":[96,80],"pivot":[48,76]}|
|wave13/candidates-v1/assets/pack/packsaddle_wool-v1.png|public/assets/wave13/pack/packsaddle_wool-v1.png|384×160|{"cell":[96,80],"pivot":[48,76]}|
|wave13/candidates-v1/assets/rider/saddle_rider_merchant-v1.png|public/assets/wave13/rider/saddle_rider_merchant-v1.png|384×160|{"cell":[96,80],"pivot":[48,76]}|


## 용량과 공통 처리

이 실행 묶음 8장: 메타데이터 제거 후 원본 합계 0.40 MiB, 원본 RGBA 한 벌 산술 합계 2.00 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

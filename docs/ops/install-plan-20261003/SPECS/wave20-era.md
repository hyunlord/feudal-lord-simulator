# 시대별 집·판자·지붕 눈

분류 B · 32장 · 관련 작업 NAT-5 / 시대 표현 · 예상 8–16 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/engine/scenarioState.ts stateCalendar; src/render/houseVariantChoice.ts:62 rawHouseBody; src/render/houseVariantChoice.ts:84 houseBodyEligible; src/render/houseConditionOverlay.ts:39 drawHouseCondition

## 연결·자리·선택

year<1350 기존 집; 1350≤year<1400 1350판; year≥1400 1400판. 단일 필지 한정, house level와 A/B 고정 hash를 유지. Wave26/30 부유도/지붕 선택과 경쟁하는 우선순위를 하나로 통합해야 하므로 A 불가. L2~4 overlay는 시대 일치 boarded-v3와 roof_snow-v4만; L0/1은 원문 CSV compatible overlay를 사용. native_to_world_scale, pivot, full canvas 보존; 기존 alpha crop 재활용 금지.

## 확인할 장면·줌·계절

1349→1350→1399→1400 저장 경계, L0~4 A/B, summer/winter×fresh/boarded/fire; 0.6 silhouette·snow 유지, 1.0/1.4 판자/눈 지붕 정합. 쌍필지/alehouse 기존 fallback 회귀.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave20/candidates-20260926/assets/houses/house_l0_1350_a-v1.png|public/assets/wave20/houses/house_l0_1350_a-v1.png|153×153|(77.35406698564593,139.57894736842104) native px|
|wave20/candidates-20260926/assets/houses/house_l0_1350_b-v1.png|public/assets/wave20/houses/house_l0_1350_b-v1.png|153×153|(77.35406698564593,139.57894736842104) native px|
|wave20/candidates-20260926/assets/houses/house_l0_1400_a-v1.png|public/assets/wave20/houses/house_l0_1400_a-v1.png|153×153|(77.35406698564593,139.57894736842104) native px|
|wave20/candidates-20260926/assets/houses/house_l0_1400_b-v1.png|public/assets/wave20/houses/house_l0_1400_b-v1.png|153×153|(77.35406698564593,139.57894736842104) native px|
|wave20/candidates-20260926/assets/houses/house_l1_1350_a-v1.png|public/assets/wave20/houses/house_l1_1350_a-v1.png|139×139|(71.66148325358851,125.92025518341308) native px|
|wave20/candidates-20260926/assets/houses/house_l1_1350_b-v1.png|public/assets/wave20/houses/house_l1_1350_b-v1.png|139×139|(71.66148325358851,125.92025518341308) native px|
|wave20/candidates-20260926/assets/houses/house_l1_1400_a-v1.png|public/assets/wave20/houses/house_l1_1400_a-v1.png|139×139|(71.66148325358851,125.92025518341308) native px|
|wave20/candidates-20260926/assets/houses/house_l1_1400_b-v1.png|public/assets/wave20/houses/house_l1_1400_b-v1.png|139×139|(71.66148325358851,125.92025518341308) native px|
|wave20/rework-20260927/assets/houses/house_l2_1350_a-v2.png|public/assets/wave20/houses/house_l2_1350_a-v2.png|137×137|(70.95813397129186,132.08373205741626) native px|
|wave20/rework-20260927/assets/houses/house_l2_1350_b-v2.png|public/assets/wave20/houses/house_l2_1350_b-v2.png|137×137|(70.95813397129186,132.08373205741626) native px|
|wave20/rework-20260927/assets/houses/house_l2_1400_a-v2.png|public/assets/wave20/houses/house_l2_1400_a-v2.png|137×137|(70.95813397129186,132.08373205741626) native px|
|wave20/rework-20260927/assets/houses/house_l2_1400_b-v2.png|public/assets/wave20/houses/house_l2_1400_b-v2.png|137×137|(70.95813397129186,132.08373205741626) native px|
|wave20/rework-20260927/assets/houses/house_l3_1350_a-v2.png|public/assets/wave20/houses/house_l3_1350_a-v2.png|142×142|(74.39712918660287,138.03668261562999) native px|
|wave20/rework-20260927/assets/houses/house_l3_1350_b-v2.png|public/assets/wave20/houses/house_l3_1350_b-v2.png|142×142|(74.39712918660287,138.03668261562999) native px|
|wave20/rework-20260927/assets/houses/house_l3_1400_a-v2.png|public/assets/wave20/houses/house_l3_1400_a-v2.png|142×142|(74.39712918660287,138.03668261562999) native px|
|wave20/rework-20260927/assets/houses/house_l3_1400_b-v2.png|public/assets/wave20/houses/house_l3_1400_b-v2.png|142×142|(74.39712918660287,138.03668261562999) native px|
|wave20/rework-20260927/assets/houses/house_l4_1350_a-v2.png|public/assets/wave20/houses/house_l4_1350_a-v2.png|161×161|(81.97647527910686,157.40510366826157) native px|
|wave20/rework-20260927/assets/houses/house_l4_1350_b-v2.png|public/assets/wave20/houses/house_l4_1350_b-v2.png|161×161|(81.97647527910686,157.40510366826157) native px|
|wave20/rework-20260927/assets/houses/house_l4_1400_a-v2.png|public/assets/wave20/houses/house_l4_1400_a-v2.png|161×161|(81.97647527910686,157.40510366826157) native px|
|wave20/rework-20260927/assets/houses/house_l4_1400_b-v2.png|public/assets/wave20/houses/house_l4_1400_b-v2.png|161×161|(81.97647527910686,157.40510366826157) native px|
|wave20/rework-20260927/assets/overlays/boarded_l2_1350-v3.png|public/assets/wave20/overlays/boarded_l2_1350-v3.png|137×137|(70.95813397129186,132.08373205741626) native px; overlay same full canvas offset(0,0) scale1|
|wave20/rework-20260927/assets/overlays/boarded_l2_1400-v3.png|public/assets/wave20/overlays/boarded_l2_1400-v3.png|137×137|(70.95813397129186,132.08373205741626) native px; overlay same full canvas offset(0,0) scale1|
|wave20/rework-20260927/assets/overlays/boarded_l3_1350-v3.png|public/assets/wave20/overlays/boarded_l3_1350-v3.png|142×142|(74.39712918660287,138.03668261562999) native px; overlay same full canvas offset(0,0) scale1|
|wave20/rework-20260927/assets/overlays/boarded_l3_1400-v3.png|public/assets/wave20/overlays/boarded_l3_1400-v3.png|142×142|(74.39712918660287,138.03668261562999) native px; overlay same full canvas offset(0,0) scale1|
|wave20/rework-20260927/assets/overlays/boarded_l4_1350-v3.png|public/assets/wave20/overlays/boarded_l4_1350-v3.png|161×161|(81.97647527910686,157.40510366826157) native px; overlay same full canvas offset(0,0) scale1|
|wave20/rework-20260927/assets/overlays/boarded_l4_1400-v3.png|public/assets/wave20/overlays/boarded_l4_1400-v3.png|161×161|(81.97647527910686,157.40510366826157) native px; overlay same full canvas offset(0,0) scale1|
|wave20/snow-v4-20260927/assets/overlays/roof_snow_l2_1350-v4.png|public/assets/wave20/overlays/roof_snow_l2_1350-v4.png|137×137|(70.95813397129186,132.08373205741626) native px|
|wave20/snow-v4-20260927/assets/overlays/roof_snow_l2_1400-v4.png|public/assets/wave20/overlays/roof_snow_l2_1400-v4.png|137×137|(70.95813397129186,132.08373205741626) native px|
|wave20/snow-v4-20260927/assets/overlays/roof_snow_l3_1350-v4.png|public/assets/wave20/overlays/roof_snow_l3_1350-v4.png|142×142|(74.39712918660287,138.03668261562999) native px|
|wave20/snow-v4-20260927/assets/overlays/roof_snow_l3_1400-v4.png|public/assets/wave20/overlays/roof_snow_l3_1400-v4.png|142×142|(74.39712918660287,138.03668261562999) native px|
|wave20/snow-v4-20260927/assets/overlays/roof_snow_l4_1350-v4.png|public/assets/wave20/overlays/roof_snow_l4_1350-v4.png|161×161|(81.97647527910686,157.40510366826157) native px|
|wave20/snow-v4-20260927/assets/overlays/roof_snow_l4_1400-v4.png|public/assets/wave20/overlays/roof_snow_l4_1400-v4.png|161×161|(81.97647527910686,157.40510366826157) native px|


## 용량과 공통 처리

이 실행 묶음 32장: 메타데이터 제거 후 원본 합계 0.64 MiB, 원본 RGBA 한 벌 산술 합계 2.63 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

# 전쟁 상태의 세계 표지·워크 시트

분류 B · 27장 · 관련 작업 LM-R3 / UI-6 · 예상 10–20 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/engine/war.ts:106 conscriptsAway; src/engine/war.ts:242 refugeeRoom; src/engine/war.ts:367 warForecast; src/render/warWorldProps.ts:166 warProps; src/render/walkerComposer.ts:188 walkerAppearance

## 연결·자리·선택

state.war의 conscripts·instalments·licence·raid·wall 상태를 읽고 보이는 표지로 연결한다. muster_field/royal_warehouse는 새 경제 건물로 설치하지 않고 고정된 공터/기존 창고 옆 presentation으로만 제안. trampled_field는 실제 raid 피해 필드, scaffold는 실제 석벽공사에만. levy/raider/refugee/royal 워커를 평시 일반 직업 pool에 넣지 않는다. 상태에 해당하는 기존 episode actor가 없다면 presentation actor lifecycle을 먼저 연결한다.

## 확인할 장면·줌·계절

징집 전/중/복귀, 약탈 전/후, 난민 수용/거절, 석벽 공사 전/후. 0.6 무기/소품 생략, 1.0/1.4 몸체와 손 정렬, 20frame 움직임. 여름/겨울.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave17/candidates-20260926/assets/bld/muster_field-v1.png|public/assets/wave17/bld/muster_field-v1.png|256×192|(128,191) native px|
|wave17/candidates-20260926/assets/bld/royal_warehouse-v1.png|public/assets/wave17/bld/royal_warehouse-v1.png|256×256|(128,255) native px|
|wave17/candidates-20260926/assets/decal/trampled_field-v1.png|public/assets/wave17/decal/trampled_field-v1.png|128×64|(64,63) native px|
|wave17/candidates-20260926/assets/herd/wool_sack_convoy-v1.png|public/assets/wave17/herd/wool_sack_convoy-v1.png|512×192|[{"direction":"NE","frame":"0","ground":["30.52","57"]},{"direction":"SE","frame":"0","ground":["50","51"]},{"direction":"SW","frame":"0","ground":["77.76","51"]},{"direction":"NW","frame":"0","ground":["88.12","57"]},{"direction":"NE","frame":"1","ground":["30.52","57"]},{"direction":"SE","frame":"1","ground":["50","51"]},{"direction":"SW","frame":"1","ground":["77.76","51"]},{"direction":"NW","frame":"1","ground":["88.12","57"]}] alpha-ground measurement; attachment uses assembly metadata|
|wave17/candidates-20260926/assets/prop/held_bill_ne-v1.png|public/assets/wave17/prop/held_bill_ne-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_bill_nw-v1.png|public/assets/wave17/prop/held_bill_nw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_bill_se-v1.png|public/assets/wave17/prop/held_bill_se-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_bill_sw-v1.png|public/assets/wave17/prop/held_bill_sw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_ledger_ne-v1.png|public/assets/wave17/prop/held_ledger_ne-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_ledger_nw-v1.png|public/assets/wave17/prop/held_ledger_nw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_ledger_se-v1.png|public/assets/wave17/prop/held_ledger_se-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_ledger_sw-v1.png|public/assets/wave17/prop/held_ledger_sw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_longbow_ne-v1.png|public/assets/wave17/prop/held_longbow_ne-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_longbow_nw-v1.png|public/assets/wave17/prop/held_longbow_nw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_longbow_se-v1.png|public/assets/wave17/prop/held_longbow_se-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_longbow_sw-v1.png|public/assets/wave17/prop/held_longbow_sw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_torch_ne-v1.png|public/assets/wave17/prop/held_torch_ne-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_torch_nw-v1.png|public/assets/wave17/prop/held_torch_nw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_torch_se-v1.png|public/assets/wave17/prop/held_torch_se-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/held_torch_sw-v1.png|public/assets/wave17/prop/held_torch_sw-v1.png|32×32|per-frame/source registration: wave17/candidates-20260926/records/ (spec requirement; not guessed)|
|wave17/candidates-20260926/assets/prop/refugee_bundle_sheet-v1.png|public/assets/wave17/prop/refugee_bundle_sheet-v1.png|296×148|[{"direction":"NE","frame":"0","ground":["33.13","36"]},{"direction":"SE","frame":"0","ground":["28.13","38"]},{"direction":"SW","frame":"0","ground":["49.13","38"]},{"direction":"NW","frame":"0","ground":["44.13","36"]},{"direction":"NE","frame":"1","ground":["33.13","37"]},{"direction":"SE","frame":"1","ground":["29.13","37"]},{"direction":"SW","frame":"1","ground":["50.13","37"]},{"direction":"NW","frame":"1","ground":["44.13","37"]}] alpha-ground measurement; attachment uses assembly metadata|
|wave17/candidates-20260926/assets/wall/stone_wall_repair_scaffold-v1.png|public/assets/wave17/wall/stone_wall_repair_scaffold-v1.png|512×128|(256,127) native px|
|wave17/candidates-20260926/assets/wk/wk_levy_archer-v1.png|public/assets/wave17/wk/wk_levy_archer-v1.png|296×148|[{"direction":"NE","frame":"0","ground":["40.32","67"]},{"direction":"SE","frame":"0","ground":["45.08","68"]},{"direction":"SW","frame":"0","ground":["28.7","67"]},{"direction":"NW","frame":"0","ground":["33","67"]},{"direction":"NE","frame":"1","ground":["39.81","67"]},{"direction":"SE","frame":"1","ground":["45.79","67"]},{"direction":"SW","frame":"1","ground":["28.74","67"]},{"direction":"NW","frame":"1","ground":["33.4","67"]}] alpha-ground measurement; attachment uses assembly metadata|
|wave17/candidates-20260926/assets/wk/wk_levy_billman-v1.png|public/assets/wave17/wk/wk_levy_billman-v1.png|296×148|[{"direction":"NE","frame":"0","ground":["40.32","67"]},{"direction":"SE","frame":"0","ground":["45.08","68"]},{"direction":"SW","frame":"0","ground":["28.7","67"]},{"direction":"NW","frame":"0","ground":["33","67"]},{"direction":"NE","frame":"1","ground":["39.81","67"]},{"direction":"SE","frame":"1","ground":["45.79","67"]},{"direction":"SW","frame":"1","ground":["28.74","67"]},{"direction":"NW","frame":"1","ground":["33.4","67"]}] alpha-ground measurement; attachment uses assembly metadata|
|wave17/candidates-20260926/assets/wk/wk_raider-v1.png|public/assets/wave17/wk/wk_raider-v1.png|296×148|[{"direction":"NE","frame":"0","ground":["40.32","67"]},{"direction":"SE","frame":"0","ground":["45.08","68"]},{"direction":"SW","frame":"0","ground":["28.7","67"]},{"direction":"NW","frame":"0","ground":["33","67"]},{"direction":"NE","frame":"1","ground":["39.81","67"]},{"direction":"SE","frame":"1","ground":["45.79","67"]},{"direction":"SW","frame":"1","ground":["28.74","67"]},{"direction":"NW","frame":"1","ground":["33.4","67"]}] alpha-ground measurement; attachment uses assembly metadata|
|wave17/candidates-20260926/assets/wk/wk_refugee_family-v1.png|public/assets/wave17/wk/wk_refugee_family-v1.png|296×148|[{"direction":"NE","frame":"0","ground":["33.8","66"]},{"direction":"SE","frame":"0","ground":["43.29","67"]},{"direction":"SW","frame":"0","ground":["30.94","67"]},{"direction":"NW","frame":"0","ground":["38.59","66"]},{"direction":"NE","frame":"1","ground":["33.29","65"]},{"direction":"SE","frame":"1","ground":["44.38","64"]},{"direction":"SW","frame":"1","ground":["27.93","64"]},{"direction":"NW","frame":"1","ground":["40","65"]}] alpha-ground measurement; attachment uses assembly metadata|
|wave17/candidates-20260926/assets/wk/wk_royal_purveyor-v1.png|public/assets/wave17/wk/wk_royal_purveyor-v1.png|296×148|[{"direction":"NE","frame":"0","ground":["32.06","68"]},{"direction":"SE","frame":"0","ground":["44.89","69"]},{"direction":"SW","frame":"0","ground":["26.56","70"]},{"direction":"NW","frame":"0","ground":["40.29","68"]},{"direction":"NE","frame":"1","ground":["31","68"]},{"direction":"SE","frame":"1","ground":["46.47","69"]},{"direction":"SW","frame":"1","ground":["26.53","69"]},{"direction":"NW","frame":"1","ground":["43.6","68"]}] alpha-ground measurement; attachment uses assembly metadata|


## 용량과 공통 처리

이 실행 묶음 27장: 메타데이터 제거 후 원본 합계 0.58 MiB, 원본 RGBA 한 벌 산술 합계 2.16 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

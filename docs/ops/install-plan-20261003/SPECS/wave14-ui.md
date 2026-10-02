# 인장·헌장·세력·청원 프레임

분류 B · 15장 · 관련 작업 LM-R1 / LM-R2 · 예상 6–12 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/ui/hud/HudShell.tsx:186 RightsRegister; src/ui/heraldry/EmblemImage.tsx:115 composeMark; src/ui/chronicle/FactionPage.tsx:43; src/ui/wave14ArtManifest.generated.ts:3

## 연결·자리·선택

현재 권리·세력 화면에 semantic icon/frame lookup을 연결한다. town seal은 중심 그림과 round/pointed mask를 중첩하는 별도 조합, existing wax_seal_hanging과 다른 자산이다. merchant_carved_texture는 ink stamp용 mask로 대체하지 않고 조각된 간판 표면에만. frame은 metadata-frames.json safe/9slice 계약 존중; 다른 wave 프레임의 inset 재사용 금지.

## 확인할 장면·줌·계절

권리 장부·세력 패널·청원/헌장 각 실제 내용 길이 긴 사례; 24/32/48 아이콘·96 인장, mobile/touch 넘침, 계절/월드줌 무관.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave14/candidates-v1/assets/seals/seal_town_center_bridge.png|public/assets/wave14/seals/seal_town_center_bridge.png|128×128|UI top-left (0,0)|
|wave14/candidates-v1/assets/seals/seal_town_center_church.png|public/assets/wave14/seals/seal_town_center_church.png|128×128|UI top-left (0,0)|
|wave14/candidates-v1/assets/seals/seal_town_center_gate.png|public/assets/wave14/seals/seal_town_center_gate.png|128×128|UI top-left (0,0)|
|wave14/candidates-v1/assets/seals/seal_town_center_ship.png|public/assets/wave14/seals/seal_town_center_ship.png|128×128|UI top-left (0,0)|
|wave14/candidates-v1/assets/seals/seal_town_pointed_oval.png|public/assets/wave14/seals/seal_town_pointed_oval.png|256×256|UI top-left (0,0)|
|wave14/candidates-v1/assets/seals/seal_town_round.png|public/assets/wave14/seals/seal_town_round.png|256×256|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-frames/frame_charter-v1.png|public/assets/wave14/ui-frames/frame_charter-v1.png|512×640|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-frames/frame_faction_panel-v1.png|public/assets/wave14/ui-frames/frame_faction_panel-v1.png|384×256|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-frames/frame_grievance_ledger-v1.png|public/assets/wave14/ui-frames/frame_grievance_ledger-v1.png|384×512|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-icons/icon_faction_church-v1.png|public/assets/wave14/ui-icons/icon_faction_church-v1.png|96×96|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-icons/icon_faction_commune-v1.png|public/assets/wave14/ui-icons/icon_faction_commune-v1.png|96×96|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-icons/icon_faction_crown-v1.png|public/assets/wave14/ui-icons/icon_faction_crown-v1.png|96×96|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-icons/icon_faction_lord_household-v1.png|public/assets/wave14/ui-icons/icon_faction_lord_household-v1.png|96×96|UI top-left (0,0)|
|wave14/candidates-v1/assets/ui-icons/icon_faction_merchant_elite-v1.png|public/assets/wave14/ui-icons/icon_faction_merchant_elite-v1.png|96×96|UI top-left (0,0)|
|wave14/texture-rework-20260926/assets/merchant/merchant_carved_texture.png|public/assets/wave14/merchant/merchant_carved_texture.png|128×128|UI top-left (0,0)|


## 용량과 공통 처리

이 실행 묶음 15장: 메타데이터 제거 후 원본 합계 1.08 MiB, 원본 RGBA 한 벌 산술 합계 3.36 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

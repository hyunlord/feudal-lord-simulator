# 목축 작업자와 도구

분류 B · 12장 · 관련 작업 LM-R3 / CLOTH-UI · 예상 5–10 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/render/walkerLook.ts:24 WalkerOccupation; src/render/walkerLook.ts:102 walkerCandidates; src/render/walkerComposer.ts:188 walkerAppearance; src/content/buildingConfig.ts:25 pastoral_farm

## 연결·자리·선택

목축 작업자 역할을 existing pastoral job에 한정해서 worker manifest에 연결한다. drover/goosegirl/swineherd/packhorse_leader를 일반 농부로 전부 풀지 않는다. 도구 goad/whip은 해당 실제 가축 유도 시에만 선택하고 동물 기능 전엔 숨긴다.

## 확인할 장면·줌·계절

작업 역할 각 4방향2프레임, 남녀 template 등록; 줌0.6 도구를 줄이고 1.0/1.4 손과 무기 크기 검증. 동물 기능 의존은 별도 표기.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave13/candidates-v1/assets/work/work_goad_ne-v1.png|public/assets/wave13/work/work_goad_ne-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_goad_nw-v1.png|public/assets/wave13/work/work_goad_nw-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_goad_se-v1.png|public/assets/wave13/work/work_goad_se-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_goad_sw-v1.png|public/assets/wave13/work/work_goad_sw-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_whip_ne-v1.png|public/assets/wave13/work/work_whip_ne-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_whip_nw-v1.png|public/assets/wave13/work/work_whip_nw-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_whip_se-v1.png|public/assets/wave13/work/work_whip_se-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/work/work_whip_sw-v1.png|public/assets/wave13/work/work_whip_sw-v1.png|48×48|{"cell":[48,48],"pivot":[24,24]}|
|wave13/candidates-v1/assets/workers/wk_drover_m-v1.png|public/assets/wave13/workers/wk_drover_m-v1.png|296×148|{"cell":[74,74],"pivot":[37,69]}|
|wave13/candidates-v1/assets/workers/wk_goosegirl_f-v1.png|public/assets/wave13/workers/wk_goosegirl_f-v1.png|296×148|{"cell":[74,74],"pivot":[37,69]}|
|wave13/candidates-v1/assets/workers/wk_packhorse_leader-v1.png|public/assets/wave13/workers/wk_packhorse_leader-v1.png|296×148|{"cell":[74,74],"pivot":[37,69]}|
|wave13/candidates-v1/assets/workers/wk_swineherd_m-v1.png|public/assets/wave13/workers/wk_swineherd_m-v1.png|296×148|{"cell":[74,74],"pivot":[37,69]}|


## 용량과 공통 처리

이 실행 묶음 12장: 메타데이터 제거 후 원본 합계 0.14 MiB, 원본 RGBA 한 벌 산술 합계 0.74 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

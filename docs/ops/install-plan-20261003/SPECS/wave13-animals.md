# 동물·가축 무리 이동

분류 C · 14장 · 관련 작업 향후 가축/운송 시각화 · 예상 20–40 작업시간(사람 시간, 실측 아님).

## 코드 근거

src/agents/walker.types.ts; src/render/walkerComposer.ts:223 drawComposedWalker; src/render/animalScale.ts; src/render/zoneLayer.ts:95 buildZoneLayer

## 연결·자리·선택

사람 워커와 별개인 동물 이동·정지·군집·방향·가려짐·발 앵커 기능이 필요하다. 사람 슬롯에 동물 시트를 넣지 않는다. 4방향×2프레임을 따로 절단하고 metadata의 cell/pivot을 사용; 무리는 이동 경로 폭을 확보하고 건물 지붕 위로 그리지 않는다.

## 확인할 장면·줌·계절

다섯 땅 방목지/도시 도로; 동물 모두 방향4·프레임2, 20frame 이동 확인; 0.6 무리 silhouette만, 1.0/1.4 다리·접지.

## 파일별 설치 계약

폭·높이는 원본 PNG 실측. 원본은 유지하고 runtime C2PA만 제거; 제거 뒤 runtimeSha256를 새로 계산한다. proposed installed_by는 설치·시각 검증을 마친 뒤에만 기록한다. flip 금지.

|원본 inbox 상대 경로|대상|크기|피벗|
|---|---|---|---|
|wave13/candidates-v1/assets/animal_walk/cow_single-v1.png|public/assets/wave13/animal_walk/cow_single-v1.png|320×128|{"cell":[80,64],"pivot":[40,60]}|
|wave13/candidates-v1/assets/animal_walk/dog_herding-v1.png|public/assets/wave13/animal_walk/dog_herding-v1.png|160×64|{"cell":[40,32],"pivot":[20,28]}|
|wave13/candidates-v1/assets/animal_walk/goose_single-v1.png|public/assets/wave13/animal_walk/goose_single-v1.png|128×64|{"cell":[32,32],"pivot":[16,28]}|
|wave13/candidates-v1/assets/animal_walk/horse_draught-v1.png|public/assets/wave13/animal_walk/horse_draught-v1.png|384×160|{"cell":[96,80],"pivot":[48,76]}|
|wave13/candidates-v1/assets/animal_walk/horse_riding-v1.png|public/assets/wave13/animal_walk/horse_riding-v1.png|384×160|{"cell":[96,80],"pivot":[48,76]}|
|wave13/candidates-v1/assets/animal_walk/ox-v1.png|public/assets/wave13/animal_walk/ox-v1.png|384×148|{"cell":[96,74],"pivot":[48,70]}|
|wave13/candidates-v1/assets/animal_walk/pig_single-v1.png|public/assets/wave13/animal_walk/pig_single-v1.png|192×80|{"cell":[48,40],"pivot":[24,36]}|
|wave13/candidates-v1/assets/animal_walk/sheep_single-v1.png|public/assets/wave13/animal_walk/sheep_single-v1.png|192×80|{"cell":[48,40],"pivot":[24,36]}|
|wave13/candidates-v1/assets/herd/cattle_drove-v1.png|public/assets/wave13/herd/cattle_drove-v1.png|768×144|{"cell":[192,144],"pivot":[96,95]}|
|wave13/candidates-v1/assets/herd/goose_flock_a-v1.png|public/assets/wave13/herd/goose_flock_a-v1.png|384×74|{"cell":[96,74],"pivot":[48,49]}|
|wave13/candidates-v1/assets/herd/goose_flock_b-v1.png|public/assets/wave13/herd/goose_flock_b-v1.png|384×74|{"cell":[96,74],"pivot":[48,49]}|
|wave13/candidates-v1/assets/herd/pig_cluster-v1.png|public/assets/wave13/herd/pig_cluster-v1.png|512×96|{"cell":[128,96],"pivot":[64,63]}|
|wave13/candidates-v1/assets/herd/sheep_cluster_moving_a-v1.png|public/assets/wave13/herd/sheep_cluster_moving_a-v1.png|512×96|{"cell":[128,96],"pivot":[64,63]}|
|wave13/candidates-v1/assets/herd/sheep_cluster_moving_b-v1.png|public/assets/wave13/herd/sheep_cluster_moving_b-v1.png|576×112|{"cell":[144,112],"pivot":[72,74]}|


## 용량과 공통 처리

이 실행 묶음 14장: 메타데이터 제거 후 원본 합계 0.43 MiB, 원본 RGBA 한 벌 산술 합계 2.29 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

# C 버려진 땅 — 10장 검수

- 제작: image_gen.imagegen 개별10콜. 기존 project tree_oak_large 및 ridge_fallow 참조. 여름5개를 새로 제작한 뒤 각각 겨울 편집5콜. 좌우/상하 뒤집기0, 회전0.
- 10개 모두128×160 RGBA PNG, 공통 지면중심(64,120), 논리1칸128×64. 본체는 가로120px로 안전여백4px 확보. 최하 접지는152px. 울타리도 같은 캔버스로 통일.
- 동일 계절쌍의 공통 union crop과 동일 uniform scale/placement 사용. 원본 여름/겨울 각각 bbox-fit하지 않음. 생성 겨울에서 풀끝 일부 변화는 계절 변화로 허용하며 픽셀동일 실루엣 보장은 하지 않음.
- alpha 최소0/최대255, 캔버스4변 alpha0, 잘림 없음. 최종이미지를 밝은/어두운 바탕 actual-size 두 판에서 직접 확인.
- 낮은 풀 → 뭉친 가시덤불 → 수직 어린나무의 형태 차이 확인. 겨울 나뭇가지와 얇은 적설, 풀의 황갈색 변화 확인. 울타리의 기둥/부러진 살대와 겨울 대응 위치 유지. 버려진 이랑의 NE 방향 유지.
- 바닥은 지면두께가 없는 불규칙 식생/흙 흔적이며 투명 외곽과 미세 식생 틈을 유지. 식생이 빽빽한 부분은 베이스를 가림. 렌더러에서 추가 투명도 낮춤 여부는 실제 게임 합성 후 결정.
- proofs/abandoned-light-actual.png 및 abandoned-dark-actual.png 순서는 grass summer/winter, bramble summer/winter, saplings summer/winter, collapsed_fence summer/winter, overgrown_furrows summer/winter.
- 오프라인 PNG/시각검수 결과이며 실제 엔진 줌/충돌/인접필지 가림 검증은 미실시. 게임 미설치, 모두candidate.

# Wave 3 A 지면·모듈 자체 검수

- 산출물: 10 PNG, candidate. 게임 설치 없음.
- 실제 native imagegen 호출: 14회, 최종 선택 10장. 첫 growing 요청 결과가 담황 성숙 이삭으로 나와 ripe_a로 채택하고 green growing을 별도 생성했음. 이후 독립 검수에서 보리의 대칭 fan/땋은 리듬 지적을 받아 4장 전부 개별 굽은 줄기와 처진 긴 수염 이삭으로 재편집. ground-sources.json attempts에 기존과 수정 원문 prompt 및 원본 경로 보존.
- 크기: strip 4장 512×64, sheepfold/shearing 256×192, wash_pool 192×128, tenter 3장 384×192. 자동 확인 통과.
- 알파: 모두 진짜 RGBA. strip X 여백 없음, Y 8px 투명; 모듈 사방 8px 투명. 여백 위반 픽셀 0.
- X 반복: 4장 좌우 endpoint RGBA 최대 차 0. ground-seams.png의 3회 반복에서 끊김 없음. 반복하는 작물 자체의 리듬은 존재하며 a/b 교대와 세계 offset 혼용을 전제로 함.
- 0.3 배율: growing과 ripe 구별 가능. 보리의 긴 수염 개별 선은 작아지나 고개 숙인 이삭 덩어리는 유지. 대칭 쌍으로 된 두 줄 fan을 제거하고 하나의 불규칙한 작물띠로 교정. b는 더 큰 빈 흙 간격과 낮은 줄기를 사용. 원본 단계의 작은 붓 결은 의미 없는 질감으로 축소됨.
- 우리: 빈 sheepfold와 전면 밝은 양털을 가진 shearing_pen은 0.3에서 구별 가능. sheepfold는 동물이 따로 들어가는 빈 모듈.
- wash_pool: 돌 테두리와 얕은 회녹색 수면, 열린 진입부 식별 가능.
- tenter: a 빈 틀 / b 무염색 직물 / dyed 저채도 청·적·황 직물 구별 가능. 천은 틀 안에서 팽팽히 걸린 형태. a를 edit target으로 b와 dyed 제작.
- 광원·역사: 좌상단 부드러운 빛, 낮은 접지, 긴 그림자 없음. 홉·현대 장비·철망·문자·사람 없음.
- 피벗: strip center; 모듈 bottom-center (W/2,H-8). 부속 socket·게임 점유 판정 검증은 수행하지 않았음.
- 검수는 정적 이미지/오프라인 합성 범위. 실제 게임 성능·가림·점유 테스트 아님.

## 최종 색 보정
- growing a/b에 native 색상 전용 편집 2회 추가: 이삭·수염·잎을 녹색으로 바꾸고 흙과 형태 유지. 총 native 16회, 10장 선택. growing의 attempts는 최초→형태교정→색교정 3개 전부 보존.
- 최종 0.3 배율에서 growing 녹색과 ripe 담황색 차이 확인. 여전히 양식화된 큰 아치 형태의 리듬은 남으므로 식물학적 세부가 저배율에서도 모두 판별된다고 주장하지 않음. 대칭 fan·braid는 제거되었고 개별 처진 이삭 형태로 개선됨.

# Wave 39 생성 기록 계약

수량은 비 22, 웅덩이 8, 떨어지는 잎 12, 낙엽 더미·눈 16의 총 58행이다. 의뢰서에서 합계가 모호한 튐 6장은 흙·돌길·지붕 × 작음·큼으로, 더미 8장은 나무 밑 4 + 바람에 몰린 줄 2 + 물 위 1 + 지붕 위 1로 해석했다.

CSV는 기존 출처 27열에 kind, frameWidth, frameHeight, frameCount, recommendedAlpha, speedPxPerSec, windTiltDegrees, lifetimeSeconds, encodedPeakAlpha를 더한 36열이다. width/height는 전체 PNG, frameWidth/Height는 한 프레임, pivot은 한 프레임 안 좌표이다. 프레임은 왼쪽부터 오른쪽, 여러 행이면 위에서 아래 순서다.

권장 값은 엔진 적용을 위한 제안이며 런타임에서 검증한 설정이 아니다. 알파는 PNG에 이미 기록된 알파에 곱하는 0~1 값, encodedPeakAlpha는 실제 PNG 최대 알파 0~255이다. 속도 단위는 타일128×64·줌1.0 기준 px/s, 기울기는 수직 기준 시계방향 도(degree), 수명은 초다. 정적인 데칼은 속도0이며 수명은 날씨·상태에 따라 엔진이 관리한다. 애니메이션 재생 시간과 세계 이동 속도는 구분한다.

게임 파일 수정·설치 없이 출처와 PNG를 검증했다. 프레임 픽셀 해시 차이는 프레임 내용 차이만 증명하며 자연스러운 운동이나 정렬까지 보증하지 않는다. 시각 판정은 별도 검수표를 따른다.

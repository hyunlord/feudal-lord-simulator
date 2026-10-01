# Wave38 재작업 검수

- [x] 요청5장: primary normal/hover/pressed/disabled + tab_hover.
- [x] 원본 수정없음.5장 모두128×40 PNG. 원본 대비 alpha변경0픽셀.
- [x] 주버튼4상태 바탕 짙은oak. 보조4상태와 식별됨.
- [x] tab_hover 중앙 상대휘도0.381 < selected0.727.
- [x] 원래 프레임 외곽·9slice·최소크기·text_safe 보존.
- [x] 실제Chrome에서15px 라벨, 최소64×40/기준128×40/가로256×40/세로160×64 확인.
- [x] 독립 시각검수PASS. 수치검수 qa/metrics.json.
- [x] 생성 프롬프트/원본·참조·출력해시/가공기록 보존.

처리: 내장image_gen으로 각각 편집 후, 생성면을 기존프레임 안쪽에 정규화하고 텍스트영역은 단색화. 기존외곽alpha를 그대로 유지. 게임설치와실제상태전환 검증없음.

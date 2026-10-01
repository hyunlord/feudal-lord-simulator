# QA ROUND 03
기준 `4386ac1a` · 일반 URL · 제품 변경 없음. 담당은 추정. 종결·미재현·미확인은 REGRESSION.md 참조.

- QA-003 · 연결 식별 · 눈에 띔 · 렌더 추정 · 1380 봄/tick 320000/줌 2/카메라(544,-2277): 수평벽 끝과 사선벽 사이(x750~790,y490~545)가 문인지 틈인지 불명확; 논리 단절 미확정(20-latest-city1380.jpg).
- QA-005 · 가림 · 눈에 띔 · 렌더 추정 · 1380 봄/tick 320000대/줌 2/카메라(544,-2277): 북서 성벽 면(x430~455,y195~235)에 이동 인물이 겹침; 논리 통과 미확정(wall-person20-contact.jpg + wall-crossing-detail.gif).
- QA-010 · 나이·호칭 · 눈에 띔 · 엔진 추정 · 1380 가을 연대기에 ‘나이 든 앨리스 해치 —29살에 세상을 떠났다’; 1394 길드 청원인에 ‘젊은 존 리처드슨 109살’(28-chronicle.jpg,68-guild-conflict.jpg).
- QA-012 · 계절 전환 · 눈에 띔 · 렌더 추정 · 1380 가을→겨울/1381 봄/줌 1.199/카메라(647,-611): 약0.6초 동안 큰 직선 패치와 신·구계절 혼합; 주달력 지연은 미재현(season-boundary-frames.jpg + season-to-winter.gif/season-to-spring.gif).
- QA-014 · 영문 역할 · 사소 · 엔진 추정 · 1384 여름/tick 337157 국왕 과세→카드·전기에 ‘가구주 · king’,1424 봄 권리 장부에 townsfolk 노출(55-royal-person.jpg,56-royal-biography.jpg,102-rights-role-english.jpg).
- QA-015 · 전기 틀 · 사소 · 렌더 추정 · 같은 국왕 전기에서 ‘아직 남긴 기록이 없습니다’가 가운데 세로 장식선에 겹침(56-royal-biography.jpg).
- QA-016 · 결정 버튼 겹침 · 사소 · 렌더 추정 · 1394 봄/tick 376156 길드 결정창에서 보류 버튼이 두번째 선택지 하단 테두리를 약11~12px 덮음;1600×1100·1280×720 재현, 클릭 실패 미확정(68-guild-conflict.jpg,69-guild1280.jpg).
- QA-017 · 화면 밖 조작부 · 막음(375px 분류) · 렌더 추정 · 1301 여름 안내 완료→건설→생업,1600에서375×812로 축소하면 상단 분류 y=-864; 재열기·위 스크롤로 복구 안 됨,1600 복원 정상(newgame-production-375.jpg + newgame-375-build-overflow-frames.jpg/GIF).
- QA-018 · 설정 글 겹침 · 사소 · 렌더 추정 · 1415 겨울/tick 463957/1280×720 설정에서 튜토리얼 설명과 ‘화면 소리100%’ 제목이 포개짐; 재열기 지속,1600에서는 분리(96-settings1280.jpg,98-settings1280-reopened.jpg).

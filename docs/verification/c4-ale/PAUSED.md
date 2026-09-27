# C4 에일 사슬 — 멈춤 (2026-09-27)

- 사용자 판정: C4는 미루고 F2-A → FACTION-0을 먼저 한다.
- 막힌 이유: `ResourceType`에 보리·말트·에일을 넣으면 렌더·UI 23개 파일의 전수 표(이름·색·창고 이름)가 타입 검사에서 깨진다. 목록은 [type-impact.txt](type-impact.txt)(파일별 오류 수)에 있다.
- 다시 이어 가는 조건: 렌더 세션이 자원 목록을 `content/resourceCatalog.ts` 한 곳으로 모으는 작업을 끝낸다. 그다음 C4는 그 목록에 보리·말트·에일 줄만 넣는다.
- 이 브랜치의 코드 변경은 `src/content/resourceConfig.ts`의 형 넓히기 시험 하나뿐이다(타입 검사 실패 상태, 본선에 합치지 않는다).

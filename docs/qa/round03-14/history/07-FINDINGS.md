# QA ROUND 07 — 이번 재현

**고유 재현 17개, 신규 확정 ID 없음.** 회귀표 실패 18행은 UI-02 중복을 포함한다.010의 실패는 기존 저장에 한정한다. fresh7은 신규 큰/작은 호칭과 일부 생년·나이 일치를 확인했다.022는 버려진 밭 사건에서 같은 유형으로 재현했다. 담당은 추정이며 원인 확정이 아니다.

- **QA003 · 중간 · 그림·렌더 추정** — 동일 칸(45,42)의 고리는 닫혔지만 벽 끝/문의 시각 연결 판독 문제를 재관찰했다. 논리 단절로 확정하지 않는다. JPEG (원문 경로: evidence/wall7-same003-valid.jpg) · 재현 (원문 경로: repro/wall7-observation.md)
- **QA005 · 중간 · 렌더 추정** — 벽 표본의 별도 파란 수레와 지붕 표본0070~79의 흰 운반체가 표면에 겹친다. 지붕 클릭은 방앗간이므로 인물 ID·논리 경로는 미확정이다. JPEG (원문 경로: evidence/roof7-person-unfolded.jpg) · 재현 (원문 경로: repro/roof7-review.md) · GIF (원문 경로: evidence/roof7-person.gif)
- **QA010 · 낮음 · 엔진 추정** — 기존 저장의 나이 든 존/26살 및 젊은 토머스/82살을 재관찰했다. 새 게임에서는 큰/작은 레티시아를 확인했으며 구저장 호칭과 동일시하지 않는다. 전체 신규 명명 규칙 통과는 미판정이다. JPEG (원문 경로: evidence/ui7-03-person1600.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA012 · 중간 · 렌더 추정** — 1337 가을→겨울5배속0017→0018에 회색/황토색 대각 직선 지면 패치가 나타났다 사라진다. 객체별 전환 시차와 내부 원인을 구분한다. JPEG (원문 경로: evidence/season7-fall-winter-unfolded.jpg) · 재현 (원문 경로: repro/season7-review.md) · GIF (원문 경로: evidence/season7-fall-winter.gif)
- **QA013 · 중간 · 렌더 추정** — 375 목표판 펼침/접기가 칩 클릭을 막으며 건설 토글로 복구된다. 결말375 달력 닫기 가림은 기존 패널 가림의 보충 표본으로 기록한다. JPEG (원문 경로: evidence/prep7-goal375-expanded.jpg) · 재현 (원문 경로: repro/prep7-observation.md)
- **QA014 · 낮음 · 렌더 추정** — 권리 townsfolk 및 국왕 카드·전기 king이 노출된다. JPEG (원문 경로: evidence/ui7-02-rights1600.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA015 · 낮음 · 렌더 추정** — 국왕 빈 전기 문구가 세로 장식선과 겹친다. JPEG (원문 경로: evidence/ui7-27-king-empty1600.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA016 · 중간 · 렌더 추정** — 1394 길드1600/1280/768의 보류 버튼이 선택지 테두리를 덮는다.375는 휠 후 접근 가능했다. JPEG (원문 경로: evidence/ui7-36-guild1280.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA017 · 중간 · 렌더 추정** — 375 fresh 생업 분류y−864는 재열기/위 휠로 복구되지 않는다.768에서는 클릭됐다. JPEG (원문 경로: evidence/prep7-production375-reopen.jpg) · 재현 (원문 경로: repro/prep7-observation.md)
- **QA018 · 낮음 · 렌더 추정** — 1280/375 설정 설명·소리 제목이 겹치며768 fresh에서는 분리된다. JPEG (원문 경로: evidence/ui7-09-settings1280.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA019 · 중간 · 렌더 추정** — 1280 설정 표적 오른쪽32px가 화면 밖이다.375/768 fresh는 화면 안이다. JPEG (원문 경로: evidence/ui7-09-settings1280.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA020 · 낮음 · 렌더 추정** — 가계도 이름 둘째줄 하단이1600/1280/768/375에서 잘린다. JPEG (원문 경로: evidence/ui7-05-tree1600.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA021 · 낮음 · 렌더 추정** — 봄 헛간의 기본/Tab 닫기 기호는 식별이 어렵고 호버에서 보인다. 실제 클릭 닫기는 성공했다. JPEG (원문 경로: evidence/ui7-22-facility1600.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA022 · 낮음 · 렌더/UI 추정** — 버려진 밭 사건의 더 보기는 본문·그림을 늘리지 않고 버튼만 없애며 카드 높이를 약 50px 줄였다. 첫 겨울과 다른 사건 표본이다. 전 JPEG (원문 경로: evidence/50-abandoned-fields.jpg) · 후 JPEG (원문 경로: evidence/51-abandoned-fields-more.jpg)
- **QA023 · 중간 · 렌더 추정** — 375 헛간/과세 칩이 닫기 하단을 가려(345,124) 클릭이 사건 카드를 연다. QA 켬/끔 모두 같으며 원래 운반인 표본과는 다르다. JPEG (원문 경로: evidence/ui7-32-close-lower-action.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA024 · 중간 · 렌더 추정** — 375 fresh 인물 닫기 전체가 창밖이며 가로 휠로 복구되지 않는다. Tab 초점도 밖이지만 Enter로 닫혀 완전 조작 불능은 아니다. JPEG (원문 경로: evidence/ui7-13-person375-close-focus.jpg) · 재현 (원문 경로: repro/ui7-observation.md)
- **QA025 · 중간 · 렌더/UI 추정** — 1407 및1347 목표 보기 클릭이 소개 없이 정지를1배속으로 해제했다. JPEG (원문 경로: evidence/ui7-20-goal-after-qa.jpg) · 재현 (원문 경로: repro/prep7-observation.md)

011 동일 길드/교회 쌍은 이번에도 구별돼 닫힘을 유지한다.004의315.522초와007의 추가 침범 미재현은 수정 입증이 아니다. 새 지면-02는 정지 상태의 반복 무늬 후보이며012 계절 전환 띠와 구분한다. 결말 달력 가림에 새 ID를 부여하지 않았다(추가 표본 (원문 경로: evidence/ending7-calendar375-close-blocked.jpg), 관찰 (원문 경로: repro/ending7-observation.md)).

계보-02의 새 게임 자녀선·전기 부모 차이와 계보-03의 부모 19살/자녀 14살 표시는 관계 설명 후보다. 1306년 혼인 기록은 있지만 의붓·입양 설명을 찾지 못했으며 생물학적 오류로 확정하지 않는다. 새 게임 관찰 (원문 경로: repro/fresh7-observation.md). 사망한 대표의 표시 시차도 후보다. 대표는 다음 계절에 교체됐으며 신규 확정 결함 ID를 추가하지 않았다. 검토 (원문 경로: repro/leader7-review.md).

같은 가족의 책·딸 전기·부모·배우자 링크 대조는 이름과 생년이 일치했다. 책의 부부 세대 차이와 가계도의 반복 노드·고리는 계보-01/02의 관계 가독성 후보로 남겼다. 후속 관찰 68~75 (원문 경로: repro/root-observations.md). 겨울→봄 추가 표본의 객체별 눈 전환 시차를 QA012 대각 띠의 재현으로 세지 않았으며, 선택 수레 2명 160장을 추가해도 다리 교대는 미검증이다. 계절 (원문 경로: repro/spring7-review.md) · 보행 (원문 경로: repro/gait7-review.md).

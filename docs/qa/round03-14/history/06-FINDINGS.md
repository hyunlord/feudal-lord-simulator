# QA ROUND 06 — 이번에 재현한 결함

**고유 결함17개, 신규024·025.** 회귀표의 실패18행에는 UI-02가 다른 UI 결함을 다시 포함한다. 담당은 추정이며 구현 원인 확정이 아니다. 조건·조작·빠진 측정값은 회귀표 (원문 경로: REGRESSION.md)와 각 관찰문을 함께 본다.

- **QA003 · 중간 · 그림·렌더 추정** — 동일 클릭(768,516)→칸(45,42)의 성벽은19/19 완공·방어100%이지만 끝 기둥과 아치 사이를 문인지 단절인지 구별하기 어렵다. 논리 단절은 미확정(JPEG (원문 경로: evidence/wall6-same003.jpg), 재현 (원문 경로: repro/wall6-observation.md)).
- **QA005 · 중간 · 렌더 추정** — tick320025, 줌2에서 선택한 배급자 에이비스의 몸과 기둥이 겹치며 별도 미선택 수레도 벽면에 높게 보인다. 논리 경로 오류와 구분한다(JPEG (원문 경로: evidence/wall6-wall-foot-compare.jpg), GIF (원문 경로: evidence/wall6-selected40.gif), 펼침 (원문 경로: evidence/wall6-selected40-unfolded.jpg), 재현 (원문 경로: repro/wall6-observation.md)).
- **QA010 · 낮음 · 엔진 추정** — 1407 존의 ‘나이 든/26살’, 새 임금 선택 후 연대기의 ‘나이 든 크리스티나/2살’처럼 호칭과 나이가 어긋난다. 명명 원인은 조사하지 않았다(JPEG (원문 경로: evidence/ui6-02-person1600.jpg), 재현 (원문 경로: repro/root-observations.md)).
- **QA012 · 중간 · 렌더 추정** — 고정 줌2·카메라(544,-2277), 가을→겨울5배속의0011에서 좌하단 회색/황토색 대각 직선 경계가 나타나0014까지 겨울색이 넓어진다. 앞선 겨울→봄 표본에서는 같은 띠를 확인하지 못했다(원본 JPEG (원문 경로: evidence/rain6-speed5-boundary.jpg), GIF (원문 경로: evidence/rain6-speed5.gif), 펼침 (원문 경로: evidence/rain6-speed5-unfolded.jpg), 독립 검토 (원문 경로: repro/rain6-speed-review.md)).
- **QA013 · 중간 · 렌더 추정** — 1316 목표판375에서 펼침·접기 모두 사건 칩 클릭을 막는다. 건설 열기→닫기로 복구돼 영구 차단은 아니다(전 (원문 경로: evidence/prep6-goal375-expanded.jpg), 복구 (원문 경로: evidence/prep6-goal375-build-recovery.jpg), 재현 (원문 경로: repro/prep6-observation.md)).
- **QA014 · 낮음 · 렌더 추정** — 권리의 townsfolk와 국왕 카드·전기의 king이 한국어 직함 대신 보인다(JPEG (원문 경로: evidence/ui6-01-rights1600.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA015 · 낮음 · 렌더 추정** — 국왕의 빈 전기 문구가 세로 장식선과 겹친다.1600 및 정착 후768·375에서 확인했다(JPEG (원문 경로: evidence/ui6-23-empty1600.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA016 · 중간 · 렌더 추정** — 동일1394 길드 결정창의 보류 버튼이 선택지와 겹친다.1280에서 선택지 하단604·보류 상단592로12px이며,375에서는 휠 후 실제 보류 클릭에 성공했다(JPEG (원문 경로: evidence/ui6-38-guild1280.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA017 · 중간 · 렌더 추정** — 375 fresh 생업 메뉴의 생활 분류가 y−864로 벗어나 닫기·재열기·위 휠로도 돌아오지 않는다. 하단 닫기는 가능하고768에서는 정상 클릭된다(JPEG (원문 경로: evidence/prep6-fresh375-production-reopen-scroll.jpg), 재현 (원문 경로: repro/prep6-observation.md)).
- **QA018 · 낮음 · 렌더 추정** — 1280 resize·375 fresh 설정에서 튜토리얼 설명과 소리 제목이 겹치며768 fresh에서는 분리된다(JPEG (원문 경로: evidence/ui6-07-settings1280-resize.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA019 · 중간 · 렌더 추정** — 1280 설정 버튼 x1268·폭44 중32px가 화면 밖이다.375/768 fresh 표본은 화면 안에 있고 클릭된다(JPEG (원문 경로: evidence/ui6-07-settings1280-resize.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA020 · 낮음 · 렌더 추정** — 1407 가계도 자손8명의 이름 둘째줄 하단이1600/768/375에서 잘린다. 전기를 통한 전체 이름 접근과는 별개다(JPEG (원문 경로: evidence/ui6-03-tree1600.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA021 · 낮음 · 렌더 추정** — 헛간(41,43)의 기본·Tab 초점에서는 닫기×가 잘 읽히지 않고 호버에서 보인다. Enter 닫기는 성공했다(JPEG (원문 경로: evidence/ui6-27-barn-normal1600.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA022 · 낮음 · 렌더 추정** — 첫 겨울과 국왕 전령의 더 보기 전후 본문·삽화는 같고 버튼만 사라진다(첫 겨울 전 (원문 경로: evidence/ui6-19-winter375-before.jpg), 후 (원문 경로: evidence/ui6-20-winter375-after.jpg), 추가 재현 (원문 경로: repro/root-observations.md)).
- **QA023 · 중간 · 렌더 추정** — 1385 헛간·국왕 과세 칩의375 화면에서 제목·닫기 하단이 가려지고 영역 안(345,124) 클릭이 사건 카드를 연다. QA를 꺼도 같으며 칩 제거 후 닫힘을 겹침 중 성공으로 해석하지 않는다(JPEG (원문 경로: evidence/ui6-33-close-lower-opens-event.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA024 · 중간 · 렌더 추정 · 신규** — 375 fresh 존 카드의 닫기 표적 x406.078,y486,55.922×44가 완전히 화면 밖이다. 가로 휠은 실패하지만 Tab12회 후 Enter 또는 Escape로 닫을 수 있어 완전 조작 불능은 아니다(JPEG (원문 경로: evidence/ui6-35-person375-keyboard-close-focus.jpg), 복구 (원문 경로: evidence/ui6-36-person375-keyboard-closed.jpg), 재현 (원문 경로: repro/ui6-observation.md)).
- **QA025 · 중간 · 렌더/UI 추정 · 신규** — 목표 보기 클릭 후 소개 없이 정지가1배속으로 풀린다.3장197009→197044, 독립195370→195440 및5장591597→591606에서 재현했다(5장 전 (원문 경로: evidence/ending6-32-goal1447-expanded.jpg), 후 (원문 경로: evidence/ending6-33-goal1447-clicked.jpg), 재현 (원문 경로: repro/ending6-observation.md)).

QA011은 이번1394 길드와1396 교회 동일 사건쌍의 그림이 구별돼 닫힘을 유지한다.004의 연속327.552초 및007의 새로운 물가 결함 미재현은 수정 입증이 아니다. 초상 불일치 의심은 확대·독립 판독으로 철회했으며025는 초상이 아니라 목표 보기 문제다(초상 검토 (원문 경로: repro/portrait6-review.md)). 양모 공납 보류 후 늦게 생긴 재정 변화는 연대기의 미응답 결과와 구분되므로 클릭 결함으로 추가하지 않는다.

푸른 비의 화풍, 겨울 질감 반복, 빈 결산 칸, 역병 공용 그림, 계보 관계 가독성 및 고인 청원의 선후는 후보·미확정으로 남긴다. 제품 코드 변경과 성능 측정은 없다.

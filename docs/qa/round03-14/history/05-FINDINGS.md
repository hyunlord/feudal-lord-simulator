# QA ROUND 05 — 이번 실제 재현

기준 `e6d08a6e61613aa63a1b6db014c33ab5e8893bac`. 이번 확인한 **고유 결함15개**, 신규는022·023 두 개다. 원인 담당은 추정이며 코드 원인 확정이 아니다. REGRESSION의 실패16행은 UI-02가018/020을 다시 포함하므로 고유 결함 수와 다르다.009는 임금/빈필지 네 선택지에서 빈 예측 미재현이나 기존 동일 사건은 미검증이며,011은 동일1394/1396 사건쌍 통과·닫힘을 확인했다.

- **QA003 · 연결 판독 · 중간 · 담당 그림·렌더 추정** — 1380봄 tick320000,줌2,pan(544,-2277),동일 클릭(768,516)→칸(45,42),성벽 `palisade-000041-segment-000`: 끝 기둥/아치 사이 공간을 문/단절로 구분하기 어려움. 상세는19/19완공·방어100%이므로 논리 단절 확정 아님(원본 (원문 경로: evidence/wall5-same003.jpg), 재현 (원문 경로: repro/wall5-observation.md)).
- **QA005 · 가림 · 중간 · 담당 렌더 추정** — 1380봄 tick320027,줌2,pan(544,-2277),클릭(421,229): 배급자 에이비스 밀러 `distributor:construction-site-000073:319560`의 발/하체가 성벽 면에 겹침; 선택 ID·귀환 이동 확인, 경로 충돌 원인 미확정(JPEG (원문 경로: evidence/wall5-red-click-421-229.jpg), GIF (원문 경로: evidence/wall5-selected-red40.gif), 전체 프레임판 (원문 경로: evidence/wall5-selected-red40-unfolded.jpg)).
- **QA010 · 호칭/나이 · 낮음 · 담당 엔진 추정** — 1407 ‘나이 든 존·26살’,1394봄 tick376158 ‘젊은 토머스·82살’ 재현; UI 검사라 월드 좌표 해당 없음, 명명 원인 미조사(26살 (원문 경로: evidence/ui5-03-person.jpg), 82살 (원문 경로: evidence/ui5-41-guild1394.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA012 · 계절 지면 전환 · 중간 · 담당 렌더 추정** — 새 게임1× 여름→가을0510~0517,가을→겨울0413~0420에서 각진 큰 지면 색 띠가 순차 교체; 단순 작물 교체와 구분, 엔진 원인 미확정(여름→가을 (원문 경로: evidence/season5-boundary.gif), 겨울 (원문 경로: evidence/season5-winter-boundary.gif), 여름 프레임판 (원문 경로: evidence/season5-boundary-unfolded.jpg), 겨울 프레임판 (원문 경로: evidence/season5-winter-unfolded.jpg), 프레임 근거 (원문 경로: repro/season5-review.md)).
- **QA013 · 목표/사건 칩 가림 · 중간 · 담당 렌더 추정** — 원본1316 일시정지375px에서 목표가 대기근 칩 클릭을 가로챔; 접기만으로 해결 안 되지만 건설 열기→닫기로 복구 가능, 영구 차단 아님(전 (원문 경로: evidence/prep5-goal375-paused-expanded.jpg), 복구 (원문 경로: evidence/prep5-goal375-paused-build-recovery.jpg), 재현 (원문 경로: repro/prep5-observation.md)).
- **QA014 · 내부 역할 키 · 낮음 · 담당 렌더 추정** — 권리/국왕 카드·전기에 `townsfolk`/`king`이 한국어 직함 대신 노출; 해당 UI 좌표·틱은 동명 JSON, 미기록 값은 미수집(권리 (원문 경로: evidence/ui5-02-rights.jpg), 국왕 (원문 경로: evidence/ui5-22-king-card.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA015 · 빈 전기 가림 · 낮음 · 담당 렌더 추정** — 1384 과세 발신인 리처드2세의 ‘아직 남긴 기록이 없습니다’가 세로 장식선과 겹침(전기 (원문 경로: evidence/ui5-23-king-empty.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA016 · 선택지/보류 겹침 · 중간 · 담당 렌더 추정** — 정상1394봄 tick376158 동일 길드1600/1280에서 재현;1280 선택지 하단604·보류 상단592,세로12px 겹침. 실제 보류 클릭은 성공(1280 (원문 경로: evidence/ui5-42-guild1280.jpg), 클릭 후 (원문 경로: evidence/ui5-43-guild-defer-worked.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA017 · 좁은 화면 생업 접근 · 중간 · 담당 렌더 추정** — 정상1307가을176명 생업1600→375 resize,닫기/재열기/위 스크롤 후에도 생활 분류 y−864,44×44로 화면 밖; 일반 클릭 실패,하단 닫기는 가능(재열기 (원문 경로: evidence/prep5-production375-reopened-scroll.jpg), 로그 (원문 경로: repro/prep5-production375-click.json)).
- **QA018 · 설정 글자 겹침 · 낮음 · 담당 렌더 추정** — 1280×720 설정의 튜토리얼 설명과 ‘화면 소리100%’가 포개짐; 단순 하단 스크롤 잘림과 구분(설정 (원문 경로: evidence/ui5-17-settings1280.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA019 · 설정 표적 잘림 · 중간 · 담당 렌더 추정** — 1600:x1588/1280:x1268,y10,44×44 표적 중 오른쪽32px가 화면 밖; 남은12px 클릭은 성공(1600 (원문 경로: evidence/ui5-18-settings1600.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA020 · 가계도 이름 잘림 · 낮음 · 담당 렌더 추정** — 정상1407 자손8명 확장 후 조앤/윌리엄 둘째줄 하단이1600/1280에서1초 정착 뒤에도 잘림; 카드 자체는 화면 안,개별 전기로 전체 이름 읽기 가능(1600 (원문 경로: evidence/ui5-04-family-expanded1600.jpg), 1280 (원문 경로: evidence/ui5-05-family-expanded1280.jpg)).
- **QA021 · 상세 닫기 기호 · 낮음 · 담당 렌더 추정** — 헛간(44,38)·교회(44,32) 기본/Tab 초점에서× 식별 어려움,호버에서 보임; Enter/Space 닫기는 성공(기본 (원문 경로: evidence/ui5-09-barn-close-normal1280.jpg), 호버 (원문 경로: evidence/ui5-13-church-hover.jpg), 재현 (원문 경로: repro/ui5-observation.md)).
- **QA022 · 불필요한 더 보기 · 낮음 · 신규 · 담당 렌더 추정** — 1300겨울 tick3120,줌2,pan(544,-2277),일시정지 첫 겨울 카드: 추가 내용 없이 버튼만 사라지고 카드가 작아짐. 정상 저장 재진입 반복 및 독립 원본 판독 확인(전 (원문 경로: evidence/25-winter-restored.jpg), 후 (원문 경로: evidence/26-winter-restored-expanded.jpg), 독립 검토 (원문 경로: repro/event-more-review.md)).

- **QA023 · 사건 칩/인물 상세 가림 · 중간 · 신규 · 담당 렌더 추정** — 1380여름 tick321067,375×812,줌1.620,pan(-116,-1810),선택칸(51,47): 인두세 칩이 운반인 이름·닫기 아래를 가림. 닫기 안(345,127)은 사건을 엶.68은 사건 칩 제거 상태,69는 제거 후 닫힘 성공이므로 겹침 유지 중 상단 클릭 성공은 미입증. QA정보 꺼도 가림 재현(QA끔 (원문 경로: evidence/64-qa375-hidden.jpg), 오입력 (원문 경로: evidence/67-inspector-close-lower-click.jpg), 칩 제거 후 닫힘 (원문 경로: evidence/69-inspector-close-upper-worked.jpg), 재현 (원문 경로: repro/inspector-chip5-observation.md), 독립 판독 (원문 경로: repro/inspector-chip5-review.md)).

이번 미재현:001(정지·1·3·5× 각2초 특정 나무),004(자동 발전 활성 합계309.591초),006(권리 장부 표본),007(의도된 물가 배치와 별도 신규 결함 미확인). 이 결과로 기존 항목을 일괄 닫지 않는다.002 개체 동일성,009 기존 동일 사건,동물 보행은 회귀표 (원문 경로: REGRESSION.md)의 미검증을 유지한다. 빈 결산 슬롯·계보·청원자 선후·기록 문구·초점 범위는 후보이며 위 고유 결함 수에 포함하지 않았다.

**QA011 닫힘:** 1394 길드 (원문 경로: evidence/petition5-01-guild1394.jpg)와 1396 교회 (원문 경로: evidence/petition5-02-church1396.jpg)가 현재 실행 화면에서 서로 구별됨을 확인했다(동일 쌍 재현 (원문 경로: repro/petition5-observation.md)). 이번 실패15개에는 포함하지 않는다. 다른 역병 관련 공용 삽화는 별도 후보이며 이 통과로 닫지 않는다.

강우는 정지20·1×40프레임 독립 검토 (원문 경로: repro/rain5-review.md)에서 불투명 가림/직선 클리핑 미재현.0010→0011의 계절·비 동시 전환은 관찰 사실이며 신규 결함으로 확정하지 않았다. 안개/먼지 및3/5× 동일 강우는 미검증이다.

# QA ROUND 11 — 발견 기록

HEAD `265079891b074d7e023674e17984c3ac828f6c8e`. 현재 고유 재현21개·실패 기준21행이다. 같은 HEAD의 과거 결과를 이번 관측으로 복사하지 않았다.

- **QA010 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1407년 가을430090 레거시 존26살에 나이 든 호칭이 붙었다. 신규 생성 이름 전체는 미검증이다. 인물 (원문 경로: evidence/ui11-003-person.jpg) · 전기 (원문 경로: evidence/ui11-004-biography.jpg)
- **QA029 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 375 실제 연대기 목록과 닫기가 보이지 않고 실제 가로·세로 휠로 접근하지 못했다. 최초375 목록도 확보했다. Esc 복귀는 가능하다.012/013은 전기이므로 제외했다. 목록 (원문 경로: evidence/ui11-015-record-list375.jpg) · 휠 후 (원문 경로: evidence/ui11-016-record-list375-wheel.jpg) · 최초375 (원문 경로: evidence/ui11-027-records-fresh375.jpg)
- **QA018 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1280 설정 및 최초375 설정에서 튜토리얼 설명과 첫 음량 제목이 겹친다.020-settings-375는 실제 장부이므로 제외했다. 1280 (원문 경로: evidence/ui11-020-settings-1280.jpg) · 최초375 (원문 경로: evidence/ui11-026-settings-fresh375.jpg)
- **QA020 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 월터 자손8명을 펼친 정착 가계도에서 조앤·윌리엄 두 줄 이름 하단이 잘린다. 초기 로딩 표본과 구분한다. 펼침 (원문 경로: evidence/ui11-006-tree-expanded.jpg) · 왕복 후 (원문 경로: evidence/ui11-008-joan-tree.jpg)
- **QA024 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 375 인물 닫기 영역(x406.078,y486,55.922×44)이 모두 창밖이다. 실제 가로 휠 후에도 복구되지 않았고 Esc로 닫았다. 최초375 인물도 별도 확보했으나 그 조작 전체는 추가 확인이 필요하다. 인물 (원문 경로: evidence/ui11-010-person375.jpg) · 휠 (원문 경로: evidence/ui11-011-person375-wheel.jpg) · 최초375 (원문 경로: evidence/ui11-028-person-fresh375.jpg)
- **QA025 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 정지430090 목표 보기 클릭 후 소개 없이1배속으로 재개됐다. 안내 CTA의 실제 다음 안내 진행과 구분한다. 전 (원문 경로: evidence/ui11-030-goal-paused.jpg) · 후 (원문 경로: evidence/ui11-031-goal-after.jpg) · GIF (원문 경로: evidence/ui11-goal-motion.gif) · 전체 펼침 (원문 경로: evidence/ui11-goal-motion-unfold.jpg)
- **QA031 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 문제 보기 활성 상태에서 화면 범례를 읽지 못했다. QA 정보 끔 비교도 확보했다. 활성 (원문 경로: evidence/ui11-021-problems-on.jpg) · QA 끔 (원문 경로: evidence/ui11-022-problems-qaoff.jpg)

계보의 세대·배우자 가지 표기는 관찰 후보이며 데이터 오류는 미확정이다. QA028은 후속 실제 기록 존재 조건과 닫기·재열기까지 재현했다.004는18개 정적 시점,007은 물가 표본에서 미재현이며 고침을 뜻하지 않는다. 범위·한계 (원문 경로: REGRESSION.md) · UI 원문 (원문 경로: repro/ui11-observation.md).

- **QA003 · 세계 표시 · 중간 · 렌더/그림 추정** — 틱320000·줌2·칸(45,42)의 palisade-000041-segment-000에 통로처럼 읽히는 접합 틈이 있다.19/19·100%·닫힌 고리 표기와 논리 통행 검증은 구분한다. 동일 위치 (원문 경로: evidence/wall11-same003-qa.jpg)

- **QA026 · 세계 표시 · 중간 · 렌더/그림 추정** — 선택 존 carter:construction-site-000081:320198·시작320749·칸(21,32)·줌2의 남동 이동에서 다리 벌림이 유지된다. 첫32장 중 교차수레3–5/18–19·식생22이후는 중심 판독에서 제외했다. 동물은 정적 후보만 확보해 보행 미검증이다. 32장 확대 (원문 경로: evidence/wall11-john32-tracked.jpg) · GIF (원문 경로: evidence/wall11-john80.gif) · 전체 펼침 (원문 경로: evidence/wall11-john80-unfolded.jpg)

- **QA027 · 세계 표시 · 중간 · 렌더/그림 추정** — 322123가을·줌2·칸(29,17) manor-house-29-17-0이 단색 갈색 지붕·회색 다각형 벽으로 보인다. 자산 누락 등 내부 원인은 미확정이다. 실제 선택 (원문 경로: evidence/wall11-manor2.jpg)

벽 겹침 외형은 보였지만005의 동일 선택 ID 재현은 미확보다. 집 앞 인물002의 이동은 관측했으나 역할·동일성은 미확인이다. 이랑 안 수목과 곡선 지면 OFF/ON 무늬 소실은 관찰 후보로 유지한다(월드 한계 (원문 경로: repro/wall11-observation.md) · 새 게임 비교 (원문 경로: repro/root11-observation.md)).

- **QA014 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 생존 국왕 리처드2세17살 전기에 가구주·king이 보인다. 전기 (원문 경로: evidence/ui11-039-king-bio.jpg)

- **QA015 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 국왕 기록 없음 문장이 중앙 세로 장식선과 겹친다. 전기 (원문 경로: evidence/ui11-039-king-bio.jpg)

- **QA016 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1394봄376159 길드1600에서 보류 윗변이 둘째 선택지 하단 테두리를 덮는다.1280 실제 아래 휠 후 분리된 상태도 있어 접근 불능으로 확대하지 않는다. 정착 화면 (원문 경로: evidence/ui11-077-guild1600.jpg) · 동선 (원문 경로: repro/ui11-observation.md)

- **QA017 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 375 생업 첫 분류·상단 항목이 창밖이며 QA끔·위쪽 휠·닫고 재열기 후에도 복구되지 않았다. 최초375 건설은 미검증이다. 위쪽 휠 (원문 경로: evidence/ui11-064-build375-up.jpg) · 재열기 (원문 경로: evidence/ui11-065-build375-reopen.jpg)

- **QA019 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 설정 버튼이1280/1920에서 오른쪽32px 창밖이다.1280 남은 부분 클릭은 가능했다. 1280 (원문 경로: evidence/ui11-067-settings1280.jpg) · 1920 (원문 경로: evidence/ui11-068-top1920.jpg)

- **QA021 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 세계 주택 상세 닫기×가 기본·키보드 초점에서 보이지 않는다. Enter 복구와 장부 헛간의 붉은×는 구분한다. 기본 (원문 경로: evidence/ui11-044-world-facility.jpg) · 초점 (원문 경로: evidence/ui11-045-close-keyfocus.jpg)

- **QA022 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 정상1348 역병 카드의 더 보기 후 기존 본문·사망46명 요약만 남고 버튼만 사라졌다. 첫겨울 카드 만료로 전후 비교에 실패한 표본은 제외했다. 전 (원문 경로: evidence/root11-040-plague-card-before.jpg) · 후 (원문 경로: evidence/root11-041-plague-card-after.jpg)

- **QA023 · UI 표시/접근 · 중간 · 렌더/UI 추정** — 1394여름377178의375 주택 상세 제목·닫기 하단을 길드 칩이 가린다. QA끔도 같고 아래쪽 클릭은 사건을 열었지만 상단 잔여 영역 클릭으로 주택 닫기는 성공했다. 켬 (원문 경로: evidence/ui11-083-guild-chip375.jpg) · 끔 (원문 경로: evidence/ui11-084-guild-chip375-qaoff.jpg) · 조작 (원문 경로: repro/ui11-observation.md)

- **QA032 · UI 표시/접근 · 중간 · 엔진 추정** — 3장 진입 후1×68틱 진행160700→160768·정지·지금 저장→재접속하면2장 결산이4초와 추가10초 뒤에도 유지된다.3장 시작으로 복귀 가능하며 시간 역행·저장 손상은 미확정이다. 저장 (원문 경로: evidence/resume11-saved.jpg) · 4초 (원문 경로: evidence/resume11-resumed4s.jpg) · 14초 (원문 경로: evidence/resume11-resumed14s.jpg) · 독립 재현 (원문 경로: repro/resume11-observation.md)

QA012의 큰 대각 파동은 초기180장에서는 미관측이었으나 후속 역병도시150장에서 재현됐다. 서로 다른 표본과 계절·지붕 전환 시차를 구분한다(판독 (원문 경로: repro/season11-review.md)). 새 게임 부모19살/자녀14살의 양방향 표기는 계보-03 설명 후보로 보강했으며 생물학적 오류를 확정하지 않는다(원본 관찰 (원문 경로: repro/root11-observation.md)).

- **QA028 · 인구 기록 접근 · 중간 · 렌더/UI 추정** — 자연1349봄196233 인구285·149명 감소 기록이 있는 상태에서 인구 창은 빈 얇은 띠다.1280 실제 띠 위 휠048/049 후에도 읽히지 않고 Esc052→인구버튼053으로 재열어도 같다. DOM 기록을 화면에서 읽은 것으로 서술하지 않는다. 잘못된 휠046·재열기 미확인050은 제외했다. 기록 열기 (원문 경로: evidence/root11-045-population-record.jpg) · 실제 띠 휠 (원문 경로: evidence/root11-048-population-panel-wheel-down.jpg) · 닫기 (원문 경로: evidence/root11-052-population-escape.jpg) · 실제 재열기 (원문 경로: evidence/root11-053-population-actual-reopen.jpg)

동일1394 길드/1396 교회 삽화는 이번에도 구별됐다. 교회 실제 선택·기록 일치는 제한된 표본이며, 빈 계절 결산 슬롯은 관찰 후보로 유지한다. 예상 밖 제목화면 복귀는 통제된 저장 재접속 시험이 아니므로032나 데이터 손실의 추가 근거로 쓰지 않는다(UI 관찰 (원문 경로: repro/ui11-observation.md) · 주검수 동선 (원문 경로: repro/root11-observation.md)).

- **QA012 · 계절 지면 · 중간 · 렌더/그림 추정** — 추가 역병도시 겨울→봄150장의0098→0099에서 녹색 삼각면과 회색 땅의 긴 대각 경계가 아래쪽으로 이동했다(줌2·pan544,-2277·0099 QA196024/5×).0112 이후 청원 가림·정지 구간은 활성 검증에서 제외한다. 초기180장 미관측은 다른 표본의 결과로 보존한다. GIF (원문 경로: evidence/root11-plague-spring150.gif) · 전체 펼침 (원문 경로: evidence/root11-plague-spring150-unfolded.jpg) · 독립 판독 (원문 경로: repro/weather11-review.md)

성밖 패치와 실제 선택한 두 창고의 외형 반복은 기존 미적 후보로 보강했다. 특정 자산 누락·배치 규칙 오류는 확정하지 않았다(주검수 기록 (원문 경로: repro/root11-observation.md)).

목표판·젖은 여름 칩은069에서 분리됐지만 이후 칩 소멸로 재열기는 미검증이다. 사이먼 귀환은 동일 ID로 확인했으나 다리·바퀴는 미검증이다. 예상 밖 환영 화면의1300/틱0은 사진이 아닌 DOM 정보이며,004는 약3분의 시점 관찰이다(주장 감사 (원문 경로: repro/claim-audit11.md)).

장1 종료→장2 소개·세계 복귀를 정상 UI로 추가 확인했다. 끝부분100장은 첫 프레임부터 이미 종료 화면이므로 전환 순간 영상이 아니며,1280 목록 하단 스크롤과 목책 완공은 미검증이다(장 경계·입력 기록 (원문 경로: repro/root11-observation.md)).

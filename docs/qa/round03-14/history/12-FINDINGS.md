# QA ROUND 12 — 발견 기록 (관찰 마감)

이번 증거로 고유 QA **21개**를 재관측했다. 내부 원인은 확인하지 않았으며 담당 표기는 추정이다. 기준 48개의 결과는 회귀표 (원문 경로: REGRESSION.md)와 구분한다.

- **QA003 · 연결-01 · 중간 · 렌더/UI 추정** — 003: t320000, (45,42), 구간000은19/19 완공 표기이나 틈이 보임. 증거 (원문 경로: evidence/wall12-exact003.jpg)
- **QA005 · 가림-01 · 중간 · 그림·렌더 추정** — 005: Roger Hewson 같은 운반자 ID의 몸통·수레가 성벽과 겹침. 줌2. 증거 (원문 경로: evidence/wall12-roger24-detail.jpg) · GIF (원문 경로: evidence/wall12-wall80.gif) · 전체 펼침 (원문 경로: evidence/wall12-wall80-unfolded.jpg)
- **QA010 · 인물-01 · 중간 · 렌더/UI 추정** — 010: 기존 저장의 나이든 존26살·젊은 토머스82살 등 접두와 나이 표현 모순. 신규 생성 동일 조건 미검증. 증거 (원문 경로: evidence/ui12-004-person.jpg) · 관찰 (원문 경로: repro/ui12-observation.md)
- **QA012 · 계절-01 /012 · 중간 · 렌더/UI 추정** — 012: 줌2, t163005~163055/164005~164055의 큰 대각 계절 지면 경계 이동. 줌0.5 별도300장에서는 미관측. 관찰 (원문 경로: repro/ch3-season12-review.md) · GIF (원문 경로: evidence/root12-ch3-season400.gif) · 전체 펼침 (원문 경로: evidence/root12-ch3-season400-unfolded.jpg)
- **QA014 · 인물-02 · 낮음 · 렌더/UI 추정** — 014: 국왕·주교 이름의 영문 표기. 증거 (원문 경로: evidence/ui12-056-king.jpg) · 증거 (원문 경로: evidence/ui12-087-church-person.jpg)
- **QA015 · UI-04 · 낮음 · 렌더/UI 추정** — 015: 국왕/주교 전기의 빈 기록 문구가 장식선과 겹침. 증거 (원문 경로: evidence/ui12-057-king-bio.jpg) · 증거 (원문 경로: evidence/ui12-088-church-biography.jpg)
- **QA016 · UI-05 · 중간 · 렌더/UI 추정** — 016:1394/t376153,1600px 보류 버튼이 선택지 하단선을 덮음.1280은 휠 후 분리. 증거 (원문 경로: evidence/ui12-076-guild1394.jpg)
- **QA017 · UI-06 · 중간 · 렌더/UI 추정** — 017:375px 리사이즈 후 생업 상단 분류가 창 밖이며 위로 휠해도 미복구. 처음부터375px 건설은 미검증. 증거 (원문 경로: evidence/ui12-040-build375.jpg) · 증거 (원문 경로: evidence/ui12-041-build375-wheel.jpg)
- **QA019 · UI-09 · 낮음 · 렌더/UI 추정** — 019:1600px 설정 표적 x1588/너비44로32px가 창 밖.375에서는 전체 보임. 증거 (원문 경로: evidence/ui12-001-loaded1407.jpg) · 관찰 (원문 경로: repro/ui12-observation.md)
- **QA020 · UI-10 · 중간 · 렌더/UI 추정** — 020: 실제 펼친 가계도 줄리애나/비어트리스의 두 줄 이름 하단 잘림.1407 초기007은 펼침 미완료라 제외. 증거 (원문 경로: evidence/ui12-065-family.jpg)
- **QA021 · UI-11 · 낮음 · 렌더/UI 추정** — 021: 우물 닫기 기호가 빈칸. 창고061은 빨간×이므로 시설 전체 일반화 안 함.046/047은 추가 빈 기호 표본. 증거 (원문 경로: evidence/ui12-037-house.jpg) · 증거 (원문 경로: evidence/root12-046-red-gable-selected.jpg)
- **QA022 · UI-12 · 중간 · 렌더/UI 추정** — 022: 첫 겨울 더보기 후 본문/그림 추가 없이 버튼만 사라짐. 증거 (원문 경로: evidence/ui12-090-firstwinter-before.jpg) · 증거 (원문 경로: evidence/ui12-091-firstwinter-after.jpg) · GIF (원문 경로: evidence/ui12-winter-more-motion.gif) · 전체 펼침 (원문 경로: evidence/ui12-winter-more-motion-unfold.jpg)
- **QA023 · UI-13 · 중간 · 렌더/UI 추정** — 023:375px 우물 상세에 사건칩 겹침, QA 꺼도 지속. 입력 우회 영역은 미검증. 증거 (원문 경로: evidence/ui12-038-house375-chip.jpg) · 증거 (원문 경로: evidence/ui12-039-house375-qaoff.jpg)
- **QA024 · UI-14 · 중간 · 렌더/UI 추정** — 024: fresh375px 닫기 x406.078,y486,55.922×44 완전히 창 밖. 가로 휠 미복구이나 Tab11/Enter로 닫힘. 증거 (원문 경로: evidence/ui12-094-fresh375-person.jpg) · 증거 (원문 경로: evidence/ui12-098-keyboard-result.jpg)
- **QA025 · UI-15 · 중간 · 렌더/UI 추정** — 025:1383가을334018 정지→목표 보기→소개 없이1×334067. 증거 (원문 경로: evidence/ui12-048-goal-before.jpg) · 증거 (원문 경로: evidence/ui12-049-goal-after.jpg) · GIF (원문 경로: evidence/ui12-goal-motion.gif) · 전체 펼침 (원문 경로: evidence/ui12-goal-motion-unfold.jpg)
- **QA026 · 보행-01 · 중간 · 그림·렌더 추정** — 026: John 같은 운반자 ID 귀환80장 중 첫32장에서 다리 자세 고정. 교차 인물/식생 가림 구간 제외. 증거 (원문 경로: evidence/wall12-john32-tracked.jpg) · GIF (원문 경로: evidence/wall12-john80.gif) · 전체 펼침 (원문 경로: evidence/wall12-john80-unfolded.jpg)
- **QA027 · 건물-01 · 중간 · 그림·렌더 추정** — 027: 새 샌드박스 영주관 manor-house-34-41-0(34,41)이 무질감 다각형. 팬 이동과 함께 움직여 UI 잔상 아님. 증거 (원문 경로: evidence/root12-010-grey-shape-selected.jpg) · 증거 (원문 경로: evidence/root12-011-manor-centered.jpg)
- **QA028 · UI-16 · 중간 · 렌더/UI 추정** — 028:1449/t599398 인구 감소 기록이 존재하나 사진은 빈22px 띠. 휠·재열기·375에서도 내용 안 보임; DOM 내용을 플레이어가 읽었다고 하지 않음. 증거 (원문 경로: evidence/ui12-102-late-population.jpg) · 증거 (원문 경로: evidence/ui12-104-population-reopen.jpg)
- **QA029 · UI-02 · 중간 · 렌더/UI 추정** — 029: fresh375px 연대기 가로/세로 휠 뒤에도 목록·닫기가 안 보임; Escape 복구. 1280 청원은 스크롤 후 분리됨. 증거 (원문 경로: evidence/ui12-099-fresh375-records.jpg) · 증거 (원문 경로: evidence/ui12-100-fresh375-records-wheel.jpg)
- **QA031 · UI-18 · 중간 · 렌더/UI 추정** — 031: 문제 강조는 켜지지만1600/1280 및 QA 켬/끔에서 범례 비표시. 증거 (원문 경로: evidence/ui12-022-problem1600.jpg) · 증거 (원문 경로: evidence/ui12-023-problem-qaoff.jpg)
- **QA032 · 장전환-02 · 중간 · 엔진 추정** — 032: 실제 제3장 시작 후69틱 진행·정상 저장→수동 재로드/정상 재접속에서 제2장 결산 재노출. 저장 전160769틱은 사진에 보이지만 재개 후 틱/HUD는 결산에 가려 DOM/QA 보조값으로만 확인. 감사 (원문 경로: repro/save12-claim-audit.md).1364 제4장 조건은 미재현. 증거 (원문 경로: evidence/root12-029-ch3-after-ticks.jpg) · 증거 (원문 경로: evidence/root12-032-ch3-manual-reload-late.jpg) · 증거 (원문 경로: evidence/root12-035-ch3-continue-14s.jpg) · 관찰 (원문 경로: repro/root12-observation.md)

004·007은 이번 표본에서 미재현이며 닫지 않는다.030은 과세 화면 숫자 차이 표본과1364 저장 일치 표본을 분리하여 통제 재현을 보류한다.

가계도 반복·결산 빈 장식칸·밑동/이랑·지면 반복·시설 외형 반복·곡선 지면 토글에 따른 경작 무늬 소실은 관찰 후보다. 관계 계산·데이터 누락·자산 오설치로 단정하지 않는다. 주검수 관찰 (원문 경로: repro/root12-observation.md) · UI 관찰 (원문 경로: repro/ui12-observation.md) · 세계 관찰 (원문 경로: repro/wall12-observation.md).

1348년 기록의0살 초상이 성인처럼 보인다는 인상은 실제 전기 확대의 포대기 아기로 반증되어 결함에서 제외했다. 전기 (원문 경로: evidence/root12-060-infant-record-biography.jpg).

역병180프레임의 도착 안내와 후속055의 사제 결정창은 정상 진행 증거로 구분했으며 새 결함으로 추가하지 않았다. 독립 판독 (원문 경로: repro/plague12-review.md).

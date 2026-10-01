# QA ROUND 12 — 회귀표 (관찰 마감)

HEAD `265079891b074d7e023674e17984c3ac828f6c8e`. 현재 48개 기준: **미재현 9 · 제한 확인 10 · 실패 21 · 통과 1 · 미검증 1 · 관찰 후보 6**. 미재현은 수정 완료를 뜻하지 않으며 제한 확인은 적힌 표본에만 적용한다.

| # | 기준 | 판정 | 담당 | 이번 근거·한계 |
|---|---|---|---|---|
| 1 | 움직임-01 | 미재현 | 세계 | 정지·1/3/5× 각20장, 줌2에서 수관·밑동 분리 미관측. 관찰 (원문 경로: repro/wall12-observation.md) |
| 2 | 움직임-02 | 제한 확인 | 세계 | 1×120·유효5×120장에 이동·정지 외형은 보이나 역할/동일 ID 미확인. 모달이 덮은 별도120장은 제외. 관찰 (원문 경로: repro/wall12-observation.md) |
| 3 | 가림-01 | 실패 | 세계 | 005: Roger Hewson 같은 운반자 ID의 몸통·수레가 성벽과 겹침. 줌2. 증거 (원문 경로: evidence/wall12-roger24-detail.jpg) · GIF (원문 경로: evidence/wall12-wall80.gif) · 전체 펼침 (원문 경로: evidence/wall12-wall80-unfolded.jpg) |
| 4 | 연결-01 | 실패 | 세계 | 003: t320000, (45,42), 구간000은19/19 완공 표기이나 틈이 보임. 증거 (원문 경로: evidence/wall12-exact003.jpg) |
| 5 | 연결-02 | 미재현 | 세계 | 같은 물가 표본에서007 미재현. 수정 완료 판정 아님. 증거 (원문 경로: evidence/wall12-start.jpg) · 관찰 (원문 경로: repro/wall12-observation.md) |
| 6 | 자동행동-01 | 미재현 | 주검수 | 실제 Auto ON318.513초, 45개 정적 시점+마지막80장. 같은 칸 반복 건설 미관측; 전체5분 연속영상은 아님. 관찰 (원문 경로: repro/root12-independent-review.md) |
| 7 | UI-01 | 제한 확인 | UI | 장부·달력·청원·연대기 역할과 버튼 접근을 실제 열람. 375px 연대기 접근 실패는 UI-02에 별도 기록. 관찰 (원문 경로: repro/ui12-observation.md) |
| 8 | 축소-01 | 제한 확인 | 세계 | 줌2→0.957→0.5 비교. 영주관 도형은027이며 별도 LOD 결함은 확정 못함; 카메라도 달라짐. 증거 (원문 경로: evidence/root12-013-zoom-half.jpg) · 관찰 (원문 경로: repro/wall12-observation.md) |
| 9 | 예측-01 | 미재현 | UI | 055 과세 선택지의 예측 수치가 표시됨. 모든 사건·배치 예측의 정상 판정은 아님. 증거 (원문 경로: evidence/ui12-055-tax-card.jpg) |
| 10 | 인물-01 | 실패 | UI | 010: 기존 저장의 나이든 존26살·젊은 토머스82살 등 접두와 나이 표현 모순. 신규 생성 동일 조건 미검증. 증거 (원문 경로: evidence/ui12-004-person.jpg) · 관찰 (원문 경로: repro/ui12-observation.md) |
| 11 | 사건그림-01 | 통과 | UI | 011 동일 사건 쌍:1394 길드 대립과1396 교회 증축 그림이 구별됨. 증거 (원문 경로: evidence/ui12-076-guild1394.jpg) · 증거 (원문 경로: evidence/ui12-086-church1396.jpg) |
| 12 | 계절-01 /012 | 실패 | 주검수 | 012: 줌2, t163005~163055/164005~164055의 큰 대각 계절 지면 경계 이동. 줌0.5 별도300장에서는 미관측. 관찰 (원문 경로: repro/ch3-season12-review.md) · GIF (원문 경로: evidence/root12-ch3-season400.gif) · 전체 펼침 (원문 경로: evidence/root12-ch3-season400-unfolded.jpg) |
| 13 | 장전환-01 | 제한 확인 | UI/주검수 | 실제2→3·3→4·4→5 소개/세계 복귀 확인. 1450 결산·유산·책2~9쪽·샌드박스 복귀와1280/375 하단 접근도 확인. 저장 재개 문제032는 별도; 1장 종료 미검증. 375 결산 (원문 경로: evidence/ui12-110-summary375-bottom.jpg) · 복귀 (원문 경로: evidence/ui12-118-sandbox1600.jpg). 관찰 (원문 경로: repro/root12-observation.md) · 관찰 (원문 경로: repro/ui12-observation.md) |
| 14 | 날씨-01 | 제한 확인 | 주검수 | 비1/3/5× 각80장, 겨울 정지20·1×80장에서 건물/주민·목초 윤곽은 읽힘.5×는 비가 약하거나 사라진 구간 포함. 역병180장에서도 비 속 건물·성벽 식별 가능; 줌0.957의 개별 주민 다리는 미검증. 사제 결정창은 영상 밖055. 역병 판독 (원문 경로: repro/plague12-review.md). 안개·먼지 미검증. 세계 추가 관찰 (원문 경로: repro/wall12-observation.md) · 비 펼침 (원문 경로: evidence/wall12-extra-rain3-80-unfolded.jpg). 관찰 (원문 경로: repro/ch3-season12-review.md) |
| 15 | 시간표현-01 | 제한 확인 | UI | 025/070 달력의 현재 계절·다가오는 계절·식량 일수 열람. 밤낮 충돌 미관측. 증거 (원문 경로: evidence/ui12-070-calendar-late.jpg) |
| 16 | 보행-01 | 실패 | 세계 | 026: John 같은 운반자 ID 귀환80장 중 첫32장에서 다리 자세 고정. 교차 인물/식생 가림 구간 제외. 증거 (원문 경로: evidence/wall12-john32-tracked.jpg) · GIF (원문 경로: evidence/wall12-john80.gif) · 전체 펼침 (원문 경로: evidence/wall12-john80-unfolded.jpg) |
| 17 | 패널가림-01 | 미재현 | UI | 013:375px 젖은 여름 칩과 목표판이 분리됨. 다른 가림 조건 전체 해소는 아님. 증거 (원문 경로: evidence/ui12-085-goal-chip375.jpg) |
| 18 | UI-02 | 실패 | UI | 029: fresh375px 연대기 가로/세로 휠 뒤에도 목록·닫기가 안 보임; Escape 복구. 1280 청원은 스크롤 후 분리됨. 증거 (원문 경로: evidence/ui12-099-fresh375-records.jpg) · 증거 (원문 경로: evidence/ui12-100-fresh375-records-wheel.jpg) |
| 19 | 세계-01 | 미검증 | 주검수 | 새 샌드박스·설정·보기·장부에서 해안/습지 진입 경로를 찾지 못함. 해당 땅 부재 단정 안 함. 관찰 (원문 경로: repro/root12-observation.md) |
| 20 | 움직임-03 | 미재현 | 세계 | 수관 흔들림과 밑동의 별도 이동은 정지·1/3/5× 표본에서 미관측. 관찰 (원문 경로: repro/wall12-observation.md) |
| 21 | UI-03 | 제한 확인 | UI | 실제 QA 켬/끔 비교 완료. 문제 범례는 꺼도 안 보임(031); 모든 패널 복구 가능성은 미검증. 증거 (원문 경로: evidence/ui12-023-problem-qaoff.jpg) · 관찰 (원문 경로: repro/ui12-observation.md) |
| 22 | 인물-02 | 실패 | UI | 014: 국왕·주교 이름의 영문 표기. 증거 (원문 경로: evidence/ui12-056-king.jpg) · 증거 (원문 경로: evidence/ui12-087-church-person.jpg) |
| 23 | UI-04 | 실패 | UI | 015: 국왕/주교 전기의 빈 기록 문구가 장식선과 겹침. 증거 (원문 경로: evidence/ui12-057-king-bio.jpg) · 증거 (원문 경로: evidence/ui12-088-church-biography.jpg) |
| 24 | UI-05 | 실패 | UI | 016:1394/t376153,1600px 보류 버튼이 선택지 하단선을 덮음.1280은 휠 후 분리. 증거 (원문 경로: evidence/ui12-076-guild1394.jpg) |
| 25 | 계보-01 | 미재현 | UI | 존1327·마저리1333→앨리스1377의 책/가계도/전기 연결 일치. 다른 가족은 미검증. 증거 (원문 경로: evidence/ui12-065-family.jpg) · 증거 (원문 경로: evidence/ui12-069-book-family-bottom.jpg) |
| 26 | UI-06 | 실패 | UI | 017:375px 리사이즈 후 생업 상단 분류가 창 밖이며 위로 휠해도 미복구. 처음부터375px 건설은 미검증. 증거 (원문 경로: evidence/ui12-040-build375.jpg) · 증거 (원문 경로: evidence/ui12-041-build375-wheel.jpg) |
| 27 | UI-07 | 미재현 | UI | 018:1280×720/375px 설정에서 설명과 음량 제목이 분리됨. 증거 (원문 경로: evidence/ui12-019-settings1280.jpg) · 증거 (원문 경로: evidence/ui12-020-settings375.jpg) |
| 28 | 계보-02 | 관찰 후보 | 주검수/UI | 같은 애그니스1306 노드 두 곳을 클릭하면 동일 전기·배우자·자녀이며 함께 선택 표시. 혈연 계산 오류는 미확정. 증거 (원문 경로: evidence/root12-040-family-tree.jpg) · 증거 (원문 경로: evidence/root12-043-tree-collapsed.jpg) · 관찰 (원문 경로: repro/root12-observation.md) |
| 29 | UI-08 | 관찰 후보 | UI | 053 결산의+210d 외 두 빈 장식칸 관찰. 아직 한 계절 표본으로, 두 계절 대조/누락 데이터 여부 미확인. 증거 (원문 경로: evidence/ui12-053-tax-wait.jpg) |
| 30 | UI-09 | 실패 | UI | 019:1600px 설정 표적 x1588/너비44로32px가 창 밖.375에서는 전체 보임. 증거 (원문 경로: evidence/ui12-001-loaded1407.jpg) · 관찰 (원문 경로: repro/ui12-observation.md) |
| 31 | 지면-01 | 관찰 후보 | 세계 | (61,37) 나무 밑동이 이랑 안에 보임. 논리 점유/ID는 미확인. 증거 (원문 경로: evidence/wall12-ground6137.jpg) · GIF (원문 경로: evidence/wall12-ground40.gif) · 전체 펼침 (원문 경로: evidence/wall12-ground40-unfolded.jpg) |
| 32 | 청원자-01 | 제한 확인 | UI | 1396 신규 교회 청원자 전기45세·사망 표시 없음. 기존 같은 계절 고인 발신 조건은 미검증. 증거 (원문 경로: evidence/ui12-088-church-biography.jpg) |
| 33 | 기록-01 | 미재현 | UI | 교회 넓혀 짓기 실제 선택 뒤 답변/수락+10 기록이 일치. 추가1348 사제 결정에서도 실제 수도원 요청→동일 선택문구·주교+10 수락 기록 일치. 선택 (원문 경로: evidence/root12-058-priest-request-selected.jpg) · 기록 (원문 경로: evidence/root12-059-priest-request-record.jpg). 과거 기록 재독을 새 선택으로 세지 않음. 증거 (원문 경로: evidence/ui12-089-church-chosen-record.jpg) |
| 34 | UI-10 | 실패 | UI | 020: 실제 펼친 가계도 줄리애나/비어트리스의 두 줄 이름 하단 잘림.1407 초기007은 펼침 미완료라 제외. 증거 (원문 경로: evidence/ui12-065-family.jpg) |
| 35 | UI-11 | 실패 | UI | 021: 우물 닫기 기호가 빈칸. 창고061은 빨간×이므로 시설 전체 일반화 안 함.046/047은 추가 빈 기호 표본. 증거 (원문 경로: evidence/ui12-037-house.jpg) · 증거 (원문 경로: evidence/root12-046-red-gable-selected.jpg) |
| 36 | UI-12 | 실패 | UI | 022: 첫 겨울 더보기 후 본문/그림 추가 없이 버튼만 사라짐. 증거 (원문 경로: evidence/ui12-090-firstwinter-before.jpg) · 증거 (원문 경로: evidence/ui12-091-firstwinter-after.jpg) · GIF (원문 경로: evidence/ui12-winter-more-motion.gif) · 전체 펼침 (원문 경로: evidence/ui12-winter-more-motion-unfold.jpg) |
| 37 | UI-13 | 실패 | UI | 023:375px 우물 상세에 사건칩 겹침, QA 꺼도 지속. 입력 우회 영역은 미검증. 증거 (원문 경로: evidence/ui12-038-house375-chip.jpg) · 증거 (원문 경로: evidence/ui12-039-house375-qaoff.jpg) |
| 38 | UI-14 | 실패 | UI | 024: fresh375px 닫기 x406.078,y486,55.922×44 완전히 창 밖. 가로 휠 미복구이나 Tab11/Enter로 닫힘. 증거 (원문 경로: evidence/ui12-094-fresh375-person.jpg) · 증거 (원문 경로: evidence/ui12-098-keyboard-result.jpg) |
| 39 | UI-15 | 실패 | UI | 025:1383가을334018 정지→목표 보기→소개 없이1×334067. 증거 (원문 경로: evidence/ui12-048-goal-before.jpg) · 증거 (원문 경로: evidence/ui12-049-goal-after.jpg) · GIF (원문 경로: evidence/ui12-goal-motion.gif) · 전체 펼침 (원문 경로: evidence/ui12-goal-motion-unfold.jpg) |
| 40 | 지면-02 | 관찰 후보 | 주검수 | 초기 마을 빈 땅의 낮은 대비 대각 색면 반복을 정적 표본에서 관찰. 줌1.2/동일 정지30프레임 대조 미검증;012와 구분. 증거 (원문 경로: evidence/root12-auto-a-04.jpg) · 관찰 (원문 경로: repro/root12-independent-review.md) |
| 41 | 계보-03 | 제한 확인 | UI | 정상 새 게임1300년87틱: 토머스1293→앨리스1259→토머스, 월터1255→조앤1288의 부모/자녀 왕복과 연령차 확인. 과거1307년 가주 교체 후19살/14살 조건은 미검증. 추가 판독 (원문 경로: repro/ui12-extra-genealogy03.md) · 부모 (원문 경로: evidence/ui12-extra-006-alice-parent.jpg) · 자녀 (원문 경로: evidence/ui12-extra-009-joan-child.jpg). |
| 42 | 건물-01 | 실패 | 주검수/세계 | 027: 새 샌드박스 영주관 manor-house-34-41-0(34,41)이 무질감 다각형. 팬 이동과 함께 움직여 UI 잔상 아님. 증거 (원문 경로: evidence/root12-010-grey-shape-selected.jpg) · 증거 (원문 경로: evidence/root12-011-manor-centered.jpg) |
| 43 | UI-16 | 실패 | UI | 028:1449/t599398 인구 감소 기록이 존재하나 사진은 빈22px 띠. 휠·재열기·375에서도 내용 안 보임; DOM 내용을 플레이어가 읽었다고 하지 않음. 증거 (원문 경로: evidence/ui12-102-late-population.jpg) · 증거 (원문 경로: evidence/ui12-104-population-reopen.jpg) |
| 44 | UI-17 | 제한 확인 | UI/주검수 | 030:055 HUD42195d/선택지 지금42198d 차이 표본.1364/t256864 정상 저장·재로드는475명/211일/6892d 일치; 해당 차이의 통제 재로드는 미검증. 증거 (원문 경로: evidence/ui12-055-tax-card.jpg) · 증거 (원문 경로: evidence/root12-022-manual-load-late.jpg) |
| 45 | UI-18 | 실패 | UI | 031: 문제 강조는 켜지지만1600/1280 및 QA 켬/끔에서 범례 비표시. 증거 (원문 경로: evidence/ui12-022-problem1600.jpg) · 증거 (원문 경로: evidence/ui12-023-problem-qaoff.jpg) |
| 46 | 건물-02 | 관찰 후보 | 주검수 | t173083 실제 선택한 두 창고(50,42)/(41,40)와 줌0.957 전체에서 빨간 박공·흰 기단 반복. 미적 후보이며 자산 오설치 확정 아님. 증거 (원문 경로: evidence/root12-046-red-gable-selected.jpg) · 증거 (원문 경로: evidence/root12-047-second-red-gable-selected.jpg) · 증거 (원문 경로: evidence/root12-048-repetition-wide.jpg) |
| 47 | 장전환-02 | 실패 | 주검수 | 032: 실제 제3장 시작 후69틱 진행·정상 저장→수동 재로드/브라우저 재접속에서 제2장 결산 재노출. 저장 전160769틱은 사진 판독, 재개 후 결산 뒤 틱/HUD는 DOM/QA 보조값이며 사진에서 읽히지 않음. 저장 감사 (원문 경로: repro/save12-claim-audit.md).1364 제4장 조건은 미재현. 증거 (원문 경로: evidence/root12-029-ch3-after-ticks.jpg) · 증거 (원문 경로: evidence/root12-032-ch3-manual-reload-late.jpg) · 증거 (원문 경로: evidence/root12-035-ch3-continue-14s.jpg) · 관찰 (원문 경로: repro/root12-observation.md) |
| 48 | 지면-03 | 관찰 후보 | 주검수 | 1347여름/t189822·줌0.957 동일 정지 장면에서 OFF/ON 두 번 왕복. OFF의 경작 토양/이랑 소실과 ON 복귀 관찰. 생산 데이터 손실은 단정하지 않음. OFF (원문 경로: evidence/root12-050-curved-off.jpg) · ON (원문 경로: evidence/root12-051-curved-on.jpg) · 반복 OFF (원문 경로: evidence/root12-052-curved-off-repeat.jpg) · 반복 ON (원문 경로: evidence/root12-053-curved-on-repeat.jpg). |

검토 방법 (원문 경로: CHECKLIST.md). 이번 회차 관찰은 마감했다. 미검증·제한 확인·후보의 한계는 그대로 유지한다.

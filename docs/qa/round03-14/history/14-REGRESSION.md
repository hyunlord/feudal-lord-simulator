# QA ROUND 14 — 회귀표 (관찰 진행 중)

HEAD `267b43b8e203a64a9971f2b1a53a4eb69d935f73`. **49개 기준: 미재현 6 · 제한 확인 12 · 실패 21 · 통과 1 · 미검증 1 · 관찰 후보 8**. 이전 판정을 이번 관찰로 복사하지 않는다.

| # | 기준 | 판정 | 이번 근거·한계 |
|---|---|---|---|
| 1 | 움직임-01 | 미재현 | 같은 카메라에서 정지20·1×40·3×40·5×40프레임의 수관/밑동 분리 이동 미관측. 새·비와 구분. 사진 (원문 경로: evidence/wall14-tree-paused20-detail.jpg) · GIF (원문 경로: evidence/wall14-tree5-40.gif) · 전체 펼침 (원문 경로: evidence/wall14-tree5-40-unfolded.jpg) |
| 2 | 움직임-02 | 제한 확인 | 1×/5× 각120프레임에서 이동·정지 주민을 관찰했으나 선택 ID/역할 미확인. 전체 주민 정상 판정 아님. 사진 (원문 경로: evidence/wall14-idle1-valid120-detail.jpg) · GIF (원문 경로: evidence/wall14-idle5-120.gif) · 전체 펼침 (원문 경로: evidence/wall14-idle5-120-unfolded.jpg) |
| 3 | 가림-01 | 실패 | 005: 선택 Roger carter000048, 1×80프레임 중19–22에서 성벽 위 겹침 외형. 경로 침범 원인 미확인. 사진 (원문 경로: evidence/wall14-roger80-detail.jpg) · GIF (원문 경로: evidence/wall14-roger80.gif) · 전체 펼침 (원문 경로: evidence/wall14-roger80-unfolded.jpg) |
| 4 | 연결-01 | 실패 | 003:320000틱·줌2·(45,42) 완공19/19 목책000041 seg000에서 시각적 단절. 통행 오류로 단정 안 함. 사진 (원문 경로: evidence/wall14-exact003.jpg) |
| 5 | 연결-02 | 미재현 | 물가/성벽의 줌2·0.5 표본에서 별도 연결 깨짐 미관측. 003과 구분하며 고침 판정 아님. 세계 관찰 (원문 경로: repro/wall14-observation.md) |
| 6 | 자동행동-01 | 미재현 | 실제 자동 발전 ON, 04:23:45.826→04:28:55.527 UTC 309.701초(41036→71674틱), 정적32장·100프레임 두 묶음에서 같은 곳 반복 건설 미관측. 계절결산으로 정지한 auto-a/b 제외; 전 구간 연속 영상 아님. 사진 (원문 경로: evidence/root14-020-auto-paused-end.jpg) · 원문 (원문 경로: repro/root14-observation.md) |
| 7 | UI-01 | 제한 확인 | 장부1600/375 실제휠 후 최하단 행과4만d 이상 숫자 읽힘. 다른 UI 표면 전수 통과 아님. 사진 (원문 경로: evidence/ui14-021-resources375-bottom.jpg) · UI 관찰 (원문 경로: repro/ui14-observation.md) |
| 8 | 축소-01 | 제한 확인 | 321333틱에서 줌2→약1→0.5→2 LOD 외형 전환 관찰. 카메라 이동 포함, 모든 전환 정상 보장 아님. 세계 관찰 (원문 경로: repro/wall14-observation.md) |
| 9 | 예측-01 | 미재현 | 1384여름337151 과세 양쪽 예측41807/42207d 표시. 다른 사건 전체 보장 아님. 사진 (원문 경로: evidence/ui14-025-tax-paused.jpg) |
| 10 | 인물-01 | 실패 | 010:1394봄376151틱 길드 청원에 ‘젊은 토머스 밀러82살’. 구원본 유래 이름이며 신규 명명 검사는 아님. 사진 (원문 경로: evidence/ui14-064-guild1600.jpg) |
| 11 | 사건그림-01 | 통과 | 동일1394 길드/1396 교회 쌍이 거리 깃발·군중 대립과 비계·교회 증축으로 구별됨. 사진 (원문 경로: evidence/ui14-064-guild1600.jpg) · 사진 (원문 경로: evidence/ui14-067-church1396.jpg) |
| 12 | 계절-01 /012 | 제한 확인 | 320프레임의 수관 전체 점프는 미관측.161→162 인접 표본의 밭 밝아짐/일부 지붕 눈 출현, 달력·QA 전환 시차만 관찰; 이전 큰 대각 경계 실패의 재현이나 전체 해소로 세지 않음. 사진 (원문 경로: evidence/wall14-season-boundary1.jpg) · GIF (원문 경로: evidence/wall14-season320.gif) · 전체 펼침 (원문 경로: evidence/wall14-season320-unfolded.jpg) · 독립 판독 (원문 경로: repro/independent14-season-service.md) |
| 13 | 장전환-01 | 제한 확인 | 정상 UI 2→3 진입 및1450 결말→책9쪽→샌드박스 확인.1→2 저장 재노출은032로 분리. 이번 정상1→2·3→4·4→5 전체 흐름은 미검증. 사진 (원문 경로: evidence/ui14-078-ending-bottom1280.jpg) · 통제 (원문 경로: repro/control14-observation.md) |
| 14 | 날씨-01 | 제한 확인 | 비·눈 표본에서 세계 식별 가능. 안개/먼지 및 모든 강도는 미검증. 사진 (원문 경로: evidence/wall14-season-boundary1.jpg) · 세계 관찰 (원문 경로: repro/wall14-observation.md) |
| 15 | 시간표현-01 | 제한 확인 | 달력 식량387일·내년 가을 말·계절 일정 실제 표시 확인. 밤낮 기능 전수 검사가 아님. 사진 (원문 경로: evidence/ui14-055-calendar.jpg) |
| 16 | 보행-01 | 실패 | 026:John carter000081 선택 후1×80프레임 중 첫32에서 이동하지만 같은 다리 벌림 외형 반복. 동물은 정지 표본뿐이어서 보행 미검증. 사진 (원문 경로: evidence/wall14-john-click.jpg) · GIF (원문 경로: evidence/wall14-john80.gif) · 전체 펼침 (원문 경로: evidence/wall14-john80-unfolded.jpg) |
| 17 | 패널가림-01 | 제한 확인 | 196196틱 임금 사건 패널→목표 확장1600/375→접기에서 목표의 사건칩 가림 미관측.375 달력의 일부 오른쪽 공간은 칩과 겹치지만 일정·닫기 읽힘, 실제 닫기 성공. 전체 해소 판정 아님. 목표 (원문 경로: evidence/root14-044-goal-chips375.jpg) · 달력 (원문 경로: evidence/root14-046-calendar375.jpg) · 닫은 뒤 (원문 경로: evidence/root14-047-calendar-closed375.jpg) |
| 18 | UI-02 | 실패 | 029:375 연대기 가로/세로 휠 후 왼쪽 목록·오른쪽닫기 창밖. Escape 복구. 사진 (원문 경로: evidence/ui14-015-record375.jpg) · 사진 (원문 경로: evidence/ui14-016-record375-scroll.jpg) |
| 19 | 세계-01 | 미검증 | 새 컨텍스트2개의 목표형·샌드박스·설정·새 게임9개 화면에서 땅 선택 경로 미발견. 기능 부재나 고장으로 판정 안 함. 접근 기록 (원문 경로: repro/land14-observation.md) |
| 20 | 움직임-03 | 미재현 | 정지/1×/3×/5× 수목 표본에서 카메라 고정 시 밑동 자체 이동 미관측. 사진 (원문 경로: evidence/wall14-tree1-40-detail.jpg) · GIF (원문 경로: evidence/wall14-tree3-40.gif) · 전체 펼침 (원문 경로: evidence/wall14-tree3-40-unfolded.jpg) |
| 21 | UI-03 | 제한 확인 | QA 켠 상태에서 장부·인물·설정 닫기/Escape 복구.375 QA 부가 가림 전수 검사는 아님. UI 관찰 (원문 경로: repro/ui14-observation.md) |
| 22 | 인물-02 | 실패 | 014:국왕 실제 카드·전기의 king 영문 역할 표기. 사진 (원문 경로: evidence/ui14-026-king-card.jpg) · 사진 (원문 경로: evidence/ui14-027-king-bio.jpg) |
| 23 | UI-04 | 실패 | 015:새 게임 토머스/앨리스 및 국왕 전기의 빈 기록 문구와 중앙 장식선 겹침. 사진 (원문 경로: evidence/ui14-009-thomas-biography.jpg) · 사진 (원문 경로: evidence/ui14-027-king-bio.jpg) |
| 24 | UI-05 | 실패 | 016:1394 길드1600/1280에서 보류 버튼이 둘째 선택지 우하단 테두리와 겹침. 사진 (원문 경로: evidence/ui14-064-guild1600.jpg) |
| 25 | 계보-01 | 관찰 후보 | 초기 가족은 일치. 후기 같은 토머스1293의 전기 부모 조앤1288/윌리엄1288, 책 부모 월터1255/앨리스1259로 다름. 가구 관계와 혈연 차이를 배제하지 않음. 사진 (원문 경로: evidence/root14-029-thomas-tree-click.jpg) · 사진 (원문 경로: evidence/root14-032-book-family.jpg) |
| 26 | UI-06 | 실패 | 017:375 생업 상단분류 창밖, 위휠1800 후 동일. 사진 (원문 경로: evidence/ui14-043-build375.jpg) · 사진 (원문 경로: evidence/ui14-044-build375-up.jpg) |
| 27 | UI-07 | 실패 | 018:1280×720 상단설정의 튜토리얼 설명·화면소리 겹침.005 Esc메뉴 정상 표본과 분리. 사진 (원문 경로: evidence/ui14-004-settings1280.jpg) · 사진 (원문 경로: evidence/ui14-005-esc1280.jpg) |
| 28 | 계보-02 | 관찰 후보 | 후기 앨리스1259–1300·윌리엄1288 반복 및 토머스1293–1311 십자와 전기의 마을 떠남 표시. 혈연/사망 계산 오류 단정 안 함. 사진 (원문 경로: evidence/root14-028-family-tree-late.jpg) · 사진 (원문 경로: evidence/root14-029-thomas-tree-click.jpg) |
| 29 | UI-08 | 관찰 후보 | 1388 여름/가을 결산에서 두 칸 채움·세 번째 빈 틀. 명세나 데이터 누락은 미확인. UI 관찰 (원문 경로: repro/ui14-observation.md) |
| 30 | UI-09 | 실패 | 019:1600 상단설정 버튼 오른쪽 잘림. 사진 (원문 경로: evidence/ui14-003-settings1600.jpg) |
| 31 | 지면-01 | 관찰 후보 | 321333틱·(61,37)·줌2 나무 밑동/그루터기와 밭이랑 중첩. 논리 점유는 미확인. 사진 (원문 경로: evidence/wall14-ground6137.jpg) |
| 32 | 청원자-01 | 제한 확인 | 1349봄196155 임금 청원의 오즈버트64살 카드와 전기에 사망 표시, 휠 후 같은1349봄 사망 기록 확인. 같은 계절 내 청원/사망 선후 미확정으로 내부 발생 오류를 단정하지 않음. 초기 국왕 생존 표본과 구분. 카드 (원문 경로: evidence/root14-037-deceased-petitioner-card.jpg) · 전기 끝 (원문 경로: evidence/root14-039-deceased-bio-scroll.jpg) |
| 33 | 기록-01 | 미재현 | 실제 과세 납부 후030연대기에400d납부/과세를낸다/국왕+10·도시−5 일치.029파일은 국왕전기라 기록 근거 제외. 사진 (원문 경로: evidence/ui14-030-records-paid.jpg) |
| 34 | UI-10 | 실패 | 020:1447 후기1280 가계도에서 긴 이름 ‘앨리스 드 포콩…’ 줄임. 전체 이름을 다른 방법으로 확인 못 한다는 주장은 아님. 사진 (원문 경로: evidence/ui14-073-late-tree1280.jpg) |
| 35 | UI-11 | 실패 | 021:실제 시장000044(56,35) 상세의 기본 닫기칸 빈 기호.037파일명 house는 선택 건물과 다름. 사진 (원문 경로: evidence/ui14-037-house1600.jpg) |
| 36 | UI-12 | 실패 | 022:1300겨울3120틱 정지·줌2·pan544,-2277에서 첫 겨울 더보기 클릭 후 본문 한 문장은 같고 버튼만 사라짐. 실제 휠 후에도 동일. 전 (원문 경로: evidence/ui14-087-winter-before.jpg) · 후 (원문 경로: evidence/ui14-088-winter-after.jpg) · 휠 (원문 경로: evidence/ui14-089-winter-wheel.jpg) · GIF (원문 경로: evidence/ui14-winter-motion.gif) · 전체 펼침 (원문 경로: evidence/ui14-winter-motion-unfold.jpg) |
| 37 | UI-13 | 실패 | 023:375 과세사절칩이 시장 제목·닫기하단 덮음. 클릭불능까지 단정 안 함. 사진 (원문 경로: evidence/ui14-038-market375.jpg) |
| 38 | UI-14 | 실패 | 024:375닫기 x406.078,y486,w55.922,h44 전체창밖,가로휠1500 미복구/Escape복구. Tab/Enter 미검증. 사진 (원문 경로: evidence/ui14-046-person375.jpg) · 사진 (원문 경로: evidence/ui14-047-person375-horizontal.jpg) |
| 39 | UI-15 | 실패 | 025:정지356431틱에서 목표 보기 클릭 후 소개 없이356482틱1× 진행. 사진 (원문 경로: evidence/ui14-053-goal-before.jpg) · 사진 (원문 경로: evidence/ui14-054-goal-after.jpg) · GIF (원문 경로: evidence/ui14-goal-motion.gif) · 전체 펼침 (원문 경로: evidence/ui14-goal-motion-unfold.jpg) |
| 40 | 지면-02 | 관찰 후보 | 324751틱·줌2 성밖 풀·꽃·관목·흙 색면 반복. 미적 후보이며 끊김/논리 오류 아님. 사진 (원문 경로: evidence/wall14-flat-on.jpg) |
| 41 | 계보-03 | 관찰 후보 | 초기 부모 연령차 정상. 후기 토머스1293와 전기 부모 조앤1288는5년 차; 책 부모와 다르고 입양/가구주 설명은 미확인. 사진 (원문 경로: evidence/root14-029-thomas-tree-click.jpg) · 사진 (원문 경로: evidence/root14-030-thomas-parent-joan.jpg) |
| 42 | 건물-01 | 실패 | 027:321333틱·(29,17) 영주관 실제 선택·줌2에서 갈색 평면 지붕/회색 벽 도형. 최초 잘못된 카메라의 manor2/1/05는 제외. 사진 (원문 경로: evidence/wall14-manor-selected2.jpg) |
| 43 | UI-16 | 제한 확인 | 039/040 빈 인구기록의 제목·빈기록 문구도 얇은 띠에서 비표시. 실제 내용 존재 조건은 미검증이므로 동일 실패 확정 보류. 사진 (원문 경로: evidence/ui14-039-population.jpg) · UI 관찰 (원문 경로: repro/ui14-observation.md) |
| 44 | UI-17 | 실패 | 030:1340 통제160783 정지 저장의 식량208일→수동 재로드 직후204일(인구480·금고3636 동일).1364 통제값은 일치. 원래 인구 불일치의 원인과 같다고 단정하지 않음. 사진 (원문 경로: evidence/control14-004-saved.jpg) · 사진 (원문 경로: evidence/control14-005-manual-immediate.jpg) |
| 45 | UI-18 | 실패 | 031:문제보기1600/375 세계강조는 있으나 범례 비표시. 사진 (원문 경로: evidence/ui14-041-problem1600.jpg) · 사진 (원문 경로: evidence/ui14-042-problem375.jpg) |
| 46 | 건물-02 | 관찰 후보 | 실제 곡창000064(41,43)/000047(55,48)의 노란 초가·목조·자루 외형 반복. 잘못된 자산 사용은 미확인. 사진 (원문 경로: evidence/wall14-barnA.jpg) · 사진 (원문 경로: evidence/wall14-barnB.jpg) |
| 47 | 장전환-02 | 실패 | 032:1340 실제3장 시작·83틱 진행·정지 저장 후 재로드4초/24초에2장 결산.1322 무입력100프레임도0–3세계→4부터1장 결산.1364동일 절차 음성 표본 보존. 사진 (원문 경로: evidence/control14-006-manual4s.jpg) · GIF (원문 경로: evidence/control14-1322-immediate100.gif) · 전체 펼침 (원문 경로: evidence/control14-1322-immediate100-unfolded.jpg) · 통제 원문 (원문 경로: repro/control14-observation.md) |
| 48 | 지면-03 | 제한 확인 | 320000틱 동일 장면 곡선 지면 OFF/ON 두 차례에서 경계·밭 등 외형 변화 확인. 이 표본만으로 경작 구획 식별 소실 실패 확정 안 함. 세계 관찰 (원문 경로: repro/wall14-observation.md) |
| 49 | 서비스 안내-01 /033 | 관찰 후보 | 033:90255틱 정지 주택(43,43)에 시장 멂4/8, 교회 이용 가능10/12. 시장 상세 길40걸음과 단위·대상 동일성 미확인. 독립 판독 (원문 경로: repro/independent14-season-service.md) · 사진 (원문 경로: evidence/root14-008-service-market-church.jpg) |

검토 기준 (원문 경로: CHECKLIST.md). UI 후속 관찰과 주검수는 계속 진행 중이다.

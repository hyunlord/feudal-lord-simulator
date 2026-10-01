# QA ROUND 13 — 회귀표 (관찰 완료)

HEAD `265079891b074d7e023674e17984c3ac828f6c8e`. **49개 기준: 미재현 7 · 제한 확인 10 · 실패 22 · 통과 1 · 관찰 후보 8 · 미검증 1**.004 미재현은 수정 완료가 아니다.

| # | 기준 | 판정 | 이번 근거·한계 |
|---|---|---|---|
| 1 | 움직임-01 | 미재현 | 정지/1/3/5× 동일 카메라 줌2에서 줄기·수관 연결 유지. 모달 포함 첫5× 표본은 제외. 세계 관찰 (원문 경로: repro/wall13-observation.md) |
| 2 | 움직임-02 | 제한 확인 | 1/5× 각각120장에 이동·머무름·떠남 관찰. 집 선택만 성공했고 개인 ID/역할 미확인. 세계 관찰 (원문 경로: repro/wall13-observation.md) |
| 3 | 가림-01 | 실패 | 005: 로저 휴슨 같은 운반자 ID, 줌2 (43,42),80장 중19~22에서 몸/수레가 석벽 면·상단에 겹침. 사진 (원문 경로: evidence/wall13-roger-click.jpg) · GIF (원문 경로: evidence/wall13-roger80.gif) · 전체 펼침 (원문 경로: evidence/wall13-roger80-unfolded.jpg) |
| 4 | 연결-01 | 실패 | 003: t320000 (45,42) 구간000,19/19·100% 닫힌 고리 표기와 시각 접합 틈. 사진 (원문 경로: evidence/wall13-exact003.jpg) |
| 5 | 연결-02 | 미재현 | 007: 동남쪽 호숫가·성벽 표본에서 별도 결함 미확인. 수정 완료 아님. 사진 (원문 경로: evidence/wall13-ground-end.jpg) · 세계 관찰 (원문 경로: repro/wall13-observation.md) |
| 6 | 자동행동-01 | 미재현 | 실제 ON5×03:16:01.155→03:21:59.129(357.974초),6794→40807.32정적 시점+road100장에서 같은 칸 반복 건설 미관측. 정지 auto-b 제외; 전체 연속영상 아님. 사진 (원문 경로: evidence/root13-059-auto-end-paused.jpg) · GIF (원문 경로: evidence/root13-auto-road100.gif) · 전체 펼침 (원문 경로: evidence/root13-auto-road100-unfolded.jpg) · 주검수 (원문 경로: repro/root13-observation.md) |
| 7 | UI-01 | 제한 확인 | 장부 역할 틀과375px 숫자 열 확인. 완공 토스트의 일시 겹침은 새 결함으로 확정 안 함. 사진 (원문 경로: evidence/ui13-009-ledger375.jpg) · UI 관찰 (원문 경로: repro/ui13-observation.md) |
| 8 | 축소-01 | 제한 확인 | 약1/0.5 줌 실제 비교. 팬도 바뀌어 픽셀 동일성 비교 아님; 별도 LOD 결함 미확인. 사진 (원문 경로: evidence/wall13-zoom05.jpg) · 세계 관찰 (원문 경로: repro/wall13-observation.md) |
| 9 | 예측-01 | 미재현 | 과세 t337160의 두 선택지에 예측금액 표시. 다른 결정 전체 보장 아님. 사진 (원문 경로: evidence/ui13-067-tax-decision.jpg) |
| 10 | 인물-01 | 실패 | 010: 기존1447 원본 진행 후 젊은 스티븐154세 사망 표현. 전기1295–1449와 나이는 일치해 접두 표현 문제로 한정. 사진 (원문 경로: evidence/ui13-039-late-records.jpg) · 사진 (원문 경로: evidence/ui13-040-late-record-person.jpg) |
| 11 | 사건그림-01 | 통과 | 011 동일1394 길드 대립/1396 교회 증축 삽화가 명백히 다름. 사진 (원문 경로: evidence/ui13-088-guild1600.jpg) · 사진 (원문 경로: evidence/ui13-094-church1396.jpg) |
| 12 | 계절-01 /012 | 실패 | 012: 첫 겨울100장,0049 결산 출현 후0054~0059 모달 바깥 대각 녹색/회색 지면 경계 이동. 전체가5× 진행은 아님. 독립 판독 (원문 경로: repro/root13-early-review.md) · GIF (원문 경로: evidence/root13-firstwinter-build100.gif) · 전체 펼침 (원문 경로: evidence/root13-firstwinter-build100-unfolded.jpg) |
| 13 | 장전환-01 | 제한 확인 | 1450여름601158 결산→유산→책2~9쪽→샌드박스 복귀.1280/375 최하단 접근 확인. 새 게임1322년1→2도115결산→120소개→121세계90255로 확인. 3→4·4→5만 미검증. 제2장 세계 (원문 경로: evidence/root13-121-chapter2-world.jpg). 사진 (원문 경로: evidence/ui13-061-summary375-bottom.jpg) · 사진 (원문 경로: evidence/ui13-065-sandbox375.jpg) · UI 관찰 (원문 경로: repro/ui13-observation.md) 통제 관찰에서2→3 실제 시작 확인(재개032별도). 통제 (원문 경로: repro/control13-observation.md) |
| 14 | 날씨-01 | 제한 확인 | 비가 보이는 정지/1/3×에서 나무·건물 윤곽 읽힘. 5× 유효 재촬영은 계절/강도도 달라 배속 원인 분리 안 함. 안개·먼지 미검증. 세계 관찰 (원문 경로: repro/wall13-observation.md) |
| 15 | 시간표현-01 | 제한 확인 | 달력의 다가오는 장날·기간 마감·파종·수확 및 계절/식량 일수 읽힘. 밤낮 전체 검증 아님. 사진 (원문 경로: evidence/ui13-051-calendar1280.jpg) |
| 16 | 보행-01 | 실패 | 026: 존 아트필드 같은 운반자 ID (19,32),t320734부터1×80장 중 앞32장 이동 시 벌어진 다리 자세 고정. 동물/다른 방향 일반화 안 함. 사진 (원문 경로: evidence/wall13-john32-tracked.jpg) · GIF (원문 경로: evidence/wall13-john80.gif) · 전체 펼침 (원문 경로: evidence/wall13-john80-unfolded.jpg) |
| 17 | 패널가림-01 | 관찰 후보 | 093375에서 사건칩이 목표 글을 덮음. 원래013과 반대 가림 방향의 보강 후보이며 동일 재현/해소 단정 안 함. 사진 (원문 경로: evidence/ui13-093-goal-guildchip375.jpg) |
| 18 | UI-02 | 실패 | 029: 새 게임375px 연대기에 가로/세로 휠 후 목록·닫기 비표시. Escape 복구. 사진 (원문 경로: evidence/ui13-023-fresh-records375.jpg) · 사진 (원문 경로: evidence/ui13-024-fresh-records375-wheel.jpg) |
| 19 | 세계-01 | 미검증 | 새 컨텍스트3개에서 목표형·샌드박스·Esc/상단 설정을 실제 탐색했으나 땅/이름 입력 경로 미발견. 해안/습지 부재 단정 안 함. 독립 탐색 (원문 경로: repro/land13-observation.md). 주검수 (원문 경로: repro/root13-observation.md) |
| 20 | 움직임-03 | 미재현 | 수관 미세 변화와 지나가는 검은 새를 밑동 분리로 세지 않음. 동일 카메라 표본 미재현. 세계 관찰 (원문 경로: repro/wall13-observation.md) |
| 21 | UI-03 | 미재현 | QA 켬/끔 이후 장부·설정·인물·연대기 열고 닫기에서 복구 불능 미관측. 모든 표면 보장 아님. UI 관찰 (원문 경로: repro/ui13-observation.md) |
| 22 | 인물-02 | 실패 | 014: 실제 국왕 리처드2세 카드/전기에 king 영문 표기. 사진 (원문 경로: evidence/ui13-068-king-card.jpg) · 사진 (원문 경로: evidence/ui13-069-king-bio.jpg) |
| 23 | UI-04 | 실패 | 015: 국왕 전기의 빈 기록 문구가 중앙 장식선과 겹침. 사진 (원문 경로: evidence/ui13-069-king-bio.jpg) |
| 24 | UI-05 | 실패 | 016:1394봄376156 길드1600/1280 휠 후 보류 버튼과 둘째 선택 하단선 겹침. 과세067 정상 표본은 별개. 사진 (원문 경로: evidence/ui13-088-guild1600.jpg) · 사진 (원문 경로: evidence/ui13-090-guild1280-bottom.jpg) |
| 25 | 계보-01 | 관찰 후보 | 1312봄48546 토머스1293 전기의 부모 조앤/윌리엄1288과 책080 부모 월터1255/앨리스1259가 다름. 가구주/혈연 구분 가능성으로 내부 오류 미확정. 초기 다른 가족의 일치도 보존. 사진 (원문 경로: evidence/root13-077-thomas-deceased.jpg) · 사진 (원문 경로: evidence/root13-080-fresh-family-book.jpg) · 주검수 (원문 경로: repro/root13-observation.md) |
| 26 | UI-06 | 실패 | 017:375 생업 상단 분류가 창 밖, 실제 위 휠1800 후 동일. 사진 (원문 경로: evidence/ui13-053-production375.jpg) · 사진 (원문 경로: evidence/ui13-054-production375-wheel.jpg) |
| 27 | UI-07 | 실패 | 018:768/1280×720/375 상단 설정 드롭다운에서 튜토리얼 설명과 화면 소리 제목 겹침.012 Esc 일시정지 메뉴는 분리된 정상 표본으로 구별. 사진 (원문 경로: evidence/ui13-079-settings768.jpg) · 사진 (원문 경로: evidence/ui13-080-settings-dropdown1280.jpg) · UI 관찰 (원문 경로: repro/ui13-observation.md) |
| 28 | 계보-02 | 관찰 후보 | 앞선 가문 여성들이 새 가주 옆 연속 배우자 고리/공통 자녀선에 놓임. 떠남/사망·가구 관계의 내부 의미 미확정. 사진 (원문 경로: evidence/ui13-019-successor-tree.jpg) · UI 관찰 (원문 경로: repro/ui13-observation.md) 추가076 토머스1293–1311 십자 표식과077전기 마을 떠남은 의미 후보.077파일명deceased는 사망 증거 아님. 사진 (원문 경로: evidence/root13-076-fresh-tree.jpg) · 사진 (원문 경로: evidence/root13-077-thomas-deceased.jpg) |
| 29 | UI-08 | 제한 확인 | 봄/여름/가을은 요약2개·채운칸2개, 겨울은 요약3개·세칸 모두 채움. 네 계절 대조에서 내용 누락 해석 반증. 빈틀의 미적 읽힘만 의견으로 남김. 사진 (원문 경로: evidence/root13-041-chapel-building.jpg) · 독립 판독 (원문 경로: repro/root13-early-review.md) |
| 30 | UI-09 | 실패 | 019:1600 설정 버튼 bbox1588,10,44,44로32px 창 밖.768/375의 정상 폭과 구분. 사진 (원문 경로: evidence/ui13-034-settings1600.jpg) |
| 31 | 지면-01 | 관찰 후보 | (61,37) 이랑 안 밑동/그루터기, 새 튜토리얼 경작지에서도 나무→그루터기 변화. 개간 중 표현 가능성; 논리 불법 점유 미확정. 사진 (원문 경로: evidence/wall13-ground6137.jpg) · 독립 판독 (원문 경로: repro/root13-early-review.md) |
| 32 | 청원자-01 | 제한 확인 | 과세 청원 국왕 전기17세·사망 표기 없음. 고인 청원 동일 조건은 미검증. 사진 (원문 경로: evidence/ui13-069-king-bio.jpg) |
| 33 | 기록-01 | 미재현 | 이번 실제 과세 납부 선택→기록400d/답했다/국왕+10·도시−5 일치. 사망 기록039→전기040도 일치. 사진 (원문 경로: evidence/ui13-070-tax-record.jpg) · UI 관찰 (원문 경로: repro/ui13-observation.md) |
| 34 | UI-10 | 실패 | 020: 새 가문 교체 후 가계도 앨리스의 두 줄 긴 이름 하단 잘림. 사진 (원문 경로: evidence/ui13-019-successor-tree.jpg) · UI 관찰 (원문 경로: repro/ui13-observation.md) |
| 35 | UI-11 | 실패 | 021:우물1280/375 닫기 기호 빈칸, 창고073은 빨간×.082/083은 파일명과 달리 도시대가옥의 추가 빈 기호 표본. 사진 (원문 경로: evidence/ui13-056-well1280.jpg) · 사진 (원문 경로: evidence/ui13-058-well375-qaoff.jpg) |
| 36 | UI-12 | 실패 | 022: 새 게임 첫 겨울 t3256 더보기 후 버튼만 사라지고 본문 추가 없음. 사진 (원문 경로: evidence/root13-031-winter-before.jpg) · 사진 (원문 경로: evidence/root13-032-winter-after.jpg) · 주검수 (원문 경로: repro/root13-observation.md) |
| 37 | UI-13 | 실패 | 023:1392여름370016 양모집산지 이전 칩이 실제 도시대가옥 제목/닫기 하단을 덮음. QA 꺼도 지속. 사진 (원문 경로: evidence/ui13-086-house-woolchip375.jpg) · 사진 (원문 경로: evidence/ui13-087-house-woolchip-qaoff.jpg) |
| 38 | UI-14 | 실패 | 024: 새 게임375px 닫기 x406.078,y486,w55.922,h44 전체 창 밖. 가로 휠 미복구/Escape 복구; Tab/Enter 미검증. 사진 (원문 경로: evidence/ui13-025-fresh-person375.jpg) · 사진 (원문 경로: evidence/ui13-026-fresh-person375-wheel.jpg) |
| 39 | UI-15 | 실패 | 025: 헛간 목표 입력 전1001 정지→촬영0000~0019 1×1001~1036, 후속1040 정지. 정확한 클릭 순간 미수집. 사진 (원문 경로: evidence/root13-009-barn-before-clear.jpg) · GIF (원문 경로: evidence/root13-goal-barn20.gif) · 전체 펼침 (원문 경로: evidence/root13-goal-barn20-unfolded.jpg) · 독립 판독 (원문 경로: repro/root13-early-review.md) 추가1447 표본593085 정지→목표 보기→소개 없이1×593138. 사진 (원문 경로: evidence/ui13-032-goal-before.jpg) · 사진 (원문 경로: evidence/ui13-033-goal-after.jpg) |
| 40 | 지면-02 | 관찰 후보 | t320000·줌1.899·pan1424,-850 안정화 표본에서 잔디/꽃/관목/흙패치 반복. 격자 접합 파손·타일링 원인 미확정. 휠 직후flat2 제외. 사진 (원문 경로: evidence/wall13-more-flat-stable-on.jpg) · 세계 (원문 경로: repro/wall13-observation.md) |
| 41 | 계보-03 | 관찰 후보 | 새 게임1312봄48546 토머스1293와 전기 부모 조앤/윌리엄1288의 출생 차5년. 책 부모는 다름. 입양/후견 설명 미발견이나 혈연 오류 단정 안 함.1304 다른 가문의 정상 표본과 분리. 사진 (원문 경로: evidence/root13-077-thomas-deceased.jpg) · 사진 (원문 경로: evidence/root13-078-thomas-parent-joan.jpg) · 주검수 (원문 경로: repro/root13-observation.md) |
| 42 | 건물-01 | 실패 | 027: t322929, 실제 선택 영주관 manor-house-29-17-0 (29,17), 줌2에서 갈색 지붕·회색 벽 도형이 주변 그림과 대비. 사진 (원문 경로: evidence/wall13-manor2.jpg) |
| 43 | UI-16 | 실패 | 028:4명 감소 기록이 DOM에 존재하지만 사진은 빈 얇은 띠. 정지 휠1200/닫고 재열기 후 동일. DOM 본문을 화면에서 읽었다고 하지 않음. 사진 (원문 경로: evidence/ui13-035-population.jpg) · 사진 (원문 경로: evidence/ui13-037-population-reopen.jpg) |
| 44 | UI-17 | 제한 확인 | 030:337003 정지 HUD42195d/지금42198d 차이. 해당 틱 그대로 재로드 통제 미확보. 이후337091 저장·재로드는768명/386일/42204d/지금42204d 일치. 다른 틱 음성 대조이며 저장으로 해소됐다고 하지 않음. 사진 (원문 경로: evidence/control13-017-tax-after-ledger.jpg) · 사진 (원문 경로: evidence/control13-023-tax-paused-reload4s.jpg) · 통제 (원문 경로: repro/control13-observation.md) |
| 45 | UI-18 | 실패 | 031:375px 문제 강조는 보이나 QA켬/끔 모두 범례 비표시. 사진 (원문 경로: evidence/ui13-010-problem375.jpg) · 사진 (원문 경로: evidence/ui13-011-problem375-qaoff.jpg) |
| 46 | 건물-02 | 관찰 후보 | t320000 실제 선택한 보리 헛간000064(41,43)/밀 헛간000047(55,48)의 같은 초가·목골조·자루/수레 외형 반복. 동종 미적 후보이며 오설치 미확정. 사진 (원문 경로: evidence/wall13-more-facilityA.jpg) · 사진 (원문 경로: evidence/wall13-more-facilityB.jpg) · 세계 (원문 경로: repro/wall13-observation.md) |
| 47 | 장전환-02 | 실패 | 032:제3장 시작 후67틱 진행160767 정지·저장→수동 재로드/재접속4초+20초에 제2장 결산 재노출. 재개 후 틱은 가려져 DOM/QA 보조값.1364/t256864 음성 대조는 세계 유지. 사진 (원문 경로: evidence/control13-003-ch3-played.jpg) · 사진 (원문 경로: evidence/control13-005-manual-reload-4s.jpg) · 사진 (원문 경로: evidence/control13-014-negative-continueplus20s.jpg) · 통제 (원문 경로: repro/control13-observation.md) 추가 새 게임1322년 제2장 진입90255 정지→정상 저장123→수동 재로드·브라우저 이어하기 각각4초 대기 후와 후속 촬영에서 제1장 결산 재노출. 저장 (원문 경로: evidence/root13-123-chapter2-manual-save.jpg) · 재노출 (원문 경로: evidence/root13-124-chapter2-manual-reload4s.jpg) · 후속 확인 (원문 경로: evidence/root13-125-chapter2-manual-reload24s.jpg) · 이어하기 (원문 경로: evidence/root13-126-chapter2-continue4s.jpg). |
| 48 | 지면-03 | 제한 확인 | t320000 같은 카메라/줌에서 OFF/ON 두 왕복. 도로·물가·성벽·농지 표현 변화 확인; 이번 보고만으로 특정 경작 무늬 소실 실패까지 확정 안 함. 사진 (원문 경로: evidence/wall13-more-toggle0.jpg) · 사진 (원문 경로: evidence/wall13-more-toggle1.jpg) · 세계 (원문 경로: repro/wall13-observation.md) |
| 49 | 서비스 안내-01 /033 | 관찰 후보 | 같은 정지81478 주택(46,42)의 첫 방해/펼친 조건에 시장 거리7/범위8인데 멀다는 안내. 후속 정상 이어하기에서 주택000004(43,43)는 시장4/8·교회 이용가능10/12 표시. 적용 기준 설명 불일치 후보이며 서비스 계산 오류 미확정. 첫 방해 (원문 경로: evidence/root13-096-house-front.jpg) · 펼친 조건 (원문 경로: evidence/root13-105-service-market-detail.jpg) · 독립 판독 (원문 경로: repro/service13-review.md). |

검토 기준 (원문 경로: CHECKLIST.md). 관찰은 종료했으며 독립 판독·최종 감사 및 패키징 확인은 별도다.

# 지정 회귀 결과

| 항목 | 판정 | 실제 재현·증거 |
|---|---|---|
| QA034 본문 소실 | 닫힘, 지정 재현 통과 | 같은 1384 과세 원본→337151틱. [이전](evidence/before15-QA034-tax1600.jpg) / [현재](evidence/ui16-03-tax1600.jpg). 1600/1280/1024 모두 본문·두 선택·예측·보류 표시 |
| QA016 보류 겹침 | 닫힘, 지정 재현 통과 | 같은 1394 길드 376157틱, 세 폭에서 경계 분리. [1024](evidence/ui16-18-guild1024.jpg). [보류 후 재개](evidence/ui16-21-guild-reopened-decision.jpg) 및 실제 선택 성공 |
| QA010 호칭 | 닫힘, 기존 충돌 통과 | 동일 청원 ‘작은 토머스 밀러·82살’. 옛1407 원본의 [가계도](evidence/root16-007-tree-expanded.jpg)·[인물 카드](evidence/root16-004-john-card.jpg)에도 큰/작은 재적용 |
| 돈 표기 | 확인 표본 통과 | [장부](evidence/root16-002-ledger.jpg) £420 10s 5d; [원장 역사](evidence/root16-018-history-1351.jpg) 벌금8s4d/예측£75 14s; [연대기 책](evidence/root16-022-book-raid.jpg) 습격£4 16s; [실제 내보낸 글](repro/chronicle1407-export.txt)도 전환 |
| QA015 전기 장식선 | 실패, 열림 유지 | 같은1384 국왕 전기337158틱1600폭, 기록 없음 문구가 중앙선을 관통. [증거](evidence/ui16-30-king-empty-bio1600.jpg) |
| QA035 설정 하단 가림 | 실패, 열림 유지 | 같은1384 저장336292틱, 패널 내부 끝까지 스크롤한 [1024](evidence/root16-020-settings-bottom1024-after-scroll.jpg)·[1280](evidence/root16-021-settings-bottom1280-after-scroll.jpg). 명령버튼이 저장행을 덮음 |

## 청원 카드 표본

| 화면의 장 / 내용 | 틱 | 표본 | 판정 |
|---|---:|---|---|
| 제3장 / 1349 임금 요구 | 196002~196003 | [1600](evidence/root16-025-wages.jpg), [1280](evidence/cards16-wages1280.jpg), [1024](evidence/cards16-wages1024.jpg) | 내용·선택·예측·보류 표시 통과. 고인 표시는 별도 QA036 후보 |
| 제3장 / 1349 빈 필지의 주인 | 198155 | [1600](evidence/root16-027-after-wages.jpg), [1280](evidence/root16-028-emptylots1280.jpg), [1024](evidence/root16-029-emptylots1024.jpg) | 내용·선택·예측·보류 표시 통과 |
| 제4장 / 1373 길드 인가 청원 | 292153 | [1600](evidence/cards16-ch4-wave1600.jpg), [1280](evidence/cards16-ch4-wave1280.jpg), [1024](evidence/cards16-ch4-wave1024.jpg) | 본문·인가/거부 긴 설명·예측·보류 모두 분리·표시 통과 |
| 제4장 / 1374 직물 대 곡물 | 296156 | [1600](evidence/cards16-ch4-cloth1600.jpg), [1280](evidence/cards16-ch4-cloth1280.jpg), [1024](evidence/cards16-ch4-cloth1024.jpg) | 본문·두 선택·예측·보류 표시 통과 |
| 제5장 / 1384 국왕 과세 | 337151 | ui16-03/04/05 | 통과. 실제 납부 선택 후 정상 진행 |
| 제5장 / 막간 내용 1394 길드 다툼 | 376157 | ui16-16/17/18 | 통과. 보류·재개·길드 선택 성공 |
| 제5장 / 막간 내용 1396 교회 증축 | 384153 | [1600](evidence/ui16-25-church1600.jpg), [1280](evidence/ui16-26-church1280.jpg), [1024](evidence/ui16-27-church1024.jpg) | 통과. 길드와 교회 삽화도 구별 |

옛 저장의 1384~1396 HUD는 실제로 제5장이다. 연대만으로 제4장 검증으로 바꿔 세지 않는다. 처리 완료 사건 요약·연대기 과거 기록을 현재 선택 모달 통과로 세지 않는다.

## 한계

- 현재 호칭과 별개로 1383 로버트·1401 머틸다를 언급한 과거 역사 문장에는 ‘나이 든’이 남는다([화면](evidence/root16-010-book-settled.jpg), 내보낸 글). 원래82살 ‘젊은’ 청원 충돌은 해소됐지만 모든 과거 문자열을 다시 썼다는 뜻은 아니다.
- 장부의 원시 100,925d 보조 합계와 잔돈 d는 남는다. 금액의 모든 계산·이벤트 유형 전수 검증은 아니다.
- 임금 청원 보류 후 재개는 독립 관찰에서 미확보였고 길드는 실제 재개 성공했다. 도구 탐색 실패를 제품 조작 불능으로 등록하지 않았다.
- 목록 밖 누적 항목은 기존 판정을 보존하고 이번 미검증으로 둔다. 전체 정기 시험은 같은 날짜 반복하지 않았다. 코드 수정·빌드·성능 측정 회차가 아니다.

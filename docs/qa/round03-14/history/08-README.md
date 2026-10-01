# 게임 관찰 QA — 8회차

**관찰 종료 · 45개 기준: 실패23 / 통과1 / 제한통과6 / 미재현6 / 미검증7 / 후보2.** 고유 재현23개, 새 ID026–031. 이전 회차의 통과를 복사하지 않았다.

- 본선 `61d79e8e7b6146cfca4da8c9ccc0a83c234c8898`, 시작 `2026-09-30T17:38:32.661851Z`. 종료 `2026-09-30T19:40:47.028Z`, 약 122분 관찰·증거 정리. ZIP 검증은 별도 검증 파일에 기록한다.
- 일반 UI로 관찰했다. 제품 코드 수정·증명 모드·직접 틱·성능 측정 없음. 잠금·대기열을 조회하지 않았다.
- 항목당 한 줄 발견 (원문 경로: FINDINGS.md) · 전체 회귀표 (원문 경로: REGRESSION.md) · 재시험 방법 (원문 경로: CHECKLIST.md).

주요 결과:
- **012 재현:** 겨울→봄 1×에서 대각 지면 경계가 이동한다. 110프레임 펼침 (원문 경로: evidence/root8-winter-spring110-unfolded.jpg) · GIF (원문 경로: evidence/root8-winter-spring110.gif).
- **026 보행:** 같은 운반인의 이동 중 다리 자세가 유지된다. 추적 JPEG (원문 경로: evidence/wall8-road-first32-tracked.jpg) · 전체 펼침 (원문 경로: evidence/wall8-road80-unfolded.jpg) · GIF (원문 경로: evidence/wall8-road80.gif).
- **027–031:** 근접 영주관 화풍, 인구 기록 띠, 좁은 연대기, HUD/저장 인구 차이, 문제보기 범례 미표시. 영주관 (원문 경로: evidence/root8-32-manor-select.jpg) · 인구 (원문 경로: evidence/ui8-46b-population-settled.jpg) · 연대기 (원문 경로: evidence/ui8-70-fresh-record375.jpg) · 저장 전 (원문 경로: evidence/root8-87-save-stable.jpg) / 재개 후 (원문 경로: evidence/root8-88-manual-reload.jpg) · 범례 (원문 경로: evidence/root8-110-legend-qaoff.jpg).
- **011 닫힘 유지:** 같은1394 길드/1396 교회 삽화는 구별된다. **004·007 미재현 유지**, 고침으로 바꾸지 않았다.

장1→2, 전쟁 도래, 역병 뒤 장3→4→5·1430년까지 정상 진행했고, 별도 무편집1447 저장에서1450 결말·유산·책을 확인했다. 화면1600/1280/768/375, 실제 줌0.5–2, 사계절·강우·겨울 흰 입자를 관찰했지만 모든 조합을 통과시킨 것은 아니다. 실제 식구31명, 밀2094, 별도 도시 재정175446d·연납금11880d·저장2600/2600을 열람했으며 숫자나 이름을 인위적으로 만들지 않았다.

**미확인:** 새 땅 선택과 잠긴 방향 내부(약속·영수증·이웃 영지), 멈춘 사람의 동일 ID, 원래 사망 청원자, 전체 날씨·동물 걸음. 동물 추가 탐색 (원문 경로: repro/animal8-observation.md)에서 실제 선택된 것은 사람 운반인이어서 동물 시험으로 바꾸지 않았다. 계보 관계·빈 결산 슬롯·이랑 속 나무 등은 후보로 남겼다. 화재/반란 영상은 사건 칩 소실 뒤여서 고유 행동 검증으로 세지 않는다. 상세 범위 (원문 경로: REGRESSION.md) · 겨울 촬영 공백과 한계 (원문 경로: repro/winter-weather8-review.md).

증거는 재현별 JPEG, 움직임 GIF+전체 프레임 펼침, 실제 QA좌표/촬영시각과 독립 판독을 포함한다. 감사 (원문 경로: repro/report-audit-final-prep.md) · 경량판5종 직접 판독 (원문 경로: repro/lite-readability-review.md) · 정상 저장3개 바이트 검증 (원문 경로: repro/normal-save-byte-verification.json). 저장 본문은 파싱하지 않았다. 경량판은 JPEG를 재압축하고 GIF 해상도·색을 줄이되 프레임 수/시간/반복을 보존하며, 원본은 작업 폴더에 남긴다. 패키지의 최종 CRC·SHA 결과는 전달 시 별도로 공개한다.

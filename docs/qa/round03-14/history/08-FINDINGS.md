# QA ROUND 08 — 재현 목록

고유 재현 **23개**. 담당 분류는 추정이며 내부 원인 확정이 아니다. QA029는 기존 UI-02를 보강했으며 기준을 별도로 추가하지 않았다. 사진별 시각·카메라·입력은 대응 repro JSON과 회귀표 (원문 경로: REGRESSION.md)에 있다.

- **QA003 · 연결 · 중간 · 그림·렌더 추정** — 틱 320000 · 줌 2.000 · 칸 (45,42): 같은 문/벽 끝에서 연결이 끊겨 보이는 증상이 유지된다. 논리 고리는 닫혀 있다. JPEG (원문 경로: evidence/wall8-same003.jpg)
- **QA005 · 가림 · 중간 · 렌더 추정** — 시작 틱 319560 · 줌 2 · 파란 수레 ID 미확보: 별도 파란 수레가 벽면에 겹친다. 파란 신원을 다른 선택 ID로 대신하지 않았다. JPEG (원문 경로: evidence/wall8-selected60-detail.jpg) · 전체 GIF (원문 경로: evidence/wall8-selected60.gif) · 전체 펼침 (원문 경로: evidence/wall8-selected60-unfolded.jpg)
- **QA010 · 인물 표기 · 낮음 · 엔진 추정** — 틱 51474 · 줌 2.000: 이번 새 게임에서도 나이 든 조앤 8살·헨리 10살이 재현돼 기존 저장만의 문제로 한정할 수 없다. JPEG (원문 경로: evidence/prep8-38-old-joan-fresh.jpg)
- **QA012 · 계절 전환 · 중간 · 렌더 추정** — 틱 259864→260084 · 1× · 줌 2: 후속 겨울→봄 1배속110장의70~74에서 대각 지면 경계를 재관찰했다. 앞선 봄→여름 미관측은 그 표본의 한계로 남기며 내부 원인은 미확정이다. JPEG (원문 경로: evidence/root8-winter-spring110-unfolded.jpg) · GIF (원문 경로: evidence/root8-winter-spring110.gif)
- **QA013 · 패널 가림 · 중간 · 렌더 추정** — 틱 58266 · 줌 2.000: 375 목표판이 새 게임 대기근 조짐 칩을 가리며 접기만으로 복구되지 않는다. 건설 토글 후 같은 칩은 열린다. JPEG (원문 경로: evidence/prep8-42-goals1314-375.jpg)
- **QA014 · 직함 표기 · 낮음 · 렌더 추정** — 틱 601168 · 줌 2.000: townsfolk·king뿐 아니라 이번 정상 진행에서 생성된1450년 기록에도 ‘lord 일을 맡았다’가 노출된다. 새 기록 JPEG (원문 경로: evidence/ui8-extra-49-lord-bio1600-new1450.jpg)
- **QA015 · 본문 겹침 · 낮음 · 렌더 추정** — 틱 337003 · 줌 2.000: 국왕 빈 전기 문구가 중앙 장식선에 겹친다. JPEG (원문 경로: evidence/ui8-30-emptybio1600.jpg)
- **QA016 · 선택지 겹침 · 중간 · 렌더 추정** — 틱 308155 · 줌 2.000: 길드 결정·후속 과세1600/1280·자치 협상에서 보류 버튼이 둘째 선택지 경계·예측 문구를 덮는다.375 초기 잘림은 별도 UI-02로 기록한다. JPEG (원문 경로: evidence/root8-159-tax1280.jpg) · 자치 협상 (원문 경로: evidence/root8-185-rebellion.jpg)
- **QA017 · 화면 밖 조작 · 중간 · 렌더 추정** — 틱 0 · 줌 1.620: 375 fresh 생업 분류가 위로 이탈하며 재열기/위 휠로 복구되지 않는다. JPEG (원문 경로: evidence/prep8-02-production375.jpg)
- **QA018 · 설정 겹침 · 중간 · 렌더 추정** — 틱 430090 · 줌 1.800: 1280/375 설정의 튜토리얼 설명과 소리 제목이 겹친다. JPEG (원문 경로: evidence/ui8-12-settings-alone1280.jpg)
- **QA019 · 화면 밖 조작 · 중간 · 렌더 추정** — 틱 430090 · 줌 1.800: 1600/1280 설정 표적 오른쪽32px가 창밖이다. JPEG (원문 경로: evidence/ui8-12-settings-alone1280.jpg)
- **QA020 · 이름 잘림 · 중간 · 렌더 추정** — 틱 430090 · 줌 1.800: 가계도 두 줄 이름 하단이 카드 안에서 잘린다. JPEG (원문 경로: evidence/ui8-07-tree1600.jpg)
- **QA021 · 기호 식별 · 낮음 · 렌더 추정** — 헛간 (41,43) · 줌 2 · 즉시 QA틱 갱신 제한: 헛간 상세 닫기 기호가 기본/Tab에서 읽히지 않고 호버에 의존한다. JPEG (원문 경로: evidence/ui8-23-barn-basic.jpg)
- **QA022 · 무효 확장 · 낮음 · 렌더/UI 추정** — 틱 337019 · 줌 1.620: 과세 사건 더 보기는 추가 내용 없이 버튼만 없앤다. JPEG (원문 경로: evidence/ui8-35-tax-more-after375.jpg)
- **QA023 · 조작 가림 · 중간 · 렌더 추정** — 틱 미수집 · 줌 미수집: 사건 칩이 닫기 영역을 가려 상세 닫기 클릭이 사건을 연다. JPEG (원문 경로: evidence/ui8-33-barn-close-lower.jpg)
- **QA024 · 화면 밖 조작 · 중간 · 렌더 추정** — 틱 430090 · 줌 1.620: 375 인물 닫기 표적 전체가 창밖이다. 가로 휠로 복구되지 않았고 Tab 초점 후 Enter로 닫기는 성공했다. JPEG (원문 경로: evidence/ui8-15-person375-fresh.jpg)
- **QA025 · 의도 밖 재개 · 중간 · 렌더/UI 추정** — 틱 373283→373311 · 정지→1× · 줌 2: 목표 보기 버튼은 소개 없이 일시정지를 1배속으로 해제한다. 전 JPEG (원문 경로: evidence/ui8-55-goal-before1393.jpg) · 후 JPEG (원문 경로: evidence/ui8-57-goal-after1393.jpg) · GIF (원문 경로: evidence/ui8-56-goal-click1393.gif) · 20프레임 펼침 (원문 경로: evidence/ui8-56-goal20-unfold.jpg) · 장5 추가 (원문 경로: evidence/root8-204-ch5-goal-paused-action.jpg)
- **QA026 · 보행 · 중간 · 렌더 추정** — 틱 320746→320905 · 1× · 줌 2 · 시작 칸 (21,32): 열린 도로 운반인의 1배속 이동 중 다리 벌림 자세가 유지돼 미끄러짐으로 읽힌다. 내부 구현·전체 인물은 미확정이다. JPEG (원문 경로: evidence/wall8-road-first32-tracked.jpg) · 전체 GIF (원문 경로: evidence/wall8-road80.gif) · 전체 펼침 (원문 경로: evidence/wall8-road80-unfolded.jpg)
- **QA027 · 화풍 · 중간 · 그림·렌더 추정** — 틱 200289 · 줌 2.000 · 칸 (35,16): 실제 선택한 영주관이 근접 줌에서도 단색 사각벽·평면 지붕으로 남아 주변 화풍과 다르다. 이미지 누락 원인은 미확정이다. JPEG (원문 경로: evidence/root8-32-manor-select.jpg)
- **QA028 · 기록 잘림 · 중간 · 렌더 추정** — 사진 틱353909 / 후속 JSON353934 · 줌2.000: 인구 기록이 약22px 띠로 압축돼 제목·행이 보이지 않으며 재열기·휠로 복구되지 않는다. JPEG (원문 경로: evidence/ui8-46b-population-settled.jpg)
- **QA029 · 좁은 화면 · 중간 · 렌더 추정** — 틱 591597 · 줌 1.620: 375 fresh 연대기에서도 목록이 보이지 않고 닫기가 창밖이다. 휠로 복구되지 않지만 Escape 및 별도 Tab/Enter는 닫기에 성공한다. JPEG (원문 경로: evidence/ui8-70-fresh-record375.jpg) · 복구 (원문 경로: evidence/ui8-71-fresh-record375-escape.jpg)
- **QA030 · 표시 불일치 · 중간 · 엔진/렌더 추정** — 틱 256233 · 줌 1.063: 같은 정지 틱의 HUD238/방금 저장한 행241이 불일치하고, 정상 재로드 뒤 HUD241·식량373으로 달라진다(전367). 주민 손실·저장 손상·원인은 미확정이다. 전 JPEG (원문 경로: evidence/root8-87-save-stable.jpg) · 후 JPEG (원문 경로: evidence/root8-88-manual-reload.jpg)
- **QA031 · 범례 미표시 · 중간 · 렌더 추정** — 틱 265446 · 줌 2.000: 문제만 보기의 세계 강조는 켜지지만 원인 범례가 화면에서 읽히지 않는다. QA 끔과 독립 저장에서도 같으며 DOM 문자만으로 표시 성공이라 하지 않는다. JPEG (원문 경로: evidence/root8-109-problem-legend-settled.jpg) · QA 끔 (원문 경로: evidence/root8-110-legend-qaoff.jpg)

004·007은 미재현이며 수정 완료로 닫지 않는다. 011은 같은1394/1396 삽화 쌍만 구별됐다. 전체 범위 (원문 경로: REGRESSION.md) · UI 재현 (원문 경로: repro/ui8-observation.md) · 새 게임 (원문 경로: repro/prep8-observation.md).

계보·결산 빈칸·이랑 안 나무·화풍·resize 후 휠·목표 체계 설명은 후보이며 새 결함 수에 넣지 않았다. 가족 대조 (원문 경로: repro/family31-independent-review.md) · 추가 새 게임 (원문 경로: repro/prep8-extra-observation.md) · 추가 UI (원문 경로: repro/ui8-extra-observation.md) · 주검수 (원문 경로: repro/root-observations.md).

방향의 약속·영수증·이웃 영지 및 개체 동일성은 미검증이다. 화재/반란 영상은 칩 소실 뒤라 해당 동작 누락의 증거가 아니다. 화재 (원문 경로: repro/fire-active80-review.md) · 반란 (원문 경로: repro/rebellion-world80-review.md) · 감사 (원문 경로: repro/report-audit-final-prep.md).

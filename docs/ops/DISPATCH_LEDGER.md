# 작업 지시 장부 (Dispatch Ledger) — 2026-10-02 기준

목적: 여러 세션에 섞여 나간 지시가 **빠짐없이** 이행됐는지, 결과 보고가 올 때 Claude가 이 표의 **관문·판정 항목을 하나씩 대조**한다. 보고가 오면 해당 줄을 "완료(커밋)"로 옮기고, 빠진 항목은 다음 메시지에 되돌린다.
본선: `codex/phase15-organic-ground` (main 아님). 검증 원칙: 원격 커밋 조상 확인 → 코드·장부 직접 대조 → 관문 수치 확인.

---
## A. 엔진 세션

### Engine B — LM-E9c 계약 요청 전달 (2026-10-06)
- [x] `engine-B-read-bundles.md`, `engine-B-7.md`, `engine-B-remaining.md`, `engine-B-EVA-AUTO.md` 요청서 전달. 런타임 구현과 장기 관문은 미완료. 본선 문서 커밋은 이 항목을 추가한 커밋이다.
- [ ] Engine B 구현 게시: DGX 분포·가드레일·최종 변경 시험 및 사건 그림 총량 관문 대기.

### A1. 완료·검증됨
| 작업 | 본선 커밋 | 비고 |
|---|---|---|
| BOT-4 | 34ae1735 | GP-1 수확 기록·GP-4 방앗간, 기준선 bdcfe2c |
| FIX-11 | 5e214ef7 | 후견·사망표·큰/작은·영주관 자리·stuckStock 등 15항목 |
| LM-E9b-v41 | 53aeba5f | 콘텐츠 v4.1(011 교체·201~215 추가, 215건), 125년 분포: 도시·자연·세력 모두 이웃의 절반 이상 |
| MANOR-1 | 53aeba5f | 영주관 3×3·가문 하나(드 해버럴)·저장 v50, 기준선 baseline-11205c9 |
| RECOVER-1 | 53aeba5f | 이주·비축 문·모자란 쪽이 당김·곡창 보리 40 %·굶는 가구 반응 — 붕괴 0, 흑사병 뒤 10년 84~93 % |
| EXT-1 | 05a3ff24 | 열린 id: 건물·세력 종류를 데이터 id 목록에서, CONTENT_REGISTRY, 빠짐없는 표는 정의의 칸, 저장은 모르는 id 거부 — 가드레일 해시 그대로 |
| LM-R2-E | 05a3ff24 | 렌더 LM-R2 요청 넷: 봤음 기록(저장 v51)·이웃 문장·읽기와 거절 까닭·단어표, v4.1-senders 보류 셋 켜짐 |
| LM-E1 / LM-E1b | 26507989 / 267b43b8 | 자율 성장·영수증·후보 2~5·장려금 한도 |
| LM-E2 | 83599119 | 영지·권리(권원/점유)·소송·이웃 셋 |
| QA 3~14 엔진 몫 | 37538017 | 저장 왕복 무결함·seenTick·호칭 v39·serviceMeasure·£s |
| LM-E3 | bc24d036 | 협상·약속 장부·혼인→상속 |
| FIX-12 | 20eec341 | 채무 분할(장부 25%)·남자 친족 신랑·QA036·원장 사람 id·습지 캐시 |
| LM-E4 | 6d039cd | 위임·주의력·연례 감사 |
| LM-E5 | f5aec50 | 무작위 seed·확률 선택·땅 변화, 기준선 0028311 |
| FIX-13 | 01bb7b92 | 과부산 등 비현금 조항·1배속 A·10배속·노화 |
| LM-E8 | bdf84129 | 수직 조각 시나리오·멈춤 사유·결정 밀도 |
| FIX-14 | eca4a97f | 초반 지루함(홈 청원 12·선례·세력 다섯)·TT-5 |
| FIX-15 | e87de7bc | 물 둘레 성벽(seed 77777) |

### A2. 보냄 — 결과 대기 (순서대로)
**① FIX-16** — 관문·판정 대조 항목 — 본선 `eff6b068`:
- [x] 굶주림 사망: 빵값 가중치 **대부분은 식량 모자란 가구에만**, 식량 있는 가구는 작은 몫 + 원인 문구 **"기근 해에 병들어 죽었다"**
- [x] **구휼/방관에 따라 대기근 사망 수가 다른지 표**
- [x] **묶인 밀을 식량 일수에서 뺌** + "묶인 밀 N — 풀리면 +M일" 데이터(렌더용)
- [x] `stuckStock`에 **창고 가득(받을 곳 가득)** 포함
- [x] 엔진에 **굶는 가구 수** 함수(렌더 LM-R1 식량 분해용)
- [x] 목책 **칸당 15 → 8**, 시장·교회가 목재 기다리면 **목책은 비축의 절반까지만**
- [x] 캠페인·가드레일 바뀌면 이유와 새 기준선, **봇 1장 끝 해 비교표**
- [x] 회귀·클론(DGX), 실행 위치 명시
**② LM-E6a 직업 확장 1차**(영주 모드에서만, 화면 없음) — 본선 `40e1f77`:
- [x] 직업 20(핵심 12 + 조건부 8) 데이터 {입력·출력/서비스·작업장 원형·위치 점수 항목·계절·등급·길드 묶음·등장 조건}
- [x] 작업장 원형 12를 **필지 구조**로(새 건물 종류 늘리지 않음)
- [x] 가구 직업 선택이 위치 점수로, **영수증**에 항목·값
- [x] **운송 용량이 물류 처리량** — 운송 늘리면 묶인 물자 줄어드는 비교표
- [x] 거리 이름 생성 사례
- [x] 사슬마다 **병목 하나** 데이터
- [x] 영주 모드 seed 3개 1300→1340 직업 분포가 다름, 푸줏간→무두→구두 사슬이 돎
- [x] 샌드박스·캠페인 가드레일 불변
- [x] 넘김: 직업 20 목록·작업장 원형별 필요한 그림 목록
**③ COPY-1e**(문구 감사 엔진 몫 23건, `docs/design/copy-audit-20261002/`) — 본선 `7167b1c2`:
- [x] **CA-001** 청원 답을 수락/거절로만 기록 → 청원·답 조합별 뜻, 시험으로 박음
- [x] CA-007 노동자법(1349 조례 vs 1351 법), CA-008 1391 칼레
- [x] 나머지 엔진 몫, 용어는 `docs/design/glossary.md`

### A3. 다음 후보(아직 안 보냄)
- [ ] **GP7-ENGINE** 결정의 무게(게임 원칙 v0.3, 결정 GP-7): 작은 일은 처음부터 청지기가 상시 방침대로·철마다 요약, 큰 결정(권리·땅·혼인·상속·후견·큰 돈·여러 해 약속·세력 결렬·위기)만 영주에게. 겨울 강제 홈 청원(FX14-1)과 두 번 답 선례(LM9-3)를 바꿈. 관문: 125년 판 해마다 무거운 결정 0~4, 결정 없는 해에도 연대기·철 요약에 변화

**확장성 EXT**(결정 EXT-D1~D3, [extensibility.md](../design/extensibility.md); RECOVER-1·LM-R2 마무리 뒤 LM-E9c와 번갈아, 순서대로):
- [x] **EXT-1** (본선 `05a3ff24`) 열린 id: 건물·물자·직업·세력 종류를 데이터 레지스트리 + 문자열 id로(로드 때 검증) — 동작 불변, 가드레일 해시 그대로
- [ ] **EXT-2** 달력·화폐를 설정값으로(연도 범위·계절·장 구조·화폐 단위와 표기) — 동작 불변
- [ ] **EXT-3** 팩 껍데기: core 팩·mod.json·저장에 팩 id·판·켠 모듈과 모드 목록 — 동작 불변, 저장 이행
- [ ] **EXT-3b** 모드 불러오기·합치기·패치 연산·파일과 줄을 짚는 오류 보고·`npm run mod:validate`
- [ ] **EXT-6** 예제 모드 `mods/example-fantasy-march/`(패치로 이름·화폐·작물, 건물 하나·사건 셋·자리 그림, 역병 끄고 저주 켬) — 새 게임 10년·mod:validate·core 가드레일 해시 불변을 정기 시험에
- (점진) EXT-4 모듈화는 그 체계를 고칠 때마다, EXT-5 문구 키는 영어판 때

LM-E6 2차·LM-E7 가솔과 봉사(G-LM 뒤), 영주 모드 L4 지연·증분 걷기, 지역 날씨 사건(홍수·폭풍·가뭄·강 얼음), 4·5장 특권 영지 모델 이전(캠페인 통합 때), heriot·merchet 수치 근거.
- [x] **LM-E9 사건 등록기**(본선 `b9d7f571`, 새 사건 분포 관문은 사용자 판정으로 LM-E9b): NE01 + 홈 선례 NE10(FIX-14는 지도 밖 영지만 — 코드 확인) + NE03 기간 있는 감면·분할 납부 + NE08 권리 범위 판결, 콘텐츠 2차 형식 제안 기준 — COPY-1e 다음
- [x] **LM-E9b 콘텐츠 정본 v4**(본선 `24a5769b`): R1 조건·바인딩 어댑터, R2 소송 후보, R3 보류의 대가, R4 복합 원자성, 이웃 청구·Paston 되찾기, 한 번뿐인 사건 나눠 쓰기 — LM-E9c(R5)는 묶음 표로
- [x] 엔진: 가문 이름·문장을 저장 데이터로(결정 HOUSE-1, 기본 드 해버럴) — 본선 `b9d7f571`(LM-E9 `registry.house`)

---
## B. 렌더 세션

### B1. 완료·검증됨
UI-10 91a602a1 · SMOOTH-2R 653af2e2 · NAT-2 8ebdcf5c · UI-AUDIT-1 3acc04ff · QA-034 핫픽스 e531560e · LAND-UI b90c0eca

### B2. NAT-4 — 본선 병합(렌더 세션)
- [x] QA 렌더 몫: 025 정지 중 목표 보기, 032 결산 재노출(엔진 seenTick 사용), 005 운반꾼 성벽 겹침, 003 목책 접합(그림 몫 N4-D4), 026 수레꾼 걸음(1픽셀 들림 + Astra 반대 보폭), 012 첫 겨울 대각선(NAT-3으로 N4-D1), 022 더보기, 028 인구 기록 빈 띠, 014 "king", 030 화면 갱신/자동저장 선택 확인 — 본선 `21a43547`
- [x] 033 거리 단위 문구(serviceMeasure) — NAT-4에서 빠짐, COPY-1r로(시장 막힘 판정도 옛 칸 반경이라 진단 모델 둘을 함께 고침; 보고서 3b) — COPY-1r 본선 `9c0d0bf7`
- [x] 아트 감사 코드 몫: **BLD-06 상태 오버레이 함께 변환(P1)**, BLD-01 옛 평면 시설 7장 제거, BLD-07 문/사람 비율·먼 줌 최소 배율, RUN-03 나무 좌우 반전 금지, RUN-02 겨울 창고/집 눈 차이, ENV-03 옛 물 대비 — 본선 `21a43547`
- [x] 빠르게 인장 하나(5×↔10×, 모서리 표 12px, 키 5·0), HUD 27줄 중앙값 예산 안 — 본선 `21a43547`
- [x] 엔진 넘김: palisadeProposalForPlacement, history.summary(record, state) — 본선 `21a43547`
- [x] **17MB 증거 가지 재구성**(원격 미푸시 → 새 가지), `git diff --stat` 첨부, ui-geometry 입력 해시 일치 확인, "증거 3MB 넘으면 실패" 검사 여부 — 본선 `21a43547`
- [x] **N4-D1~D5 한 줄씩 보고** → Claude 판정 필요(보고서 4절)
- [x] 1280·태블릿 HUD 여유 0 → LM-R1에서 회복 — 영주 모드는 명령 핀으로 되찾음(1280 건설 15.3 → 7.5, 보통 6.5 → 4.3), 샌드박스·캠페인 여유 0은 그대로(LR1-D6 사용자 판단) — 본선 `5d333071`

### B3. 대기열(순서)
**NAT-5 땅 자연스러움** — [x] QA-040 숲 바닥 직각 판(불규칙 경계 + Wave 41 띠: 여름 A·B 번갈아, 겨울 앞 판), Wave 22 띠 넓히고 부드럽게 · [x] QA-039 백악 바위 마름모·검은 사각(경계 부드럽게, Wave 41 바위) · [x] QA-038 지도 선택 **seed 칸 + 무작위**, 강가 고정 해제 · [x] Wave 41 29장 + 폭 1 여울 + **Wave 42 땅의 변화 단계**(CSV 접속 규칙) 설치 · [x] **성벽 검증 `{waterReach: true}`** · [x] 습지 중앙 수평 색 경계, 빗물통이 사람 키만 함(검사기 발견) · 관문: 다섯 땅 × 여름·겨울 전후(QA 17 같은 카메라) — 본선 `5fcf90e1`(Wave 41은 27장 + 바위; seal_slot은 LM-R1. 빗물통은 그림 몫으로 Astra에. 습지 긴 경계는 땅 생성기 몫, 보고서 1절)
**COPY-1r** — [x] CA-002 장부 `+240`, CA-005 납부액 3d, CA-006 계절 결산 단위(상세는 완전 표기) · [x] CA-003 길드 "작업 시간 25% 단축" · [x] CA-004 파종 안내 · [x] 나머지 화면 몫 · 용어 glossary, 튜토리얼 "집사"→청지기 · [x] QA-033 거리 단위(엔진 `serviceMeasure` — 시장은 길 걸음, 우물·교회는 칸; NAT-4에서 넘어옴) — 본선 `9c0d0bf7`(집사는 src에 없음 — 영주 모드 튜토리얼에서 청지기로, 보고서 6절)
**LM-R1 영주 모드 첫 화면** — [x] "왜 여기에?" 영수증(고른 곳 vs 다음 후보·확률·관련 결정) · [x] 방침·장려금(25% 한도 거절 사유)·시장 부담 · [x] 도시의 요청·선포 대기 · [x] Wave 37 집 앞 표지(32장) · [x] 영주관 그림·빈 영주관(a_empty·b_empty-v2) · [x] 관계 예측·kingAt·"늙은 영주" 문구·후견인 표시 · [x] 영주 모드 건설 서랍→명령 핀(예산 회복) · [x] Wave 38 버튼(재작업 포함) · [x] FIX-14 홈 청원 12 + **Wave 44 삽화** + 청지기 선례·recurring · [x] lordSliceFactionsMet · [x] **플레이테스트 여섯**: 목표 고정·창고 가득 경고·식량 분해(굶는 가구·묶인 밀)·계절 결산 알림화·불탄 집 패널·장 흐름 vs 목표 · [x] **Astra 감독관 B01~B04**: 시작 화면 영주 모드 버튼, 청원 뒤 방향 잠금, 자율 창고 영수증 원인 공백, 금고 부족 복원 안내 — 본선 `5d333071`(Wave 44 11/13: court_baron·forest_trespass·chancel은 Astra·엔진. 큰/작은 호칭은 바꿀 것 없음. 결정 LR1-D1~D7 판단 대기, 보고서 6절)
**NAT-3 날씨·계절** — [ ] 세계 좌표 비(움직이는 비 띠·튐·젖은 땅·웅덩이)·낙엽 쌓임(Wave 39) · [ ] 계절이 대상마다 천천히(나무 위상·첫서리·눈 쌓임/녹음) · [ ] **봄 Wave 43**(LU-D1 해소) · 관문: 움직이는 캡처
**PERF-R** — [ ] 텔레메트리 훅 요청서 · [ ] NAT-2 쪽 최대 프레임 큼 · [ ] 목책 래스터 캐시 8.6→32MB
**LM-R2** — [x] 협상 화면·약속 장부·영지 포트폴리오(위임·주의력·감사·분기 요약)·소송 트랙·혼인 진행 · [x] Wave 35·Wave 40 사건 삽화·영주 화면 시안(담비 없는 L3, 세계 보이는 패널, 12px 하한)·영주 부품 40(지역 지도) — 본선 `5f278b95`(Wave 40 순간은 EVENT-ART에서; 이웃 18·atlas는 LM-E10, "봤음"은 v50 뒤 후속)
**LM-R3** — [ ] 수직 조각 시작(lordSliceStart·시작 버튼)·pauseReasons·lordSliceOutcome · [ ] 시작 화면 이름·문장 고르기(결정 HOUSE-1, 기본 드 해버럴) · [ ] **튜토리얼 대본**(`docs/design/tutorial-lord-mode-20261002/`, 청지기 목소리, 새 지역 지도) · [ ] **제목·로고 Charter & Kin / 인장과 가문**(타이틀·창 제목·로딩·아이콘, `phase11PublishedUi` 시험에 게임 이름 허용) · [ ] 모드 전환(영주 기본·샌드박스 선택)
**샌드박스 UX(G-LM 뒤)** — 성벽-시장 경로 경고·성문 강조, 목책 그리기 안내, 배치 학습

---
## B′. 렌더 B — Astra (결정 FND-2, 2026-10-04 출범)
- [x] **RB-HERDS 정적 목축군 4장**: 양 a·b·소·돼지 원본 시트 4장을 기존 소품에 연결했다(`001a4873`, `ed483f09`). 최초 양 a 6쌍과 확장 24쌍에서 저장·상태·카메라·소품이 같고 실제 그림 소비를 확인했다. 관련 시험 102개·타입·린트 통과. 보이는 몸통 수는 달라지지만 엔진 가축 수·이동은 바꾸지 않았다. 작은 크기·선명한 윤곽·가림·0.6줌 판독 한계는 [보고서](../verification/herds/README.md)에 남겼다.

- [x] **RB-HANDCART 손수레 1장 설치·화면 확인**: 제품 `62e4a720`, 실제 운반자 연결·전후 16쌍·기하 80조건 실패 0. NE 접점 가림·남성 손 잔차 3.43 세계 px·작은 줌 판독 한계를 보존했다. 최종 시험·게시 영수증은 전달 ZIP에 기록한다. [보고서](../verification/handcart/README.md).
- [x] **RB-WORLD-FIRE 화재 연출3장**: 구현 `74fe1398`·가림 수정 `ee3f0249`. 실제 여름·겨울 전후10쌍·기하80조건 실패0. 크기 가드는 cf0ffec7에서 큐 병합을 분리해 유지. 최종 게시 영수증은 보고ZIP. [보고서](../verification/world-fire/README.md).
- [x] **RB-LANDMARK-DATA 자료 준비**: `1b68f4dd` 확정 원본32장과 교정12장, 44장·22계절쌍을 정리했다. 변경 시험3개 통과. 설치0장, 엔진 성장·점유 사실은 [요청서](../requests/landmark-growth/README.md)로 넘긴다. LANDMARK-GROW 전체는 미완료.
- [x] **RB-ERA-SIGNS 간판 8장**: 본선 포함 구현 `f749fecc`. 네 L2 본체에 실제 직업·달력으로 작은 벽 간판을 붙였다. 변경 시험 1,478개·기하 80조건 실패 0·전후 18쌍 확인. 문양 판독 한계와 미등록 본체 제외를 [보고서](../verification/era-signs/README.md)에 적었다.
- [x] **RB-ERA-SIGNS 크기 가드 복구**: `f749fecc` 뒤 커진 세계 그리기를 본체·간판 모듈로 분리했다. `drawBuildings.ts` 순수 156줄, 새 모듈 124줄이며 양쪽에 기존 250줄 가드를 유지한다. 화면 동작은 그대로다.

- [x] **RB-SEASON-BOUNDARY 시점 수정**: 본선 포함 구현·통합 `494fb0d1`, 새 그림 0장. 네 시점과 여름 실제 전후 20쌍을 확인했다. 영향 시험 1,204개 중 옛 부분 적설 가정 1건을 보정하고 해당 13개를 다시 통과했다. 연속 214프레임은 보고 영상 6개로 묶었다. UI 입력 변경 없음, RR16 병합 검사로 게시한다. [보고서](../verification/season-boundaries/README.md).
- [x] **RB-SPRING 봄 그림 8장**: 본선에 포함하는 구현·통합 `5c61e56c`. 물가·양떼·과수원·마당·숲에 8장을 설치했다. 실제 전후 133쌍·기하 2,262조건 실패 0, DGX 영향 시험 1,489개·권한 복원 3개·병합 검사 통과. 출처·장부 각 8행을 맞췄다. RR16에 따라 전체 클론은 본선 묶음 회귀로 확인한다. [보고서](../verification/spring/README.md).

- [x] **RB-SEASONS 눈6장·점진 계절**: `cda5764f`까지 구현·회귀 수정, 같은 저장 전후 캡처21쌍과 겨울 전체 재생을 기록했다. 수정본 클론 회귀5,024개·기하2,262조건 실패0·재캡처를 완료했고 최종 병합 검사도 통과했다. 봄8장과 그늘·북향 잔설은 별도 미완료다. [보고서](../verification/seasons/REPORT.md).

- [x] **NAT-3 비·낙엽 50장**: 세계 좌표 비와 움직이는 비 띠, 날씨에 따른 젖은 땅, 활엽수 낙하·바닥 쌓임을 연결했다. 실제 전후 11개 구도와 연속 캡처를 확인했고 클론 4,997/4,997·기하 2,262조건 실패 0을 통과했다. 계절 위상·서리·눈 진행은 RB-SEASONS에서 이어 설치했다. [보고서](../verification/nat3/REPORT.md).

- [x] **RB-TRADE 72장**: 마당·직업 거리 68장과 빵 손짐 4장을 실제 직업·운반 상태에 연결했다. 여름·겨울 실제 게임 전후 4쌍에서 뒤뜰 작업대·통 제작 소품이 추가됐고 실행 오류는 0이다. 깨끗한 클론 4,958/4,958·기하 2,202조건 실패 0. 미해결 56장은 그림별 사유를 남겼다. 구현 `11d40c60`, 회귀 보강 `77023333`. [보고서](../verification/rb-trade/REPORT.md).

세계 그리기 장치·그림 계약(manifest)·그림 설치. 자기 가지에 커밋하고 `check:merge`·깨끗한 클론을 통과한 뒤 본선에 푸시한다. 파일 경계는 AGENTS.md "레인과 파일 경계"(UI·영주 화면은 렌더 A). 판정은 실제 게임 장면 합성으로.
- [x] **ASSET-ARCH-1** 그림 계약과 데이터 주도 그리기 장치(visual-architecture 4절) — 끝 기준: **그림 한 종류가 코드 없이 데이터로 설치됨**(0단계 끝). UI 그림부터(결정 FND-4). 10종 계약·UI descriptor, Wave42 36장28쌍 RGBA 동일, 시대 집 신규32+재사용4의8장면 데이터 증명(코어 `d60ababf`, 데이터 `541a0811`). QA003 통합 smoke4/4·A/A0차이·오류0 및 clean `1da2327e` 기하122행/2202조건 실패0 확인(도달불가4·경고693 보존). d677 check:merge 통과; 같은 HEAD clone 4819/4820으로 출처 열거68누락을 찾고 수정(관련11시험 통과). 수정92a566d7 뒤 smoke4/4·이전RGBA 차이0 확인; 최종 clean90d9b586 clone4820/4820·타입/build·check:merge PASS, 보호된 본선push exit0 완료. [보고서](../verification/asset-architecture/REPORT.md).
- [x] **계절 기존20 계약 이전 — core 커밋 실제10뷰 통과**(Astra 렌더 B): `208c6222`의 실제 DGX10뷰는 baseline과 identity·RGBA 동일, A/A10·오류0·기존20 URL 도달을 확인했고 원격 입력4137개가 일치했다. core의 legacy45+contract20=65 선택·기하·preload 순서를 보존한다. 새 봄9는 별도 후보 데이터 단계다. [증거](../verification/season-core/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [x] **봄9 데이터 — 커밋 실제10뷰·독립 시각 검토 통과, 장부9 표시**: `70c15321`에서 새9 요청·디코드·draw, A/A10·오류0·입력4143 해시 일치를 확인했다. 비봄7 identity·RGBA 동일, 봄3 의도변화; 원본13장 독립 검토 통과. runtime9·RENDER-B-SPRING9 표시, 옛6 retired 원본 보존. Node C25 봄 호출열의 의도변화를 분리 확인해 봄 fingerprint 한 항목만 갱신한다. 장부 커밋 `c8089d60`의 실제 reference4 identity·RGBA0·A/A4도 통과했다. [증거](../verification/spring9-data/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [x] **FIELD core — 실제 main 20쌍 통과**: `3e722109`→`a392694c` 전체 identity20·RGBA 차이0·양쪽 A/A20·오류0, core 원격 입력4,165 해시 일치·실행/수집 exit0. 독립 원본40장 검토 PASS WITH LIMITS(기존 가림·저배율 한계 유지). 12번째 ground-texture kind·기존4개 이전, catalog95→99·신규 이미지0·장부0, main196/196·타입/린트 및 보호이관22/22 PASS. spring9·retired6·C25 보존. [증거](../verification/field-core/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [x] **렌더 B 2단계 게시 관문**: 본선 `be576dbe` exact DGX merge·깨끗한 클론4,886/4,886·타입/build·source LFS14/public14·보호 push·원격 HEAD 확인 PASS. 기하 fd68 실제2,202조건 실패0·경고693/미도달4행 보존. 신규runtime14·퇴역public6·W37 장부16 범위. [관문·게시 영수증](../verification/renderb-phase2/REPORT.md).
- [x] **CLOUD CORE**: 기존 구름 그림 2장을 계약 장치로 이전했으며 신규 그림은 0장이다. 통합 구름 7개 장면의 전후 픽셀 동일성과 원본 독립 검토를 통과했다. [기존 증거](../verification/cloud-core/REPORT.md)·[통합 17쌍](../verification/renderb-region-cloud-height/README.md). 구름 가시성·이동은 불확실하며 새 DATA2 [HOLD](../verification/cloud-data2-hold/REPORT.md), v1/v2 실패·v3 미실행을 유지한다. 현재 UI 기하2,202조건 실패0. 설치 커밋 `718dce4b`, 증거 `db7f98f5`, 본선 게시 `6fd89016`. 기존 클론 재사용과 세계 PNG 4개 기하 해시 예외를 보고서에 명시했고 보호된 본선 푸시를 완료했다.
- [x] **REGION core30·봄4**: 지역 봄 지면 4장으로 백악 구릉·해안 항구·배수 습지·숲 가장자리의 봄 장면이 달라졌다. 통합 17쌍에서 봄 4개 변화·나머지 13개 RGBA 동일, 양쪽 A/A 17개와 독립 원본 34개 검토를 통과했다. [격리 증거](../verification/region-spring4-data/REPORT.md)·[통합 증거](../verification/renderb-region-cloud-height/README.md). 4행 `RENDER-B-REGION4` 표시는 이미 되어 있으며 기존 본선 be576의 14장과 별개다. 세계 실행718dce4b·현재 UI2fdbb11d를 구분하며 현재 기하2,202조건 실패0. 설치 커밋 `5bc29c6b`, 증거 `db7f98f5`, 본선 게시 `6fd89016`. 기존 클론 재사용과 세계 PNG 4개 기하 해시 예외를 보고서에 명시했고 보호된 본선 푸시를 완료했다.
- [x] **HEATH B/C2 — 실제 data30·독립 시각 통과, 정확2행 표시**: 작업 커밋 `fd68f124`의 DGX 실제30뷰에서 A/A30·오류0, 적용14의 B/C 요청·디코드·paint와 픽셀 변화, 비대상16의 full identity/RGBA0·첫 진입 ABC 부재를 확인했다. 새 export는 tracked-clean·실행 입력4,310 SHA 일치이며 core의 문서2 drift와 구분한다. AFTER30·BEFORE14 독립 원본 검토 뒤 정확2행 runtime/RENDER-B-HEATH2 승격, 다른 출처2,430행·장부6,120행과 코드·public 보존. 원425 밖 두 장이므로 원425 표시153/runtime157은 그대로다. 승격 `db17321a` 뒤 실제 reference4도 full identity/RGBA0·A/A4·오류0·clean4,311 SHA 및 부모 원본4 검토를 통과했다. 반복 진입 소비 부재는 미증명이다. [증거](../verification/heath-data/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [x] **HEATH core — 실제30 동일·독립 원본 검토 통과**: `931d780e`에서 before30 대비 identity/RGBA30 동일·A/A30·오류0, 음성16 첫 소비 부재와 원격 실행 입력4,308 해시를 확인했다. 수출 중 증거 문서2 변경은 `NON_RUNTIME_DOCUMENT_DRIFT`로 별도 기록했으며 전체 clean 증거로 쓰지 않는다. 기존 A만 계약 이전(catalog103), public·장부0; [증거](../verification/heath-core/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [x] **FIELD 봄3 — 실제 main20·시각 통과, 정확3행 표시**: `cd399e4a` / `astra-field-main-spring3-cd399e4`에서 A/A20·오류0, 봄8 새3 request/decode/paint 및 의도 변화·비봄12 identity/RGBA0, 원격4,168 SHA 일치·독립 시각 PASS WITH LIMITS. catalog102·정적196/196·타입·출처5/5/2,387 통과. 이후 정확3행 provenance/installed_by 승격; 원본425 marked153/runtime157/physical157, 코드·public4,259 및 다른 행 보존. 승격 `d3673823` 뒤 실제 reference4 identity/RGBA0·A/A4·오류0, 원격4,281 해시 일치. [증거](../verification/field-spring3-data/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [x] **RENDER-B 출범 관문** — 본선 `90d9b586`, exact clean clone4820/4820·build PASS·보호된 push0.
- [x] **RENDER-B-W37** — 기존 사용16행 installed_by 적용, 원본/PNG/provenance 변경0. LM-R1 12·fisher/shepherd4 공란 보존. 커밋 `bc29f6b2`의 실제 after4 PASS·RGBA 차이0·A/A4·오류0. [보고서](../verification/wave37-reconcile/REPORT.md). 게시 완료: 최종 본선 be576dbe clean clone4,886/4,886·merge·보호 push·원격 exact HEAD PASS.
- [ ] 설치 1단계: 영주 모드 수직 조각용 그림(`docs/ops/install-plan-20261003` ORDER 1절) — 데이터 커밋 + 실제 장면 캡처
- [ ] 설치 2단계: NAT-5·NAT-3 자연스러움(ORDER 2절)
- [ ] 설치 3단계: 나머지 기존 기능 연결과 새 기능(ORDER 3절)
- [ ] **사람 키 통일**(FND-3): 등록 높이17.6/.55는 작업 가지38be7e4a에 통합했으며 [A1 실제 여름 2개 장면](../verification/height-a1/REPORT.md)과 역사적 겨울16/여름4 증거를 분리 보존한다. 통합 BEFORE에도 같은 높이가 있어 이번 2쌍 동일성은 외형 보존만 입증한다. 맨발 실측·가려진 접촉·[문23](../requests/render-human-scale-art-request.md)·[신체/군중/운구12](../requests/render-human-registration-request.md)는 미완료다. 현재 기하2,202조건 실패0·소스 동일 확인, 최종 클론·게시 대기.

---
## C. REMOTE·문서 세션
### 보냄 — 대기
- [x] TRADEMARK 항목에 사전 조사 경로·남은 것(영국·전문가) 기록 — 본선 `eb701f8b`
- [x] `AGENTS.md`·CHARTER·CLAUDE.md에 **"문구는 glossary.md 따름"** 규칙(INBOX가 glossary 넣은 뒤) — 본선 `eb701f8b`
- [x] "증거 폴더 3MB 넘으면 병합 실패" 검사(렌더 NAT-4가 넘김, 결정 RR10) — 본선 `73c80c8b`
- [x] 병합 전 검사: inbox 그림 한 장 = 장부 한 행(`assets-inbox/`를 건드리는 모든 푸시, 결정 RR11) — 본선 `366b1111`
- [x] 장부 검사가 그림 여섯 종류(png·jpg·jpeg·webp·gif·svg)를 장부 file 열과 대조 — 본선 `75928eee` (INBOX GIF·SVG 17행 뒤 5,067 = 5,067 확인은 보고서에)
- [x] 장부 검사: 새 inbox JPG·JPEG가 LFS 포인터가 아니면 실패, 1 MB 넘는 새 그림이 LFS가 아니면 경고(결정 RR11) — 본선 `e01f4b01`
- [x] 렌더 NAT-5 넘김: 캡처 스크립트가 서버를 반드시 끄고 DGX 정리가 남은 개발 서버를 찾음(결정 RR12) — 본선 `21770861`
- [x] 렌더 NAT-5 넘김: 끝난 팀원 에이전트를 다시 깨우는 OMC SubagentStop 훅 — 저장소에서 OMC 플러그인을 끔(결정 RR13) — 본선 `c125a63c`
- [x] 기초 설계서·시각 아키텍처 반입, 결정 FND-1~5, 헌장 고치기, AGENTS 레인 표·렌더 B 파일 경계, 로드맵 0~4단계, 장부 렌더 B 절 — 본선 `3eec752c`
- [x] DGX 무거운 실행 동시 상한 2와 줄, 둘째 포트를 범위 안에서(결정 RR14), devServerStop 시험을 부하와 무관하게(RR9) — 본선 `9e78cb7b`
- [x] DGX 디스크: 상위 사용 확인, 정리 규칙(끝난 폴더 하루·용량 상한·_kept 압축·클론·LFS 공유), 무거운 실행 전 정리, 그날 225 → 704 GB(결정 RR15) — 본선 `2a1d1aa0`
- [x] DGX `/tmp`의 게임 잔여물(끝난 perf:ab·추이 소스 트리 `fls-src-*`, 3일 안 읽은 tsx 캐시)을 RR15 정리에 — 본선 `231aa17c`
- [x] 확장성 설계 확정(EXT-0): extensibility.md 반입·foundation 2부 링크, 결정 EXT-D1~D3, 헌장·AGENTS·CLAUDE 원칙 한 줄, 로드맵 EXT 줄, 엔진 절 EXT-1~3b·6 — 본선 `553c937e`
- [x] 게임 원칙 확정: game-principles.md 반입(정본), 헌장·foundation 링크와 정체성↔대전제 대응, 지시서 관련 원칙·보고서 원칙 점검 칸, 결정 GP-1~6 — 본선 `6b67fa98`
- [x] 관문 줄이기: 올리기 전 check:merge + test:changed + 바뀐 줄 기하 감사, 본선 묶음 클론(3~4시간·bisect·run.sh 알림), 무거운 칸 3, 가드레일 2회째 생략, 기다리는 동안 다음 일(결정 RR16~RR19) — 본선 `eeccc92a` · `6b52f281`
- [x] 게임 원칙 v0.3: P-T1·P-T3 정정, P-D5, 결정 GP-7(FIX-14 빈 해 관문 대체), 엔진 절 GP7-ENGINE — 본선 `d499935d`
- [x] 관문 줄과 실험 줄(`--gate`/`--experiment`, 마지막 칸은 관문 몫, 결정 RR20) — 본선 `81c28025`
- [x] 실험 줄을 세션이 돌아가며·세션마다 하나(RR21), `--status` 세션별 수, 감사·관문 규칙 변경은 REMOTE 검토(RR22) — 본선 `8de36eba`
- [x] 줄의 규칙을 DGX 칸 관리자가 지킴(옛 체크아웃의 실행에도, 결정 RR23) — 본선 `fb88011f`
- [ ] 전체 시험 여러 갈래(testShards) 측정과 클론에 쓰기 — 본선 ``
- [x] 성능 추이 자동 갱신(병합 뒤 훅, 결정 RR4) — 본선 `31554791`
### 운영 규칙(확인용)
추이 판정 지표 넷(할당·GC/분·캔버스/초·GC 뒤 힙), 의심 → A-B 자동(95% t 폭) → 나빠짐은 두 번 확정, 실행 폴더 잠금, 푸시 훅 분리, 결정 ID 중복 실패, settings.local.json 규칙, 무거운 검증 Mac 금지.

---
## D. INBOX 세션 — 보냄·대기
- [x] Wave 42 가시나무 v3(`/tmp/astra-wave42-bramble-v3-lite.zip`) → 옛 bramble 4행 superseded — 본선 `6c954293`
- [x] Astra 첫 플레이(`/tmp/astra-playtest-20261002.zip`) → `docs/qa/playtest-20261002/` — 본선 `ad156117`
- [x] QA 17회차(`/tmp/fls-qa-round17-lite.zip`) → `docs/qa/round17/` — 본선 `2ed0fa8b`
- [x] 제목 묶음(`/tmp/astra-title-logo-20261002.zip`) → `docs/design/title-20261002/`(1번만, 결정 줄) — 본선 `c23747f1`
- [x] 브랜드(`/tmp/charter-kin-brand-20261002.zip`) → `docs/design/brand/` — 본선 `f99eaf99`
- [x] 튜토리얼(`/tmp/astra-lord-tutorial-20261002.zip`) → `docs/design/tutorial-lord-mode-20261002/` + lord-mode.md 한 줄 — 본선 `9ccb98e4`
- [x] 문구 감사(`/tmp/astra-copy-audit-20261002.zip`) → `docs/design/glossary.md`(원본 SHA 줄) + `docs/design/copy-audit-20261002/` — 본선 `0cba5b35`
대조: 장부 행 수 = inbox 그림 수, 판정 없는 그림 0(가시나무 v3 뒤), 끊긴 replaced_by 0.

---
## E. Astra
- 완료 그림: Wave 32~44, 영주 시안·부품, 아트 감사·바이블 v2, 제목·로고(벡터)·상표 사전 조사, 튜토리얼 대본, 문구 감사·용어 정본, 첫 플레이.
- [x] 콘텐츠 초안 60개 1차 — 본선 `83b06802` · 2차(157선택) — 본선 `5f10d874`
- [x] 시각 검사기 1차 — 본선 `7de9b655`
- [x] 시각 검사기 2차(재현율 회차) → 저장소 도구 `tools/vision-check/`(개선판, `npm run vision:check`, 검출기 상태 사용 넷·실험 둘, 동결 정답 시험지 양성 19) — 본선 `55269a11` (이 줄은 장부에 없어 REMOTE·문서 세션이 더함)
- [x] 시각 검사기 확장 회차 → `tools/vision-check/` 교체(여섯 모두 사용, 교정 성능 — 홀드아웃 검증 전·병합 관문 아님, 시험지 양성 38, 파이썬 132 통과·1 xfail) — 본선 `59196866`
- [x] 검사기 홀드아웃: 재현 실패, 보조 도구로 고정, 다듬기 중단 — 이음새만 사용·다섯 실험 — 본선 `e73c068d`
- **설계 납품 — 설계 완료(구현 0%)**: 설계 문서로만 들어온 것. 구현 작업이 장부에 생기면 그 줄로 옮긴다.
  - [x] 이웃 세계 위르델미어(18 세력·사람 138·연간 규칙 14·연대기 표본 32) → `docs/design/neighbor-world-20261003/` — 설계 완료(구현 0%), 본선 `a8834c7f`
- 대기: **QA 다음 회차**(NAT-4/NAT-5 병합 뒤 — 다섯 땅 같은 카메라 전후, 037·038·039·040), **영주 모드 첫 플레이**(LM-R3 뒤), **Steam 대표 그림용 로고**(출시 준비 때).

---
## F. 사용자
- **G-LM 플레이**(렌더 LM-R1~R3 뒤 — LM-R1 뒤 짧게라도 먼저 권장)
- 출시 전 **상표 전문가 확인**

## G. Claude가 판정해야 할 대기
- N4-D1~D5(렌더 보고 시)
- FIX-16 결과의 사망 표·목책 비교표
- LM-E6a 넘김 목록 → Astra 그림 의뢰로 변환

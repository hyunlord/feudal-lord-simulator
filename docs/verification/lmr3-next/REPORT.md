# 틀 등록·조각 끝 쪽의 옛 해·문구 변형·자동 정지 — 렌더 A 보고

렌더 A, 2026-10-09. 사용자 지시(SUIT-THREAD 통과 뒤, GROW-BLOCK 요청 4절 전까지): ① 등록 안 된 틀 넷 등록 ② 수직 조각 끝 쪽에 1300~1308 큰 결정과 작은 일의 수 ③ 엔진 B 문구 변형 읽기 다섯 연결 ④ LM-R3 나머지 pauseReasons — 그 뒤 자동 정지 기준(사용자 판정). 엔진 파일 0줄.

## 실행 위치
- 코드·시험: Mac 작업 트리 `~/github/fls-frames`(가지 `claude/frames`, ①과 합치기) — 에이전트 가지 `claude/slice-old`(②)·`claude/variants`(③)·`claude/pause`(④)를 병합.
- 상태(DGX): 조각 끝 `~/fls-slice-end-states`(TRACE-KEEP 엔진으로 다시 만든 slice-end·slice-eve, 옛 판은 `~/fls-slice-end-states-pre-tracekeep`; 자동 정지 pause-due·pause-due-suit 추가), 문구 변형 `~/fls-variant-states`(새 상태 묶음 `variants`).
- 기하(--gate --keep): 마지막 트리: 병합 트리 `d5dbeb55`에서 바뀐 줄 전부 `render-LEAD-geometry-d5dbeb5-d5dbeb5`(55줄 1,100칸, 등록 안 된 틀 0) — 철 카드 하나가 실패해(아래 5절) 고친 뒤 철 카드를 쓰는 줄 셋 `render-LEAD-season-geometry-db1b1b1-db1b1b1`(마지막 화면 트리 `db1b1b1e`, 60칸, 실패 0·열지 못함 0·등록 안 된 틀 0, 공용 결과). 단계별: `render-FRAMES-geometry2-d213642-d213642`(영주 화면·영주 카드 40줄 800칸, 실패 0·등록 안 된 틀 0) · `render-SLICEOLD-geometry-d429d73-d429d73`·`render-SLICEOLD-cards-geometry-eca04c8-eca04c8`(조각 끝 넷 80칸) · `render-VARIANTS-geometry-4324ed6-4324ed6`(12줄 240칸) · `render-PAUSE-geometry-6a603cc`(3줄 60칸) — 모두 실패 0·열지 못함 0·등록 안 된 틀 0.
- test:changed: 마지막 트리에서 DGX `--gate`(푸시 기록). 단계별 `render-SLICEOLD-tests-9c474ef-9c474ef`(231/235)·`render-VARIANTS-tests-fe7c0cf-fe7c0cf`(555/567)·`render-PAUSE-tests-9532408`(1311/1324), 모두 실패 0.
- 캡처·측정: `render-SLICEOLD-captures-d429d73-d429d73`·`render-SLICEOLD-live-eca04c8-eca04c8` · `render-VARIANTS-captures-115468a-115468a`(12/12)·`render-VARIANTS-exposure-8394df7-8394df7`(자연 노출 14판) · `render-PAUSE-captures-6a603cc`(11/11)·`render-PAUSE-measure-f001a2a`(봇 20년 seed 1~5)·`render-PAUSE-pairs-6a603cc`·`render-PAUSE-checks-5c8ddaf`·`render-PAUSE-states-6d51d0a`. 증거 `docs/verification/lmr3/slice-old/`(331 KB)·`docs/verification/variants/`(1.2 MB)·`docs/verification/pause/`(0.9 MB).

## 1. 등록 안 된 틀(사용자 지시: 다음 푸시엔 경고 없이)
- LM-R2부터 감사마다 "등록 안 된 틀"로 나온 그린 부품(Wave 35)에 자기 줄을 줬다: `lord.ledger.book`(.lord-ledger-book)·`lord.ledger.track`(.lord-ledger-track)·`lord.negotiation.treaty`(.lord-neg-treaty)·`lord.negotiation.row`(.lord-neg-row). 감사가 이 넷을 재며 같은 판에서 하나 더(`lord-neg-reason`) 나와, DC2 감사가 적었던 `lord-estates-card`(기록 틀)와 함께 `lord.negotiation.reason`·`lord.estates.card`도 등록했다. 각 줄은 그 쪽을 여는 줄을 잇고(`extends`), 그린 바탕이라 `flat`(영지 카드는 `css`).
- 영주 화면·영주 카드 전부(40줄 800칸) 실패 0, 등록 안 된 틀 0. 마지막 트리의 공용 결과도 0이라 이번 푸시는 기하 덮어쓰기 없이 간다.

## 2. 수직 조각 끝 쪽: 1300~1308의 큰 결정과 작은 일(TRACE-KEEP)
- 해마다 줄이 연대기의 결정 기록으로 세던 것을 엔진의 `yearReview(state, year)`로: 큰 결정(엔진 `isBigDecision`)은 그 해 아래 날짜와 함께, 뒤따른 일 N건과 그 줄 셋까지(`traceInRange`), 없으면 "뒤따른 일은 기록되지 않았습니다".
- 작은 일은 해마다 한 줄, 맡은 쪽대로: "작은 일 N건은 영주가 정함 · 작은 일 N건은 청지기가 처리 · 답하지 않은 일 N건은 그대로 둠"(청지기 문구는 사용자, DC-D14). 0은 쓰지 않는다. 조각 전체 한 줄이 해들 위에("1300~1316년 동안: …").
- 큰 결정 + 작은 일 = 그 해 연대기의 결정 기록 전부(시험).
- 상태: 지금 엔진으로 영주 봇 seed 3을 다시 놀렸다. 조각은 두 번째 영지(1312) 뒤 다섯 해, 1317년 봄에 끝난다(엔진의 끝 규칙, 20년을 억지로 채우지 않음). 1300~1316, 큰 결정 17건 중 1300~1308 7건(엔진 보고와 같음: 소송 1300·1303, 시장 특허 청원 1306, 혼인 1307, 등록기 1307 둘·1308 하나). 마지막 해 카드·철 카드 줄과 실제 끝 캡처는 1316을 엔진에서 읽는다(LR3-D7 동작은 이미 엔진의 마지막 해를 씀).

## 3. 엔진 B 문구 변형 다섯(`docs/requests/engine-B-petition-variant-presentation.md`)
- 홈 청원 카드와 그 칩: `estatePetitionVariantFor`(041 돼지 방목·048 공동 목초지·056 길과 다리), 등록기 제안 카드와 그 칩: `registryVariantFor`(067·078). 제목과 본문만 바뀐다. 청원 id·명령·선택·비용·마감·관계·결정 기록의 주체·그림은 그대로(변형이 꺼진 같은 상태와 문구 밖 전부 같음 — 시험).
- 저장 왕복 뒤에도 같은 문구, 답은 같은 원 청원으로 한 번만. 다른 영지·숲 아닌 땅·가을 밖·당사자 없음·목초지 없음·시장 없음이면 원래 문구.
- 준비 상태 화면 검증과 자연 노출을 나눠 적었다(`docs/verification/variants/results.json`): 준비 041·056은 플레이 그대로, 048·067·078은 준비. 자연 노출(영주 봇 14판): 041 숲 땅에서 19건 중 4, 056 16건 중 6(영주가 그 종류를 직접 맡을 때만 — 봇 기본 방침에선 홈 청원이 영주에게 오지 않음), 067 2건 중 2, 048 0(마을이 목초지를 두지 않음), 078 0(019가 오지 않음).

## 4. 자동 정지(LM-R3 pauseReasons, 사용자 판정 2026-10-09)
- 멈추는 것: 엔진 `lordMattersDue`의 새 기한 있는 일(유언·상속 다툼·영주를 상대로 한 소송의 다음 단계·강제 점거 예고)과 `pauseReasons`의 큰 사건 여덟뿐. 청지기가 처리한 일·소식·작은 결정으론 멈추지 않는다(P-T1·P-T3). 화면만의 무게 규칙은 없다.
- 한 철에 한 번: 그 철의 첫 이유들에 멈추고, 멈춘 사이 온 것은 같은 알림에 붙는다. 다시 흐른 뒤 같은 철에 온 것은 두 번 멈추지 않고 "이번 철에 영주가 볼 일이 더 생겼습니다"(확인)로 보인다. 이유마다 한 줄과 답할 곳 링크(유언 → 혼인, 소송·예고 → 장부의 그 줄, 역제안 → 혼인, 판결·영지 → 장부, 상속 → 가문 카드, 권리 청원 → 그 카드), 주 단추는 [계속] 하나.
- 불러오기·새 게임·틱이 뒤로 가면 멈추지 않는다. 같은 기록으로 두 번 멈추지 않는다. 카드가 열린 채 멈췄다가 카드가 닫히며 속도가 돌아오면 다시 멈춘다.
- 설정: 일시 정지 메뉴 설정에 "영주가 답할 큰일에 저절로 멈추기"(기본 켬). 끄면 멈추지도 알리지도 않는다(칩은 온다). 새 칩에 멈추기(eventPause)는 뜻 그대로, 자동 정지 직후의 칩으로 두 번 멈추지 않는다.
- 측정(영주 봇 조각 seed 1~5, 20년, 멈추면 바로 다시 흐르게): 한 해 멈춤 중앙값 1·최대 4(100 seed-해: 0번 42, 1번 31, 2번 20, 3번 1, 4번 6). 조각 안의 해만 보면 seed마다 중앙값 0~1·최대 2~4. 목표(한 해 1~4번 안팎) 안 — 위쪽은 철 상한이 막는다.
- 엔진 층위로 넘길 목록(EB-WEIGHT, 화면에서 줄이지 않음): ① 영주를 상대로 한 소송의 `lordMattersDue` dueTick이 철마다 새로 생겨 소송이 이어지는 동안 철마다 새 기한(133건 중 36, 한 해 4번인 해 여섯 모두) ② `stewardship.escalated` 권리 규칙(32, 둘째 영지 뒤 해마다) ③ `estate.suit_judged`(24, seed 4만 8).
- 자동 정지를 끄는 쿼리 `?auto-pause=off`: 영주 상태에서 시간을 흘려 나중 철·해를 기다리는 장면만(조각의 실제 끝, 두 연말 카드 캡처, 철 청지기 캡처, `modal.season-ledger.steward` 줄). 감사 도구 파일은 고치지 않았다.

## 5. 마지막 감사에서 나온 철 카드 한 줄
- `modal.season-ledger.steward`(영주 상태에서 시간을 흘려 철 청지기 쪽까지)가 병합 트리의 감사에서 장식 검사 20칸 실패: 철 카드 위 그림 띠의 칸마다 든 값이 긴 문구("3가구가")·큰 수("+139만")에서 칸(약 65px)을 넘어 그린 칸막이를 지났다. 이 줄이 바뀐 것은 장면 쿼리(`auto-pause=off`)뿐이라 본선부터 있던 배치로 보인다(전에 커밋된 감사에 이 줄은 없었다).
- 고침: 칸의 값이 제 칸 안에서 줄고 넘치면 말줄임(`src/styles/hudShell.css`). 띠 아래 줄이 칸마다 이름과 값을 다 말한다. 철 카드를 쓰는 줄 셋(`modal.season-ledger`·`.steward`·`modal.slice-end.season-card`) 실패 0.

## 결정(렌더 A 판단, 2026-10-09)
- FRM-D1 화면 안의 그린 부품(그림이 바탕인 틀)도 감사가 따로 재는 자기 줄을 가진다 — 그 쪽을 여는 줄을 잇는 줄(`extends`), 틀 종류는 화면이 붙인 그대로(`flat`/`css`).
- LR3-D8 수직 조각 끝 쪽의 해마다 줄은 엔진 `yearReview`로 읽는다: 큰 결정은 그 해 아래 뒤따른 일과, 작은 일은 맡은 쪽대로 한 줄("작은 일 N건은 영주가 정함 · … 청지기가 처리 · 답하지 않은 일 N건은 그대로 둠"), 0은 쓰지 않음. 조각 끝 상태 폴더는 지금 엔진의 판으로 바꿨다(옛 판 보관).
- LR3-D9 자동 정지(사용자 판정의 화면 몫): `lordMattersDue`의 새 기한(종류·id·dueTick)과 `pauseReasons`만, 한 철에 한 번 모아서, 다시 흐른 뒤 같은 철 것은 멈추지 않고 알림으로; 설정 기본 켬, 끄면 알림도 없음; 시험 장면 쿼리 `?auto-pause=off`.
- VAR-D1 문구 변형은 답을 기다리는 동안의 카드와 칩만 바꾼다. 답한 뒤 그 청원을 이르는 곳(결과의 실·연말 카드·연대기·청지기 철 보고)은 종류의 문구 그대로 — 변형 읽기가 답한 뒤엔 null이라 영주가 본 문구를 화면이 알 수 없다(엔진 요청 후보).
- VAR-D2 홈 변형 본문은 종류의 요구 문장(합계가 든)을 대신한다. 합계는 카드의 걸린 것 줄과 답마다 "지금" 줄에 그대로 있다.

## 엔진에 남은 것(요청 후보)
1. 문구 변형: 답할 때 보인 변형을 발생·결정 기록에 남기기(그래야 연대기·결과의 실이 그 문구로 이름 붙음). 048은 마을이 목초지를 두지 않아 자연히 닿지 않음, 078(019)은 14판 동안 오지 않음 — 콘텐츠·엔진 판단.
2. 자동 정지: `manor.petition`·`stewardship.escalated` 기록에 청원 id가 없어 링크가 그 종류의 첫 카드를 연다. `estate_gained`/`lost` 기록에 소송 id가 없어 그 영지의 마지막 소송을 연다. `lordMattersDue`에 "처음 온 틱"이 없어 새것은 화면이 두 상태의 차이로 안다. 층위 목록은 4절.
3. 수직 조각(engine-slice-ends.md): 1·5번은 TRACE-KEEP로 답됨. 2~4번(시작의 도시와 세력, 틱 0의 조각, 본 영지의 값)은 GROW-BLOCK 뒤. 1312·1316의 큰 결정 몇(지킨 약속·감사 답)은 뒤따른 줄이 없다.

## 원칙 점검
- 엔진 파일 0줄. 한국어는 `*.ko.ts`에만(변형 문구는 엔진의 정본 V4_COPY에서 읽음), 색은 palette.ts에만, `title=` 0, 그림 문자 0.
- 새 화면 파일은 250줄 이하(autoPauseModel 101·useLordAutoPause 67·AutoPauseNotice 50·registryCardModel 244). 뷰 모델은 상태마다 한 번(perState).
- 화면마다 주 단추 하나(멈춤 알림 [계속]/[확인]; 결정 카드는 답을 고르기 전 0). 누르기는 이름 붙은 명령·입력(R4, inputIntentBoundary 0). 글자 12px 이상, 터치 44/48px — 기하 감사.
- 감사·판정 규칙은 바꾸지 않았다. 상태 묶음 `variants`를 deccard2와 같은 방식으로 더했다(`scripts/uiGeometryAudit.mjs` STATE_FLAGS 한 줄, `scripts/remote/tasks.sh` ui-geometry 묶음) — 판정 변경 아님(RR22, REMOTE에 한 줄). 시험 `tests/qa025PauseHolds.test.ts`는 그 시험이 스스로 요구하는 대로 속도를 정하는 파일 목록에 둘을 더했다.

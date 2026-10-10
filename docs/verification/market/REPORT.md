# 선포 뒤 영주 화면 — "시장도시" 상태 묶음 · 렌더 A 보고

렌더 A, 2026-10-10. 사용자 지시: 감사 상태 묶음에 시장도시 선포 뒤의 영주 모드 상태가 없어 선포 뒤 영주 화면 전체가 기하 감사 밖이었다 — 상태 묶음을 만들고 선포 뒤 영주 화면과 목책 계획의 past 줄을 기하 줄에 넣는다. 엔진 파일 0줄.

## 실행 위치
- 코드·시험: Mac 작업 트리 `~/github/fls-market`(가지 `claude/market-town`, 에이전트 market; 마지막 단계는 리드) — 본선 `6fa71fc9b` 병합.
- 상태(DGX 새 폴더 `~/fls-market-states`, 새 상태 묶음 `market`): `scripts/marketTownStates.ts` — 영주 봇이 영주 조각 seed 1을 아무것도 끼우지 않고 둠. 선포(시대 palisade, charterWallPlan past) 틱 69,266(1317년 여름), 조각은 제 규칙대로 틱 72,000(1318, 두 번째 영지)에 끝나고 봇은 계속(1300~1321).
  - `market-proclaimed`: 틱 70,266, 1317 가을, 528명, 성벽 2/25, 1장 쪽 열릴 때, 대기근 칩.
  - `market-season-eve`: 틱 70,960, 철이 닫히기 40틱 전(철 카드 줄).
  - `market-years`: 틱 85,266, 1321 여름, 528명, 금고 £82, 조각 끝남, 영주를 상대로 한 소송(증거 단계), 영주 순간·결과의 실 칩.
  - 실행: `render-MARKET-states5-061e8b2`(셋 모두), `render-MARKET-states3-81dbc49`(앞 둘, 바이트까지 같음). 무거운 줄 대신 가벼운 줄로 돌렸다(한 노드 프로세스, 실험 줄이 4시간 전체 감사 뒤에 막혀 있었다).
  - **엔진의 선포 뒤 저장**(`engine-GROW2-saves-a770814`: seed1-charter-season-1317·charter-5y-1322·final-1330)이 도착하기 전에 이미 같은 seed·같은 엔진으로 만들어 둔 상태를 그대로 썼다 — 선포 해(1317)와 인구(528)가 엔진 판과 같다. 엔진 판의 파일로 바꾸는 것은 작은 뒤일이다.
- 기하 관문(--gate --keep, trailer `UI-Geometry-Run`): `render-MARKET-geometry-bc1298d-bc1298d` — 20줄, 390칸, 실패 0·열지 못함 0·등록 안 된 틀 0, `retried: []`(51분). 측정 뒤 본선 병합분은 RR26 covered(본선 커밋이 제 증거를 지님)로 인정.
- 캡처: `render-MARKET-captures-c345cdb` — 선포 한 철 뒤와 네 해 뒤의 도시·시대 칸·영주 화면, 1280×800·태블릿 12장(1.6 MB, 모두 통과), `docs/verification/market/`.
- test:changed: 마지막 트리에서 DGX `--gate`(푸시 기록).

## 1. 기하 줄(새 묶음 `market`, `src/ui/lord/market/surfaces.ts`)
- 시대 칸: `slot.goals.era-console.lord.past`(선포 뒤)·`.past-years`(몇 해 뒤) — 목책 계획의 past 줄(`.era-plan-done`)과 성벽 진척·우선을 요구.
- `slot.goals.market`, 상태 알약 `hud.status-pill.market`·`.market-years`, 명령 핀 `hud.command-pins.market`.
- 영주 화면: `lord.screen.market`, `lord.estates.market`, `lord.ledger.market`(소송과 방어), `lord.negotiation.market`, `lord.region.market`, `lord.standing.market`.
- 장부 서랍: `slot.ledger.lord.market`, `slot.ledger.stock-lord.market`.
- 칩·카드: `hud.event-chips.market`, `hud.event-card.suit-defence.market`, `hud.event-card.lord-moment.market`, `hud.event-card.famine.market`(story-delay 8초, 첫 대기 90초).
- `modal.chapter-page.market`(1장 쪽, story-delay 20초), `modal.season-ledger.market`(eve 상태, 1배속).
- 감사 연결(판정 변경 아님, RR22): `scripts/uiGeometryAudit.mjs` STATE_FLAGS 한 줄, `scripts/remote/tasks.sh`(폴더·상태 파일 셋·`--states-market`·입력 선언), `scripts/uiGeometryFingerprint.mjs` STATE_SETS 한 줄(그림자 시험이 tasks.sh와 맞기를 요구).

## 2. 찾아 고친 것
- **화면 버그(캡처가 찾음)**: 태블릿에서 아이콘 없는 영주 화면 메뉴 항목(약속·소송)이 48px가 아니라 44px — 44px 터치 바닥 규칙(특이도 0,3,0)이 굵은 포인터의 48px 규칙을 이겼다. `src/styles/lordScreen.css`에서 그 규칙을 `:root .app-shell .ui-btn.lord-screen-nav-item / .lord-screen-open`으로 올림.
- 선포 한 철 뒤엔 1장의 쪽(1300~1317)이 스스로 열려 기근 칩을 가렸다 — 쪽에 제 줄을 주고 칩 줄은 먼저 쪽을 미룸(.chronicle-keep).
- 철 카드(극단 수) 조건이 선포 상태에서 120초 안에 철 끝에 닿지 못했다(바쁜 DGX에선 10배속으로도) — 철 닫히기 40틱 전 상태(eve)를 만듦.
- 혼인 줄 하나가 조약의 그린 틀이 실리기 전에 재여졌다(틀 안쪽 여백이 조항을 민다) — 그 줄은 조약 그림을 기다린다. 이 배치 이동은 모든 lord.negotiation 줄에 있는 발견이다(바꾸지 않음).

## 3. 판정이 필요한 화면 발견
- 선포 뒤 영주 모드 시대 칸에 샌드박스의 "목책 넓히기" 그리기 단추와 되돌릴 수 없다는 안내가 보인다 — GROW-BLOCK 판정(영주 모드엔 그리기 단추 없음)과 어긋난다. 선포 뒤에도 같은지 판정 부탁.
- 기존 `modal.season-ledger.steward` 줄은 Digit3(겹쳐 보기 키)을 눌러 도시를 1배속으로 돌린다.
- 약속·소송 메뉴 항목에 아이콘이 없다(lord.nav.ledger 그림, 렌더 B).

## 엔진에 넘길 것(관측)
- 인구가 1311~1321년 528명에서 평평하다.
- 선포 뒤 네 해 동안 성벽이 2/25 → 7/25구간, 배정된 일꾼 0(시대 칸: "성벽 공사 인력 0명, 대기 18").
- 봇의 1315·1316년이 500~600초·250~290초 걸린다(다른 해는 8초 안팎).
- 1장 연대기에 id가 빈 사건이 있다("era:", defId "": h-000002, h-000052).

## 원칙 점검
- 엔진 파일 0줄. 한국어는 `*.ko.ts`에만, 색은 palette.ts에만, `title=` 0. 새 파일 250줄 이하(market/surfaces 88).
- 터치 44/48px(태블릿 48px 고침), 글자 12px 이상 — 기하 감사·캡처.
- 감사·판정 규칙은 바꾸지 않았다(새 상태 묶음은 variants·growplan과 같은 꼴). 공용 상태 폴더는 건드리지 않았다.

## 0. 개발 헌장

게임 이름: 영어 **Charter & Kin**, 한국어 **인장과 가문**(결정 TITLE-1, 가제 "봉건 영주 시뮬레이터" 대체).

이 절은 [`docs/CHARTER.md`](docs/CHARTER.md)의 1~6절을 그대로 옮겼다. 모든 세션(엔진·렌더 A·렌더 B·INBOX·REMOTE·Astra)이 작업 전에 읽는다. 방향·아키텍처·레인의 정본은 [기초 설계서](docs/design/foundation.md)(2026-10-04 확정, 결정 FND-1~5)이고, 이 헌장은 그 요약이다.
- 근거: [`docs/ROADMAP.html`](docs/ROADMAP.html)(비전·화면·로드맵·작업 방식)과 설계서.
- 충돌 시 우선순위: `docs/ROADMAP.html` > 이 절 > 개별 지시서.
- 헌장을 고칠 때는 `docs/CHARTER.md`, 이 절, `CLAUDE.md`를 같은 커밋에서 함께 고친다.

### 1. 목적
잉글랜드 1300–1450 시장도시를 영주로서 키우는 등각 2D 건설·경영 게임을 **사람이 끝까지 하고 싶어 하는 게임**으로 만든다. 시스템은 재료이고, 플레이어의 경험이 결과다.

### 2. 방향(정체성 아홉)
1. **역사가 재료**: 대기근·전쟁·흑사병·재편이 병목을 토지→돈→사람→권리로 옮긴다. 고증은 실제 자료로 하고, 금지 목록(문 표식, 홉 맥주, 육각 관, 담비 — 백작·왕실만 허용, 원색 염료, 현대 달력·헤어·칼라, 물레방아 곡물 방앗간, 1300년 일반 집·오두막의 굴뚝 — 1400년 뒤 부유한 큰 집은 허용; 상세는 `docs/design/art-bible.md`)을 지킨다.
2. **조작 층위 셋**: 조건(권리·정책·약속·인사) → 명령 핀(구역·공공사업 후보지·장려 구역) → 직접 건물은 샌드박스 도구. 영지가 커질수록 결정 단위가 커진다: "이 청원을 누구 편으로?" → "이 시장의 상인 세력을 어떻게 대할까?" → "세 영지 중 어디에 자본과 믿을 청지기를 둘까?"
3. **보이는 시뮬레이션**: 규칙은 세계에서 보인다. 새 규칙은 "어떻게 보이는가"까지가 한 작업이다. 위기는 세계에서 먼저, UI가 뒤따른다.
4. **압력과 위기**: 게임은 대가를 청구한다. 위기는 배운 루프의 시험이고 예고→도래→회복으로 온다. 실패는 사다리다.
5. **사람과 권리**: 후반은 인물·세력·권리의 게임. 인물은 초상 풀·노화 사슬·문장으로 기억된다.
6. **모든 것이 남는다**: 내 결정(대안·예측·실제), 사건, 인물의 생애, 주변 세력의 역사가 전부 기록 원장에 남는다. 연대기·인물 전기·세력 연대기 화면에서 "그때는 어땠나"를 글과 그때의 지도로 본다. 설계는 `docs/design/CHRONICLE_DESIGN.md`.
7. **조건을 만드는 영주**: 플레이어는 조건을 만들고 도시는 이유 있게 반응한다. 설계는 `docs/design/lord-mode.md`.
8. **이유가 보인다**: 모든 결과에 "왜"가 있고 누르면 나온다(영수증·예측·원장).
9. **과장하지 않는다**: 확률과 다른 원인을 숨기지 않는다("영주님의 판결이 모든 까닭은 아닙니다").

### 3. 화면 원칙
- 평소엔 게임만. UI는 행동이 부를 때만 나타나고 끝나면 접힌다. 상시 정보는 날짜·계절, 인구, 식량 버팀 일수, 돈 넷뿐.
- 배치 가능 여부는 도구를 고른 뒤 세계 위에 색+패턴+이유로. 도구 선택 전 안내 표시는 튜토리얼 목표 1곳뿐.
- UI 상태 기계(평소·건설·배치·구역·선택·장부·모달·결산·일시정지): 패널 슬롯 1개, Esc 한 단계, 모달은 자동 정지.
- 상태별 면적 예산(평소 PC 6%·태블릿 8% 등)은 자동 측정 관문. 이모지·유니코드 기호 대신 그림. 터치 대상 ≥ 44px, 호버 전용 정보 0.

### 4. 작업 방식
- **관문은 사람 플레이**(G1~G4). 에이전트 관문(시나리오·가드레일·결정론·클론)은 회귀 방지.
- 지시서: ID·목표·만들 것·만들지 않을 것·관문(수치)·필수 조건·시간 상한. 보고 첫 줄은 관문 결과. 한 지시서는 한 세션에만. 의존 없는 작업은 연쇄 진행 가능.
- 레인(기초 설계서 8절, AGENTS.md "레인과 파일 경계"): 엔진(규칙·시뮬·저장·등록기 어댑터·읽기 모델 API) / 렌더 A(영주 화면·UI·입력·HUD) / 렌더 B = Astra(세계 그리기 장치·그림 계약·그림 설치 — 자기 가지에 커밋하고 같은 병합 전 검사·클론을 통과한 뒤 본선에 푸시) / Astra 콘텐츠·그림·QA(설치는 렌더 B가) / INBOX(수령·장부) / REMOTE(실행기·검사·문서·추이) / 판정(Claude 채팅) / 최종 판단(사용자). 다른 레인의 파일은 건드리지 않는다(예외: 상태 분기 한 줄).
- 가드레일 실행은 작업당 2회, 순환 금지. 4/5면 "알려진 정지"로 기록·병합, 봇 문제는 별도 작업(BOT-n).
- 무거운 검증(가드레일·전체 회귀·브라우저·캡처·기하 감사·클론·장기 판)은 실행기 `scripts/remote/run.sh`로 돌린다(지금은 DGX; 기하 감사용 Mac Studio 실행기는 0단계 할 일). 무거운 실행은 동시에 2개까지이고 나머지는 줄을 서며 기다리는 동안 자리와 앞의 실행을 기록한다. 작업 Mac은 단위 시험·린트·개발 서버까지이고, 무거운 검증을 시작하면 장치가 거부한다(급할 때 `FLS_ALLOW_LOCAL=1`, 보고서에 적음).
- 성능은 기다리지 않고 판정한다: 개발 서버가 늘 계측하고(환경을 함께 기록), 본선 커밋마다 DGX가 추이를 재며, 두 커밋은 A-B 짝 비교(95 % 폭)로 나빠짐을 정한다. 조용한 때를 기다리지 않는다.
- 본선 합치기: 작업 브랜치 → 관문 → 깨끗한 클론 → merge·push → 브랜치 삭제. 본선이 움직였으면 양쪽을 살린다. C25 판·문서·STATUS 갱신.
- 판정이 필요한 선택지는 물어보고, 기다리는 동안 다른 일을 한다. 판정 전제(예: "N일")가 게임 구조와 안 맞으면 지적하고 대안을 제시한다.
- 시간 표기는 달력 도착점("봄 말쯤"). 틱·게임초 금지. 새 문구는 `*.ko.ts`.

### 5. 에셋 규칙
- 규격 `ASSET_PIPELINE_SPEC_v1.md`. 워커 = 승인 템플릿 재스킨, 동물 = 다리만 다른 2프레임, 초상 = 완성 초상 풀 + 노화 사슬(레이어 합성 금지).
- Astra 산출물은 도착 즉시 `assets-inbox/<wave>/` + `INBOX_LEDGER.csv`, 원본은 `~/feudal-lord-analysis/astra-raw/`. 설치 시 런타임은 C2PA 청크 제거본, inbox는 받은 바이트 그대로.
- 검수는 개별 파일 전부를 펼쳐서(확인 그림만 보지 않음), 오버레이는 원본 위에 겹쳐서, 초상은 256px 합성으로, 줌 0.6 판독으로.
- 그림은 **그림 계약(manifest)**으로 들어간다: 렌더는 종류마다 그리는 장치를 한 번 만들고, 그 뒤 그림은 데이터와 파일만으로 설치된다(`docs/design/visual-architecture.md` 4절).
- 판정은 **실제 게임 장면 합성**으로 한다: 주변과 이어지는지를 먼저 보고, 색·수치만으로 판정하지 않는다.

### 6. 문서
- 로드맵·상태: `docs/ROADMAP.html`(작업 상태는 TASKS 배열), `docs/STATUS.md`(세션별 현재·다음).
- 기초 설계서: `docs/design/foundation.md`(게임·개발 방향·아키텍처의 정본, 이 헌장은 그 요약), `docs/design/visual-architecture.md`(시각·에셋).
- 설계서: `docs/design/DESIGN_MASTER.md`, `CONTENT_DESIGN.md`, `PLAYER_FLOW_DESIGN.md`, `VISIBILITY_DESIGN.md`, `CHRONICLE_DESIGN.md`, `lord-mode.md`, (예정) `UI_STATE_DESIGN.md`, `PERSON_DESIGN.md`.
- 결정 목록: 규칙·기준을 바꿀 때마다 ID와 이유. 조사 결과는 `docs/research/`.
- 용어: 게임 문구는 docs/design/glossary.md의 용어 정본을 따른다. 새 용어가 필요하면 정본에 먼저 추가한다.

### 로드맵 작업 상태 (헌장 6절의 운용 규칙)
- **작업 전**: `docs/ROADMAP.html` 5절(로드맵)에서 자기 작업 ID를 확인한다. `deps`가 끝났는지, 같은 ID를 맡은 세션이 없는지 본다. 목록에 없는 작업이면 같은 형식으로 추가한다(8절 편집 규칙).
- **끝나면**: `TASKS` 배열에서 그 작업의 `status`(`done`/`wip`/`todo`/`hold`/`dropped`)와 `note`(커밋 해시와 한 줄)를 갱신하고, 문서 하단 변경 이력에 한 줄을 적는다.
- **상태 변경은 두 곳을 같은 커밋에서 고친다**: `docs/ROADMAP.html`의 `TASKS`와 `docs/STATUS.md`.

### 헌장과 아래 번호 규칙의 관계
아래 규칙의 번호는 그대로 둔다. 같은 내용은 합쳐 읽는다.
- **지시서·보고**
  - 4절 "지시서 형식·보고 첫 줄" = "지시서 읽는 법"·"보고 양식".
  - 4절 "판정은 물어보고 기다리는 동안 다른 일" = 상시 규칙 앞의 "지시서와 저장소 문서가 충돌하면 멈추고 질문한다"를 보탠다.
- **가드레일**: 4절 "가드레일 작업당 2회·4/5면 알려진 정지" = "자동 성장 가드레일".
- **원격 실행**: 4절 "무거운 검증은 DGX" = "원격 실행 (DGX Spark)".
- **세션 범위**: 4절 "세션 범위·상태 분기 한 줄 예외" = 규칙 18.
- **본선 합치기**
  - 4절 "본선 합치기" = 규칙 13(깨끗한 클론)·14(브랜치)·16(문서 갱신).
  - 병합 뒤 브랜치 삭제: 4절과 규칙 14가 같다(기본 삭제, 지시서가 "남겨 두라"고 명시하면 예외). 사용자 판정(2026-09-26)으로 규칙 14를 4절에 맞췄다.
- **문구**: 4절 "새 문구는 `*.ko.ts`" = 규칙 5·9.
- **화면**: 3절 "터치 ≥ 44px·호버 전용 정보 0" = 규칙 4.
- **에셋**: 5절 Astra inbox·원본 보관 = 규칙 6·17.
- **문서**
  - 6절 문서 = 규칙 15·16. 규칙 15의 읽는 순서에서는 `docs/STATUS.md` 다음, 지시서 앞에 `docs/ROADMAP.html` 5절을 본다(위 "로드맵 작업 상태").
  - 6절 설계서 이름 `PLAYER_FLOW_DESIGN.md`·`VISIBILITY_DESIGN.md`는 저장소의 [`docs/design/player-flow.md`](docs/design/player-flow.md)·[`docs/design/visibility.md`](docs/design/visibility.md)다.
  - 기록·연대기 설계서는 [`docs/design/CHRONICLE_DESIGN.md`](docs/design/CHRONICLE_DESIGN.md)다(정체성 6, 작업 F0-C2·CHRON-1·CHRON-2).
  - 영주 모드 설계서는 [`docs/design/lord-mode.md`](docs/design/lord-mode.md)다(정체성 7, 작업 LM-E1~E4·LM-R1~R3·G-LM). 종합은 [`docs/design/lord-mode-synthesis.md`](docs/design/lord-mode-synthesis.md)다.

<!-- ===== 아래 블록을 저장소 루트 AGENTS.md 맨 위(기존 내용 앞)에 추가 ===== -->

## 레인과 파일 경계 (기초 설계서 8절, 결정 FND-2)

| 레인 | 누가 | 소유 | 하지 않음 |
|---|---|---|---|
| 엔진 | Claude Code | 규칙·시뮬·저장·등록기 어댑터·읽기 모델 API | 화면 코드 |
| 렌더 A | Claude Code | 영주 모드 화면·UI·입력·HUD | 세계 그리기 장치 |
| **렌더 B** | **Astra** | 세계 그리기 장치·그림 계약(manifest)·그림 설치 | UI·엔진 규칙 |
| 콘텐츠 | Astra | 사건·문장·이웃 세계 데이터(등록기 형식) | 엔진 어댑터 |
| 그림 | Astra | 계약 형식 그림 생산, 장면 합성 검증 | 설치(렌더 B가) |
| QA·감독 | Astra | 화면 QA, 시각 검사기 후보, 로직·설계 감시 | 고치기(보고만) |
| INBOX | Claude Code | 그림·기록 수령, 장부 | 판정 |
| REMOTE | Claude Code | 실행기·검사·문서·추이 | 게임 코드 |
| 판정 | Claude(채팅) | 원격 대조·판정·지시·장부 | 코드 |
| 최종 판단 | 사용자 | 방향·플레이 판정(G-LM 등)·권한 | — |

**렌더 B 권한**: 자기 작업 가지에 커밋하고, 다른 세션과 같은 관문(`check:merge`·깨끗한 클론·작업 지시 장부)을 통과한 뒤 본선에 푸시한다(규칙 14·19와 같은 방식).

**렌더 A와 렌더 B의 파일 경계** — `src/render/`에는 세계 그리기와 캔버스 입력·화면 부품이 섞여 있어, 폴더가 아니라 역할로 나눈다.
- **렌더 B(세계 그리기·그림 데이터)**
  - `src/render/`의 세계 그리기: 지면·땅의 변화·물·경계, 건물 본체와 상태 층, 땅 소품·마당, 워커·짐, 연출·날씨·계절, 랜드마크(`*Draw*`·`*Model*`·`*Art*`·`*Assets*`·`*Layout*`·`*Kit*` 등).
  - 그림 계약과 카탈로그: `src/render/*Manifest*`·`*.generated.ts`, ASSET-ARCH-1이 만드는 계약 파일. UI 그림(초상·사건 삽화·지역 지도)의 계약 데이터와 파일도 여기다.
  - 런타임 그림 `public/assets/**`, 설치 대장 `docs/provenance/assets.csv`, 설치·카탈로그 스크립트(`scripts/install*`·`scripts/*AssetManifest*`·`scripts/*Provenance*`·`scripts/provenanceLedger*`·`scripts/*WorldAssets*`).
- **렌더 A(화면·입력)**
  - `src/ui/**`·`src/styles/**`·`src/input/**`·`src/App.tsx`·`src/main.tsx`.
  - `src/render/`의 캔버스 입력·런타임 연결(`canvas*Runtime*`·`canvas*Resolution*`·`canvas*Handler*`·`camera*`)과 React 부품(`*.tsx`, 예: `BuildingInspector`)·문구(`*.ko.ts`).
  - 그림을 보여 주는 화면(초상 틀·삽화 카드·지역 지도 화면)은 렌더 A, 그 그림의 계약·파일은 렌더 B다.
- **경계에 걸친 파일**: 위 목록으로 갈리지 않으면 먼저 손대는 레인이 판정(Claude 채팅)에 묻고, 결정을 이 목록에 한 줄로 더한다. 다른 레인의 파일이 필요하면 고치지 말고 보고서에 "넘김"으로 적는다(규칙 18의 상태 분기 한 줄 예외는 그대로).
- **판정 기준**: 그림은 실제 게임 장면 합성으로 판정한다(헌장 5절). 사람 키 정본은 아트 바이블 17.6px다(결정 FND-3).

## 작업 원칙 (모든 작업에 항상 적용)

### 지시서 읽는 법
모든 작업 지시서는 맨 위 여섯 칸으로 시작한다: **목표 · 만들 것 · 만들지 않을 것 · 관문 · 필수 조건 · 시간 상한**.
- 합격은 **관문으로만** 판정한다.
- 관문을 통과하면 **즉시 보고하고 멈춘다.** 관문 밖에서 발견한 개선은 보고서 "다음 후보"에 적기만 한다.
- 시간 상한을 넘으면 멈추고 현황과 막힌 이유를 보고한다.
- 지시서와 저장소 문서가 충돌하면 멈추고 질문한다.

### 검증 네 층
| 층 | 질문 | 역할 | 언제 |
|---|---|---|---|
| 단위·회귀 테스트 | 코드가 깨졌나 | **필수 조건** | 매 작업. **마지막 커밋 해시 기준 전체 회귀(Phase 9 포함)**. 테스트를 고쳤으면 그 커밋에서 다시 전체 |
| 자동 성장 seed 1~5 | 시뮬레이션이 **나빠졌나** | **가드레일** (목표 아님) | 엔진 규칙(경제·배치·공사·서비스·승급)을 바꾼 작업에서만 |
| 화면 플레이 60분 | 처음 하는 사람이 막히나 | 플레이 흐름 단계의 **관문** | 단계 관문. 결함을 고쳤으면 다시 플레이해야 판정 |
| 사람 플레이 | 재미있나 | 판단 | 단계 끝 |

### 자동 성장 가드레일
- 기준선: 직전 가드레일 통과 커밋의 seed 1~5 결과(`seeds/baseline-<commit>.json`).
- **회귀(고쳐야 함)**: 기준선에 없던 교착(성장 정지 + 자동 조언 "조치 없음"), 과잉 건설(방앗간 > 밀밭, 시설 상한 초과), 서비스 공백 영구 방치 악화, 기준선에서 L4 24/24였던 seed의 미도달, 경고 표시 건물 10% 이상.
- **기록만**: 승리 틱, 안정 구간, 유휴 노동 비율, 안정 구간에서 같은 방앗간의 밀 재고가 2,400틱 연속 0이었던 비율. 마지막 순간 재고로 이 비율을 대신하지 않는다. 같은 방식으로 측정한 기준선보다 크게 나빠지면 회귀이며, 기준선에 연속 관측이 없으면 비교 결과는 미판정(통과 아님)이다.
- **가드레일에 새 목표를 얹지 않는다.** 새 조건은 그걸 달성할 시스템이 생긴 단계의 관문에 넣는다(예: 유휴 노동 비율 → C3 관문).
- 최대 1,200,000틱. UI·문서만 바꾼 작업에서는 돌리지 않는다.

### 화면 플레이 규칙
`npm run play`, 새 게임, 1600×1100. 코드·테스트·문서·DOM·콘솔·상태 주입·검증 훅·자동 발전 금지. 마우스·키보드 입력과 화면 캡처만. 실제 60분. 결정마다 `[mm:ss] 본 것 → 판단 → 행동 → 결과`. 마찰 분류(막힘·오해·못 찾음·지루함·조작·버그). 보고서 첫 줄: "에이전트는 사람의 재미를 대표하지 않는다".
- **상태 스냅샷**: 화면 플레이 중 하네스가 5분마다 게임 상태를 읽기 전용으로 저장한다(`replay*/snapshots/mmss.json`). 플레이어(에이전트)는 이 파일을 보지 않는다. 실패 재현용이다.
- **구간 관문 예외**: 지시서가 구간 관문을 지정하면, 자연 화면 플레이에서 나온 스냅샷에 한해 그 시점부터 시작할 수 있다. 합성·편집한 상태는 금지. 보고서에 스냅샷 출처(어느 플레이, 몇 분)를 적는다.

### 원격 실행 (DGX Spark)
[사용법·동작: docs/REMOTE_RUNS.md](docs/REMOTE_RUNS.md)
- **원격 필수**: 다음은 `scripts/remote/run.sh`(`npm run remote:*`)로 DGX에서 돌린다.
  - 가드레일 → `remote:guardrail`
  - 전체 회귀(`npm test` 전체) → `remote:test`
  - 브라우저·Playwright 테스트 → `remote:browser`, 또는 `run.sh`에 명령을 준다
  - 캡처·성능 측정 → `remote:perf`, 또는 `run.sh`
  - 깨끗한 클론 검증 → `remote:clone-check`
- **로컬 허용**: typecheck, 단일 파일·소규모 단위 테스트(`npx tsx --test tests/<파일>.test.ts`), 린트, 개발 서버, `npm run perf:gate`, Astra QA.
- **장치로 막는다**(`scripts/remote/localGuard.mjs`): 전체 시험 스위트(`npm test`), 가드레일(`scripts/efficientGrowthRun.ts`), 브라우저 캡처 스크립트(`scripts/*Captures*`·`*Evidence*` 등 Playwright를 쓰는 스크립트)는 Mac에서 시작하면 거부하고 쓸 명령(`npm run remote:*`·`scripts/remote/run.sh`)을 알려 준다.
  - Mac 판별은 macOS와 `scutil --get LocalHostName`이다. Mac의 `os.hostname()`은 네트워크가 주는 이름이라 쓰지 않는다.
  - 급할 때만 `FLS_ALLOW_LOCAL=1`로 푼다. 그 경우 보고서에 반드시 적는다. 실행은 `.remote-runs/local-heavy.log`에 남는다.
  - 개발 서버를 띄우는 스크립트는 `scripts/remote/devServers.sh`(셸 `fls_serve`)나 `scripts/serverProcess.ts`(`spawnServer`)로 띄운다. 실패·중지에도 서버가 꺼진다(결정 RR12, [원격 실행](docs/REMOTE_RUNS.md#브라우저)).
  - 새 브라우저 캡처 스크립트는 첫 import 앞에 `refuseHeavyOnMac("브라우저 캡처(<경로>)", { entry: import.meta.url })`를 넣는다.
- **성능은 두 가지이고, 재는 곳이 다르다.**
  - **처리량 기준선**(프레임 p50·p95, 단계 시간 등): DGX 기준선(`perf/baseline-dgx-<sha>.json`)과만 비교한다. Mac 수치와 섞지 않는다.
  - **끊김 판정**(`npm run perf:gate`, 최대·33/50 ms 초과·순간): 이 Mac의 실제 Chrome 창에서만 판정한다. DGX 헤드리스는 소프트웨어 래스터라 끊김 판정에 쓰지 않는다([perf-gate](docs/verification/perf-gate/README.md), 결정 SG1~SG5).
  - **메모리 측정**(`scripts/perf/memoryHolders.ts`, 힙 스냅숏·픽셀 붙잡이): 이 Mac의 실제 Chrome 창에서 잰다. 픽셀 메모리는 DPR·GPU에 따라 달라서다. 판정에 써도 된다(결정 RR2).
- **성능 판정은 추이로 한다**(사용자 판정 2026-09-30, 결정 RR3). 측정은 아무것도 기다리지 않는다: 잠금·대기열·조용한 기계 기다리기가 없고, 다른 세션을 막지도 막히지도 않는다. 그때의 환경은 수치 옆에 적는다.
  - **커밋마다 추이**: 본선 푸시 때 pre-push 훅이 그 커밋을 DGX에서 뒤로 잰다(`scripts/perf/trendRun.ts`, 판정 지표 넷: JS 할당 MB/s·GC/분·캔버스 생성/초·GC 뒤 남은 힙. 스크립트 시간은 DGX 부하에 끌려가므로 다른 일 CPU와 나란히 참고 칸에만 두고, 판정은 `perf:ab` 짝 비교에서만 한다 — 결정 RR6). 값이 비교 커밋(앞 본선 커밋)이 제 실행들에서 보인 범위를 그 폭만큼 넓힌 범위 밖이면 **의심**이고, 그러면 DGX가 두 커밋을 A-B-A-B(`perf:ab`)로 자동으로 돌려 짝 차이의 95 % 폭(t 분포)이 0 위이면 A-B를 한 번 더 돌려 두 번 모두 그럴 때만 **나빠짐**으로 확정한다(결정 RR7). `npm run perf:trend`가 [`docs/verification/perf-trend/`](docs/verification/perf-trend/README.md)를 다시 쓴다. 본선에 합치는 세션은 이 문서를 갱신해 함께 커밋한다. 작업 브랜치에 본선을 합칠 때 문서가 10개 넘게 뒤처졌으면 병합 뒤 훅이 갱신해 그 폴더만 따로 커밋한다(`FLS_TREND_AUTO=0`으로 끔). 문서가 본선 머리보다 10개 넘게 뒤처지면 `check:merge`가 경고 한 줄을 찍는다(푸시는 막지 않음). 경고가 쌓이면 인프라 세션이 모아 커밋한다(결정 RR4).
  - **두 커밋 비교**: `npm run perf:ab -- --a <커밋> --b <커밋>`. 같은 장면을 A-B-A-B로 번갈아 돌려, 같은 소음을 둘이 같이 맞게 한다. 짝지은 차이의 95 % 폭(쌍 수에 맞춘 t 분포, 4쌍이면 ±3.18 표준오차)이 0의 한쪽에 있을 때만 나빠짐·좋아짐이다(결정 RR7). Mac 실제 창(기본)이나 DGX(`--headless`, `run.sh`로).
  - **항상 켜진 텔레메트리**: 개발 서버(`npm run dev`)는 누가 돌리든 10초마다 프레임 분포·33/50 ms 초과·긴 프레임의 우리 함수·힙·GC·캔버스 생성·계절 전환/자동 저장을 그때의 환경(다른 CPU·입력·창·배속·인구)과 함께 `~/.fls-telemetry/`에 쌓는다(`scripts/telemetry/`, 배포판에는 없음, `FLS_TELEMETRY=0`으로 끔). `npm run telemetry:report`가 환경별로 나눠 본다. 게임 쪽 훅(줌·캐시 재생성 이름)은 [요청서](docs/requests/render-telemetry-hooks.md).
- **원격 폴더 label은 `<세션>-<작업ID>`다**(예: `render-F0V`, `engine-F0A`). `FLS_REMOTE_LABEL`로 준다.
- 원격 실행은 48GB·12코어·nice 10 안에서만 돈다(`fls-runs.slice`). 무거운 실행(전체 회귀·가드레일·화면 기하 감사·깨끗한 클론, `--heavy`·`--detach` 명령)은 동시에 2개까지이고 나머지는 줄을 선다(결정 RR14). 짧은 실행은 `--light`로 상한 밖에 둔다. DGX 디스크는 실행이 끝날 때마다 스스로 치운다(끝난 폴더는 하루 뒤, `--keep` 결과는 `_kept/`에 남고, 보고서가 부르지 않는 오래된 `_kept`는 압축, 결정 RR15). 판정에 쓴 실행은 보고서에 실행 이름을 적어 두면 압축되지 않는다. 이 상한을 올리거나 우회하지 않는다. 플레이 서버(4173)는 건드리지 않는다. 원격 실행의 포트는 4300~4399다.

### 상시 규칙
1. 커밋은 작업 단위. 증빙은 단계당 3MB 이하(재플레이 캡처 별도, 병합 전 검사가 막는다 — 규칙 19), 이미지 JPEG. 준비 상태·자연 플레이·자동 성장 재생을 캡처마다 구분 표기.
2. 배포·main 병합은 명시 지시 없이 금지.
3. 원인 표시는 원인 등록표, 예측은 `PredictionLine[]` 재사용. 새 표시 체계를 따로 만들지 않는다.
4. 모바일·Steam Deck: 호버 전용 정보 금지(선택·탭으로도 보여야 함), 입력은 의도(선택·확정·취소·이동·확대·긋기)로 추상화, 터치 영역 44×44px, 글자 최소 11px·권장 12px.
5. 새 문구는 문자열 조립 금지(`"예상 " + n + "/" + m` ✗). `t()`가 생기기 전까지 새 문구를 한 파일에 모은다.
6. 새 생성 에셋은 설치 전에 에셋 생성 기록 대장에 행을 추가한다(도구가 주지 않은 seed·모델 버전은 지어내지 않는다).
7. 작업이 설계 결정을 바꾸면 같은 커밋에서 설계 문서와 결정 기록을 갱신한다.
8. **푸시**: 작업 브랜치를 항목마다 원격에 푸시하고, 최종 보고서에 원격 해시 = 로컬 해시를 적는다. main 병합·배포·PR은 명시 지시가 있을 때만.
9. **이름**: 파일·모듈·상수 이름은 작업 번호가 아니라 영역으로 짓는다(`aQuadruplePrimeWallCopy.ts` ✗ → `wallDraftCopy.ko.ts` ✓). 사용자 문구는 영역별 `*.ko.ts`.
10. **캐시**: 캐시를 추가할 때 (a) 무효화 키 (b) 키에서 빠진 입력이 결과에 영향을 주지 않는 이유 (c) 추가 전후 측정값을 주석과 보고서에 남긴다.
11. **저장 형식**: `GameState` 모양을 바꾸는 작업은 같은 커밋에서 `SAVE_SCHEMA_VERSION`을 올리고 `src/save/migrations/`에 vN→vN+1 단계를 추가한 뒤 `npm run save:fingerprint`로 지문을 갱신한다. 저장 스키마 감시 테스트(`tests/saveSchemaFingerprint.test.ts`)를 끄거나 지문만 바꾸지 않는다(저장 시스템 병합 후 적용).
12. **규칙 명세 우선**: 규칙을 바꾸는 작업은 지시서의 명세를 코드 주석이나 `docs/`에 옮기고, 명세의 각 조항을 검증하는 시나리오 테스트를 먼저 쓴다. 화면 플레이는 마지막 확인이다.
13. **완료 판정은 깨끗한 클론 기준.** 테스트·스크립트는 저장소 밖 절대경로·`output/` 증빙 폴더에 의존하지 않는다.
14. **브랜치**: 작업 브랜치는 그 작업이 끝나면 본선에 합치고, **병합 뒤 브랜치(원격·로컬)를 삭제하는 것이 기본이다.** 지시서가 "남겨 두라"고 명시하면 예외다. 본선에 합치지 않은 브랜치를 다음 작업까지 남기지 않는다. 본선에서 작업 중인 에이전트가 있으면 다른 에이전트는 본선을 자기 브랜치로 merge해 충돌을 미리 푼다. 본선은 제품 작업 브랜치를 뜻하며 main 병합·배포는 명시 지시가 있을 때만 한다.
    - **본선 푸시는 `FLS_PUSH_OK=1 git push …`로만 하고, 다른 명령과 이어 붙이지 않는다**(예: `FLS_PUSH_OK=1 git push origin HEAD:codex/phase15-organic-ground`를 단독 실행). main도 같다.
      - 안전장치: pre-push 훅(`scripts/git-hooks/pre-push`)이 이 변수 없이 본선·main으로 가는 푸시(갱신·삭제)를 거부한다. 설치는 `npm run hooks:install`이고, `npm ci`/`npm install`의 postinstall이 새 클론에도 설치한다. git-lfs 훅은 `pre-push.chained`로 이어서 돈다.
      - `--no-verify`로 훅을 건너뛰지 않는다. 작업 브랜치 푸시에는 변수가 필요 없다.
      - 명령이 중단되거나 거부되면, 계속하기 전에 원격 ref(`git ls-remote`, reflog)에 이미 반영된 것이 있는지 확인한다.
15. **읽는 순서**: `docs/STATUS.md` → 지시서 → `docs/design/DESIGN_MASTER.md` 관련 절 → `docs/decisions/README.md`.
16. **문서 갱신**: 작업 완료 시 `docs/STATUS.md` 갱신, 결정을 바꾸면 같은 커밋에서 설계서·결정 목록 갱신.
17. **에셋 받은 편지함**: Astra 후보는 받는 즉시 `assets-inbox/<wave>/`에 LFS로 커밋한다(설치 여부와 무관). 설치는 여기서 꺼내 `public/assets/`로 옮기고, 불채택은 inbox에 남긴 채 대장 상태 `rejected`.
    - Astra 산출물은 도착하면 설치 여부와 관계없이 `assets-inbox/<wave>/`에 보관하고 `INBOX_LEDGER.csv`에 상태를 기록한다([구조·상태 뜻](docs/ASSET_INBOX.md)).
18. **렌더 수정 금지의 예외**: 새 건물 종류를 추가할 때 렌더의 종류별 분기 세 곳(`buildingInspectorModel` 용도 문구, `buildingVisualState` 몸체, `historicalFacilityAssets` 그림 id)에 최소 줄을 넣는 것은 렌더 수정 금지의 예외다. 그 밖의 렌더는 건드리지 않고, 보고서에 "렌더 세션이 넘겨받을 것"으로 적는다.
19. **병합 전 자동 검사**: 본선·main 푸시마다 pre-push 훅이 `npm run check:merge`를 푸시하는 범위(원격 머리..로컬 머리)에 돌린다(`FLS_PUSH_OK=1`일 때도). 하나라도 실패하면 푸시를 거부한다. 기존 위반은 목록으로 두고 새 것만 본다. [사용법](docs/REMOTE_RUNS.md#병합-전-자동-검사)
    - **회귀 시험은 벽시계로 판정하지 않는다**(결정 RR9): 시간은 가짜 시계·틱 수로 정하고, 성능 예산은 `recordCodeBudget`(`tests/helpers/codeBudget.ts`)으로 넘겨 DGX 추이가 커밋마다 잰다. 목록은 [wall-clock-tests](docs/verification/wall-clock-tests.md).
    - **증거 폴더는 3 MB 이하다**(`scripts/checks/evidenceSize.mjs`, 결정 RR10): 범위에서 바뀐 `docs/verification/<작업>/` 폴더가 3 MB(2^20 단위)를 넘으면 푸시를 거부한다. 재플레이 캡처·`uiaudit1/geometry/`·`perf-trend/`는 세지 않고, 이미 넘은 두 폴더는 기준선 크기까지다.
    - **결정 ID는 하나뿐이다**(`scripts/checks/decisionIds.mjs`, 결정 RR8): `docs/decisions/README.md`에서 같은 ID가 두 행에 있으면 푸시를 거부한다. 다른 세션이 먼저 쓴 번호면 내 것에 새 번호를 준다.
    - **고정값 재기록은 결정 목록에 이유와 함께 한다.**
      - 대상: 가드레일 기준선 `seeds/baseline-*`, DGX 성능 기준선 `perf/baseline-dgx-*`, 저장 지문 `src/save/schemaFingerprint*.json`, C25 판 `c25-board*.json`, 장부 세계 기준 `fixtures/ledger/world-baseline-*`, `fixtures/determinism/`, `fixtures/saves/`, 테스트 파일 안의 16자 이상 해시 값.
      - 이 가운데 하나를 추가·변경·삭제한 브랜치는 같은 브랜치에서 `docs/decisions/README.md`(또는 `docs/DECISIONS.md`)에 그 파일 이름(또는 두 단계 이상의 상위 폴더)과 재기록 이유를 적은 줄을 더한다.
    - **린트 예외는 이유 주석과 함께 넣는다.**
      - 새 `eslint-disable…`·`@ts-ignore`·`@ts-expect-error`·`as any`에는 같은 줄이나 윗줄에 `// why: <이유>`를 단다.
      - 기존 25건은 `scripts/checks/lint-exceptions-baseline.json` 목록에 있다. 이 목록은 줄이기만 하고, 손으로 늘리지 않는다.
    - **ESLint**(`tools/eslint/`, 루트와 따로 설치)
      - 바뀐 파일에서 `react-hooks/exhaustive-deps`와 금지 컨트롤을 본다. 금지 컨트롤은 `src/ui`의 네이티브 `<select>`·`<input>`·맨 `<button>`이며, UI 부품 폴더 `src/ui/kit/`는 예외다.
      - 기존 위반은 `tools/eslint/eslint-suppressions.json`에 있다.
      - **금지 컨트롤 규칙의 원본은 `tools/eslint/uiControls.mjs`다.** 다른 ESLint 설정(UI-KIT-1 등)은 이 파일을 가져다 쓰고 복사하지 않는다.
    - **계층**: `src/{engine,population,economy,zones,world,save,ledger,state}/**`는 `src/ui/**`·`src/render/**`를 import하지 않는다.
      - 표현이 시뮬레이션을 읽고, 반대로는 읽지 않는다. 시뮬레이션에 필요한 문구는 자기 `*.ko.ts`에 두거나, 코드를 돌려주고 UI가 문구를 붙인다.
      - 규칙 원본은 `tools/eslint/layers.mjs`(ESLint `no-restricted-imports`)다. 기존 위반은 `eslint-suppressions.json`에 있고, CODE-1a가 없앤다.
    - **한글 문자열은 `*.ko.ts`에만 둔다**(규칙 5·9, `scripts/checks/koreanStrings.mjs`).
      - `src`의 코드 파일에서 한글이 든 문자열·템플릿·JSX 텍스트는 `*.ko.ts`와 생성 파일(`*.generated.*`)에만 둘 수 있다. 주석은 세지 않는다.
      - 기존 40개 파일의 문자열 463개는 `scripts/checks/korean-strings-baseline.json` 목록에 있다(파일별 정확한 문구). 목록의 문구를 고치면 새 문자열로 본다.
    - typecheck도 함께 돈다. 새 억제·예외 목록 항목을 손으로 추가해 검사를 통과시키지 않는다.
    - **Astra 장부의 `replaced_by`는 장부에 있는 파일 경로만 쓴다**(`scripts/checks/inboxLedger.mjs`). 여러 장이면 `;`로 잇고, 패턴·설명은 `verdict_note`에 쓴다. 기존 행과 바이트가 같은 행을 새로 넣으면 비고에 `○○와 동일 바이트(정본: 경로)`를 단다(정본 = runtime manifest나 설치 대장이 가리키는 행, 없으면 같은 바이트 중 confirmed이면서 가장 먼저 받은 행).
    - **inbox 그림 한 장에 장부 한 행**(`scripts/checks/inboxLedger.mjs`, 결정 RR11): 범위가 `assets-inbox/` 아래를 하나라도 바꾸면(어느 세션이든, 더하기·옮기기·지우기·장부 고치기), `<head>`의 그림(`.png`·`.jpg`·`.jpeg`·`.webp`·`.gif`·`.svg`) 목록과 장부 `file` 열이 같아야 한다. 행 없는 그림(`NOROW`)이나 파일 없는 행(`NOFILE`)이면 푸시를 거부한다. 옮긴 파일은 그 행의 `file`도 옮긴다. 같은 검사에서 새로 들어온 inbox JPG·JPEG가 Git LFS 포인터가 아니면 실패하고(`NOTLFS`; `.gitattributes`가 옛 JPG를 일반 파일로 두는 예외 폴더 27곳에 새 JPG를 넣을 때의 함정), 새 그림이 1 MB(2^20)를 넘는데 LFS가 아니면 경고한다(푸시는 막지 않음). 옮기거나 복사한 파일은 새것으로 치지 않는다.

20. **개인 Claude Code 설정은 `.claude/settings.local.json`에 둔다**(git에 올리지 않음, `.gitignore`).
    - 저장소의 `.claude/settings.json`은 모든 세션이 같이 쓰는 것만 담는다: graft 훅·graft 권한, 그리고 `GRAFT_NO_STATUSLINE=1`(`env`).
    - 같은 파일에서 oh-my-claudecode 플러그인을 이 저장소에서 끈다(`"enabledPlugins": {"oh-my-claudecode@omc": false}`, 결정 RR13). 까닭: 그 플러그인의 SubagentStop 훅(`subagent-tracker`)이 끝난 팀원 에이전트에 "Agent … completed"를 넣어 4~5초마다 다시 깨웠고, 늦게 받은 지시로 같은 일을 두 번 하게 했다(NAT-5 창고 눈·강가 바위). 그 훅 하나만 끄는 설정은 없다. 하위 에이전트는 Claude Code 자체 종류(`general-purpose`·`Explore` 등)를 쓴다.
    - 상태줄(`statusLine`·`subagentStatusLine`), 개인 권한, 개인 환경 변수는 `settings.local.json`에 넣는다.
    - 까닭: 커밋하지 않은 추적 파일 변경이 작업 트리에 남으면, DGX 실행은 "dirty" 트리로 돌고 병합 전 검사는 그 결과(예: ui-geometry)를 거부한다. 2026-10-02 엔진 세션이 이 때문에 1시간을 잃었다.
      - 원인은 graft였다. graft는 버전이 바뀔 때 저장소 연결을 다시 쓰면서 상태줄을 `.claude/settings.json`에 넣는다.
      - `GRAFT_NO_STATUSLINE=1`이면 넣지 않고, 이미 넣은 graft 상태줄도 지운다(`graft init`의 `--no-statusline`과 같음).
    - graft 상태줄을 쓰고 싶으면 `settings.local.json`에 `"statusLine": {"type": "command", "command": "node \"${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-statusline.cjs\""}`를 넣는다.
    - 작업 트리에 커밋할 생각이 없는 추적 파일 변경을 남기지 않는다. 남았으면 `git status`로 보고, 개인 것이면 `.local` 파일로 옮긴다.

### 보고 양식
맨 위 한 줄 판정: `관문: 통과/실패 — <관문 지표>`. 이어서 커밋 / **실행 위치** / 관문 결과 / 가드레일(해당 시) / 필수 조건(마지막 커밋 기준 전체 회귀 N/N · typecheck · build) / 다음 후보 / 소요 시간. A4 2장 이내.
- **실행 위치(필수)**: 관문·필수 조건에 쓴 검증마다 어디서 돌았는지 적는다: `DGX`, `Mac`, `둘 다`.
  - 예: `전체 회귀 3,901/3,901 — DGX(깨끗한 클론 a597617)`, `perf:gate — Mac 실제 창`.
  - Mac에서 무거운 검증을 `FLS_ALLOW_LOCAL=1`로 돌렸으면 그 사실과 이유를 여기에 적는다.
  - 위치가 없는 수치는 판정에 쓰지 않는다.
- **작업 지시 장부(필수)**: 작업을 본선에 병합할 때 [`docs/ops/DISPATCH_LEDGER.md`](docs/ops/DISPATCH_LEDGER.md)의 자기 세션 줄에서 그 작업의 체크박스(`- [ ]` → `- [x]`)를 채우고 본선 커밋 해시를 적어, 병합 커밋에 함께 넣는다. 채우지 못한 항목은 비워 두고 보고서에 까닭을 적는다.

<!-- ===== 추가 블록 끝 ===== -->

## Graft 그래프 준비

워크스페이스(git worktree)마다 로컬 `graft/` 그래프를 쓴다. `graft/`는 git에 올리지 않는 캐시라서 새 worktree에는 없다. 작업을 시작할 때 `graft/` 폴더가 없으면 먼저 `graft build`를 실행한다(API 키 불필요, 30초 안팎).

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->

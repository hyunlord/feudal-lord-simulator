# EVA-AUTO 사건 그림이 엔진을 따라가게 — 보고서

관문: 통과 — 켜진 사건 그림 71/71이 진짜 카드에 그려짐(`render-EVAAUTO-full2-35d1bdc`) · 관계 시험 · 등록기 카드 두 줄 기하 40칸 실패 0(`render-EVAAUTO-geometry3-97779d2`) · `test:changed` 실패 0(아래) · 첫 로드 98.46 MB / 150 MB

사용자 지시(2026-10-06): 엔진이 v4.1로 011을 켜자 EVENT-ART 시험 여섯이 깨졌다 — "진짜 자동으로: ① 등록기의 켜진 사건에서 그림 목록·출처를 자동으로 ② 시험은 숫자 대신 관계 ③ 모드가 사건을 더해도 렌더 코드를 안 건드리게." 결정: 설치 표시는 사건마다 진짜 카드를 그려 본 자동 캡처로(EVA-D5).

커밋: `claude/evaauto`(본선 `56aae1a6`에서, 본선을 합침 — DEC-CARD 카드 포함) → 본선. 엔진 파일 0줄. 작업은 에이전트가 하고(명령·시험·첫 캡처) 렌더 A가 본선을 합친 뒤 카드 표지를 맞추고 다시 캡처했다.

실행 위치: 둘 다.
- DGX: 사건마다 카드 캡처(`render-EVAAUTO-full-3b050f5`, 합친 뒤 `render-EVAAUTO-full2-35d1bdc`), `test:changed`, 등록기 카드 줄 기하 감사.
- Mac: 명령의 적용 절반(출처 줄·장부 쓰기 — 장부는 DGX가 돌려주는 폴더에 없어서), 단일 시험 파일, 타입 검사, ESLint, `check:merge`.

## 1. 만든 것
- **명령 하나 `npm run eventart:auto`**(`scripts/eventArtAuto.ts`), 두 절반:
  - **캡처**(`scripts/eventArtAutoCapture.mjs`): 켜진 사건은 등록기에서(`eventCardEntryIds()`), 싣는 그림은 빌드에서(`EVENT_ART_DERIVATIVES`) — 손 목록 없음. 개발 서버를 띄우고(`spawnServer`), 그림마다 영주 조각에 그 항목의 제안을 연 상태를 넣어 진짜 카드를 머리 없는 Chrome으로 연다(넷씩). 확인 넷: 카드와 그림 요소가 이 id · 그림 주소가 이 id의 파생본이고 페이지가 받은 바이트가 이 빌드의 파생본 SHA-256 · 디코드됨(`naturalWidth > 0`) · 비지 않음(그린 상자의 밝기 퍼짐 ≥ 8). 결과 `docs/verification/eventart/auto/captures.json`(시각 없음 — 같은 트리면 같은 파일) + 1280×800 JPEG 넷. Mac에서 부르면 캡처를 DGX로 보낸다.
  - **적용**(브라우저 없음): 그려졌고 SHA가 맞는 그림만 출처 줄(실행 자산, 파생본 크기·SHA), 프롬프트 파일, 장부 `installed_by EVENT-ART`(CRLF 그대로). 다른 켜진 집합의 캡처나 받은 그림 묶음과 다른 목록은 거부. 두 번 돌려도 그대로.
- **관계 시험**(`tests/eventArtAuto.test.ts`, 순수 함수 `scripts/eventArtAutoRows.ts`에 등록기·목록·캡처를 넣어서): 켜진 사건마다 그림이 그려졌고(이 빌드의 SHA) 출처 줄·설치 표시가 있음, 아니면 밝힌 까닭(정본의 막힘 · 팩에 그림 없음); 싣는 그림마다 켜진 사건; 캡처가 지금의 켜진 집합과 같음. 실패 줄은 "run `npm run eventart:auto`"로 끝남. **모드 꼴 시험 항목**(`mod:harvest_feast`, 제 그림)이 렌더 코드 없이 같은 고르기·파생본·첫 로딩 밖 범주로 실림. **끈 사건 시험**(ck_evt_005): 줄이 retired, 표시가 지워지고 관계가 성립. `tests/eventArtCard.test.ts`의 `live.length === 71`·011/180/001 줄·`ids.length === 200`을 지우고 v4 항목 전부에 대한 확인으로.
- **손으로 돌리던 단계 없앰**: `scripts/installEventArt.ts` → `scripts/eventArtIntake.ts`(받은 그림을 들일 때 목록만 씀; 200/167/33 숫자 → 관계). `scripts/eventArtCaptures.mjs`의 그림마다 4절은 새 명령이 대신(본선을 합칠 때 DEC-CARD가 그 절을 고친 것과 겹쳐, 그 절은 빼고 DEC-CARD가 더한 `registryOfferView` 쓰임은 둠).
- **본선을 합친 뒤**: 등록기 카드가 DEC-CARD의 무거운 결정 카드가 되어 그림 요소가 `.decision-card-art`(배경 그림) — 거기에 `data-art`(그림의 사건 id)를 달고 캡처가 두 요소를 다 찾게 했다(`35d1bdcb`). 다시 캡처: 71장 모두 그려짐, 출처 줄·장부는 그대로(파생본이 같음).

## 2. 관문과 필수 조건
- **사건마다 캡처**(DGX 가벼운 실행, 남김): `render-EVAAUTO-full-3b050f5` 71/71(캡처 416초, 넷씩); 본선·DEC-CARD를 합친 뒤 `render-EVAAUTO-full2-35d1bdc` **71/71**(캡처 320초, 밝기 퍼짐 약 43–58). 켜진 항목 86개, ck_evt_201–215(15개)는 팩에 그림이 없음(밝힌 까닭). 첫 적용은 출처 줄 71개의 설명을 다시 쓰고(자리 그대로) RECOVER-1부터 켜져 있었지만 표시가 없던 ck_evt_011에 `installed_by`를 달았다.
- **정직한 메모**: 캡처는 사건마다 같은 조각에 제안을 넣으므로 카드의 답이 "이 일에 걸린 대상이 더는 없습니다"로 닫혀 보일 수 있다(사진 `shot-ck_evt_037.jpg`). 이 캡처가 증명하는 것은 그림이고, 답은 각 사건의 실제 상태에서 엔진이 정한다.
- **기하 감사**(등록기 카드 줄): `render-EVAAUTO-geometry3-97779d2`(`97779d29`, 깨끗한 트리): `modal.lord.registry`·`modal.lord.registry-hold` 40칸 실패 0·열지 못함 0, 남김. 화면의 바뀐 것은 무거운 카드 그림 요소의 `data-art` 속성 하나(배치 없음)라 사건 그림이 나오는 이 두 줄만 쟀다. (앞의 `geometry`는 한 줄만 맞았고, `geometry2`는 결정 문서가 커밋 전이라 더러운 트리 — 둘 다 지움.)
- **바뀐 것에 걸린 시험**: 에이전트의 `render-EVAAUTO-changed-e142331` 534/534(본선 합치기 전). 내용(트리)마다 기록이 따로라 이 보고서를 넣은 커밋 뒤 올리는 내용에서 `render-EVAAUTO-changed2`(DGX 관문 줄)로 다시 돌리고, 그 기록으로 check:merge가 통과한 뒤에만 올린다.
- **check:merge**: `97779d29`에서: 고정값 변화 없음·lint 예외 새것 0·장부 6,122줄 한 줄씩·화면 밖 한국어 문자열 새것 0·결정 번호 중복 없음·증거 eventart 1.40 MB / 3 MB·틀 후보 261개 모두 등록·eslint 12개 파일 새 위반 0·typecheck 통과·첫 로드 98.46 MB / 150 MB. **ui-geometry**는 공용 기록(`205b3238`에서 잼)이 UI 입력이 바뀌어 낡았다고 FAILED(실패 0칸) — 바뀐 줄 기하 감사(위)를 근거로 `FLS_UI_GEOMETRY_GATE=warn`과 머리 커밋의 `UI-Geometry-Override:` 꼬리말로 올린다.
- **Mac 시험**: eventArtAuto·eventArtCard·verifyProvenance·keyartDerivatives 28/28(합친 뒤).
- 증거: `docs/verification/eventart/auto` 약 0.37 MB(JPEG 넷 + captures.json + README), eventart 폴더 1.40 MB / 3 MB.

## 3. 원칙 점검
- **P-M1·확장성**(docs/design/extensibility.md): 사건 그림은 사건 id로만 찾고, 고르기·파생본·캡처·줄 쓰기가 모두 목록을 받기만 한다 — 모드 꼴 시험 항목이 렌더 코드 없이 실림(지킴). 팩 id는 렌더 B가 그림 계약에 넣으면 팩마다의 목록을 합침(EVA-D7).
- **P-D4**: 그림이 실리는지는 등록기가 정함(`runs`), 화면은 규칙을 베끼지 않음(지킴).
- **증거는 실제에서**: 설치 표시는 진짜 카드에 그림이 그려진 뒤에만(EVA-D5).
- **RR22**: 관문·검사·실행기 규칙은 바꾸지 않았다. 시험은 관문 규칙이 아니다.

## 4. 경계 파일 수정: 이유·최근 수정자
모든 파일의 최근 수정자는 공용 git 이름 `kwanhyeonpark-ctrl`이다.
- `scripts/keyartDerivatives.ts` — 순수 `eventArtDerivatives(known, ids)`(EVENT-ART `5ed9b4eb`).
- `src/ui/eventArt.ts`·`src/ui/eventArtSelection.ts` — 주석만(`f3fd5d9c`).
- `src/ui/decisionCard/DecisionCard.tsx` — 그림 요소에 `data-art`(DEC-CARD `2c37f162`).
- `scripts/eventArtCaptures.mjs` — 4절 뺌(DEC-CARD lordcards `27169114`와 합침).
- `docs/provenance/assets.csv`·`assets-inbox/INBOX_LEDGER.csv`(CRLF 그대로) — 명령이 씀.

## 5. 결정
EVA-D5 설치 표시는 자동 캡처로, 숫자 시험은 관계 시험으로(사용자) · EVA-D6 더는 켜지지 않은 그림의 줄은 retired(렌더 A) · EVA-D7 그림 목록은 커밋 + 다시 만든 것과 같음 시험, 팩 목록은 합치기(렌더 A).

## 6. 넘김
- **엔진 세션에 한 줄**: "사건을 켜거나 끈 뒤(모드의 사건을 더해도) Mac에서 `npm run eventart:auto`를 돌려 바뀐 것을 커밋해 — 안 돌리면 `tests/eventArtAuto.test.ts`가 이 명령을 부르며 실패해."
- **엔진 B**(가지 ae26ab28, 108개 사건 → 그림 93장): 병합하면 관계 시험이 실패하고 이 명령으로 풀린다(93장이면 7~10분쯤으로 보이지만 잰 것은 아님).
- **콘텐츠·Astra**: ck_evt_201–215는 켜져 있지만 팩에 그림이 없어 카드가 그림 없이 나온다.
- **REMOTE**(요청 없음, 가능한 후속): `run.sh`는 docs/·seeds/·perf/·output/·fixtures/만 돌려주어 DGX에서 바로 이 명령을 돌리면 `assets-inbox/INBOX_LEDGER.csv`가 오지 않는다 — 명령이 "Mac에서 `-- --apply`"를 알려 준다. Mac에서 부르면 문제없다.
- **렌더 B**: 그림 계약에 팩 id가 들어오면 `EVENT_ART_IMAGES`를 팩마다의 목록을 사건 id로 합친 것으로 — 사건마다 바꿀 것은 없다. 렌더 B 파일은 건드리지 않았다.

## 7. 다음 후보
Wave 18·Wave 14 작은 작업 → LM-R3. DEC-CARD 2단계는 DEC-TRACE·GP7-ENGINE이 들어오면.

소요 시간: 2026-10-07 14:56 ~ 2026-10-07 18:10(보고서 커밋)(명령 시각 기준, UTC+9).

# LM-R2 영주 화면 — 보고서

관문: 통과 — 영주 화면 넷·결정 카드 넷·그림 58장(필요할 때 불러옴, 첫 로드 97.34 MB / 150 MB) · 기하 감사 LM-R2 바뀐 줄 50줄 990칸 실패 0·열지 못함 0(`render-LMR2-geometry8-5f278b9`, REMOTE 검토판 감사) · `test:changed` 1,744/1,744(`render-LMR2-changed3-5f278b9`) · 스킨 감사 1,023 요소 그림 없는 것 0(`render-LMR2-skin2-490b767`)

커밋: `claude/lmr2`(본선 `d041e9ff`에서, 본선 여러 번 합침) → 본선. 엔진 파일 0줄.

실행 위치: 둘 다.
- DGX: 영주 상태 묶음(`~/fls-lmr2-states` 아홉, `~/fls-lmr2-ledger-states` 일곱, 실제 플레이에서), 화면별 캡처, 스킨 감사, 기하 감사, `test:changed`.
- Mac: 단일 시험 파일, 타입 검사, ESLint(`tools/eslint`), `check:merge`(예산 포함), 뷰 계산 시간(tsx).

## 1. 만든 것 (영주 모드에서만)
- **영주 집무**(`src/ui/lord/screen/`): 장부의 영주 탭에서 여는 옆 패널(너비 `min(760px, 100% − 280px)`, 세상이 보이고 시간이 흐름), 왼쪽 메뉴 아홉(lord-components-region 아이콘), 화면 사이 깊은 연결(`onOpen(screen, 엔진 id)`).
- **혼인**(협상): 신랑·조항 편집 → 엔진 `evaluateOffer`의 단계·이유·상한·거절을 그대로 보이는 실시간 조약 미리보기, 역제안(바뀐·빠진 줄), 혼인 진행 연표. 다툼은 소송 화면으로.
- **약속·소송**: 약속 장부(열림·기한·지킴·어김, 증인·담보·빚 나눠 갚기), 등록기의 기한 있는 조건(ER-7), 소송 트랙(청구 → 제기 → 증거 → 후원 → 심리 → 판결 → 점유 집행), 이웃이 영주에게 거는 소송은 보기만.
- **영지**: 포트폴리오 카드(그림은 Estate 필드에서만), 관리 방식·청지기 후보·주의력·예외 규칙·감사 방식·여덟 철 요약, 정책 탭의 정책 아이콘 넷과 보조금 안내.
- **지역**: 지도 하나(본 영지 + 이웃 셋, 직할·위임·이웃 깃발, 빈 받침에만 문장, 지도만의 확대).
- **결정 카드 넷**(`src/ui/lord/decisions/`): 유언 변경·상속 다툼·미카엘마스 감사·지도 밖 청원. 칩에서만 열리고(LR2-D2), 영지 화면의 [결정하기]로도 열린다(지금 카드가 보이는 그 결정에만).
- **그림 58장**(협상 11·약속 9+소송 트랙 1·영지 22·지역 15)을 렌더 B의 그림 계약 장치로 설치: UI 부품 종류 둘(`ui-frame` 9-slice, `ui-image` 고정 크기)을 더하기만 했다(기존 종류·로더·검증기 그대로). 장부 58줄 `installed_by=LM-R2`는 실제 화면 캡처와 같은 커밋에서만. 영주 화면 그림은 화면이 열릴 때 불러온다(LR2-D1, 첫 로드 97.34 MB / 150 MB).
- 담비 초상(I101–I103·L6)은 백작 가문 밖에 안 나온다(`lordPortrait.ts` 출처 가드 + 시험), 글씨 12 px 아래 없음(시험), 주 버튼은 화면마다 하나 이하.

## 2. 관문과 필수 조건
- **스킨 감사**(DGX `render-LMR2-skin2-490b767`, 남김): 상태 전부(기본 UI5 + 영주 화면 넷 + 결정 카드 셋) 1,023 요소, 그림 없는 것 0·기본 버튼 0·틀 없는 상자 0·빠진 상태 0. 기본 UI5 상태는 이 커밋에서 새로 만듦(남아 있던 `~/fls-ui5-states`는 이행 전 저장이라 열리지 않았다).
- **기하 감사**: 1회째 `render-LMR2-geometry-bebbc47`(50줄 990칸) — 실패 52칸 모두 지역 지도 이름표가 지도 끝을 넘음, 결정 카드 네 줄 80칸은 감사의 칩 단계가 첫 칩만 되풀이해 못 엶. 고침: 이름표를 지도 가운데 쪽으로 걸고 10em에서 줄바꿈, 맞춘 지도는 `overflow: clip`(초점이 지도 안을 스크롤하지 못하게), 글꼴이 온 뒤 이름표를 다시 잼, 감사의 칩 단계는 칩을 차례로. 2~7회째는 지역 줄을 고쳐 가며 다시 쟀고(감사 판정 변경은 2b절), **8회째 `render-LMR2-geometry8-5f278b9`**: REMOTE 검토판(`hyunlord/geometry-review` `f2ba1240`)과 본선을 합친 `5f278b95`에서 LM-R2의 바뀐 줄 전부(lord.·modal.lord.·slot.ledger.·hud.event-chips·hud.event-card·hud.crisis-icons·hud.action-dock) 50줄 990칸 실패 0·열지 못함 0. 남김(`_kept`).
- **가짜 긴 문구**: 기하 감사의 긴 문구 칸(1.4배)에 포함.
- **바뀐 것에 걸린 시험**(`npm run test:changed`, DGX, 관문 줄): `render-LMR2-changed3-5f278b9` 251개 파일 1,744/1,744. 1회째 `render-LMR2-changed2-2fc4dba`는 1,639/1,640 — 입력 경계 R4(약속·소송·협상의 단추 여섯이 `dispatch`를 바로 부름)를 고침(`fb03dcd1`). 엔진 EXT-1 "one catalog line adds a good"·"…adds a building" 통과(이 가지에 엔진 변경 없음).
- **check:merge**(본선 `56aae1a6`을 합친 `9d9c4e84`): 고정값 변화 없음·lint 예외 새것 0·장부 6,122줄 한 줄씩·화면 밖 한국어 문자열 새것 0·결정 번호 중복 없음·증거 폴더 둘 다 3 MB 안(lmr2 2.73 MB, uiaudit1 1.65 MB)·틀 후보 251개 모두 등록·eslint 새 위반 0·typecheck 통과·첫 로드 98.15 MB / 150 MB. **ui-geometry**는 공용 기록(`geometry.json`, 렌더 B가 `d63bea5c`에서 잼)이 UI 입력이 바뀌어 낡았다고 FAILED(실패 0칸) — 새 기준(본선 `eeccc92a`)의 바뀐 줄 기하 감사가 8회째(위)라서 `FLS_UI_GEOMETRY_GATE=warn`과 머리 커밋의 `UI-Geometry-Override:` 꼬리말로 올린다(8회째 뒤 바뀐 것은 문서와 본선 합치기뿐). **tested**는 내용(트리)마다 기록이 따로라 이 보고서를 넣은 마지막 커밋 뒤 `render-LMR2-changed4-final`(DGX, 관문 줄)로 다시 돌리고, 그 기록으로 check:merge가 통과한 뒤에만 올린다.
- 화면별 캡처(각 사양의 캡처 관문, DGX, 합 2.9 MB / 3 MB): 협상 `render-LMR2-negotiation-65b74c1`, 약속·소송 `render-LMR2-ledger-cap-ba93891`, 영지 `render-LMR2-estates-21d4dda`, 지역 `render-LMR2-region-1c8fa69` — 모두 실패 0. 협상·지역 캡처는 한국어 이름 고침(LR2-D3) 전에 찍혀 라틴 가문 이름이 보인다(그림 관문의 증거, 문구 증거 아님).
- **매 프레임 비용**: 칩은 엔진 명령을 돌리지 않고(결정 칩 0.0004–0.001 ms), 카드·영지·지역·약속 뷰는 상태마다 한 번(같은 틱 다시 그리기 0.0001 ms 안팎). 영주 상태에서 `storyBeats` 0.006–0.017 ms(이전 0.065–0.103).

## 2b. 감사 판정 변경 (모든 세션이 쓰는 관문 — 사용자 승인 2026-10-06)
기하 감사(`scripts/uiGeometryMeasure.ts`)의 **"글이 말줄임 없이 잘림"** 판정이 바뀌었다(`80a193a7`).
- **전**: 글 하나에 영역 하나(스크롤하는 조상까지 모든 잘라내는 조상의 겹침)를 두고, 실패를 가장 안쪽 잘라내는 조상의 이름으로 셌다. 그래서 스크롤된 화면 안의 overflow-hidden 상자(지역 지도) 속 글이 스크롤로 시야 밖에 나가면 "지도가 잘랐다"로 실패했다 — 스크롤하면 닿는 글인데(잘린 양 = 이름표 너비 전체).
- **후**: 글마다 `hardRect`(가장 가까운 스크롤러 안의, 스크롤하지 않는 잘라내는 조상만 남긴 부분)를 두고, 그 잘림만 센다. 스크롤로 가려진 부분은 — 스크롤러 바깥 상자(옆 패널)가 자른 것까지 — 실패가 아니다(`render-LMR2-geometry6-b99e8c8`: 처음 판이 옆 패널을 단단한 자름으로 세어 스크롤된 이름표가 남았다).
- **그대로**: 스크롤하지 않는 상자가 제 글을 자르면 여전히 실패(`tests/uiGeometryMeasure.test.ts`의 새 시험이 둘 다 확인). 판정이 느슨해지는 쪽은 "바깥 스크롤러가 가린 부분"뿐이다.
- **REMOTE 독립 검토**(사용자 2026-10-07, 이후 결정 RR22 — 감사·관문 규칙은 바꾸기 전에 REMOTE 검토): 이름표 판정은 맞았지만 내 규칙이 진짜 잘림 둘을 놓쳤다 — overflow-x:hidden인 세로 스크롤러의 가로 잘림, 높이 제한 없는(실제로 안 스크롤되는) 스크롤러가 바깥 패널에 잘린 경우. 고친 판(`hyunlord/geometry-review` `f2ba1240`: 축마다 판정, 스크롤러 창이 바깥 자름 안일 때만 지움, 글꼴 기다림, 브라우저 시험)을 합쳤고 8회째 기하가 그 판으로 쟀다. **다른 화면 비교가 나오면 LR2-D5에 "REMOTE 검토 통과"를 적는다**(이 올림은 검토를 기다리지 않음 — 사용자).

## 3. 원칙 점검 (지시서에 관련 원칙이 없어 건드린 것을 적음)
- **P-D1** 결정마다 2–3개 답, 각자 엔진의 대가(금고·호감·후임·약속 기한) — 지킴(`tests/lmr2DecisionCards.test.ts`).
- **P-D3** 같은 무게의 답은 모두 보조 버튼(카드·역제안·감사 방식) — 지킴(LR1-D2, 스킨·기하 감사).
- **P-D4** 예측은 엔진 계산: 카드는 명령 시험 실행, 협상 미리보기는 `evaluateOffer`, 약속·소송 단추는 `gameReducer(state, cmd) !== state` — 지킴(시험이 `estateConfig` 상수 복사를 막음).
- **P-T2** 결정 카드는 스스로 열지 않고 칩으로(멈춤은 기존 칩 규칙 그대로) — 지킴.
- **P-L1** 권원과 점유를 따로 보임(영지 조각표·소송 판결 뒤 집행 따로) — 지킴.
- **P-L2** 약속 장부: 기한·지킴·어김은 엔진 기록 그대로 — 지킴.
- **P-W2** 이웃의 회복 소송도 보임(보기만) — 지킴.
- **P-H2** 죽은 사람은 건강 "좋음"으로 안 보임(건강 그림은 보류) — 지킴.
- **P-M2** 화면 코드에 배경 단어 없음(바뀐 코드 36파일 검사: 엔진·콘텐츠 이름과 개발용 설명뿐), 새 문구는 화면마다 `*.ko.ts` 한 곳 — 지킴. 남은 것: 영지 그림 규칙의 "40마르크"(`WEALTHY_MARKS`)는 팩 데이터로 옮길 몫(EXT-2).
- **P-T6** 화면의 뷰 캐시는 상태 객체 키 WeakMap(지난 상태를 붙잡지 않음, LEAK-1) — 지킴.

## 4. 경계 파일 수정: 이유·최근 수정자
모든 파일의 최근 수정자는 공용 git 이름 `kwanhyeonpark-ctrl`이다. 괄호는 이 작업 전 마지막 커밋.
- `src/render/art/artContract.ts`·`artContract.schema.json`·`artAdapters.ts`·`artSelection.ts`·`artRegistryValidation.ts` — UI 부품 종류 둘(형식·스키마·`ui-handoff` 배치·선택 문맥 `state`·의미 검사 한 줄), 더하기만(`cd24d50c` 2026-10-05).
- `src/render/art/catalog.json` — 묶음 넷 `lord-ledger`·`lord-estates`·`lord-negotiation`·`lord-region`(`11d40c60`).
- `docs/provenance/assets.csv` 58줄 더함, `assets-inbox/INBOX_LEDGER.csv` 58줄 `installed_by`(CRLF 그대로)(`57eb2563`).
- `scripts/checks/surfaceRegistry.mjs` — 영역별 줄 파일 읽기(`b22a3a9e`); `scripts/marriagePath.ts` — 약속 지키기 정책(기본 그대로)(`25b72d48`); `scripts/uiGeometryAudit.mjs` — lord2 상태, 칩 단계 차례로(`25b72d48`); `scripts/remote/tasks.sh` — lord2 상태 폴더(`d2eda0a0`); `scripts/uiSkinAudit.mjs` — `--states-lord2`(`e4e7a7b5`); `scripts/checks/distBudget.config.json` — 필요할 때 불러오는 영주 화면 범주(`ffd08387`).

**렌더 B에 한 줄**: "LM-R2가 `src/render/art/`에 UI 부품 종류 `ui-frame`(9-slice)·`ui-image`(고정 크기)를 더했고(기존 종류·로더·검증기 무변경, `uiPartValidation.ts` 새 파일), 영주 화면 그림 58장이 그 종류로 들어가 있다 — 검토해 주고, 앞으로 UI 그림도 이 종류로 받아 줘(팩 id가 계약에 들어오면 이 둘도 함께)."

## 5. 결정
LR2-D1 영주 화면 그림은 화면이 열릴 때 불러옴(사용자) · LR2-D2 결정 카드는 칩에서만, 숫자는 명령 시험 실행(사용자) · LR2-D3 이름은 `GENTRY_NAMES_KO`(사용자) · LR2-D4 지역 지도 바탕·자리·두 걸음 고르기(렌더 A, 두 걸음은 판정 대기).

## 6. 넘김
- **엔진**(`docs/requests/engine-lmr2-seen-and-reads.md`, 본선): 이야기 "봤음" 기록(저장 v50) — 들어오면 렌더가 칩·카드에 잇는 작은 후속(사용자 2026-10-06); `suitActions`(증거 값·후원 크기·집행 힘·다음 단계 틱), `keepPromiseRefusal`·`answerCounterRefusal`(지금은 "지금은 할 수 없습니다"), 복사 표 내보내기. 새로: 협상의 `right_piece`·`land_use` 조항은 `evaluateOffer`가 점수에 넣지만 계약이 실행하지 않아 화면에 없다.
- **Astra**: 약속·소송 메뉴 아이콘(아홉째 항목에 그림 없음), `treaty_divider`의 늘림 기록(지금 16×256 그대로), `annual_audit.png` 1.41 MB를 240 px로 보임(480 px 판이면 약 1.3 MB 줄음).
- **보류 그림**(설치 안 함, 엔진 필드 없음 또는 실제 상태에 안 나옴): 영지 declining·hunting·ecclesiastical·moated, 직책 bailiff·clerk·reeve와 office_40 다섯, health_* 셋, alert_news, 성향 넷(엔진 성향은 상인·소작인·탐욕 셋), map_abbey(종교 영지 없음 — LM-E10).
- **LM-E10**: 이웃 18·지역 atlas 20장·슬롯·실험 길.
- **MANOR-1**(본선): 홈 청원 문장 원은 이미 고른 가문(확인), 영주관 그림은 발자국대로 3×3로 그려짐. 남은 연대기 문장·카메라 중심은 DEC-CARD에서 고침.

## 7. 다음 후보
DEC-CARD(사용자 최우선: 쉬운 말의 무거운 결정 카드·결과 칩·연말 카드·가문 카드 — 1단계 다 됨, 관문 중) → EVA-AUTO 나머지(관계 시험·자동 설치 캡처; 크기 관문은 EVA-D4로 먼저 올림) → Wave 18·Wave 14 작은 작업 → LM-R3. v50이 들어오면 "봤음" 연결.

소요 시간: 2026-10-06 01:06 ~ 2026-10-07 14:47(명령 시각 기준, UTC+9). 기하 감사 대기가 대부분(DGX 무거운 칸이 엔진 B의 긴 실행에 몇 시간씩 잡힘).

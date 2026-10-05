# EVENT-ART 사건 삽화와 등록기 사건 카드 — 보고서

관문: 통과 — 등록기 사건 카드(v4) · 사건 그림 70장(v4 id, 엔진이 돌리는 것만) · Wave 40 순간 열넷 · 첫 로딩 예산 97.05 MB / 150 MB(필요할 때 84파일 10.49 MB) · 기하 57eb2563 28줄 550칸 실패 0·열지 못함 0(EVA-geom-57eb256) · 깨끗한 클론 4,980/4,980·타입·빌드(EVA-clone-57eb256) · ui-geometry 덮어쓰기 1

실행 위치: 둘 다.
- DGX: 캡처(카드 v4 70장·답·칩·보류·태블릿·캠페인 없음, Wave 40 열넷의 순간), 기하 감사, 전체 시험, 깨끗한 클론, 영주 상태(`~/fls-lord-states/registry-offer*.json`, `~/fls-wave40-moment-states`).
- Mac: 단일 시험 파일, 타입 검사, ESLint(`tools/eslint`), 병합 전 검사(예산 포함).

지시(사용자 2026-10-04~05): 사건 삽화 200장 확정(`event-art/final200-20261004/`, 파일 이름 = 콘텐츠 정본 v4 사건 id) — 엔진 등록기가 사건을 켜면 카드가 그 id로 그림을 찾게. 초반 청원 13장은 wave44/(LM-R1이 홈 청원 카드에 붙임), 영주 모드 사건 14장은 wave40/. 레지스트리 사건 카드는 새로 만든다(EVENT-ART 범위). 판정: ① 엔진이 가진 사건 그림만 싣는다(EVA-D1) — LM-E9b가 병합되면 v4 정본으로 70개 안팎이 켜지고 013·032·034 문구 어긋남도 그때 풀린다. ② 사건 삽화는 카드를 열 때 불러오고 첫 로딩에 넣지 않는다(예산은 첫 로딩 기준), 빌드 산출물만 재압축하고 원본은 장부 그대로(EVA-D2).

**판 경계**: 렌더 B 분리(FND-2) 뒤 AGENTS의 파일 경계는 "그림을 보여 주는 화면(삽화 카드)은 렌더 A, 그 그림의 계약·파일은 렌더 B"다. LM-E9b 보고서도 v4 사건의 그림 연결을 렌더 B 몫으로 적었다. 이 작업은 사용자가 렌더 A에 맡긴 것(2026-10-04~05)이라 카드와 함께 그림 설치(목록·빌드 파생·출처·장부 표시)까지 했다 — 이후 사건 그림의 계약·파일 손질은 렌더 B와 나눈다.

## 1. 등록기 사건 카드 (영주 모드만)
- v4 발생(`occurrence.source === "v4"`, LM-E9b)만 그린다. 홈 청원은 LM-R1의 카드가 그대로이고 두 번 뜨지 않는다. 샌드박스·캠페인에는 없다.
- 오는 방식은 청원과 같다: 세계 먼저 → 이야기 칩 → [결정하기]로 카드, 처음 한 번은 스스로 열린다(`src/ui/hud/RegistryCard.tsx`, 모델 `src/ui/registryCardModel.ts`, 문구 `src/ui/registryCardCopy.ko.ts`).
- 카드: 그림(240 px, 궁정·보낸 쪽 줄 옆), 제목·본문·보낸 쪽(`V4_COPY`, 보낸 세력은 `factionDisplayName`), 궁정 줄, 남은 날과 그 해·계절, **왜 왔나**(묶인 대상 — 청구·신랑/신부·가문·소송 단계, 판 전체 한 번인지, 뽑힘 확률; 말로만, 원 열쇠 없음 — 정체성 8).
- 선택: `offerChoices`가 내는 것만 열리고 각자 지금 움직이는 금고와 맞바꿈(tradeoff) 줄; 엔진이 내지 않는 선택은 까닭과 함께 닫힘(이미 그렇게 됨·돈 N 필요·증거 이미 냄·대상 없음·거절됨 등); 보류는 그 대가(ER-19 `holdCost`: 청구 약화·세력 관계)를 말로, 지금 대가가 없는 보류는 숨김. 모든 답은 보조 단추(LR1-D2).
- 답은 `answer_registry_offer`; 답·만료·무효가 되면 카드가 닫힌다. LM-E9의 옛 초안 카드 경로는 없앴다(이제 그런 발생을 내는 곳이 없음; 옛 저장에 열린 초안 발생이 있으면 카드 없이 기한에 만료).

## 2. 사건 그림 (v4 id로 찾기)
- `scripts/installEventArt.ts`(다시 돌려도 됨): 200장 모두 확인(장부 confirmed·SHA·960×540·C2PA 없음), 200 id의 목록(`src/ui/eventArtManifest.generated.ts`). 33장은 앞 묶음(event-art candidates·rework, wave44 07)의 같은 바이트 파일.
- 싣는 것(EVA-D1·EVA-D3): 엔진이 돌리는 v4 항목(`registryV4Support`)의 그림만 — 지금 **70장**, 손 목록 없음. 엔진이 항목을 켜면 그 그림이 함께 실린다. `artId`가 있으면 그것.
- 그림이 없는 항목은 그림 없이 카드(다른 그림을 세우지 않음).
- 출처 행 70, 장부 installed_by=EVENT-ART 70(실제 카드가 그린 것을 캡처로 본 뒤, CRLF 유지).

## 3. 예산 규칙 (EVA-D2, 사용자 2026-10-05)
- 사건 그림은 카드·칩이 그려질 때 인라인 배경으로만 요청된다(미리 불러오기 없음, 모듈이 그림을 가져오지 않음 — 시험).
- 빌드 산출물만 재압축: 형식 `jpeg-reencoded` — 받은 JPEG를 집안 해독기(`scripts/jpegDecode.ts`, 기준·점진)로 풀고 기존 `encodeJpeg` q70 4:2:0으로(Wave 16·17·21·33 삽화와 같은 설정). WebP는 sharp(네이티브 바이너리)가 필요해 쓰지 않았다(keyartDerivatives가 의존성 없이 쓰인 까닭). 해독기는 libjpeg와 밝기 평균 차 0.04~0.08, 바이트 고정 시험. 받은 원본·장부는 그대로.
- `scripts/checks/distBudget.config.json`: 범주에 `onDemand`를 두고 "사건 삽화(카드에서 불러옴)"(`assets/event-art/**`, `assets/wave40/**`)는 재기만 하고 전체(=첫 로딩)에서 뺀다.
- 크기: 사건 그림 70장 받은 것 14.44 MB → 빌드 9.05 MB; Wave 40 열넷 2.95 → 1.44 MB. 첫 로딩은 카드 코드만큼만 늘었다(v4 작업 기준 95,437,193 → 95,449,851 B); 본선(RB-TRADE)을 합친 머리에서 check:merge "첫 로딩 97.05 MB / 150 MB, 필요할 때 84파일 10.49 MB".

## 4. Wave 40 — 영주 모드의 순간 열넷
- 그림마다 엔진이 이미 쓰는 기록으로 고른다: 혼인(`negotiation.offered`, `marriage.contracted`·`bride_arrived`·`child_born`·`brother_in_law_born`·`father_ill`·`will_change`·`inherited`), 소송(`estate.suit_filed`, 증거 단계, `possession_enforced` 실패 11·성공 12), 후견(`lord.wardship_begun`·`ended`). 다른 기록에는 그림 없음.
- 영주 모드만: 기록마다 그 계절의 이야기 칩과 카드 하나(`lord-moment:<기록 id>`, 기존 EventCards), 연대기의 기록 카드·장 쪽에도 그 그림. 캠페인은 원래 그림 그대로.
- 같은 순간을 두 번 띄우지 않는다: 같은 틱의 제안·성혼은 성혼 그림만, 한 소송의 거듭된 집행은 마지막만. DGX 캡처: 열넷 모두 실제 판에서, 칩 한 번·카드 그림 960×540·연대기에서 다시 열어도 두 번째 칩 없음.
- 설치 `scripts/installWave40.py`, 출처 행 14, installed_by=EVENT-ART 14. 빌드는 위 예산 규칙대로 재압축·필요할 때 불러오기.

## 5. 결정
EVA-D1 엔진이 가진 사건 그림만 · EVA-D2 카드를 열 때 불러오기·첫 로딩 예산·빌드 산출물만 재압축 · EVA-D3 v4 카드(v4 발생만, 문구 V4_COPY, 선택 offerChoices, 보류 대가, 싣는 그림 = 엔진이 돌리는 v4 항목).

## 6. 넘김
- 엔진·콘텐츠: `ck_evt_011`은 Astra의 파생 이름(`COUNTER_MATERIAL_BURDEN_INCREASE_V1`)이 READ_MODEL에 없어 막혀 있다(LM-E9b 보고서와 같음); `ck_evt_050`은 이제 엔진이 돌리지 않아 그림이 실리지 않는다. 보낸 쪽이 복합인 사건(008·024·035)은 보류의 관계 대가를 정할 수 없다(Astra 몫).
- 엔진: 이야기 칩의 "본 것" 표시는 다른 이야기와 같이 메모리에만 — 같은 계절 안에서 저장을 불러오면 칩이 다시 뜬다.
- LM-R2: 협상·혼인·소송 화면 자체, 유언 변경·다툼 결정의 답 화면, 그림 없는 순간들(반대 제안·아버지의 죽음·잃음·다툼·후원·심리·판결). 작업 지시 장부 LM-R2 줄의 "Wave 40 사건 삽화"는 이 작업에서 순간 그림으로 들어갔다.
- 렌더 B: 이후 사건 그림의 계약·파일 손질(판 경계, 위).
- MANOR-1이 병합되면: 홈 청원 카드의 문장 원이 고른 가문 문장으로 바뀌는지 확인하고 영주관을 3×3 제 크기로 다시 그린다(LR1-D 넘김).

## 7. 시험과 관문
- **Mac**: 타입 검사 깨끗, ESLint(`tools/eslint`) 바꾼 파일 깨끗, 시험 76개(eventArtCard 12·eventartWave40 7·jpegDecode·distBudget·keyartDerivatives·verifyProvenance·inboxLedgerRows·surfacesRegistry·renderSourceGuards·c25Board·phase13Part6Rendering·lmr1Petitions) 통과. check:merge: 예산 "첫 로딩 97.05 MB / 150 MB".
- **캡처**(DGX): 카드 — 실제 판의 발생(seed 1, ck_evt_124·1303) 답해 금고가 카드대로 움직이고 닫힘, 칩에서 다시 엶, 보류(ck_evt_053·1319) 답해 대가가 발생에 남음, 70장 모두 실제 카드로 960×540, 1024×768·태블릿 화면 안, 캠페인엔 카드 없음(`docs/verification/eventart/v4/`, 573 KB). Wave 40 — 열넷 모두 실제 판의 순간, 칩 한 번·두 번째 없음(`docs/verification/eventart/wave40/`, 316 KB).
- **기하 감사**(DGX EVA-geom-57eb256): modal.lord.*(등록기 카드·보류 카드·청원), hud.event-*(이야기 칩·카드·영주의 순간), modal.history.*, modal.chronicle-book.*, hud.goal-chips — 28줄 550칸 실패 0·열지 못함 0·새 실패 0.
- **깨끗한 클론**(DGX EVA-clone-57eb256): 4,980/4,980, 타입, 빌드.
- **ui-geometry 덮어쓰기 1**: 사유 — EVENT-ART가 바꾼 화면 줄 전부(등록기 카드·보류 카드·영주의 순간·이야기 칩·연대기)를 57eb2563에서 재 550칸 실패 0·열지 못함 0; 그 뒤 커밋은 보고서·상태 문서뿐; 깨끗한 클론 4,980/4,980.

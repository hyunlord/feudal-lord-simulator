# ASSET-ARCH-1 검증 기록

> 최종 상태: ARCH1·RENDER-B는 본선 `90d9b586` 게시 완료다. 아래 중간 단계의 미완료·대기 문장은 당시 이력이며, 문서 끝 최종 게시 절과 [영수증](final-publication.json)이 해당 관문을 닫는다. d677 clone 실패는 그대로 보존한다.


상태: **코어·분리 데이터 런타임 검증 통과, 데이터 설치 반영, QA003 통합 기하·smoke 통과, 최종 회귀·병합 대기**. 기준 본선 `d4973e85d3d4039cf6f8091c33c1047239e443ee`, 작업 가지 `astra/renderB-asset-arch-1`. 실행기는 DGX이며 무거운 실행은 현재 실행기의 동시 2개 대기열을 사용한다. 이 문서는 완료 보고서가 아니다.

## 구현 범위와 판단

열 종류 그림 계약의 구조·의미 검증, 원자 registry, 결정적 선택, 이미지 디코드와 종류별 그리기/인계 어댑터를 구현했다. 이미 설치된 Wave42 36장의 경로·픽셀·기하를 보존하며 선택을 JSON으로 옮겼다. 10종의 일반 어댑터가 있다는 사실과 실제 게임 소비자 연결은 구별한다. 현재 연결은 땅의 변화와 주택이며 UI는 Render A 인계다.

판단: 첫 신규 증명은 승인된 Wave20 시대 집 전체 32장(본체 20, 판자 6, 눈 6)이다. 기존 상태층 4장을 함께 재사용하되 신규 수량에 더하지 않는다. 직업 세계 전체 128장은 후속 설치 의무로 유지한다. 실제 운반 actor와 중립 지원 활동 사실이 없는 52장을 임의 직업·장식으로 대체하지 않는다. [읽기 정보 요청](../../requests/render-art-read-models.md)을 참고한다.

다음 수치는 **코어→데이터 경계(`d60ababf`→`541a0811`) 당시**의 기록이며, 이후 본선 통합 상태는 마지막 절에서 구분한다. 계약 코어를 고정한 뒤 새 묶음은 JSON·PNG·출처·장부만 추가하는 별도 경계로 증명한다. 코어 커밋 `d60ababf` 뒤 분리 데이터 검증 폴더에서 증명한 catalog와 신규 PNG 32장을 주 작업 폴더로 동일 바이트 복사했다. 출처 32행과 해당 inbox 32행의 `installed_by=ASSET-ARCH-1`만 갱신했으며 기존 다른 설치 행은 보존했다. 1,039개 제품 코드 파일의 집합·SHA가 코어 고정본과 같고, 전체 72개 catalog 항목의 파일·해시·치수·RGBA 검사는 통과했다. 분리 데이터의 실제 소비 캡처 8/8, A/A 8/8, 오류 0을 확인했다. 주 작업 폴더의 72개 파일 검사를 다시 통과했고 제품 코드 1,039개 SHA는 코어와 그대로 같다. 본선 설치 완료는 최종 병합 뒤에만 판정한다.

## 실제 화면 관문

같은 저장 바이트·카메라·틱·계절·줌·viewport·DPR·브라우저·시각 시간을 사용한다. 각 화면은 별도 로딩의 A/A 안정성을 먼저 확인하고, 이전/이후 전체 캔버스 RGBA를 비교한다. JPEG는 열람용이며 픽셀 판정은 PNG RGBA다. 요청·디코드와 실제 게임 캔버스까지 이어진 drawImage 계보를 함께 관측한다. draw 계보만으로 최종 픽셀 가시성이나 가림을 증명하지 않으며 눈 검토를 따로 한다.

| 실행 | 현재 판정 | 해석 |
|---|---|---|
| `astra-ARCH1-capture-before-ba44840` | 실패 | 초기 문서 localStorage, Vite socket, telemetry 요청 오류. A/A 동일이어도 승인하지 않음 |
| `astra-ARCH1-before-fixed-d4973e8` / `astra-ARCH1-after-core-d4973e8` | 실패 | 환경 오류는 해결했으나 offscreen 길 그림의 실제 paint 관측이 부족했음. 8쌍 RGBA 차이 0은 진단 자료에 한정 |
| `astra-ARCH1-proof-core-d4973e8` | 실패 | 처음 8개 도시 화면 A/A·paint·오류 검사는 통과. 준비 장면의 오래된 bare save 형식이 다음 화면에서 거부됨 |
| `astra-ARCH1-proof-before-d4973e8` | 취소 | 같은 준비 파일의 실패가 확인되어 대기 실행을 취소함 |
| `astra-ARCH1-before-v2-d4973e8` / `astra-ARCH1-core-v2-d4973e8` / `astra-ARCH1-data-v2-d4973e8` | 실패 | 담당자가 `tsx` 대신 `node`로 제출하여 `processBuildingSprite.ts`의 확장자 없는 TypeScript import를 해석하지 못함. 셋 모두 캡처 전 0.1초에 종료 1. 제품 실패나 화면 증거로 해석하지 않음 |
| `astra-ARCH1-before-v3-d4973e8` / `astra-ARCH1-core-v3-d4973e8` | 통과 | 전후 각 28/28, 각각 A/A 28/28, 오류 0. 같은 전체 identity에서 RGBA 차이 0, Wave42 36개 요청·정확한 치수 디코드·실제 draw 관측 |
| `astra-ARCH1-data-v3-d4973e8` | 통과 | 분리 코어+데이터 주택 8/8, A/A 8/8, 오류 0. expectedRequests만 제외한 나머지 identity 동일. 신규 32+재사용 4 전체 36개 요청·디코드·draw 관측. 의도한 주택 픽셀 변화는 코어 동일성 판정과 분리 |
| `astra-ARCH1-core-tests-d4973e8` | 취소 | typecheck 종료 0. 저장 fixture/경계 시험 수정 전 스냅샷으로 더 이상 최종 관문이 될 수 없어 중단. 최종 커밋에서 전체 회귀 예정 |

준비 장면은 자연 플레이 성과가 아니다. 생성기는 작성된 fixture를 정식 `decodeSave` migration → `encodeSave`/`decodeSave` 왕복 → 브라우저 `admitSceneState` 경로로 검사한 뒤 쓴다. 땅·집 6개 저장과 20개 준비 화면, 기존 봇 성장 도시 8개 화면을 합쳐 전후 각 28개를 비교한다. 기존 봇 저장은 원래 바이트를 보존하며 준비 fixture의 기반으로 사용하지 않는다.

[픽셀 비교](core-pixels.json), [관측 감사](runtime-coverage.md), [행별 증거](runtime-coverage.json), [캡처 목록](capture-index.json)을 보존한다. 실제 원격 코어·데이터 작업 폴더의 1,039개 제품 코드 집합·SHA는 모두 동일하고 차이 0이다([원격 증명](remote-code-freeze.json)). 두 실행의 aggregate SHA256은 `fe924ebd99df4aef97eddbf24de5b0c86c7b68958e9300982c49002237492e8d`다.

[코어 눈 검토](visual-core.md)와 독립 데이터 검토 [1](visual-data-independent.md), [2](visual-data-second.md)를 함께 제공한다. 두 데이터 검토자는 각각 원본 PNG 전후 8쌍을 열었으며 새 BLOCK 회귀는 관찰하지 않았다. 작은 줌의 판자 세부 및 기존 경고 배지 가림 등 가시성 주의는 남긴다. 실제 draw 관측은 가려지지 않은 최종 픽셀이나 자연 플레이 성과를 뜻하지 않는다.

## 설치 목록과 인계

원본 425개 source ID를 보존한 [재집계](recount-425.md)와 [행별 CSV](recount-425.csv)를 제공한다. Wave37 세계 소품 32장은 B 소유이며 A의 LM-R1과 협업한다. 초기 UI/input 160행도 그림 계약·파일 설치는 B, 화면 소비자는 A로 나눠 기록했으며 최신 변경분은 재집계 delta에서 구분한다. [1단계 UI 인계](../../requests/ui-contract-handoff.md)는 260개 UI 표면 자료를 다루며 425개 하위 집계와 분모가 다르다.

본선 `57228cc1`의 LM-R1을 현재 작업 가지에 통합했다. 원본 `recount-425.csv`는 `d4973e85`의 역사적 재집계로 보존하며 현재 설치분은 `recount-current-delta.json`과 `recount-425.md`에 따로 대조한다. 영주관·Wave37 등 LM-R1 반영분을 신규 B 설치로 중복 집계하지 않는다.

## 코드 검토와 남은 관문

독립 코드 검토에서 발견한 접속 포트 누락, 선택 ID 손실, 길 외 계열 배율 강제, 산술 overflow, startup parser와 draw의 fallback 불일치, 부적합 house layer의 부분 그리기 문제를 수정했다. 최신 코드 재검토의 열린 finding은 0이다. 추가 JPEG 파일 관문도 독립 검토 PASS, 집중 시험 8/8 통과다. 이는 런타임 승인과 별개다.

2026-10-05 Mac 커밋 전 정적 감사: 변경 코드 36파일의 ESLint, `tsc --noEmit`, `git diff --check` 종료 0. 현재 코어 변경의 UI 기하 입력 경로 교집합과 고정 파일 변경은 없었다. 정식 `check:merge`는 git 객체를 읽으므로 이 미커밋 감사로 대체하지 않는다. 새 PNG를 추가하는 후속 데이터 경계에서는 해당 검사를 다시 판정한다.

남은 필수 관문: 최종 회귀·병합 전 check:merge·최종 HEAD 깨끗한 클론 전체 시험/빌드·본선 push. QA003 통합 기하와 통합 장면 재촬영은 아래 별도 입력의 결과로 완료했다. 코어 28쌍 RGBA·Wave42 36개 관측 및 분리 데이터 8개 화면·36개 관측은 완료했다. 별도 데이터 설치 커밋 `541a0811`은 실제 관측 뒤 신규32개만 설치 장부에 표시했으며 현재 작업 가지는 두 묶음을 포함한다.

경계 파일 수정: 기존 world house 본체·overlay 호출부만 최소 변경해 같은 그리기 회차의 본체/상태층 선택 영수증을 전달한다. 엔진·저장 형식·UI/TSX·입력 런타임은 변경하지 않았다.

| 파일 | 기준 본선의 최근 작성자·커밋 | 최소 수정 이유 |
|---|---|---|
| `drawBuildings.ts` | kwanhyeonpark-ctrl, `fc89ac9b` | 실제 본체 draw가 반환한 상태층 영수증을 해당 pass에 전달 |
| `buildingOverlays.ts` | kwanhyeonpark-ctrl, `c8fa7ef3` | 영수증의 층만 그려 본체/층 재선택 불일치를 방지 |
| `historicalHouseAssets.ts` | kwanhyeonpark-ctrl, `30dfbd19` | 새 계약 준비 완료 시 본체를 선택하고 기존 fallback·boolean API를 보존 |
| `houseConditionOverlay.ts` | kwanhyeonpark-ctrl, `30dfbd19` | 계약 층을 그린 경우 기존 판자 층을 중복 표시하지 않음 |

## 통합 후 확인

코어 `d60ababf`와 데이터 `541a0811` 사이 제품 코드 변경은 0이다. 본선 `57228cc1` 통합 뒤에는 렌더 A의 기존 변경 53파일 때문에 d497 기준 전체 동결 SHA와 같지 않으며, 이를 데이터 경계 위반으로 해석하지 않는다. B 제품 파일은 데이터 커밋과 동일하다. 카탈로그가 두 묶음이 되며 드러난 테스트 두 파일의 JSON 추론 가정을 검증된 계약 종류로 좁혔고, 21개 집중 시험과 타입 검사를 통과했다. 새 그림은 UI 기하 입력에 포함되므로 현재 통합 입력으로 전체 기하 감사를 다시 제출했다.

통합 계약 모듈의 집중 시험은 Mac에서 224/224 통과했다. [독립 통합 범위 검토](integrated-scope-review.md)는 B 제품 바이트와 데이터 경계·장부·출처 보존을 통과시켰다. 렌더 A의 queue/sort/가림 변경은 별도 통합 장면으로 확인한다. 기존28쌍 비교는 기존 이전의 증거로 유지하며 새 장면으로 대체하지 않는다.

증거 용량: 기존 지면 전후 JPEG 네 쌍은 SHA256과 바이트가 동일하여 물리 파일만 공유한다. `capture-index.json`은 before/core의 독립 실행 원본 경로와 해시를 각각 유지한다. 이는 새 촬영을 대체한 것이 아니며 무손실 PNG 비교 결과는 그대로다.

[최종 계약 정합 검토](final-contract-compliance.md)는 열 종류 계약과 현재 세 종류의 실제 세계 연결을 구별하고 새로운 중대 결함을 찾지 않았다. 나머지 일곱 종류의 응용 연결, 자연 플레이, 최종 통합 관문은 이 정적 검토의 통과 주장 밖이다. 검토가 지적한 과거 core-only 문단은 현재 상태로 바로잡았다.

## 통합 실제 장면 (4151d15f)

DGX `astra-ARCH1-integrated-smoke-4151d15`는 4/4 화면, A/A 4/4 RGBA 차이0, 오류0으로 종료했다. 준비된 현재 형식의 저장 두 개(여름 점유 영주관/겨울 빈 영주관), 같은 카메라(34,35), 1280×800 DPR1, 줌1.0·0.6이다. 여름 각16개·겨울 각20개 예상 URL의 요청200·디코드·실제 draw 계보를 모두 확인했다. [원본 식별과 행별 관측](integrated-smoke.json), [JPEG 목록](capture-index.json)을 남긴다. 이 혼합 장면은 A/B 통합 후 공존 확인이며 기존36 이전의 전후28쌍 무손실 비교를 대신하지 않는다.

주 검수자가 원본 PNG 네 장을 각각 열었다. 집 발판과 눈/판자 층의 위치, 기존 직업 표지와 영주관, 길·묵은 밭은 한 장면에 그려지고, 새 층의 눈에 띄는 분리·중복 몸체·잘림은 관찰하지 못했다. 기존 경고 표지와 금색 고리는 일부 정면을 가리고 줌0.6에서는 직업 표지 세부를 식별하기 어렵다. 영주관의 겨울 지붕은 기존 눈 없는 그림이며 이번 집 계약의 회귀로 간주하지 않는다. 준비 장면은 자연 플레이·전체 겹침 조합·움직이는 워커의 깊이 순서를 증명하지 않는다.

보관 크기를 지키기 위해 원본별 SHA를 검증한 JPEG만 중복 제거했고, 추가1400년 요약 JPEG 두 장은 원래 output 경로에 보존했다. 전체1400년 PNG 런타임 관측과 독립 검토 기록은 유지한다. 저장소에는 논리20캡처/물리16JPEG가 있으며 필수 여름·겨울×줌1.0·0.6 행렬은 남아 있다.

[독립 통합 눈 검토](integrated-visual-review.md)도 원본 PNG 네 장을 개별로 열어 조건부 통과했다. 직업 표지 글리프의 세부 가시성은 별도 증명하지 않았으며, 겨울 영주관의 눈 없는 지붕은 관찰 사항으로 남긴다.

## QA003 통합과 감사 재실행

본선 `bba59ece`의 성문·바위 수정을 `1da2327e`에 통합했다. 장부는 새 본선에서 B 소유 설치 표시32칸만 다르고, provenance는 새 본선 바이트 뒤 B32행만 붙는 것을 확인했다. 기존425와 UI260 원본 집합에 QA003의 두 그림은 포함되지 않아 집계는 그대로다.

`public/assets`도 기하 입력에 포함되므로 앞선 `astra-ARCH1-geometry-e370716`은 전체2,202조건 중1,332조건을 측정한 뒤 **새 입력으로 대체되어 중단**했다. 최종 결과나 통과 증거가 아니다. `astra-ARCH1-geometry-qa003-1da2327`의 종료 결과는 아래에 별도로 기록했다. 앞선28쌍·4151d15f smoke는 각각의 역사적 입력에 대한 증거로 유지한다.

다음 계절 작업의 기준 촬영 `astra-SEASON-before-77ce8af`은 촬영 전 입력 검증에서 실패했다(0장). 도구가 여름·겨울/줌1·0.6만 허용했고 비여름을 겨울로 확인하는 문제가 있었으며, 새 준비 파일의 기본 나무 URL3개에 슬래시가 중복됐다. 봄·가을/줌1.4 검증과 실제 계절 인덱스를 보완하고 URL 생성부를 수정했다. URL 안전 검사는 유지했다. 집중 회귀18/18·타입검사·실제10뷰 사전검사를 통과했고 기존 상태/저장8개 SHA는 바뀌지 않았다. 이는 촬영 도구 검증이며, 새 계절 그림 설치나 브라우저 통과를 뜻하지 않는다.

## QA003 통합 이후 확인된 관문과 남은 작업

DGX 전체 기하 `astra-ARCH1-geometry-qa003-1da2327`은 clean 입력 `1da2327e627c28172f3f3c7011102cb35b326013`,1969개 입력의 SHA256 `97ce43004db357de1ab3756d85c558754164930179fe0f6fb994722682ebb4a1`에서122행·2202조건 모두 측정했다. 실패0·미개방0·미등록틀0·page error0이다. 선언된 도달 불가4개(`hud.goal-help`, `hud.unlock-banner`, `hud.era-ceremony`, `hud.build-details`)와 경고693개를 숨기거나 통과 화면 수에 더하지 않는다. [요약](geometry-final.json), [전체 원본](../uiaudit1/geometry/astra-ARCH1-geometry-qa003-1da2327/geometry.json)을 보존한다. 전체 감사는 AGENTS19의 별도 `uiaudit1/geometry/` 보관 범위다.

QA003 통합 smoke 첫 실행 `astra-ARCH1-qa003-smoke-ab67dcb`는 `--states` 하위 `/states` 누락으로 ENOENT·0장·종료1이었다. 이는 제품 실패나 화면 통과가 아니다. 올바른 경로로 실제 재실행한 `astra-ARCH1-qa003-smoke-v2-ab67dcb`는 입력 `ab67dcb8`에서4/4·A/A4/4 RGBA 차이0·오류0이며 여름 각16/겨울 각20 URL의 요청200·디코드·draw 계보를 확인했다. [행별 영수증](qa003-smoke.json), [검토 기록](qa003-visual.md)을 남긴다. 부모 주 검수자가 신규 PNG4장을 각각 열었고 동일 identity/RGBA/JPEG를 기존4151d15f와 대조했다. 신규 실행의 식별/원본 경로/해시는 독립 보존하고 동일 물리 JPEG4개만 재사용한다. 현재 논리24캡처/물리16JPEG이며 역사적28쌍·데이터8장면 증명은 그대로다.

별도 후속 Wave37 기준 실행은0뷰·ENOENT(`wave37-fixtures/condition_newcomer_cart_a-summer.json`)로 종료했다. 이 준비 경로 실패를 ARCH1 설치 실패/성공이나 Wave37 추가 설치 증거로 집계하지 않는다. 계절·밭·Wave37 후속 실행은 각 작업의 별도 증거다. 원425의134표시+20byte설치 미표시+255활성 미증명+16퇴역 집계와 UI260 경계도 바뀌지 않는다.

**아직 미완료:** 최종 범위의 `check:merge`, 마지막 commit SHA의 DGX 깨끗한 clone 전체 회귀·빌드, 보호된 본선 push와 원격 도달 확인. 측정한 기하 입력과 이후 최종 HEAD는 구분하며 입력 일치 검사는 해당 관문에서 다시 한다. 마지막 전체 시험 뒤 새 commit이 생기면 그 마지막 HEAD까지 clone 관문을 다시 수행한다. 이 문서는 ARCH1 본선 완료 선언이 아니다.

최신 작업 트리의1969개 기하 입력은 위 보고서 inputHash와 일치했다. 기존 관문의 `compareBaseline`에서 이미 실패가 사라진 예외 `modal.history.factions|overflow|chronicle-world-strip` 한 건이 stale로 확인되어, 부모가 기존 축소 규칙에 따라 그 항목만 삭제했다(최근 소유 `e67553b9`, kwanhyeonpark-ctrl). 새 면제는 추가하지 않았다. 원 측정 보고서의 역사적 exceptions1은 수정하지 않았으며, 삭제 뒤 현재 정적 비교는 exceptions/new/fixed/stale 모두0이다. 이는 작업 트리 입력/기준선 대조이며 커밋 후 정식 check:merge를 대신하지 않는다. [요약의 현재 대조 영수증](geometry-final.json)을 참고한다.

[독립 QA003 시각 검토](qa003-visual.md)는 새 원본4장을 각각 열어 제한된 준비 장면에서 PASS with notes를 기록했다. 간판 glyph, 가려진 면, 자연 플레이, 전체 변형/가림 조합 및 성능은 승인 범위 밖이다.

## 마지막 클론에서 찾은 출처 집계 누락

`astra-ARCH1-final-clone-d6776f2`는 exact clean `d6776f2`에서 clone/LFS·npm ci·타입검사를 통과했으나 전체 시험4820개 중4819통과/1실패로 종료1이었다(957823.96498ms). 빌드는 실행하지 않았다. 실패는 기존 `verifyProvenance.test.ts:23`의 CSV2381 대 runtime2313 비교였다. 실제68 orphan은 전부 새 catalog의72 URL 중 legacy와 중복된4개를 제외한 집합이며, 중복CSV·실제없는파일·해시불일치는0이었다.

그림 출처 검사기의 기존 manifest URL 탐색 목록에 실제 `src/render/art/catalog.json`을 추가했다. 기존 중복 제거와 keyart derivative 처리를 유지하고 기존 시험·CSV·PNG는 바꾸지 않았다. Mac의 동일 실패 재현 뒤 기존 관련11시험·타입검사·명시적 설정의ESLint·diff check가 통과했다. 실제 provenance CLI는 runtime2381/CSV2381,missing/orphan/hash/missingFiles/retiredStillRuntime 모두0을 보고했다. [실패와 수정 영수증](provenance-enumeration-fix.json)을 보존한다.

경계 파일 수정: `scripts/provenanceLedgerAssets.ts`의 최근 소유는 `39b1d55c` kwanhyeonpark-ctrl이며, 새 계약 목록을 기존 설치 감사에서 빠뜨리지 않기 위한1행 목록 추가다. 렌더·엔진·UI·그림 바이트는 변경하지 않았다. 독립 검토는72/4/68 집합과 기존 경로 정규화/중복/파생그림 처리 보존에 blocker0을 기록했다.

`astra-ARCH1-merge-check-d6776f2`는 이미 통과한 역사적 관문이다. 이 수정 뒤 최종 commit의 check:merge·깨끗한 clone 전체시험/빌드·보호된 본선push는 다시 필요하며, 첫 clone 실패를 통과로 고쳐 기록하지 않는다.

수정 커밋 `92a566d7`의 별도 DGX 실제 재촬영 `astra-ARCH1-provenance-smoke-92a566d`는4/4·A/A4/4·오류0이며 QA003 화면과 전체 identity 및 RGBA 차이0이다. 부모가 새 원본PNG4장을 각각 열어 새 회귀 없음을 확인했다. 기존 경고 배지·금색 고리 가림, 작은 줌 글자와 영주관 지붕 눈 부재는 남는다. [수정 뒤 실제 화면 영수증](provenance-smoke.json)에 조건과 원본 해시를 기록했다. 동일 바이트 JPEG만 기존 물리 파일을 공유하여 논리28캡처/물리16JPEG이며, 새 촬영을 과거 촬영으로 대체하지 않았다. 마지막 증거 커밋의 전체 clone 관문과 본선 push는 여전히 대기다.

## 최종 90d9 본선 게시 — ARCH1·RENDER-B 완료

정확한 clean HEAD `90d9b5865bee4dc012f49f6eded135ac85975e78`의 `astra-ARCH1-final-clone-90d9b58`은 clone·npm ci·typecheck·전체시험 **4820/4820(실패0·skip0)**·build 모두 exit0이다. `astra-ARCH1-final-merge-90d9b58`도 check:merge PASS, 변경37파일 ESLint 신규위반0, 기하 실패/기준선/예외/override0, build PASS다. perf-trend102commits stale 경고는 비차단으로 보존한다.

`astra-ARCH1-trunk-push-90d9b58`은 보호된 pre-push check:merge를 거쳐 exit0으로 `bba59ece → 90d9b586`을 `codex/phase15-organic-ground`에 게시했다. 부모가 해당 remote ref를 명시적으로 fetch/rev-parse하여 exact SHA를 확인했다. [final-publication.json](final-publication.json)에 clone/merge 요약, 게시 확인과 원본 로그 경로·SHA256을 저장했다. 과거 d677 clone4819/4820·build 미실행 기록을 성공으로 고쳐 쓰지 않는다. 수정92a566d7와 그 뒤 smoke4의 증거도 각각 유지한다.

따라서 앞 절의 최종 clone/build/push 대기는 이90d9 관문으로 해소됐으며 ASSET-ARCH-1과 RENDER-B 출범 관문을 완료했다. UI 전체 연결·잔여425 전체·추가 계절/밭 작업은 포함하지 않는다. 별도 [W37 장부 조정](../wave37-reconcile/REPORT.md)은 후속 working-tree16표시 적용이며 그 작업 commit 뒤 실제 after4는 아직 대기다. ARCH1 완료로 W37의 새 runtime 관문을 대체하지 않는다.

# ASSET-ARCH-1 검증 기록

상태: **코어·분리 데이터 런타임 검증 통과, 데이터 설치 반영, 최종 회귀·기하·병합 대기**. 기준 본선 `d4973e85d3d4039cf6f8091c33c1047239e443ee`, 작업 가지 `astra/renderB-asset-arch-1`. 실행기는 DGX이며 무거운 실행은 현재 실행기의 동시 2개 대기열을 사용한다. 이 문서는 완료 보고서가 아니다.

## 구현 범위와 판단

열 종류 그림 계약의 구조·의미 검증, 원자 registry, 결정적 선택, 이미지 디코드와 종류별 그리기/인계 어댑터를 구현했다. 이미 설치된 Wave42 36장의 경로·픽셀·기하를 보존하며 선택을 JSON으로 옮겼다. 10종의 일반 어댑터가 있다는 사실과 실제 게임 소비자 연결은 구별한다. 현재 연결은 땅의 변화와 주택이며 UI는 Render A 인계다.

판단: 첫 신규 증명은 승인된 Wave20 시대 집 전체 32장(본체 20, 판자 6, 눈 6)이다. 기존 상태층 4장을 함께 재사용하되 신규 수량에 더하지 않는다. 직업 세계 전체 128장은 후속 설치 의무로 유지한다. 실제 운반 actor와 중립 지원 활동 사실이 없는 52장을 임의 직업·장식으로 대체하지 않는다. [읽기 정보 요청](../../requests/render-art-read-models.md)을 참고한다.

계약 코어를 고정한 뒤 새 묶음은 JSON·PNG·출처·장부만 추가하는 별도 경계로 증명한다. 코어 커밋 `d60ababf` 뒤 분리 데이터 검증 폴더에서 증명한 catalog와 신규 PNG 32장을 주 작업 폴더로 동일 바이트 복사했다. 출처 32행과 해당 inbox 32행의 `installed_by=ASSET-ARCH-1`만 갱신했으며 기존 다른 설치 행은 보존했다. 1,039개 제품 코드 파일의 집합·SHA가 코어 고정본과 같고, 전체 72개 catalog 항목의 파일·해시·치수·RGBA 검사는 통과했다. 분리 데이터의 실제 소비 캡처 8/8, A/A 8/8, 오류 0을 확인했다. 주 작업 폴더의 72개 파일 검사를 다시 통과했고 제품 코드 1,039개 SHA는 코어와 그대로 같다. 본선 설치 완료는 최종 병합 뒤에만 판정한다.

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

원본 425개 source ID를 보존한 [재집계](recount-425.md)와 [행별 CSV](recount-425.csv)를 제공한다. Wave37 세계 소품 32장은 B 소유이며 A의 LM-R1과 협업한다. UI/input 160행도 그림 계약·파일 설치는 B, 화면 소비자는 A로 나눠 기록했다. [1단계 UI 인계](../../requests/ui-contract-handoff.md)는 260개 UI 표면 자료를 다루며 425개 하위 집계와 분모가 다르다.

후속 현재 상태 확인: 최신 가져온 본선 `57228cc1`에는 LM-R1이 병합되어 있다. 이전 DGX 검증 스냅샷의 미병합 여부를 현재 상태로 취급하지 않는다. 이 작업 폴더와 425행 재집계의 기준은 여전히 `d4973e85`이며, 재집계 기준 수량을 최신 본선 수량으로 소급 변경하지 않는다. 영주관·Wave37 등 LM-R1 반영분은 통합 시 최신 본선과 다시 대조하여 중복 설치를 피한다.

## 코드 검토와 남은 관문

독립 코드 검토에서 발견한 접속 포트 누락, 선택 ID 손실, 길 외 계열 배율 강제, 산술 overflow, startup parser와 draw의 fallback 불일치, 부적합 house layer의 부분 그리기 문제를 수정했다. 최신 코드 재검토의 열린 finding은 0이다. 추가 JPEG 파일 관문도 독립 검토 PASS, 집중 시험 8/8 통과다. 이는 런타임 승인과 별개다.

2026-10-05 Mac 커밋 전 정적 감사: 변경 코드 36파일의 ESLint, `tsc --noEmit`, `git diff --check` 종료 0. 현재 코어 변경의 UI 기하 입력 경로 교집합과 고정 파일 변경은 없었다. 정식 `check:merge`는 git 객체를 읽으므로 이 미커밋 감사로 대체하지 않는다. 새 PNG를 추가하는 후속 데이터 경계에서는 해당 검사를 다시 판정한다.

남은 필수 관문: 최종 회귀·병합 전 검사·깨끗한 클론·본선 병합과 별도 신규 데이터 설치 커밋. 코어 28쌍 RGBA·Wave42 36개 관측 및 분리 데이터 8개 화면·36개 관측은 완료했다. 주 작업 폴더는 현재 코어만 포함하므로 신규 설치 수나 installed_by를 아직 올리지 않는다.

경계 파일 수정: 기존 world house 본체·overlay 호출부만 최소 변경해 같은 그리기 회차의 본체/상태층 선택 영수증을 전달한다. 엔진·저장 형식·UI/TSX·입력 런타임은 변경하지 않았다.

| 파일 | 기준 본선의 최근 작성자·커밋 | 최소 수정 이유 |
|---|---|---|
| `drawBuildings.ts` | kwanhyeonpark-ctrl, `fc89ac9b` | 실제 본체 draw가 반환한 상태층 영수증을 해당 pass에 전달 |
| `buildingOverlays.ts` | kwanhyeonpark-ctrl, `c8fa7ef3` | 영수증의 층만 그려 본체/층 재선택 불일치를 방지 |
| `historicalHouseAssets.ts` | kwanhyeonpark-ctrl, `30dfbd19` | 새 계약 준비 완료 시 본체를 선택하고 기존 fallback·boolean API를 보존 |
| `houseConditionOverlay.ts` | kwanhyeonpark-ctrl, `30dfbd19` | 계약 층을 그린 경우 기존 판자 층을 중복 표시하지 않음 |

## 통합 후 확인

코어 `d60ababf`와 데이터 `541a0811` 사이 제품 코드 변경은 0이다. 본선 `57228cc1` 통합 뒤에는 렌더 A의 기존 변경 53파일 때문에 d497 기준 전체 동결 SHA와 같지 않으며, 이를 데이터 경계 위반으로 해석하지 않는다. B 제품 파일은 데이터 커밋과 동일하다. 카탈로그가 두 묶음이 되며 드러난 테스트 두 파일의 JSON 추론 가정을 검증된 계약 종류로 좁혔고, 21개 집중 시험과 타입 검사를 통과했다. 새 그림은 UI 기하 입력에 포함되므로 현재 통합 입력으로 전체 기하 감사를 다시 제출했다.

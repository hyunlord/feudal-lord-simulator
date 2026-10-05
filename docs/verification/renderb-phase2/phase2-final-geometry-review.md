# Phase2 최종 geometry 독립 종료 검토

판정: **PASS — 한정된 숫자 gate와 provenance 검증**. 실제 측정 run은 `astra-phase2-final-geometry-fd68f12`, 측정 HEAD는 `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5`로 유지한다. 현재 main `db17321a907b5c0c72560fe2fab29966f38963d1`에서 같은 실행을 했다고 재표기하지 않는다. 이전1da 또는 다른 run의 수치를 섞지 않았다.

## 독립 확인 결과

- watch의 remoteExit0/fetchExit0와 가져온 raw `exit-code`0을 확인했다. 실제 exported start attestation은 tracked clean이며, final pass=true/auditExit0/errors=[]/actualSourceUnchanged=true다. 원격 tracked 변경은 `docs/verification/uiaudit1/geometry.json` 하나다.
- fetched `phase2-geometry/source-freeze.json`은 원래 prepared freeze와 객체 전체가 동일하다. 실제 export freeze의 차이는 **createdAt만**이다: 준비23:07:45.498Z, export23:10:40.251Z. 실제 export freeze와 fetched export freeze는 전체가 동일하다. 시각 차이를 파일/input drift로 혼동하지 않았다.
- 현재 main의 보호 파일**4277개 바이트 SHA를 직접 다시 계산**해 모두 frozen SHA와 비교했다. 보호 경로 집합을 다시 열거해 추가/누락0도 확인했다. native API `geometryInputs('HEAD')` 결과**1977개 전체 목록**과 inputHash를 다시 계산했다. 모두 측정 freeze와 동일하며 hash는 `0cb88b8e55d305f886f513ca36952ea784ab0d93bf92860bbe3641a490b9b58a`다.
- private scene roots8의 start/end 목록이 동일하다. 가져온 private 원본**126개 바이트 SHA**와 경로 집합을 독립 재검사했고 drift/추가/누락0이다. source 종료 동일성은 frozen wrapper의 실제 final attestation이며, 원격 전체 checkout을 새로 다운로드했다고 주장하지 않는다.
- 최상위 `docs/verification/uiaudit1/geometry.json`은 raw final.summary와 전체 객체가 같다. 해당 run의 상세 report와 run/commit/inputHash/dirty=false가 일치한다. owner final-summary의 proof SHA13개도 실제 파일로 다시 검증했다.

## 수치와 미도달 구분

상세 report의 모든 row/condition을 직접 순회했다. **122행 중 실제 reachable 측정 조건2202개**, 전부 status=measured, total0, failures/keys=[], 모든 byCheck0이다. unopened0, unregisteredFramed0, pageErrors0, retry0. baseline entries/count/excepted/exceptions/added/fixed 모두0이고 실제 baseline/exception 파일의 목록도 비어 있다. 실행 시간4827초다.

별도의 선언된 unreachable4행은60조건이며 status=unreachable로 남아 있다. 저장된 condition record 총수는2262지만 이를2262회 측정이라고 하지 않는다.

| 선언된 미도달 행 | 조건 수 | 원본 설명 요약 |
|---|---:|---|
|hud.goal-help|10|advisor line이 있는 후속 tutorial step에 도달하는 scripted 경로 없음|
|hud.unlock-banner|10|tool unlock tutorial step 완료 경로 없음|
|hud.era-ceremony|20|era 진입 순간 tick의 cached state 없음|
|hud.build-details|20|controlled build drawer가 details toggle을 숨기며 열리는 play 경로 없음|

원본의 **empty-space warnings693개**를 개별 measured condition의 empty.warn에서 재집계했다. 실패0과 별개로 그대로 남긴다. screenshots0/bytes0이며 이번 numeric gate를 새 human visual 검토 또는 모든 자연 플레이 수락으로 포장하지 않는다. viewport5(1280×800,1920×1080,tablet1180×820,1024×768,1280×720),copy normal/long,number normal/extreme가 원본 axes다. 각 행의 실제 condition 집합을 사용했으며 모든 축의 전조합을 모든 행에 강제했다고 주장하지 않는다.

## 원본 경로와 범위

- owner watch: `.omo/evidence/phase2-geometry-watch.json`
- prepared/export freeze: `.omo/evidence/phase2-geometry-source-freeze.json`, `.omo/evidence/phase2-geometry-export-freeze.json`
- owner final receipt: `.omo/evidence/phase2-geometry-final-summary.json`
- raw start/end/fixtures: `.remote-runs/astra-phase2-final-geometry-fd68f12/phase2-geometry/`
- fetched detailed report: `docs/verification/uiaudit1/geometry/astra-phase2-final-geometry-fd68f12/geometry.json`
- official summary: `docs/verification/uiaudit1/geometry.json`
- 독립 SHA/count/result: 이 문서와 같은 이름의 `.json`.

공식 geometry 파일·owner 영수증은 수정하지 않았다. 새 fetch/browser/DGX/capture/제품 변경도 없다. 이 독립 감사가 쓴 파일은 `.omo/drafts/phase2-final-geometry-review.md/json` 두 개뿐이다. 후속 evidence commit, 최종 HEAD 연결 검사, check:merge, clean clone, publication은 부모 소유의 별도 gate다. 현재 결과는 fd68 측정과 db173의 파일/input 동일성까지를 증명한다.

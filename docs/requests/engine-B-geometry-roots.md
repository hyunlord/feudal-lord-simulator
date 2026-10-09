# Engine B → 렌더/REMOTE: 통합 기하 증거와 프레임 범위

상태: 기존 B 측정의 네 미등록 root는 본선8096b3585에서 렌더가 등록했다. 통합 B 입력으로 관문 재측정은 남아 있다. B가 프레임 등록·관문·예외·기준선을 수정하지 않았다.

039b387f2에서 실제 check:merge를 실행했다. 린트·타입·빌드 용량·증거 용량은 통과했지만 ui-geometry와 tested는 실패했다. 기하 결과에 위반 측정값은0이지만 입력 해시가 이전5c7df267의 것이고, 당시 상세 보고서에 독립 root로 측정되지 않은 프레임4개가 있다.

- flat lord-neg-treaty
- flat lord-neg-row
- flat lord-ledger-book
- flat lord-ledger-track

기존 행의 requires에서 일부 자식 selector가 나타나지만, 그것만으로 별도 framed root가 측정된 것은 아니다. 렌더 소유자가 실제 측정 범위를 확인해야 하며 B가 등록 또는 예외를 대신 바꾸지 않는다.

본선e5abc0e64와 B의 기하 입력 차이는 engineBDecisionLayers.ko.ts 하나다. 저장된5c7df267 결과 이후에는 본선의 surfaces.ts 설명 변경3개도 해시에 포함된다. 별도 summary 경로를 사용하는 공식 DGX gate 실행 EB-geometry-039b387f2-4e028b4에서 기존17행과 등록기2행을 함께 재측정하고 있다.2행만 남겨 이전 실패 범위를 누락하지 않는다.

실행 exit0만으로 통과하지 않는다. 실제 unregisteredFramed·입력 해시·행 범위와 병합 검사를 확인한 뒤 갱신한다. 최신 변경시험451파일의 정확한 통과 기록 및 별도 source-scan 분류 문제도 독립적으로 남는다.

### 완료된 실제 재측정

EB-geometry-039b387f2-4e028b4는1356.1초·exit0으로 끝났다. clean4e028b474 소스의 입력 해시5ad5b96d4e84ec901baa30a6d032b4797ceab80ae5b8d339918649f30c92f898로19행·380조건 전부 측정, failures0·unopened0·warnings37·unregisteredFramed4다. [상세 결과](../verification/uiaudit1/geometry/EB-geometry-039b387f2-4e028b4/geometry.md)와 현재 summary를 실제 출력으로 갱신했다. 입력 노후화는 해소됐지만 위4개 root는 그대로이며 병합 관문 미해결이다. 기준선·예외·관문 코드는 바꾸지 않았다.

### 2026-10-09 · 렌더 수정 통합, 통합 관문은 별도

본선 `8096b35858d9f52b148eaa0073dd6e7812f78ed3`의 FRM-D1은 위 네 root와 추가 두 root를 등록한다. [렌더 보고서](../verification/lmr3-next/REPORT.md)의 프레임40행·800조건은 실패/미등록0이다. 최종 결합55행·1100조건에는 철 띠20실패가 있었고, 수정 뒤 철 카드3행·60조건을 다시 측정해 실패/미개방/미등록0을 기록했다. 이3행 측정이 현재 공용 summary이며, 전체55행 최종 재측정이나 통합 B 관문 통과로 바꾸어 말하지 않는다.

이전 B19행 상세 기록은 보존한다. 위의 당시 summary 갱신 설명은 과거 실행 기록이며, 현재 summary는 본선의 `render-LEAD-season-geometry-db1b1b1-db1b1b1` 원본을 보존했다. 통합 B의 입력 해시·확대된 root 범위와 실제 check:merge/test:changed는 별도 확인해야 한다. checkpoint 시험 source-scan 분류 요청도 아직 미해결이다.

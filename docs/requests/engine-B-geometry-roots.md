# Engine B → 렌더/REMOTE: 통합 기하 증거와 프레임 범위

상태: 기존 실패 확인, 실제 재측정 진행 중. 프레임 등록·관문·예외·기준선은 수정하지 않았다.

039b387f2에서 실제 check:merge를 실행했다. 린트·타입·빌드 용량·증거 용량은 통과했지만 ui-geometry와 tested는 실패했다. 기하 결과에 위반 측정값은0이지만 입력 해시가 이전5c7df267의 것이고, 당시 상세 보고서에 독립 root로 측정되지 않은 프레임4개가 있다.

- flat lord-neg-treaty
- flat lord-neg-row
- flat lord-ledger-book
- flat lord-ledger-track

기존 행의 requires에서 일부 자식 selector가 나타나지만, 그것만으로 별도 framed root가 측정된 것은 아니다. 렌더 소유자가 실제 측정 범위를 확인해야 하며 B가 등록 또는 예외를 대신 바꾸지 않는다.

본선e5abc0e64와 B의 기하 입력 차이는 engineBDecisionLayers.ko.ts 하나다. 저장된5c7df267 결과 이후에는 본선의 surfaces.ts 설명 변경3개도 해시에 포함된다. 별도 summary 경로를 사용하는 공식 DGX gate 실행 EB-geometry-039b387f2-4e028b4에서 기존17행과 등록기2행을 함께 재측정하고 있다.2행만 남겨 이전 실패 범위를 누락하지 않는다.

실행 exit0만으로 통과하지 않는다. 실제 unregisteredFramed·입력 해시·행 범위와 병합 검사를 확인한 뒤 갱신한다. 최신 변경시험451파일의 정확한 통과 기록 및 별도 source-scan 분류 문제도 독립적으로 남는다.

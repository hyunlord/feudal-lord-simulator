# R08 진단 작업 기록

사용자 범위는 원인 검증·재현·보고이며 엔진/렌더 수정을 금한다. 증거는 납품에 보존한다. 디버깅 스킬의 일반 삭제 규칙보다 사용자 증거보존이 우선한다.

## 범위와 가설

식량: 가구 용량/최소거리, 남은 이동범위, 수요 순위, 선택 이전 귀환을 구별한다. records/food-selection-design/REPORT.md의 정확관측값·소스 핀을 사용한다.
창고: 다른 UI 표면의 안내공백, 지속 물류정체, 기존 운반 종료 후 회복을 구별한다. records/storage-surface-boundary/REPORT.md 참조.

## 작성 허용 산출물

- output/steward-food-choice-r08/: 원함수 기록입력 재실행 helper와 원본 stage사본. 새 engine tick0. 현재 준비 중; 원격 실행 전 부모 검토 필수.
- records/food-choice-prep/: helper검토 및 정적 구문검사 증거. 실행결과와 구분.
- records/storage-probe-design/: 실제관측을 위한 설계만. 실행아님.
- records/assets-current/ 및 install-plan-updated/: 읽기전용 원본 대조; 엔진/그림 변경없음.

현재 우리 DGX scope 없음 확인. 다른 render scope2개에는 손대지 않는다. 원격 공식 runner nice19 직렬, helper상한60초. 새 debugger attach나 포트 개방 없음. 준비산출물은 삭제하지 않고 출처와 함께 보존한다.

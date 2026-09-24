# S0 상태 기록 계측 도구

소유 파일(모두 신규):
- scripts/growthStateRecord.ts: CLI, Git source commit/dirty 출처
- scripts/growthStateRecordWorker.ts: 기존 createGrowthOpening + createAutoplayTraceDriver + advanceTick 실행
- scripts/growthStateRecordSupervisor.ts: 독립 부모 watchdog, 입력 보존, 시간 종료
- scripts/growthStateRecordInspector.ts: 10초 넘는 결정 실제 스택 sampling 후 즉시 resume
- scripts/growthStateRecordMetrics.ts: 필지 대비 건물 수·성벽 안 농지·빈 타일
- tests/growthStateRecord.test.ts: 계측·watchdog·기존 driver와 전체 상태 동등성

## 실행

```sh
node --import tsx scripts/growthStateRecord.ts 24 1200000 output/trunk-baseline/seed1 1 1500 > /tmp/seed1-state-run.log
```
seed 1~5는 네 번째 인수를 각각1~5로; 출력은 각각 빈 폴더. 마지막1500은 최대25분(초), 생략시1500. 48필지 측정은 첫 인수48로(기본 autoplay 정책8은 수정하지 않음). 측정동시실행은 독립 프로세스로 가능. 본 실행은 루트가 최종코드 커밋 확정 후 시작.

산출물:
- `final-state.json`: 완성 틱 또는 마지막 결정 직전의 실제 원시 상태. timeout시 `stateSemantics`가 정확한 의미를 표기.
- `summary.json`: source.commit/dirty, 제한, 종료 원인, ticks, 필지·L4·시설별수·서비스·진단값, 밀도, tick mean/p50/p95, 안정관측, slowDecisions.
- `slow-decision-<tick>-input.json.gz`: 10초를 넘긴 결정의 수정 없는 입력(gzip 해제 후 재현).
- `worker-stderr.txt`: 워커 오류/inspect 주소 진단.

판정은 없음: `classification=state-record-only-no-acceptance-judgment`. 24,000틱 안정은 기록만 하며 달성해도 실행을 일찍 종료하지 않음. 120만틱/25분 먼저 오는 예산으로 끝남. 실제 엔진 중단/abandoned/비정상 재고는 상태 기록 뒤 일찍 끝내고 원인 명시.

## watchdog와 입력 보존

동기 autoplay 결정 직전에 자식이 부모로 stateJSON을 전송해 flush 완료 확인 후 `driver.apply` 진입. 자식 event loop가 무기한 막혀도 부모는10초 timer에서 입력을 보존하고 debugger stack 샘플을 남기며25분 timer로 SIGKILL. timeout의 최종 화면은 `before-pending-decision` 또는 `last-decision-input`임을 표기해야 함(미완료 결정 이후 상태로 표현 금지). 스택은 실제 함수/URL/line/column; inspector 실패시 명시적 정적 진입위치 fallback.

## 지표 정의

- buildings/lots: 완공 건물 수 / housingLotCount(합필은2필지).
- wallInterior.farmAreaRatio: 선포된 둘레 안 타일 중심으로 센 밀밭 점유 타일 / 내부 전체 타일. 미완공 목책도 **계획 둘레**로 명시; 둘레 자체 없으면 null.
- shareOfFarmAreaInside: 전체 농지 점유 중 둘레 안 비율(별도 참고값).
- emptyLandRatio: 내부 grass 중 도로/건물/건물공사장이 없는 타일 / 내부 전체 타일. 건물 전체 footprint 합법성이나1칸 성벽 여유 검사 통과를 뜻하지 않는 순수 면적 지표.
- tickTiming은 계측 및 동시 호스트 부하 포함한 실제 tick 함수 호출비용, FPS나 성능 관문 아님.

## 검증

- `node --import tsx --test tests/growthStateRecord.test.ts`: 4/4.
- 실제 자연 opening240틱을 계측 워커/원래 driver로 각각 진행한 **전체 GameState(pathCache 포함) 일치**.
- 동기무한루프 워커로 watchdog 강제종료, 실제 내부 stack URL, tick120 입력 보존 테스트.
- 24필지240틱 CLI smoke: /tmp/s0-state-smoke-240/summary.json.
- 48필지120틱 CLI smoke: /tmp/s0-state-smoke-48/summary.json.
- typecheck 통과.

게임 src나 기존 efficientGrowthRun, phase19NaturalGrowth, economyHarnessAutoplay는 수정하지 않음. 최종 장시간 seed 실행은 미실행(루트 담당). commit/push 미실행.

## S0 최종 관측
24필지5개·48필지1개 모두25분 상한으로 종료. 결과는 seeds/state-e97d6a8.json 및 seeds/capacity-48-e97d6a8.json. 시간은 부모 IPC 수신 간격을 포함하며 debugger 접속 지연으로 48필지142200/143280틱의 stack은 다음 advanceTick을 가리킨다. 해당2건을 결정 내부 위치로 사용하지 않는다. 나머지69건은 decideNextAction stack을 포함한다. 기록 후 src/tests/의존성 git object가 최종 제품과 같음을 확인했다.

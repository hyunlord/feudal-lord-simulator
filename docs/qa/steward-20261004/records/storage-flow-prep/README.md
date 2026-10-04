# Storage flow R08 — READY 준비본, 실행 없음

Helper: `output/steward-storage-flow-r08/`. 기존 R07 UI와 엔진/렌더 파일은 변경하지 않았다. 원본입력 SHA b663dde465f0b8b4fceae704bd583fca4e79ea6fd0852a1ee83d78f88990dbbb, seed1 tick200000, current HEAD5fb1aeb. 원본 JSON read 및 Mac node --check/bash -n만 수행했다. runtime import/type resolution와 실제 산출은 DGX 실행 전 미검증이다.

부모 단일 직렬 실행:

```sh
scripts/remote/run.sh steward-storage-flow-r08 --detach --keep -- nice -n 19 bash output/steward-storage-flow-r08/run.sh
```

공식 Linux/runfolder/port/HEAD/nice19 guard; timeout180초/내부170초, tick3840한번. 160틱 재실행은 없다. 결과폴더가 있으면 재사용/덮어쓰기 거부. source·helper·input 전후 SHA 검사. source guard는 현 엔진1095파일 전체이다. probe/timeout PID 기록과 종료 조회, 비정상종료는 nonzero. 브라우저/서버를 열지 않아 새 포트가 없다. 부모 공식runner가 최종scope/PID 종료를 별도로 확인한다. SIGKILL/호스트장애는 shell trap 보장 밖이다.

## 관측·쓰기 계약

주 상태는 정상 decodeSave 뒤 public advanceTick만3840회. 정책·건물·자원·agent관측 플래그를 바꾸지 않는다. 루프마다 tick/wallTick +1 검증. 진단은 경계 상태의 별도 route port/pathCache복사만 쓰며 주 상태의 전체SHA 전후동일을 검사한다. 진단 cache를 주 상태에 돌려넣지 않는다.

기준 projection에는 제재소/벌목소/창고 전체 재고·예약·stockReserved·작업자·운영상태·progress, 모든 carter의 식별/화물/예약/phase/position, 전체 공사장을 기록한다. 매틱 trace는 건물변경분, 모든 carter 경량위치/claims, target/창고수치, 공사변경분, 금고목재를 기록한다. path는 별도 파일에 hash별1회 보존한다. 도로/건물 topology는 실제 원본 필드 tiles,width,height,palisade,river,roadRevision,wallConstructionReserve 및 building id/kind/tx/ty의 SHA 변화다. 존재하지 않는 grid/roads/walls/bridges/roadVersion 필드를 쓰지 않는다.

공개 candidate/route/production 진단은 시작·끝·35틱마다·target또는topology변경 시 수행한다. 경계 진단이지 tick 내부시점에 호출한 엔진 선택과 동일하다고 주장하지 않는다. target↔원료보유시설/모든창고 route가47변을 넘으면 상한근거 초과 표시로 결론을 inconclusive 처리한다. 3840은 원료/공간발생을 보장하지 않는다.

실제 파일을 다시 읽어 baseline포함3841행의 step/fromTick/toTick 연속성과 최종203840을 검증한다. memory counter만 통과시키지 않는다. 정상 codec snapshot은 최초target변경 직전/직후 최대2개와 endpoint1개: 생성최대3개, 원본입력복사 포함4개. 매틱 전체state 저장하지 않는다. 각 codec decode 결과SHA가 현재stateSHA와 같아야 한다.

## 최소화와 판정의 한계

설계의 완전한 pickup/delivery/production 귀속은 엔진 callback 추가 또는 전체 하위 파이프라인 재연 없이 일반 advanceTick 경계만으로 보장할 수 없다. 따라서 새수레·phase/cargo/cancellation변화·제거 및 건물순변화를 원시자료로 제공하고 항상 source-correlated/ambiguous로 표시한다. 수레 제거 자체를 배송 성공이라고 표시하지 않는다. ambiguousDeltas는 건물변화가 있는 틱수이며 오류수/실제배송수/유실량이 아니다. targetProgressChanges는 progress변화 횟수이지 생산품 개수가 아니다.

모든 틱에서 target logs1/timber19/progress0/reserved0/수레없음과5창고무여유가 유지되고, 경계 진단이 도로정상/no_input/null fetch/null deliver/homeSpace0일 때만 `persistent_capacity_block_in_window`. progress가 변하면 `production_resumed_delivery_attribution_unverified`, 그밖은 alternate/inconclusive. 영구교착/개입효과/첫플레이UI해결로 일반화하지 않는다.

전체 event/history를 매틱 복사하지 않고 events SHA변화와 ledger tail변화를 기록한다. 이것은 사건별 완전원장 감사가 아니다. 새 공사·도로·대상변화는 trace/snapshot으로 재검토한다. 원인 불명 델타가 있으면 자동으로 특정배송에 귀속하지 않는다. 이 최소화는 H1 자연회복/H2 관측창내정체/H3 경로·예약·busy조건/H4 자율변화 구별자료를 남기면서 관측비용과 침습성을 줄인다.

예외/시간초과/신호/대상삭제/입력변조/진단주상태변경/trace행불일치는 FAIL_CLOSED nonzero. 회복없음 자체는 제품실패로 세지 않고 경제적 관측분류로 남긴다.

## 예상 산출물

`output/steward-storage-flow-r08/result/`: baseline.json, timeline.jsonl, diagnostics.jsonl, walker-paths.jsonl, 최대3 fls.json, summary.json/probe.pid.

`run-evidence/`: source-before/after, artifact-before/after, probe.log, probe-exit-code, exit-code, timeout.pid, process-after, cleanup.txt. source/inputs/코드는 SHA256SUMS에만 포함하고 생성결과는 pin 목록에 넣지 않는다.

원본 ledger.entries 배열과 실제 마지막 entry 필드를 확인했고 FIELD_EVIDENCE에 보존했다. ledger.entries 부재/비배열은 정상 빈기록으로 흡수하지 않고 nonzero 실패한다. diagnosis.mjs 수정 뒤 node --check를 다시 실행해 exit0 확인했다.

원본 target.stuckSinceTick.timber=164900은 projection에 보존한다. 초기 tick200000과의 차이35100은 저장된 표식 나이이며 이번3840틱 관측 이전의 연속 실측으로 주장하지 않는다.

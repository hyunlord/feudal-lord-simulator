# R08 창고 포화 후속 흐름 독립 감사

**PASS_BOUNDED_TRANSIENT_PRODUCTION_RECOVERY**. 200000–203840의 한 공개 advanceTick 실행에서 대상 제재소 생산이 두 차례 잠시 재개된 근거가 있다. 영구 교착 또는 지속 회복을 입증하지 않으며 첫플레이2의 UI 해결 판정도 아니다.

## 계보·완결성

실행24파일, helper5파일, source1095파일의 현재 SHA와 실행 전후 OK목록 전체를 검산했다. 공식 종료0/13.7초, helper11.128초다. trace3841행은 baseline200000과 연속3840번200001–203840을 정확히 매핑한다. step/fromTick/toTick 및 wallTick의 단위 증가를 검산했다. source helper는 추가 명령 없이 advanceTick을 루프당1회 호출하며 실제 동작중 자율 변화를 유지한다. 별도 결정론 재실행은 아니다.

세 저장의 실제bytes/state SHA와 tick을 summary에 대조하고, 저장 대상 건물 필드가 해당 trace행과 같은지도 확인했다. 전후200393/200394 및 endpoint203840 모두 일치했다. codec 왕복은 보존 실행의 save 함수에서 검사되었고, 본 감사는 새 codec/엔진 실행 없이 rawstate SHA·JSON을 대조했다. 부모 PARENT_CHECK의 scope는 설명, scopeId는 실제 식별자이며 동결 전 중복키 전사 교정이 명시돼 있다. 원격 scope inactive/dead는 부모 확인 기록이고 본 감사가 새로 조회한 것은 아니다.

## 실제 변화 경계

대상 construction-site-000050은 시작에 통나무1/목재19,예약없음,progress0이었다. 최초 **대상 projection 변화**는200394이며 생산 시작이 아니다.

|tick|직접 기록된 상태 변화|해석 경계|
|---|---|---|
|200394|목재19→18,reserved timber1, 대상deliver carter200394가 목재1을 싣고 첫 창고로 출발|동일틱 첫창고 used199→198/incoming1→2, 다른 제재소000003 fetch cart가 통나무1을 싣고 returning으로 바뀜. 공간 재사용 경로와 정합하지만 직접callback 귀속 아님|
|200609|대상deliver cart outbound→returning,cargo null,집reserved timber1 해제|배송·예약해제 소스와 정합. null 자체를 배달 성공 event로 바꾸지 않음|
|200824|대상fetch cart 출발,reserved logs1|실제 출발·예약 관측|
|200832|fetch cart returning/logs1|실제 운반 상태 전이|
|200840|대상logs1→2,reserved해제,progress0→1|첫 생산 진행 재개|
|200874|progress34→0,logs2→0,timber18→19; 새fetch 출발|35틱 생산 한 주기와 정합|
|200890|logs0→1|그 뒤 다시 입력부족 정체|
|201240/201455|둘째deliver 출발/returning, 목재반출·예약해제|같은 순서의 상태 전이|
|201670/201678/201686|fetch 출발/returning/logs2와progress1|둘째 생산 진행 재개|
|201720|progress34→0,logs2→0,timber18→19|둘째35틱 주기|
|201736–203840|logs1,timber19,progress0; 종점reserved없음|지속 회복 아님|

요약의 targetProgressChanges70은 **진행값 변화70회**다. 200840–200874와201686–201720에 각각0→1…34→0의35회 변화가 있다. 목재70개 생산이 아니다. 현행 production.ts는 입력2를 소비하고 출력1을 추가한 뒤progress0으로 초기화하므로 두 경계는 생산 주기 완료2회와 정합한다. 직접 produced 반환이나 배달 callback을 수집하지 않았으므로 출력2개를 전세계 순증·완전 보존 증명으로 확대하지 않는다.

전체 dispatch415/phase-or-cargo-or-cancellation changes416/removed413/changed-building tick3007도 원시 delta에서 다시 합산했다. 이들은 모든 관측 carter/필터링 건물의 개수다.416을 실제 배달416건으로 해석하면 안 된다.

## 진단·토폴로지·모호성

진단187회 모두 mainStateShaBefore==After이며 unchanged=true다. working68/no_input119다. 생산 완료 tick의 end-state는 이미 입력을 소비했으므로 working 진단68과 progress변화70의 차이는 모순이 아니다. 진단은 state/pathCache 사본으로 원 exported 경로·후보·생산 판정을 조회하고 before/after hash로 원 state불변을 확인한다. 이 검사는 직렬화 상태 불변에 한정되며 모든 비직렬화 전역 캐시 무영향까지 보장하지 않는다. 진단이 각 틱 내부 호출을 관측한 것이 아니므로 fetch/deliver null을 실제 틱에서 후보가 없었다고 일반화하지 않는다.

수정된 topologySha는 width,height,roadRevision,tiles,buildings의id/kind/tx/ty,palisade,river,wallConstructionReserve를 실제 state필드로 읽는다. 세 보존 저장에서 각 필드의 실제 존재·타입을 확인했고 trace의 topologyChanged는0이다. 가짜 필드명이undefined라 늘 같은 hash가 된 경우가 아니다. 단, 전체 토폴로지 trace원문은 없으므로 모든 틱의 토폴로지를 독립 재구성한 감사가 아니라 helper의 명시한 부분 projection과 세 저장의 검증이다. 다른 접근성 영향 조건 전체까지 고정됐다는 뜻은 아니다.

모든 tick끝 창고5개의 사용량+들어올몫이 용량을 채워 space0이다. 이 사실은 한 틱 안에서 창고 물자가 인출되어 자리가 생긴 뒤 다시 예약되는 일을 배제하지 않는다. 200394의 별도 fetch 전이와 새deliver예약이 그 경로와 정합하지만 callback·각 내부 단계 state가 없어 단일 원인으로 확정하지 않는다. routes의 진단 길이 상한47 초과는 없지만 이것만으로 모든 실운반 경로 성공·모든 문/여울 조건을 검증한 것은 아니다.

## 첫플레이2 판정

원래 막힘은 ‘목재 정체를 보다가 뒤늦게 창고 포화를 찾음’이고 통과 조건은 제재소에서 원인·관련창고·조건 변경을 발견하고 효과를 확인하는 것이다. 이번은 저장에서3840틱을 실행한 상태 관측이며 UI도 개입도 없다. R07 상세창의 통나무 운반 대기와 해결 연결 공백을 고치거나 시험하지 않았다. 따라서 **영구 교착 단정은 기각할 근거가 생겼지만 첫플레이2는 여전히 미해결**이다. 이후 멈춤이 영구인지, 수동 개입이 필요한지, 다른 seed에서도 같은지는 범위 밖이다. 새 중간 이상 결함을 이 단일 경로에서 추가 확정하지 않는다.

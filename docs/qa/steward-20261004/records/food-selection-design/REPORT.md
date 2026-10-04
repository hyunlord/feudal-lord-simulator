# R08 대상집 선택 공백 — 설계·정적 판독만

**재구성 stage 저장만으로 잔여 거리 초과 한 사례와 선택 호출 자체가 없는 두 사례를 구분할 수 있다. 선택 집ID의 실제 관측은 여전히 없다.** 추가 1200틱은 불필요하다. 최소 후속은 원본300000→300001에서 보존된 네 결정 입력에 원 exported `bestHouseDemand`를 호출하는 제한된 기록입력 재실행이며, 공식 tick 내부 선택의 실측과 구분해야 한다. 이번에는 helper 작성·엔진/브라우저/원격 실행 없이 문서와 정적 추출만 남겼다.

omo:debugging 및 Node/tsx, setup, investigate, partial-runtime-evidence 참고를 읽었다. 위임·실행 금지라는 이번 계약에 따라 하위 에이전트나 debugger를 시작하지 않았다. 기존 감사와 동결 산출물은 수정하지 않았다.

## 입력·검수 경계

현재 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. R07 `food-boundary-review-r07/REPORT.md` 판정은 PASS_BOUNDED_ONE_TICK_AND_RECONSTRUCTED_STAGE_EVIDENCE다. 공식 한 틱과 재구성 단계는 별개이며 내부 prefix interception이 없다. 실제 helper는 carter 관측 callback을 생략한다고 표시하고, wrapper는 실제 route 인수·결과만 기록한다. RNG 실제 생성0회. 이 전제는 R08에서도 유지한다.

`output/steward-food-boundary-r07/result/stage.json`을 읽었다. `OBSERVABLES.json`은 경로 간선 수·40−기존tilesTravelled·첫 칸 일치 여부만 계산한 정적 추출이다. 수요 순위를 구현하거나 정렬하지 않았다. 집 상태는 해당 walker의 **housesAfter**다. continueRoaming은 서비스 후 상태를 받으며 houses를 더 변경하지 않는다. 따라서 이 배열은 그 재구성 호출의 수요 판단용 값과 대응하지만 공식 tick 내부 입력임을 증명하지 않는다.

## 네 가지 경쟁 가설과 판별값

|가설|정확한 판별값/위치|기존 자료로 가능한 판정|추가 진단의 최소 관측|
|---|---|---|---|
|H1 대상이 빵 용량 또는 경로 최소길이 문턱에서 제외|roamingDemand26의 breadStock≥houseBreadCapacity,28의 path null/edges<minimumEdges; houseFoodConfig5–10|네 target servicePath 호출의 집 bread0/residents6, 용량은 코드상3. 경로20/20/19/19간선으로 최소1보다 큼. 이 네 결정에서 만재·null·최소거리 사유를 지지하지 않는다. 직접 branch 로그 아님.|원 houseBreadCapacity 결과, 원 bestHouseDemand에 전달한 minimumEdges1, 보존된 정확 경로 반환값; 판정은 predicate 평가로 명시|
|H2 길은 있지만 walker 남은 거리보다 김|roamingStep87–92 및 roamingDemand28: remainingRange=40−tilesTravelled|067:299760은24칸 사용, 남은16, 대상19간선. **기록+소스 조건으로 범위 초과가 도출됨**. 다른 세 결정은20≤28,20≤40,19≤40으로 이 이유가 아님.|원함수 입력 remainingRange와 결과; 대상 제외 사유는 직접 branch 관측 또는 명시적 조건평가로만 표시|
|H3 대상은 적격이나 다른 집이 순위에서 앞섬|roamingDemand11–14: meals→path.length→lastServicedTick→ID,35 sort,36 first|036:299880은 적격조건을 통과하는 기록이고 관측 nextTile이 대상 경로 첫 칸과 다름. 다른 수요 선택과 부합하나 선택ID 직접 관측은 아니다. 나머지 두 새 walker는 첫 칸 같아서 대상 선택 여부 불명.|원 exported bestHouseDemand 반환 houseID/path/meals. 이는 기록입력 함수 재실행 결과로만 표시; 원실행 선택ID라고 승격 금지|
|H4 선택 전에 귀환/잔량0으로 호출 안 함|roamingStep87–89 cargo0/range40; stepDistributor185–210 returning/service/continue 순서|067:299640은 이미 returning. granary:299880은 빵1을 다른집에 전달한 뒤 cargo null·returning, 대상 servicePath 없음. 전자는 선택 경계 미도달, 후자는 잔량 소진 규칙에 부합. '대상 경로 실패'가 아님.|walkerBefore/After.phase·cargo 및 actualDeliveryEvents 그대로, 선택 호출 미발생 여부; 필요하면 직접 breakpoint 별도승인|

H1~H4는 서로 배타적인 전 세계 원인 분류가 아니다. 한 틱의 walker별 다른 경계에서 동시에 일어날 수 있다. 수정안은 제시하지 않는다. 근거가 쌓이기 전 범위/우선순위/귀환 규칙을 바꾸는 것은 이번 범위 밖이다.

## 이번 정적 수치

|walker(공통 distributor: 접두 생략)|이전 이동|도출 잔여거리|대상 경로 간선|post-service 빵화물|대상 경로 첫 칸=관측 다음 칸|
|---|---:|---:|---:|---:|---|
|construction-site-000036:299880|12|28|20|1|아니오|
|construction-site-000036:300000|0|40|20|12|예, 선택ID는 불명|
|construction-site-000067:299640|22|18|미호출|cargo null, 기존 returning|해당없음|
|construction-site-000067:299760|24|16|19|1|아니오|
|granary-42-37-0:299880|12|28|미호출|cargo null, 서비스후 returning|해당없음|
|granary-42-37-0:300000|0|40|19|9|예, 선택ID는 불명|

잔여거리는 다음 경로를 정한 뒤 walkerAfter에서 이미1 증가한 tilesTravelled를 빼면 안 된다. before의 이동량을 사용한다. 입력의 cargo null을 walker가 사라졌다고 해석하지 않는다. 대상 canServiceHouse는 모든 행0호출이며 이는 경계 불허 false가 아니다. 현 위치와 집 발판거리≤1인 집만 호출된다(roamingService25–26). 주택 우선순위가 낮아서 실제로 가까이 못 갔는지의 장기 설명은 아직 HOLD다.

## 최소 공식 DGX 진단 제안 — 아직 구현/실행 없음

1. 기존 stage.json/소스/검수 SHA를 고정하고 네 target servicePath가 존재하는 walker만 입력으로 고른다. 새 advanceTick0회, 원저장부터 장기 전진0회. 이미 저장된 재구성 결정4건의 함수 재실행만 한다.
2. 각 walker에서 housesAfter 배열, 모든 servicePath 실제 호출의 start/house/반환path, before.tilesTravelled, 이후 nextTile을 추출한다. 동일 호출 구간 start가 한 종류인지, 집ID별1호출인지, saved house 인수와 housesAfter가 값으로 같은지 검증한다. 충돌·누락이면 중단하며 경로를 임의 생성하지 않는다.
3. 원 exported `bestHouseDemand(current,houses,recordedRoutePort,remainingRange,1)`를 호출한다. 이 route port는 **보존된 호출 인수를 정확히 일치 검증하고 보존 경로를 반환하는 recorded-input adapter**다. 실제 지도 경로를 새로 탐색한 것도, 공식 tick 포트를 가로챈 것도 아니다. 원 함수의 필터·정렬을 다시 작성하지 않는다. 현재 source와 saved source가 같아야 한다.
4. 반환 houseID/path/meals/null과 질의된 전체 집 목록·순서를 저장한다. 질의열이 기존 실제 servicePath 열과 다르면 실패. 같은 입력으로 원 `nextHouseDemandTile`를 호출해 best.path[1]과 일치하는지, 원 stage walkerAfter.nextTile과 일치하는지를 각각 확인한다. 입력불변 검사. 두 함수 호출의 port cursor는 독립이다. RNG 사용 없음.
5. H1/H2 문턱은 원 houseBreadCapacity 결과와 실제 입력값으로 **소스 조건 평가**라고 명시한다. H3는 **원 함수를 기록입력으로 재실행한 선택ID**다. 이를 R07 실행 당시/공식 tick 내부 선택ID의 직접 관측으로 이름 붙이지 않는다. 같은 nextTile을 공유하는 대상들은 표시만 하며 선택의 증거로 삼지 않는다.
6. 4건 처리 후 종료. 부모 공식 runner nice19/상한60초/사전사후 source+input SHA/cleanup만 사용. 실패하더라도 120/1200틱으로 자동 확장하지 않는다. 소유범위상 이번 조사에는 실행 helper/명령이 없다.

이 최소안은 기존 R07 stage의 선택 규칙을 원 함수로 재검산하는 수준이다. 공식 tick의 실제 호출에서 local candidates/remainingRange/선택ID를 직접 보려면 별도 V8 Inspector의 실제 pause/hit를 검증해야 한다. tsx 원본 줄번호 breakpoint는 source map 때문에 pending으로 남을 수 있다(debugging Node 참고). engine 파일의 debugger; 삽입은 금지다. Inspector 연결·런타임 source/scriptId·breakpoint 실제 hit·callframe 변수 범위가 확인되지 않으면 ‘runtime selection observed’로 보고하지 않는다. 이 추가 방식은 이번 최소안에 포함하지 않는다.

## 출처 핀

- roamingDemand.ts11–14,17–42: 필터·우선순위·다음 칸 API.
- roamingStep.ts81–106,185–214,221–253: 화물/범위귀환, 서비스뒤 수요, 원 walker 순서.
- roamingService.ts25–43: 근접·벽경계 검사와 잔량·배달event.
- houseFoodConfig.ts5–10 / balanceConfig.ts13: ration/capacity와40칸.
- tick.ts70–87,120–174: 비공개 glue 및 공식 prefix.
- 현재 helper/result/R07 REVIEW SHA는 SOURCE_INPUT_SHA256SUMS.

이번 새 엔진실행0, 공식추적재생0, 후보정렬 재구현0, 소스수정0. Graft 선행 조회 절감 추정7,090 tokens. 규칙과 보존 관측의 대조는 장기 미배급 원인 확정이나 결함 판정이 아니다.

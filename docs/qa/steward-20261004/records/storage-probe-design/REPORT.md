# R08 제재소·포화 창고 제한 관측 설계

판정: SPEC_READY_NOT_EXECUTED. 현재 시점의 상호 용량 제한을 코드로 설명할 수 있으나 지속 정체/자동 회복은 미검증이다. 엔진·렌더 수정, helper 구현, 브라우저·엔진·DGX 실행 없음.

## 입력과 이미 확인된 경계

원본 `/tmp/astra-steward-r04-20261003/long-run/N02-v3-open-1-growth/year-1350.fls.json`, seed1 tick200000, SHA256 `b663dde465f0b8b4fceae704bd583fca4e79ea6fd0852a1ee83d78f88990dbbb`. HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. 자연 bot 체크포인트이지 최초 플레이 저장이 아니다. 소스 SHA와 원본 보고서 SHA는 SOURCE_EVIDENCE/INPUT_PINS에 보존한다.

R07 실제 UI는 target000050에 통나무1·목재19·생산0/35와 ‘창고에서 통나무 운반을 기다리는 중’을 보였다. 실제 표면은 DiagnosticCard이며 InspectorModel.actions가 이 카드에 연결됐다고 볼 수 없다. 품목별 스위치는 없다. 이 설계는 안내 해결을 주장하지 않으며 정책 변경/가동중지/창고증설/품목변경을 포함하지 않는다.

제재소 construction-site-000050의 용량20/재고20/예약0. fetchCandidate는 homeSpace=0이면 공급원/경로 선택 전에 null. deliverCandidate는 목재를 받는 창고의 여유를 요구한다. 5창고는 현재 실제재고998+입고예약2=1000/1000이다. 따라서 현재 후보 계산상 입력 fetch와 출력 deliver 모두 공간이 없다. 영구 교착 판정은 아니다.

000039의 예약2에는 실제 outbound 수레가 있다: carter:construction-site-000003:199936 목재1, 잔거리19.04; carter:construction-site-000052:199986 통나무1, 잔거리31.04. 나머지 관련 귀환 수레2대는 화물null이다. target000050 home 수레는 없다. INPUT_OBSERVATION은 원본 필드를 경량Ruby로 추출했고 경로찾기/엔진을 실행하지 않았다.

## 경쟁 가설과 반증 관측

|가설|지지하는 시간선|기각/별도판정 기준|
|---|---|---|
|H1 순간 예약·운반 대기|기존 예약 수레 배송/귀환 뒤 빈 공간과 target 운반이 생기고 logs≥2 및 생산 progress가 진행|예약2가 재고2로 바뀌어 여유0을 유지하고 정해진 기회 창 동안 fetch/deliver와 생산이 계속없으면 이 후보의 단순 순간대기 설명 약화|
|H2 수신 창고와 제재소의 지속 용량 제한|target inventory+reserved=20, 로그1 유지; 모든 목재 수신창고 intakeSpace0; 정상 도로·노동 조건인데 fetch/deliver 후보null·target수레없음·생산0이 관측창 내 지속|공간이 생긴 뒤 운반/생산 회복이면 지속성 기각. 단 한 스냅샷이나 안내문구만으로 확정하지 않음|
|H3 공간 외 경로·예약 소유권·운반자 점유 문제|공간/원료 여유가 있는데 null경로, sourceStockReserved, busyHome 또는 cancellation/return 대기와 일치|연결경로·비예약 원료·가용공간·home비점유가 모두 성립하면 그 조건으로 설명 불가. 예약에 대응하는 살아있는 claim이 없는 경우 별도 조사후보|
|H4 정상 자율 변화/노동·운영 상태 변화|새 건물/공사/시장일 목재매각/일꾼 재배치/운영정지/미지급 등과 회복 또는 정체 시점이 일치|target 생산/공간의 작은 변화만 보고 배송효과라고 귀속하지 않음. 원래 가설 조건이 달라지면 구간 분리|

## 최소 실행 사양 (후속 구현·실행은 별도)

공식 runner의 nice19/detach/keep 단일 headless job, browser 없음. 입력 바이트 SHA 및 HEAD/source guard 후 정상 decodeSave. 주 상태 변화는 `advanceTick(state)`만 허용한다. 원본 bot의 향후 명령을 재생하거나 직접 reducer/가동중지/정책/인력명령을 추가하지 않는다. 따라서 ‘이 저장에서 무개입 자연 발전’이며 기존 장기 bot run의 이후와 동일하다고 주장하지 않는다. agency 등 원본에 있는 정상 자율효과는 끄지 않는다.

각 호출 전후 실제 tick과 wallTick, public 호출수·벽시각을 기록한다. 현재 advanceTick은 내부 substep1개지만 실제 tick 증가를 검사한다. abandoned 등 tick 정지, source/input drift, 예외, 제한시간 종료는 별도 결과이며 성공으로 포장하지 않는다. 성능 보호벽은 180초이며 이는 게임 인과의 기한이 아니다.

### 관측 길이의 근거

저장된 target↔5창고의 경로 길이는 30,1,20,47,46 격자변이다. 현재 outbound 중 긴 것은 전체33/잔여31.04. 경로 캐시는 참고이며 후속 DGX 시작 때 현재 공개 createSimulationRoutePorts.delivery로 재계산해 일치/접근 가능성과 ford를 확인해야 한다. route port는 별도 진단용으로 만들고 그 캐시 결과를 실제 주 상태에 주입하지 않는다.

CARTER_SPEED=0.14, ford는 1/2로 최저0.07. 각 단위변을 보수적으로 ceil(1/.07)=15틱으로 계산한다(실제 정상길은 더 빠를 수 있음). 기존 긴 수레의 잔여 배송+전체귀환 정리 예산은 ceil(31.04/.07)+33×15+2=941틱. 가장 긴 한 방향47변은705틱. 그 뒤 target의 입력 fetch 왕복과 출력 deliver 왕복 4구간 및 생산35틱 두 번·dispatch/경계8틱을 준다: 941 + 4×705 + 2×35 + 8 = **3839틱**, 실행 상한을 **3840 public ticks**로 둔다. 임의 몇 개월 대기가 아니라 기존 예약 정리 후 한 차례 입력→생산→출력 경로와 추가 생산 기회를 관찰하는 보수적 창이다. 두 완전 경제순환을 입증하는 기한이라고 부르지 않는다.

시작 진단은 logging_camp를 포함한 실제 로그 공급원/모든5창고 경로도 기록한다. 재계산 경로가 더 길거나 도중 경로 변경/새 공급경로/반복 cancellation/귀환 적재공간 대기가 생기면 위 유한 시간은 보장되지 않는다. 자동 연장하지 말고 route_bound_exceeded 또는 conditions_changed로 판정한다. 아무 일도 없었다는 결과는 ‘이 창 안에서 지속’이며 영구불능이 아니다.

### 매 tick 얇은 관측 (상태전체 매 tick 저장 금지)

- target과 모든 sawmill/logging_camp/storehouse: id/kind/좌표, inventory **전체품목**, reserved, stockReserved, workers, productionProgress, operationPaused/upkeepUnpaid, 실제 cap 및 availableSpace/availableStock. resource는 logs/timber/stone_raw/stone뿐 아니라 자리 경쟁하는 malt 등도 보존한다.
- carter 전원: id,homeBuildingId,cart,mission,phase,destination,cargo,position,pathIndex,spawnedTick,cancellation 및 sourceStockClaim/homeCapacityClaim/예약목적지. 경로 배열은 walker별 생성/변경 때만, 매 tick에는 hash·현재index·잔여거리. target/5창고 관련 ID subset을 별도로 표시하되 제3자가 공간을 소비하는 것을 놓치지 않도록 전체 carter 경량목록 유지.
- 정적/변화 진단: target productionOperation(실제 road access·effective definition), fetchCandidate/deliverCandidate, inventory.availableSpace 및 storageIntakeSpace, 공급 stock-stockReserved, busyHome, 수신창고와 공급원별 경로null/길이. 시작/종료·재고/예약/점유/도로/worker/운영조건 변화 때 재평가한다. 이것은 tick 경계의 진단이지 해당 tick 내부 dispatch 결과와 동일하다고 단정하지 않는다.
- constructionSites 추가/삭제·required/delivered/reserved, treasuryTimber(창고목재와 별도), roadVersion/길망변경, 건물 추가/삭제, 대상 인력/운영변경, ledger/이벤트의 관련 변화 ID. 실제 자율 공급/수요 변화가 있으면 원인 후보로 분리.

### 배송·생산 귀속의 엄격한 계약

advanceTick의 buildingDelivery callback은 내부 wheat 관측에 연결돼 있고 외부 일반 구독 포트가 아니다. 엔진에 callback을 새로 삽입하거나 autoplay 관측 state를 주입하지 않는다. 이번 최소안의 배송은 **연속 상태전이 증거**다.

1. dispatch: 새 carter의 mission/cargo/claims + 출발지 재고/예약·목적지 예약변화. 단순 walker count로 대신하지 않는다.
2. fetch pickup: 동일 ID outbound→returning, 새 cargo, sourceStockClaim 대상의 stock/stockReserved 변화. 완전 부합하면 source-code-correlated pickup으로 기록한다.
3. deliver 완료: 동일 ID outbound→returning/cargo 해제, 목적지 inventory 증가/reserved 감소와 homeCapacityClaim 해제. fetch 귀환은 returning ID 제거+home 재고증가/예약감소로 구분한다. cancellation경로와 정상완료를 섞지 않는다.
4. target 생산: progress0→1…34→0 및 로그2 감소/목재1 증가를 같은 tick 모든 수레 화물/이동·거래·관련 ledger 변화와 대조한다. 출력이 즉시 출발해 inventory 증가가 안 남을 수 있으므로 target의 재고만으로 생산없음을 단정하지 않는다. 애매한 다중 변동은 unassigned_delta로 남긴다.
5. tick 순서는 stepCarters→생산→공사→spawnCarters→상위 자연 시스템이다. 여러 단계가 한 public tick에 생길 수 있다. 경계값만으로 인과를 분해할 수 없으면 inferred/ambiguous로 남기고 별도 내부 관측 승인 없이는 ‘직접 이벤트’라고 부르지 않는다.

## 결과 계약·최소 산출물

baseline.json(입력/초기생산·후보·경로), timeline.jsonl(변화행+100틱 heartbeat), walker-paths.json, conclusions.json(가설별 지지/반증/미판정,실제호출수·도달tick·벽시간), 정확 source/input 전후 SHA. endpoint 및 최초확실회복 직전/직후 상태만 정상codec 저장(최대4 full saves). 판정기 자체의 배열/쓰기오류는 harness 오류로 분리한다.

판정은 transient_recovery / persistent_capacity_block_in_window / alternate_constraint / inconclusive로 한다. no_hit는 제품실패도 성공도 아니며 해당 창에서 회복 관측없음이다. input+output 후보가 null인 지속행·실제 배송/생산 무활동을 함께 확인했을 때만 H2를 제한적으로 지지한다. 경로/조건 변화나 귀속 불명은 별도 표기한다. 현관측 UI 공백은 headless 경제 회복 여부와 별개이며 첫플레이2 완료로 바꾸지 않는다.

선택적 결정론 확인은 첫160틱을 동일 원본에서 다시 공개 advanceTick하여 stateSHA/얇은 관측 digest를 비교한다. 이 구간은 가장 가까운 1변 길의 보수적 입력+출력 왕복60틱과 생산70틱+경계여유를 포함한다. 없던 회복을 만드는 재현이 아니며 tick200000 이후 전체3840의 결정론을 대표하지 않는다. 기본 필요조건은 아니고 wall budget 안에서만 한다.

Graft 검색1회, 표시된 절감 추정 9,803 tokens. 실행 없음.

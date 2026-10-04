# R06 시스템 지도

기준 HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`. 전체 기존 지도는 records/SYSTEM_MAP_R05_HISTORY.md에 보존했으며 그 상대경로는 R05 동결 ZIP 기준이다. 이전 지도 SHA d8b676cfc93d38028aade7af7b2c0e902ff26cdf634961393c3d256bb399a511. 엔진·렌더 변경 없음.

|인과 고리|현재 증거|남은 범위|
|---|---|---|
|청원 응답 → 방향 접근 → 방침|tutorialAccess의 모든 반환 경로가 direction=false. 첫 청원 응답을 저장한1325년 fixture에서도 잠금안내 관측|방향 이외의 모든 명령 UI 부재를 입증한 것은 아님. records/B02_DIRECTION_SOURCE.json, UI_R06B_PARENT_REVIEW.json|
|자율 건설 → receipt → 건물 상세창|저장receipt가 있는 자율창고를실제선택. 재고92통나무+4목재·들어올몫8확인|native 스크롤바로 최하단까지 확인. 저장 receipt-98의 주체·비용·입지 이유가 이 창고 상세창에 표시되지 않음. records/B03_RECEIPT_PARENT_REVIEW.json; 다른 UI로 일반화하지 않음|
|현금 거래 → 상세원장/요약 → 금고|N03저장6개의합계와금고일치|누락거래·실행중캐시미검증. analysis/CASH_N03_R06.json|
|창고 → 화물 → 공사 도착 → 건물 편입|기존14저장2437검사위반0. 후속345tick 목책1구간완공에서202+5−32=175,매tick목재잔차0|한완공/345tick 관찰로 확대했지만 취소·다른자원생산소비·전기간보존 미증명. records/material-transition-probe/, MATERIAL_TRANSITION_PARENT_REVIEW.json|
|약속 → 기한 → 지급/불이행 → 관계/기록|R04 자연조기지급 검증 승계; R06 합성약속8사례군·17trace·63검사 및 저장35개 확인|DGX exit0. 자연협상·증인·UI 미검증. records/PROMISE_PARENT_REVIEW.json|
|원고 → 당시params → 문맥선택 → 사실행|650누적원고와별도나이20제안. 92유형 생산기 감사 완료: 현재params4/새문맥32/좁은기본형54/legacy주의2|초기 묶음만이 아닌 현재 전체목록은 chronicle/CONTEXT_DRAFTS.catalog.json과 records/context-inventory/를 따른다. 현재관계로 과거를 채우지 않음; 좁은기본형 분류만으로 E 완료 선언하지 않음; 사실행/숫자adapter 차단 유지|
|그림승인 → 장부 → 설치계획 → 렌더|장부5885/계획858대조. 실제원본858SHA일치|바이트검증은설치·픽셀·런타임선택증거아님|

D200사건은 R05 편집결과를 승계했다. 기존 SAVE01·사망자위임·등록기원자성 문제는 해결증거 없이 닫지 않는다. 이번회차source/UI보강은 기존문제를새결함으로중복집계하지 않는다.

## R06 B04 경계 실행 보충

DGX 합성 권리복원 10사례·111검사·30저장 검증 완료. 50d 필요 선택에서 15d/49d는 금고·권리를 바꾸지 않지만 수락 응답을 남기고 재청원을 4000틱 미룬다. 50d/51d는 50d를 납부하고 점유를 복원한다. 무료 복원은 재현되지 않았다. 원래 브라우저 상태의 정확한 재생·자연 쇠퇴·4000틱 경과·UI 실패 안내는 미검증이다. [실측 상세](records/restoration-probe/executed/REVIEW.md).

## R06 권리복원 후 시간 경계

[연속 실행 증거](records/restoration-deadline-probe/executed/REVIEW.md): 두경로9001틱 실제진행·codec재생6회·9046검사·저장28개 검산. 납부후t16001작위복귀, 부족후t16001은하한일뿐이며 조건을충족한이번경로의첫계절t17000에재청원1개. 합성쇠퇴출발·UI미실행, 모든원인/seed보장아님. runner55.4초종료0/PID·scope종료확인. 앞 B04의4000틱후미검증범위중이두경계만추가검증됐으며 자연발생/원브라우저재생은여전히미검증.

## 혼인과 화면의 대상 연결

공식 개시상태 seed1에서 advanceTick 1회로 재실 가솔·세력 목록이 생성된다. R06b 실화면에서 가솔 카드 → 전기 보기/닫기, 세력 목록 → neighbour_1 상세까지 도달했다. 혼인 계산의 적격 신랑 kin:1:1은 지도 밖 친족이고, 신부 est-000002의 상대 영지 estate-neighbour-3는 이 세력 행과 다르다. 엔진 후보 생성 → 플레이어가 그 후보를 고르는 화면 연결은 이번 경로에서 확인되지 않았다.

근거: records/marriage-ui-access-audit/ 소스 감사, records/marriage-ui-probe-r06b/executed/fixture-eligibility.json·0014·0030. fixture 적격은 제안 수락이나 플레이 중 적격 유지가 아니다. 화면은 정지 버튼 pressed=true이며, 상단표시는 55가 아니라5s다. 저장 readback은 실시간 상태 증거가 아니다.

## 콘텐츠 근거와 효과의 분리

D200의40건은 제한형 등록기 구현과 미연결sidecar를 구분하도록 지원설명을 교정했다. 사료20필드 갱신은081/189접근보류를 확인주장범위에서 해소하고195편년보류를 유지한다. 선택·조건·효과·본문·등록기 불변이므로 출처 보강을 새 게임효과 지원으로 간주하지 않는다. records/source-hold-application-r06/ 참조.

## R06 실제 공사 취소 경계

seed1 자연 저장 t100000의 church construction-site-000061에 공개 cancel_construction 명령을 적용했다. 도착 목재84/돌4에서 목재50/돌2 환급, 목재34/돌2 소실, 추가 dropped0. 예약 중복 환급0이며 명령 직후 전 물리재고 차이는 이 소실과 일치했다. 같은 입력 재생·codec·원입력 불변·반복 취소 포함366검사 실패0, 저장11개 SHA일치. 이후272공식tick을 관측해 기존6운반꾼은 모두 사라졌다. 이 소멸을 각 반환 입금의 독립 증명으로 해석하지 않는다. 내부 진단 ledger와 영속 기록의 차이는 별도 조사 중이다. 공식 DGX nice19 명령7.5초 exit0, runner PID부재 및 scope종료 확인. 근거: records/material-cancel-probe/executed/.

## R07 취소 후 화물 반환

취소 → 화물 유지·귀환 → accepting home 재고 입금 → 공간예약 해제·운반꾼 제거. 자연4경계에서 목재16·돌12를 분리 검산하고 공식tick 재생과 일치시켰다. 이번 사례 overflow0. 수량 반환 확인과 영속 자원별 기록 공백은 서로 다른 판정이다. 근거 records/material-return-probe/REVIEW.md.

## R07 표시 대상과 계산 범위

혼인 후보 생성(lordHouseKin·estates.people)과 가솔/전기/가계도(persons.people/past·factions.people)는 다른 조회 집합이다. 지정 후보로 이어지는 검사 대상 UI join이 없다는 소스 결론이며 전UI 부재 판정은 아니다.

HUD식량일수는 저장 빵/환산 밀 기반, 가구굶주림은 breadStock·유예·emptyFoodTicks 조건 기반이다. 도시 저장량이 가구 배급 도달을 보증하지 않는다. t100000은268일/굶주림0으로 해당 문제의 음성 사례다. records/food-days-causal-scope/에 계산식·배급·집 검사 경로를 보존했다.

## R07 식량 경고와 굶주림 경계

주택 빵 재고>0 → houseHasFood. 엔진 houseIsStarving은 거주자>0·빵없음·보호기간종료·emptyFoodTicks>STARVATION_WINDOW를 모두 요구한다. 주택 원인 표시의 bread blocker는 빵없음만으로 생성되고, alertStackModel은 생활등급 유지 risk를 immediate, 승급 blocked를 caution으로 분류한다. 따라서 경고 첫 집이 결식시간이 가장 긴 집이라는 보장은 없다. R07b 실제 첫 경고는14인 상인가옥으로 연결됐으며 지정6인 장기결식 가구와 달랐다. HUD191일과 표시 굶주림 동시 관측을 엔진 starvation predicate의 live 검증으로 승격하지 않는다. 부모 대조: records/FOOD_SEVERITY_PARENT_SOURCE.json; 실제화면: records/food-ui-probe-r07b/executed/0009-bread-alert-inspector.jpg.

## R07 사망 기록과 연대기의 서로 다른 대상

도시 인물의 사망은 persons.past에 ID·deathYear·deathCause로 남는다. 살아서 떠난 사람도 past에서 늙어 사망할 수 있다. 이때 기존 항목을 갱신하므로 새 past 꼬리와 이전 people을 비교하는 person.died 연대기에는 들어가지 않는다. 따라서 person.died 개수는 persons.past 전체 사망 개수와 같다는 불변식이 아니다.

세 자연150년 판에서450연말 원인별 누계·중간 사망ID 보존을 대조했고 불일치0이었다. 기록된 사망 N02/N03/N04는5440/2167/3083, 연대기 없는1645/179/180은 모두 age다. 그중1368/147/132는 이전 저장에서 살아 있는 이주자 상태가 직접 관측됐다. 나머지도 같은 경로라고 단정하지 않는다. 기근·흑사병 원인은 모두 해당 연대기와 연결돼 기존 자료로 기록tick별 추이를 만들 수 있다.

이 범위는 persons 계열에 기록된 사망이며 지도 밖 세력·영지의 인물이나 기록되지 않은 인구 손실을 합친 전체세계 사망이 아니다. 사망 당시 가구 재고·배급 상태의 인과 분모도 별도다. 새150년 실행을 반복하기 전에 기존 기록의 질문 범위를 명시한다. 근거 records/death-coverage-inventory/REPORT.md, records/DEATH_COVERAGE_PARENT_CHECK.json(입력·소스34파일15구간 대조).

## R07 배급·거주 인과 관측 보완
1375년 자연저장 대상집000023: 300001~301200 배급시각299161 고정·빵0, 다른21개집에는81개 서비스표식이 관측됐다. 6인 중 famine사망3명 뒤 살아 이주3명,300773에 빈집. 전역식량이 존재해도 해당가구 배급을 보장하지 않는 실제 구간이다. 가장 가까운 곡창은 120틱 표본에서 빵0; 빵이 있는 곡창의 가능한 경로는20/33edges였다. 가능한 경로는 실제 방문 증거가 아니고 배급꾼 책임귀속은 기록상 불가. records/food-delivery-review-r07/REPORT.md.

배급 후속 소스·trace 대조: 관측복귀22회 모두 화물소진·40칸미만. 미배급집의 주민감소는 phase23/150틱, 취약아동3명 famine사망 후 kin→spouse→head 이주와 일치한다. 주민0을 배급후보 자동제외로 해석하지 않는다. 내부 후보점수·선택branch·deliveryEvents의 행위자 연결이 없어 특정 배급선택 결함은 아직 미증명이다. records/food-delivery-mechanism-r07/REPORT.md.

## R07 화재 자연 재생으로 보강한 고리

first_fire@9 → 실제 발화9400(물 공급 doused=true) → 짧은 연소 종료9460에 소실·생활등급/빵 상실 → 자동 재건 공사9516 → 구조 재건9576·소실표식 제거 →11460 주민7. doused는 완전진화 보장이 아니고 구조 재건은 원가구 전원복귀 보장이 아니다. 렌더 오버레이 코드와 실제 화면 가시성은 구분한다. 근거 records/fire-replay-executed-r07/ 및 records/fire-mechanism-parent-r07/.

## R07 표시·설치 경계 보강

화재 상태는 발화/소실/재건공사/표식해제로 달라졌지만 사건 aftermath 조언은 복구창 동안 고정돼 있었다. 사건 누적 burntHouses와 현재 소실표식 수는 다른 값이며, UI에서 “불탄 집1”을 현재 미복구집1로 해석하지 않는다. 재건공사 중·완료 후의 시작 지시는 기존 첫플레이8 안내 공백의 범위확장이다. 근거 records/fire-ui-review-r07b/REPORT.md.

창고 화면은 실제재고와 들어올 예약량을 함께 보여준다. 198/200·예약2일 때 시각 막대는 used+incoming 기준으로 가득 찬다. 제재소의 logs1/timber19은 총20이지만 입력요건 logs2 미충족이 먼저 설명되며, 이를 화면에서 운반정체의 전체 원인이 입증됐다고 바꾸지 않는다. 관련 포화창고·개입조건 연결은 첫플레이2의 미해결 경계다. 근거 records/storage-ui-review-r07/REPORT.md.

영주관 세계object는 저장에 있으나 현 art catalog 연결이 없어 기본도형으로 그려지는 정적 경로가 확인됐다. 실제 사진과 저장·투영의 정합이며 런타임 분기 trace는 아니다. 그림 설치와 영주/점유 상태의 연결 계약을 별도 과제로 유지한다. 근거 records/storage-background-art-audit-r07/REPORT.md.

## R07 식량 관측 경계 추가
공식1틱 저장과 재구성 서비스단계를 분리했다. 경로 존재→가구 선택→배달은 별개 고리이며 대상 경로4회 성공을 배달 가능/선정 증거로 올리지 않는다. records/food-boundary-review-r07/REPORT.md 참조.

## R08 배급 선택과 창고 안내 경계
기록된 재구성 배급입력4건을 원 선택함수로 재실행했다. 대상집 경로가 있어도 남은 이동범위와 수요 순위로 다른집을 선택하며, 같은 다음칸은 같은 목적집의 증거가 아니다. 공식 내부선택 직접관측은 여전히없다. records/food-choice-executed/ 참조.
지도 DiagnosticCard의 운영정보와 다른 Inspector의 다음행동모델을 구분했다. 받은품목은 현재 고정규칙표시다. UI 안내존재와 headless물류회복은 별도 검증고리다.

# 원장 46종 실제 계약 분류

부호가 반대인 문형이 존재한다는 이유만으로 두 상황을 인정하지 않는다. 현재 producer에서 확인한 계정·목적 범위만 판정한다.

|종류|실제 계정/목적 범위|판정·근거|
|---|---|---|
|opening_balance|initial_balance|시작 잔액. 새로운 수입 원인 추정 없이 이월 잔액과 정확한 부호 표시. (`src/ledger/ledger.ts:140-147`)|
|market_sale|saved_history_only|현재 시장 수입 producer 없음. 과거 저장용 계정 표시로 한정. (`src/ledger/ledger.types.ts:11-15`)|
|construction|cash_out|reserved 주석과 달리 시장 화재 수리비 producer가 현재 존재. 건설비라는 넓은 표시는 준공 주장 없음. (`src/engine/legacy.ts:290-299`)|
|upkeep|cash_out_and_arrears|현재 유지비 납부·미납·체납 청산 계정 차이가 실제 발생. (`src/engine/moneyRules.ts:195-229`)|
|toll|cash_in|통행세 수입이라는 단일 목적. crossings 수만으로 번영·신분 서사를 만들지 않음. (`src/engine/moneyRules.ts:159-163`)|
|stall_fee|same_sign_distinct_purposes|시장 좌판과 주택 에일집 판매 부담이 같은 카테고리. 영주 원장에는 양수 현금 수입인 에일집 판매 부담을 시장 좌판세로 이름 붙이는 문구 오류. 납부자의 부담과 영주 금고의 수입을 구별. 이제 독립 검수된 목적별 2문구가 이를 보완한다. 기존 category label을 앞에 붙이지 않는다. 실제 통합은 별도. (`src/engine/moneyRules.ts:139-150`, `src/engine/ale.ts:172-181`)|
|rent|cash_in|주택 지대 수입. 부역 전환 여부는 현재 entry만으로 새로 단정하지 않음. (`src/engine/moneyRules.ts:121-134`)|
|mill_toll|cash_in|제분량에 따른 제분료 수입. 고정 목적 표시. (`src/engine/moneyRules.ts:151-158`)|
|demesne_sale|cash_in|직영 곡창 밀/빵 판매. 직영 판매라는 상위 명칭은 두 상품에 정확함. (`src/engine/marketSettlement.ts:223-230`)|
|project|cash_out|석벽 사업 재원 지출. 현금과 실제 완공은 구별. (`src/engine/moneyRules.ts:241-250`)|
|famine_relief|cash_out_and_in_kind|구매 현금 지출과 현물 구휼을 정본 전용 문구·수량 adapter로 구별. (`src/engine/politics.ts:110-128`)|
|famine_sale|cash_in|기근 중 곡창 밀/빵 판매 수입. 저장 재고를 과거 판매량으로 추정하지 않음. (`src/engine/politics.ts:130-143`)|
|charter_fee|cash_in|칙허 대가를 받는 목적. 시장/도시 특허의 세분화는 가능하지만 상위 명칭 자체는 맞음. (`src/engine/politics.ts:210-215`, `src/engine/legacy.ts:170-181`)|
|restoration_fee|cash_out|쇠퇴에서 잃은 권리를 되찾는 비용. 권리 종류 추측 없음. (`src/engine/lordship.ts:202-216`)|
|house_change|cash_out|가문 교체 금고 손실. 개인 횡령·상속 동기 주장 없음. (`src/engine/lordship.ts:118-130`)|
|wool_levy|cash_out_in_kind_arrears|양모 현물과 현금·부족액을 실제 원장으로 구별하는 정본 adapter 존재. (`src/engine/war.ts:287-299`, `src/engine/war.ts:401-420`)|
|war_exemption|cash_out_and_arrears|징집 면제 비용의 실제 납부/미납. 일반표시도 계정 차이를 유지. (`src/engine/war.ts:300-305`, `src/engine/war.ts:111-127`)|
|war_subsidy|cash_out_and_arrears|전쟁 보조세의 실제 지출·부족액. 조달 방법을 납부액만으로 추론하지 않음. (`src/engine/war.ts:306-316`, `src/engine/war.ts:111-127`)|
|war_loan|cash_in_out_arrears|차입 수입과 상환 지출·부족액이 실제로 다름. 단순 반대 부호를 허구로 만들지 않음. (`src/engine/war.ts:306-316`, `src/engine/war.ts:422-429`)|
|war_tax|cash_in|지대에 얹힌 전쟁 세금의 수입. (`src/engine/moneyRules.ts:135-137`)|
|raid_loot|cash_out|실제 약탈 금액의 금고 손실. 사망/전투 승패 없음. (`src/engine/war.ts:207-216`)|
|purveyance|cash_in|왕실의 밀 구매 대금. 현물 몰수라고 바꾸지 않음. (`src/engine/war.ts:438-455`)|
|refugee_fee|cash_in|실제 받아들인 피란민의 입주금. 거절 이유 추정 없음. (`src/engine/war.ts:317-327`)|
|murage|cash_in|성벽세 수입. restricted 기금으로 임의 재분류하지 않음. (`src/engine/moneyRules.ts:164-168`)|
|wages|cash_out_and_arrears|임금 실제 지급/미지급. 완납·노동 완료 과장 없음. (`src/engine/plague.ts:361-366`, `src/engine/plague.ts:237-250`)|
|statute_fine|cash_out_and_arrears|노동자법 벌금의 지급/미납 계정 차이. (`src/engine/plague.ts:534-539`, `src/engine/plague.ts:237-250`)|
|church_fee|cash_out_and_arrears|수도원 사제 봉급. 전체 교회 공사비로 바꾸지 않음. (`src/engine/plague.ts:381-390`, `src/engine/plague.ts:237-250`)|
|entry_fine|cash_in|재정착한 가구의 입주금 수입. (`src/engine/plague.ts:350-360`)|
|fulling_toll|cash_in|직물 축융량에 따른 방앗간 사용료. (`src/engine/cloth.ts:186-193`)|
|ulnage|cash_in|판매 직물의 검정·인장세. (`src/engine/marketSettlement.ts:219-221`)|
|cloth_toll|cash_in|직물 판매 통행/거래 부담. 표시 명칭에 맞는 수입. (`src/engine/marketSettlement.ts:222-224`)|
|poll_tax|cash_in|위임/직접 징수 차이는 기록되나 영주 몫 수입이라는 기존 상위 표현과 모순 없음. (`src/engine/reorganisation.ts:455-466`)|
|fee_farm|cash_in|도시의 자치 연납금. 장 차이로 새 성격을 지어내지 않음. (`src/engine/reorganisation.ts:389-393`, `src/engine/legacy.ts:447-452`)|
|royal_subsidy|same_sign_distinct_purposes|tenth_and_fifteenth 보조세와 confirmation 특허 확인금이 모두 왕실 보조세로 표시됨. 이제 독립 검수된 목적별 2문구가 이를 보완한다. 기존 category label을 앞에 붙이지 않는다. 실제 통합은 별도. (`src/engine/legacy.ts:151-157`, `src/engine/legacy.ts:178-181`)|
|succession_relief|cash_out|후계자 승인금. 후계 관계별 변형은 별도 history에 있음. 기존 상위 지급 명칭은 정확. (`src/engine/legacy.ts:159-168`)|
|legacy_endowment|cash_out|유산 축마다 기부금 지출. 축은 history 유산 기록에 있고 원장의 상위 명칭도 맞음. (`src/engine/legacy.ts:202-210`)|
|church_rebuilding|cash_out|교회 재건 수락 때 실제 낸 비용. label만으로 건축 완공을 뜻하지 않음. (`src/engine/legacy.ts:196-201`)|
|timber_purchase|cash_out|실제로 가져온 목재의 구매 대금. 주문량과 지급/수량 혼동 없음. (`src/engine/timberTrade.ts:47-55`)|
|project_subsidy|cash_out|실제 행동을 시작한 주체에게 지급한 장려금. 공사 완료 주장은 없음. (`src/engine/townAgency.ts:534-544`)|
|lawsuit|reviewed_stage_context|새 4문구로 접수·증거·심리·집행 시도 분리. 독립 검수 통과. (`src/engine/estateSuits.ts:39-45`, `src/engine/estateSuits.ts:75-95`, `src/engine/estateSuits.ts:142-150`, `src/engine/estateSuits.ts:169-183`)|
|marriage_portion|cash_out|혼인 계약금 지출이라는 단일 목적. 신랑 관계·재혼은 옛 sourceRefs만으로 만들지 않음. (`src/engine/marriage.ts:256-263`)|
|promise_payment|same_sign_distinct_purposes|약속 record 이행과 will_favour 즉시 호의 지급은 다른 행위. 후자를 약속 이행으로 단정함. 이제 독립 검수된 목적별 2문구가 이를 보완한다. 기존 category label을 앞에 붙이지 않는다. 실제 통합은 별도. (`src/engine/marriage.ts:210-224`, `src/engine/marriage.ts:373-383`)|
|estate_income|cash_in_out|계절 보고 수입과 청원 처분의 실제 입출금. 사유 세분화 여지는 있지만 입출금 차이는 이미 의미 있음. (`src/engine/stewardship.ts:226-231`, `src/engine/stewardship.ts:331-336`, `src/engine/stewardship.ts:443-461`)|
|audit_recovery|cash_in|실제 감사로 되찾은 돈. revealed 금액 전부 회수로 바꾸지 않음. (`src/engine/stewardship.ts:492-500`)|
|registry_settlement|cash_signed|등록기 응답 효과의 signed 금액. occurrence ID 외 사유/배경을 확정하지 않음. (`src/engine/registry.ts:209-218`)|
|instalment|cash_out_and_arrears|실제 납부·미납·체납 해소를 전용 원고/adapter 계약으로 구별. (`src/engine/registry.ts:265-281`, `src/engine/moneyRules.ts:215-231`)|

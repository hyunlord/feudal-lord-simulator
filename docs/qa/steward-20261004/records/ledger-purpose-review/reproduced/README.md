# 원장 목적 문맥 — 3분류 6문구

**AUTHOR DRAFT, 미설치.** 단어 하나를 바꾸면 다른 정상 경로가 지워지므로, 실제 원장 sourceRefs로 서로 다른 목적을 분리한다. 현재 정본650개·money adapter·FIX12는 변경하지 않는다.

| category / 문맥 | 제안 문구 |
| --- | --- |
| promise_payment / kept | 약속한 돈을 지급하여 금고에서 {amountAbsExact} 나갔다. |
| promise_payment / will_favour | 유언 변경에 답하는 호의 지급으로 금고에서 {amountAbsExact} 나갔다. |
| royal_subsidy / tax | 왕실 보조세로 금고에서 {amountAbsExact} 나갔다. |
| royal_subsidy / confirmation | 자치 특허 확인금으로 금고에서 {amountAbsExact} 나갔다. |
| stall_fee / market | 시장 좌판세로 금고에 {amountExact} 들어왔다. |
| stall_fee / alehouse | 에일집 판매에 따른 부담금으로 금고에 {amountExact} 들어왔다. |

## 기록된 source와 원시 계약

모든 분기는 RAW.schema 검사 → 신뢰된 원본 저장 identity의 campaignId/sourceHead/전체 entry deep equality → source 조합 검사 순서다. campaignId 공백-only 금지. ledger ID는 양의 안전정수 ordinal을 padStart(6)한 원래 생성형식과 왕복 일치해야 한다. amount/tick은 안전정수이고 미지원 추가키는 거부한다. 원장 rollup에는 개별 source가 없으므로 적용하지 않는다. source 순서는 무관하지만 개수·타입·내용이 아래와 일치해야 한다.

- will_favour: cash 음수, 정확히 claim-N/detail=will_favour + actor=estate:estate-neighbour-3. 청구권 ID는 양의 안전정수 N. marriage.ts:374–388의 favour 지급은 PromiseRecord 생성·이행과 다르다. support_promise 선택은 별도 약속만 만들며 이 현금 entry를 만들지 않는다.
- kept: cash 음수, promise-N/detail=pension|debt_assumption|debt_after_inheritance + 같은 actor. 현재 확인한 첫 혼인 상대만 지원한다. keepPromise는 금액>0이고 금고가 충분할 때 지출한 뒤 kept로 처리한다. 정치지원 등 비금전 약속·0금액은 현금 entry가 없으므로 새 문구로 만들지 않는다. claim-N과 promise-N을 서로 대체하면 실패한다. 현재 promise state를 조회하지 않는다.
- tax/confirmation: cash 음수, actor=crown + claim id=royal_subsidy/detail=tenth_and_fifteenth 또는 confirmation. confirmation은 자치 특허를 받아들이는 경로의 확인금이며 보조세와 다르다. legacy post는 금고가 부족하면 부분 지출하고 0이면 entry가 없다. 따라서 200 같은 명목 비용 대신 원장 amount를 표시하고 ‘전액’이라 쓰지 않는다.
- market: cash 양수, building 원래 ID/detail=stalls:양의안전정수 하나. 선택적으로 right 원래ID/detail=stall_fee:0..999 하나를 허용한다. 이 right ID에 전역 새 명명규칙은 만들지 않는다.
- alehouse: cash 양수, building 원래ID/detail=alehouse:양의안전정수 정확히 하나. ale.ts의 판매량 기반 부담금이며 시장 좌판세가 아니다. casks는 목적 식별 검증용일 뿐 금액에서 역산하거나 문구에 통 수를 추가하지 않는다. 향후 소수 판매량·미지원 detail은 보수적으로 폴백한다.

building/right ID는 각 원장에 저장된 비어 있지 않은 비공백 문자열을 보존한다. 현재 건물 종류·현재 권리·현재 가격으로 과거 목적을 추론하지 않는다. source actor에 임의 detail이나 중복/추가 source가 있으면 폴백한다. 이 계약은 source의 진실성을 스스로 증명하지 않으며 identity는 대상 저장에서 별도로 얻어야 한다.

## 폴백과 표시 형식

purpose_variant는 미지원/unknown/손상/결합실패 시 nil을 반환한다. 기존 category label로 돌아가면 ‘약속 이행 지급’, ‘왕실 보조세’, ‘시장 좌판세’ 오인이 재발할 수 있다. 그러므로 **별도 중립 폴백 제안**을 포함했다: 유효한 결합 cash 음수는 ‘지출 목적 미확인 — 금고에서 {amountAbsExact} 나갔다.’, 양수는 ‘수입 목적 미확인 — 금고에 {amountExact} 들어왔다.’

손상 금액·identity 실패까지 금액 문구로 렌더하라는 뜻이 아니다. 먼저 기본 moneyadapter의 금액 검증과 대상 결합을 통과해야 한다. 0원은 목적별 현금문구를 고르지 않고 기존 부호있는 계정표시로 남긴다. source 미확인은 거래 자체가 없었다는 주장과 다르다. 현물/미납은 현금 문구로 표시하지 않는다.

amountAbsExact는 기존 moneyWordsFull(Math.abs(entry.amount)), amountExact는 moneyWordsFull(entry.amount)를 그대로 사용한다. 잔여 d·부호·raw pennies 보존, 새 반올림·통화변환 없음. {label}을 새 목적 문구에 붙이지 않아 기존 잘못된 category 명칭이 다시 끼어들지 않게 한다. 사람 이름 슬롯 추가 없음, FIX12 이름 조회 경로 변경 없음. 현재 canonical schema는 source 문맥 분기를 지원하지 않으므로 별도 adapter 제안이며 무단 병합하지 않는다.

## 소스·용어·검증

glossary의 ‘시장 좌판세’는 시장 좌판 수입에 한정되고 ‘에일집’은 판매 장소다. ‘판매에 따른 부담금’은 새 법정 세목명을 발명하지 않는 설명이다. 유언변경 호의 지급을 새로운 약속이나 상속 보장으로 설명하지 않는다. 소송·다른46분류는 확장하지 않았다.

첫 두분류 125사례(정상12/폴백113), stall36사례(정상3/폴백33) 통과. 양/음/0/소수/unsafe 금액, source순서/중복/문맥혼합/actor/id, 교차campaign/HEAD/entry, 공백ID 등을 검사했다. fixtures는 합성 참조 입력이다. 실제 저장 존재·엔진·formatter·UI 실행 없음. RAW.schema는 부분 Ruby 해석기로 확인하며 전체 표준 인증은 아니다.

재현 순서: ruby build.rb → ruby extend.rb → ruby validate.rb → ruby stall_checks.rb. build/extend는 이 폴더의 생성물만 쓴다. validate는 source SHA/span과 canonical SHA를 확인한다. BASELINE_REF에 canonical650·moneyadapter SHA를 기록했다. 검수 때 제안 조건·원고를 함께 읽어야 하며 selector 합격만으로 전체 통합을 주장하지 않는다.

Graft1회, 도구 추정 절약40,808 tokens. source는 SOURCE_EVIDENCE.json에 원문·SHA 보존. 엔진·정본·타인 파일 변경·설치·commit·push 없음.

원고6행은 PROPOSAL_ROWS.schema.json과 proposal_checks.rb로 별도 검사한다. category-purpose-ID 결합·필수슬롯·추가키 금지·placeholder 일치 및 오염음성30사례 통과. envelope 메타데이터 전체의 schema 인증은 아니다. 재현 뒤 ruby proposal_checks.rb도 실행한다.

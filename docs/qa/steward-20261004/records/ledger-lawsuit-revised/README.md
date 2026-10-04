# 소송 원장 문맥 — 4문구 초안

**AUTHOR DRAFT, 미설치.** 원장 category=lawsuit의 같은 현금지출 문구를 기록된 sourceRefs.detail로 구분한다. 정본650에 합산하지 않으며 엔진 설치는 이 원고의 완료조건이 아니다.

| 분기 | 문구 | 기록된 detail |
| --- | --- | --- |
| filed | 소송을 제기하는 비용으로 금고에서 {amountAbsExact} 나갔다. | suit-N:filed |
| evidence | 소송 증거를 마련하는 비용으로 금고에서 {amountAbsExact} 나갔다. | suit-N:evidence:charter/deed/court_roll/witnesses |
| hearing | 소송 심리 단계의 비용으로 금고에서 {amountAbsExact} 나갔다. | suit-N:hearing |
| enforcing | 판결에 따른 점유 집행을 시도하는 비용으로 금고에서 {amountAbsExact} 나갔다. | suit-N:enforcing:양의정수 |

## producer의 뜻

estateSuits.ts:39–45의 pay는 영주 소송이고 비용이 양수이며 금고가 충분할 때 cash/lawsuit 음수 entry를 생성한다. 비용 부족은 null, 비영주·비용0은 지출 entry를 만들지 않는다. 따라서 이 원고는 **실제로 기록된 지출**을 설명하며 요청 비용·청구금액·현재 소송 총비용을 표시하지 않는다.

fileSuit는 filed 비용을 낸 뒤 소송을 등록한다. addSuitEvidence는 종류별 비용을 낸 뒤 증거를 추가한다. advanceSuits는 유료 hearing 진입을 기록한다. enforcePossession은 비용을 낸 뒤 성공 여부를 판정하므로 지출만으로 점유 확보·승소·집행 성공을 말할 수 없다. 네 문구 모두 그 결과를 주장하지 않는다.

현행 SUIT_STAGE_COST는 filed60/hearing120/enforcing80. evidence 종류 중 charter40/deed30/court_roll20/witnesses24만 유료이며 possession_years는0이다. evidence/patronage 단계 진입 자체도0이다. 원장 없는 무료단계를 새 지출로 만들지 않는다. 금액 문자열은 이 상수로 만들지 않고 entry.amount의 실기록으로만 만든다. 다른 비용·다른 producer의 미래 detail은 다시 검토한다.

## 엄격한 원시 입력·결합 계약

1. SaveCodec/저장 읽기 경로에서 얻은 **개별 불변 LedgerEntry**만 받는다. rollup은 sourceRefs를 보존하지 않으므로 이 분기 적용 금지. 현재 estates.suits·claims·판결·집행 횟수에서 옛 entry를 역추론하지 않는다.
2. RAW.schema.json을 먼저 검사한다. 알려진 sourceHead와 campaignId, status=known, cash/lawsuit, 음의 안전정수 amount, 0 이상 안전정수 tick, 필수 ID, 정확히 하나의 claim source가 필요하다. 불필요한 키는 거부한다. 지원하지 않는 fundId/resource 등의 entry는 일반 폴백으로 간다.
3. 신뢰된 대상 identity의 campaignId/sourceHead/전체 entry와 원시입력을 deep equality로 결합한다. entry ID/tick뿐 아니라 amount·sourceRefs 변경도 실패해야 한다. identity는 같은 context가 스스로 증명한 플래그가 아니라 선택 대상 저장 entry에서 호출자가 별도로 제공한다. 현재 소송 state를 identity로 대체하지 않는다.
4. detail은 전체 문자열 정규식으로만 읽는다. suit-N은 양의 안전정수, enforcing:N도 양의 안전정수. claim ID는 estates.ts가 생성하는 claim-양의정수 형식과 안전정수 범위를 검사한다. claimId와 suitId를 서로 같다고 요구하지 않는다. 한 entry에 source가 여러 개면 이유가 모호하므로 폴백한다. 알려지지 않은 evidence·stage, 공백/접미 개행, 잘못된 숫자는 폴백한다.
5. schema → identity 결합 → detail 파싱 순서다. unknown/손상/미지원은 기존 category/account 선택기로 되돌린다. 음수 cash는 기존 lawsuit.cash_out, 그 밖은 기존 일반 계정 경로다. 폴백 자체가 원시금액 검증을 생략해도 된다는 뜻은 아니다.

새 계층을 정본 schema에 무단 추가하지 않았다. 현재 정본 when 필드는 entry.account/amount 등으로 제한돼 있어 sourceRefs 문맥 선분기 adapter가 별도로 필요하다. 이 초안은 해당 adapter와 selector의 계약/참조만 제안한다. sourceHead 고정은 조사 기준이며 다른 HEAD에서는 producer 호환성 검증이 먼저다.

## 돈·이름·슬롯

유일한 슬롯 amountAbsExact는 기존 moneyadapter의 `moneyWordsFull(Math.abs(entry.amount))` 그대로다. 통화단위·반올림·수량 변환을 새로 만들지 않는다. 현금이 아닌 in_kind 평가액을 현금지출로 읽지 않는다. 참조 selector는 문구 ID만 반환하고 금액 formatter를 실행하지 않는다. 사람 이름 슬롯을 추가하지 않았으며 기존 FIX12 history.summary(record,state) 경로는 변경하지 않는다.

## 검증/한계

경량 Ruby selector57사례(정상8, 폴백49). 정상은 evidence4종·enforcing1/12·filed/hearing. 입력누락, 금액형/부호/안전정수, 무료단계, 잘못된 detail, 다중source, 계정, unknown, ID/tick/금액/sourceRefs/campaign/HEAD 결합 실패를 검사했다. source5파일/9구간 SHA·원문과 정본 SHA 불변 확인. JSON Schema 부분해석기를 사용하며 전체 표준 인증은 아니다.

모든 fixtures는 합성 참조 입력이다. 실제 자연 저장에 이 entry가 존재하는지, 엔진·저장복원·UI·formatter는 실행하지 않았다. 실제 ledger 결합·moneyadapter 통합 검증은 추후 조건이며 지금 초안 품질과 구별한다. engine/code/정본 변경·commit·push 없음.

Graft1회, 도구 추정 절약21,924 tokens. SOURCE_EVIDENCE.json에 정확한 producer와 ledger source를 보존했다.

## 독립 검수 뒤 수정

원고4개 PROPOSAL.json 바이트 동일. campaignId는 공백만인 문자열을 거부하되 형식을 새로 강제하지 않는다. ledger ID는 ledgerEntryId의 padStart(6) 출력과 round-trip 비교하며 양의 안전정수만 허용한다(000001/999999/1000000 허용, 000000/0000001 거부). claim ID는 estates.ts 초기/추가 producer의 claim-N을 검사한다. suit 번호와 claim 번호가 같아야 한다는 거짓 규칙은 넣지 않았다. claim 관계는 pay의 sourceRef.id=suit.claimId라는 소스 구조와 대상 불변 entry 전체 결합으로 한정하며 현재 소송조회로 재구성하지 않는다. 미지원 역사 ID는 일반 폴백이다. 원래57+추가26사례 통과. source6파일/12구간. 원본 폴더 SHA와 원고 바이트 불변. build.rb는 원판 재현 자료이므로 revised selector/추가 source 검증을 재생성하는 스크립트로 주장하지 않는다. validate.rb와 regression.rb가 이 수정판의 실행 가능한 검증이다.

# E 원고 완료 재감사 — 206개 카탈로그 기준

**history 182종의 확정 미작성 공백은 해소됐다. E 전체 완료는 원장 3종의 구체 의미 교정 때문에 보류한다: `promise_payment`, `royal_subsidy`, `stall_fee`.** 어댑터 미설치나 런타임 미검증을 글쓰기 완료의 추가 요건으로 삼은 판정이 아니다.

## 전수 대조한 범위

현재 소스 HISTORY_TEMPLATES **182종**, LEDGER_CATEGORIES **46종**과 정본 키 집합이 일치한다. 정본 **650** + 나이 초안 **20** + 별도 문맥 **206** = ID **876개**, 충돌 0이다. 문맥은 history 202개와 ledger 4개이며 원장 category를 history template로 위조하지 않았다.

카탈로그206의 각 sourceSHA와 sourceEntry가 출처 원고에 그대로 존재함을 전수 확인했다. 각 검수 링크도 존재한다. 나이20을 이루는 승계 폴더22파일은 이전 원고와 바이트 동일하다. 현재 정본 SHA는 `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`로 보존됐다.

history182의 모든 유형별 조건부 문장을 읽고 정본 fallback 및 보존 사실행과 함께 의미 차이를 판정했다. 조건문 없이 문구가 여러 개 있거나 연도만 붙이는 경우를 상황 변형으로 세지 않았다. `COVERAGE.json`에 유형별 문구 수·별도문맥·나이 원고·반복 문장을 남겼다. 조건 입력의 producer/capture 진실성은 각 원고의 독립검수와 소스 근거를 연결하며 전체 런타임을 새로 실행했다고 주장하지 않는다.

## 해소된 공백

- `person.move_in`: 사건 직후 입주 가구 인원 1명/여럿. 개인 subject 나이와 혼동하지 않는다.
- `person.married`: 새 spouse 인물의 영주관/도시 주택 가구 등록. 특정 배우자 연결·초혼·재혼을 발명하지 않는다.
- `person.left_town`: 해당 사건 직후 동일 가구 인물 기록 있음/없음. 행선지·사망·이탈 원인을 발명하지 않는다.
- 원장 `lawsuit`: sourceRefs.detail에서 접수·증거·심리·판결 집행 시도의 비용을 구분한다. 수정판 독립검수에서 식별자 guard까지 통과했다.

person 세 유형은 `records/person-transitions-review/RESULT.json`의 6개 승인 및 소스/가드 검수로 연결된다. 본 감사자는 그 원고의 작성자이므로 독립 판정을 스스로 대체하지 않고 다른 검수자의 결과를 명시적으로 승계한다. 소송4는 `records/ledger-lawsuit-revised-review`와 연결된다.

`legacy.succession`의 50세 전후 두 문구는 어순 차이가 크다는 기존 편집 주의는 유지한다. 사건 당시 실제 나이가 명시되며 완전히 같은 연도 문구 반복과는 달라 이번 확정 공백으로 추가하지 않았다. `person.came_of_age`는 14세 게임 분류이며 새 노동 시작·법적 성년을 주장하지 않는 별도 사실행 수정안과 함께 읽는다.

## 실제로 남은 원장 3종

아래 예시는 source와 동일한 구조를 설명하기 위한 **합성 입력**이다. 실제 저장/플레이에서 관측한 entry가 아니다. 금액 슬롯을 기존 formatter로 렌더하면 돈 표기는 바뀌지만 잘못된 목적 명칭은 그대로 남는다.

| 유형 | 현재 문구 | 증명되는 다른 행위와 저장 구별 | 오해 및 필요한 교정 |
|---|---|---|---|
| promise_payment | 약속 이행 지급 — 금고에서 `{amountAbsExact}` 나갔다. | marriage.ts:219-220은 promise record의 `detail:record.term`; :379-380은 `detail:"will_favour"`, claimId·상대 actor, `amount:-WILL_FAVOUR_PENNIES`(설정120). 후자는 keepPromise를 호출하지 않고 유언 변경 답에서 즉시 지출한다. | `will_favour`의 호의 지급을 기존 약속 이행으로 단정한다. 검증된 해당 detail 분기와 실제 promise term 분기를 구별하거나, 둘에 맞는 중립 기본명칭을 제안해야 한다. 유언이 돈 때문에 변경됐다는 추가 인과를 쓰면 안 된다. |
| royal_subsidy | 왕실 보조세 — 금고에서 `{amountAbsExact}` 나갔다. | legacy.ts:155의 claim royal_subsidy/detail `tenth_and_fifteenth`와 :180의 같은 claim/detail `confirmation`. 후자는 자치 특허 수락 과정의 확인금이며 설정200, 실제 지출은 post가 금고 한도까지 기록. | 특허 확인 대가까지 세금으로 표시한다. 두 detail에 맞는 문구 구별이 필요하다. configured200을 실제 지출로 대체하거나 완납을 단정하면 안 된다. |
| stall_fee | 시장 좌판세 — 금고에 `{amountExact}` 들어왔다. | moneyRules.ts:148-149는 building/detail `stalls:N`; ale.ts:175-177는 주택 에일집 판매 부담으로 building/detail `alehouse:N`. 둘 다 양수 cash이며 후자는 `ceil(casks * alePrice * alehouseDuesPermille / 1000)`. | 에일집 판매에 붙은 부담을 시장 좌판 점유 대가로 묘사한다. 예컨대 `detail:"alehouse:2"`, 현재 설정 price3·permille200이면 amount2인 수입이다. 시장과 에일집을 구별하는 문구 또는 양쪽을 포괄하는 안전한 상위 명칭을 제안해야 한다. |

이 세 종류는 새 숫자·배경 이야기를 더 쓰라는 취향 판단이 아니라 **소스에 실제로 저장되는 다른 지출/수입 목적을 현재 명칭이 잘못 좁히는 문제**다. 기존 범용 cash_in/cash_out 두 문구가 있다는 사실은 이 문제를 해결하지 않는다.

## 나머지 원장 분류

`LEDGER_CLASSIFICATION.md/.json`에서 **46종 전부**를 현재 producer 목적·부호·계정과 대조했다. 42종은 범용 계정 표시가 주이고 4종(famine_relief/wool_levy/instalment/lawsuit)은 추가 producer 원고가 있다. 범용이라고 전부 미작성으로 보지는 않는다.

단일 목적의 toll·marriage_portion·timber_purchase 등은 존재하지 않는 반대 목적을 만들어 두 번째 문구를 쓰지 않는다. upkeep·war_loan·estate_income 등은 납부/미납 또는 실제 입출금 차이가 이미 의미를 가진다. 상품·인원·후계 관계별 세분화가 가능해도 기존 상위 명칭이 사실에 맞는 demesne_sale·succession_relief 등은 필수 새 공백으로 부풀리지 않는다. `market_sale`은 과거 저장 전용 범위로 남긴다.

주의: ledger.types의 `construction is reserved` 주석만으로 현재 producer가 없다고 판단하면 안 된다. 현재 legacy.ts:296이 시장 화재 수리비를 construction으로 낸다. 원고 “건설비”는 넓은 비용 명칭이며 완공을 주장하지 않으므로 이번 미흡 목록에 추가하지 않았다.

## FIX-12·전기·슬롯

historyQuery/historyParams가 읽을 때 이름을 새로 해석하는 현재 소스를 재독했다. 원시 ID 선택 조건은 같은 decoded save의 record.id로 `state.history.records` 원본에 결합해야 한다. UI의 현재 이름·나이·가구 목록에서 과거 처지를 만들지 않는다.

personBiography의 events에는 id/tick/date/template/summary만 있으며 biographyView는 이를 생애 행으로 표시한다. BIOGRAPHY_CONTRACT의 event.id 재결합·unknown fallback·당시 나이 계약을 유지하는 것이 정확하다. 계약의 옛 sourceHead 표기를 현재 설치 검증으로 오인하지 않았으며 관련 현재 함수 본문을 다시 읽었다. 정본 headline의 슬롯 선언 일치 검사와 신규 소송 amountAbsExact 보존을 확인했다. 사람 이름을 신규 JSON 문자열로 고정한 형식은 없다.

## 보류와 통합을 구별

기본 사실행14 수정안과 연결30개 조합은 원고·독립검수가 존재한다. 현재 엔진에 패치가 설치되지 않아 남아 있는 보류30을 “아직 글을 쓰지 않았다”로 세지 않는다. 보류 목록은 그대로 두고 카탈로그 SHA 포인터만 갱신했다.

엔진 실행·capture 설치·저장복원·최종 UI·실제 formatter 테스트는 이번 범위에 없다. 이 조건들은 실제 사용 전 검증 과제이며, 위 **원장3종 의미 교정**과 별개다. 다음 작성자는 이 세 종류만 교정한 뒤 독립검수와 같은 범위의 재감사를 받으면 된다.

재현: `ruby check.rb`, `ruby ledger_scope.rb`. JSON·SHA·소스 텍스트만 검사한다. 게임 코드는 수정하거나 실행하지 않았다.

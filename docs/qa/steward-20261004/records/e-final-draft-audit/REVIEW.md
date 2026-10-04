# E 최종 작성 범위 감사

**확인된 필수 원고 공백 없음.** 기존 전수 감사의 history 182종·원장 46분류 판정을 승계하고, 유일하게 남았던 원장 목적 3분류를 독립 승인된 6문구로 보완했다. 엔진 미설치를 새 작성 완료 요건으로 추가하지 않는다.

현재 소스의 182/46 키 집합과 정본이 정확히 일치한다. 정본650 + 나이20 + 별도 문맥212 = ID882개, 중복0. 문맥은 history202·원장10이며 category를 history template로 바꾸지 않았다. 이전206개 카탈로그 항목은 객체 전체가 동일하고, 새6개는 원문 sourceEntry 그대로다. 나이20을 담은 승계22파일 바이트 동일, canonical650 SHA 보존, 사실행 보류30 목록·원인 불변이다.

## 남았던 세 목적의 해결

|분류|실제 producer 구별|새 원고가 보장하는 범위|
|---|---|---|
|promise_payment|marriage.ts:210–224의 keepPromise / 373–383의 will_favour|약속 지급과 유언 변경에 답하는 호의 지급을 구별. 후자를 기존 약속 이행으로 꾸미지 않는다.|
|royal_subsidy|legacy.ts:151–157의 tenth_and_fifteenth / 178–181의 confirmation|보조세와 자치 특허 확인금을 구별. 부분 지급도 원장 실제 금액만 말하며 완납으로 과장하지 않는다.|
|stall_fee|moneyRules.ts:139–150의 stalls:N / ale.ts:172–181의 alehouse:N|시장 좌판세와 에일집 판매 부담금을 구별. 둘 다 영주 금고에는 양수 수입이다. 납부자의 부담과 영주의 지출을 혼동하지 않는다.|

독립 검수 `../ledger-purpose-review/REPORT.md`, `REVIEW.json`의 PASS_OFFLINE_PURPOSE_DRAFT를 읽은 뒤 반영했다. 검수자는 작성자125+36과 별도247+34 선택 사례를 검사했다. 본 감사는 그 독립 검수 증거를 승계하며, 같은 검사를 직접 새로 실행했다고 주장하지 않는다. 새 merge check는 전체212 출처SHA·검수 링크, 이전206·보류30 불변을 재검증했다.

`LEDGER_CLASSIFICATION.json/.md`는 46분류 전체를 실제 목적·계정·부호로 분류한다. producer 특화 문구가 있는7분류와 범용39분류를 구별하되 범용39 전체를 미작성이라고 부르지 않는다. 단일목적 toll·timber_purchase에 허구의 반대 사건을 더하지 않는다. saved-history 전용 market_sale 범위는 현재 producer 존재 주장과 구별한다. history182 의미 판정은 `../e-completion-reaudit/REVIEW.md`의 전수 읽기 결과를 승계하며 `COVERAGE.json`에 이번 정확집합·출처를 다시 고정했다.

## FIX-12·미확인 목적·통합 경계

이름은 기존 FIX-12 read-time 해석을 유지한다. 신규6개는 사람 이름 슬롯이 없고 정확한 금액 슬롯만 사용한다. 같은 저장 캠페인의 원장 전체 항목·ID에 결합해야 하며 입력 자체를 신뢰 증명으로 복사하면 안 된다. 현재 상태로 과거 원인을 재구성하지 않는다. 정본 history 슬롯 선언 검사는 통과했다.

목적 미확인 중립 문구2개는 카탈로그에 별도 제안으로 실었고212에 포함하지 않았다. 현재 선택기는 unknown에 nil을 반환한다. 향후 검증된 entry 결합과 기존 금액 adapter를 통해 fallback을 렌더링해야 한다. 옛 category label을 앞에 붙이면 같은 잘못된 목적이 재등장하므로 붙이지 않는다.

사실행 수정14 및 연결30개는 독립 검수된 원고로 존재한다. 현재 엔진용 보류30을 삭제하지 않았으며 이것을 미작성으로 오해하지 않는다. capture/adapter 설치, 저장복원, 실제 UI와 formatter 실행은 이번 감사의 증거가 아니다. 조건별 원고 작성 완료와 실제 사용 가능 판정은 별개다.

재현: `ruby check.rb`, `ruby ledger_scope.rb`, `ruby ../ledger-purpose-catalog-merge/check.rb`. 게임 소스 수정·실행 없음.

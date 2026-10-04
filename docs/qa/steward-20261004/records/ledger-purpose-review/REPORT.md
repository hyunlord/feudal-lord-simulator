# 원장 목적 문맥 독립 검수

**PASS_OFFLINE_PURPOSE_DRAFT — 3분류 6문구 승인. 필수 수정 없음.** 엔진 미설치는 원고 승인을 막는 사유로 취급하지 않았다. 통합·표시 검증은 별도다.

실제 producer를 독립 확인했다. marriage.ts:212 keepPromise는 양의 약속 금액을 충분한 금고에서 출금한 뒤 이행 상태로 바꾼다. 같은 파일:374의 will_favour는 유언 변경에 답하는 120d의 호의 지급이며 그 순간 PromiseRecord 이행을 만들지 않는다. 두 문구를 구분한 것이 맞다. legacy.ts:72/180의 확인금은 최대 실제 금고 잔액만 출금하므로 200d 명목액과 다를 수 있다. 실제 1d 부분출금도 confirmation 문구로 선택되는 독립 사례를 확인했고, 문구에 전액·특허 보장·상속 확정 등의 과장이 없다.

ale.ts:176은 실제 판매 통수로 계산한 부담금만 cash/stall_fee에 입금한다. moneyRules.ts:149의 시장 좌판 입금과 source detail이 다르다. ‘에일집 판매에 따른 부담금’은 전체 매출·시장 좌판세라고 하지 않는다. 건물·권리의 현재 상태에서 과거 목적을 추론하지 않는다. 권리 source의 0..999 범위는 politics.ts:236의 <1000 선택과 정합한다. 금액을 통수에서 역산하지 않는 것도 적절하다.

원시 입력은 HistoryRecord.params가 아닌 **LedgerEntry 본문과 sourceRefs**다. claim-N/detail=will_favour와 promise-N/detail=금전약속을 혼동하지 않는다. tax/confirmation은 동일한 claim id=royal_subsidy에서 detail로 나뉜다. 읽는 시점의 인물 이름을 새로 저장하거나 보간하지 않고 이름 슬롯 자체를 추가하지 않아 FIX12 경로를 보존한다.

검증: 작성자의 125 selector + 36 stall 사례, 원고 6행/오염 음성 30개를 검수 폴더 사본에서 재현했다. 별도로 필수필드 삭제, 잘못된 루트·entry 타입, ledger ID 형태, unsafe tick·금액, campaign/HEAD/전체 entry 교차결합, source 혼합, 잘못된 좌판·통수, 시장 권리 혼입 등 **독립 281개**(247+34)를 검사했다. 양수 stall, 음수 지출, 0·미지원은 분리된다. 원본 manifest 17항목과 source 11파일/21구간이 일치했다. 정본 650개와 money adapter SHA도 보존됐다.

스키마 단독으로 source의 의미 결합 전체를 보증하는 구조는 아니다. 실행 순서는 RAW schema gate → 신뢰된 identity와 전체 entry 결합 → source 조합 검사다. 원고 행은 별도 schema와 placeholder/ID 고유성 검사를 병행한다. Ruby 해석기는 사용한 키를 지원하는 부분 구현이며 전체 표준 인증이 아니다. envelope 메타데이터는 별도 완전 스키마 인증 대상이 아니라는 작성자 설명을 확인했다.

통합 조건은 남는다. unknown에서 selector는 nil만 반환하며 중립 금액 문구를 아직 렌더하지 않는다. 중립 fallback도 금액 검증·원본 결합을 먼저 통과해야 한다. 과거 category label을 다시 붙이면 ‘약속 이행/왕실 보조세/좌판세’의 오인이 재발할 수 있으므로 붙이지 않는다. identity를 untrusted raw에서 복사하여 자기 자신을 인증해서는 안 된다. 안전정수 전체 영역을 허용하는 것은 현재 producer 명목 비용의 재검증이 아니라 저장 원장의 안전한 숫자 계약이다. 현재 설정 이상의 금액을 실제 발생 사실이라고 주장하지 않는다.

이 검수는 source·Ruby·JSON에 한정했다. 엔진·formatter·UI 실행, 실제 캠페인 발생 증명, 설치는 하지 않았다. 원본 수정은 없고 사본 재현 결과와 독립 사례는 이 폴더에만 저장했다.

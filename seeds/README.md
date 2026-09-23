# 자동 성장 기준선

`baseline-7db9df85.json`은 소스 커밋 `7db9df85ee0b87e1dd8d99930abb328bace3ee95`의 seed 1~5 최종 결과를 고정한다. `sourceExecutionSummarySha256`과 seed별 `summarySha256`·`finalStateSha256`은 보관된 원본 결과를 가리킨다. 숫자는 이번 작업의 결과를 역산해 만든 것이 아니다.

새 검증은 기준선보다 L4 도달, 서비스 공급, 행동 가능한 성장 상태가 나빠지지 않았는지 검사한다. 유휴 노동 5~25%는 현재 합격 조건에서 제외된 **C3 관문 후보**다. 방앗간 재고 0 비율은 안정 구간에서 한 방앗간이 **2,400틱 연속** 밀 0인지 관측한 뒤 계산한다. 파일의 `legacyFinalInstantZeroWheatMillRatio`는 당시 마지막 한 틱의 기록이며 새 지표와 비교하지 않는다. `chronicZeroWheatMillRatio`가 `null`이면 원본 증거만으로 연속 여부를 증명할 수 없어 결과는 미판정(통과 아님)이다. 같은 방법으로 기준선을 재관측한 후 20퍼센트포인트를 초과하는 악화만 회귀로 본다.

# v4.2 변경 기록

30개 수정, 18개 유지, 38개 보류 권고. 보류는 실행 데이터에 가짜 상태를 넣어 끈 것이 아니다.

## 실제 결과를 바꾼 5개

- 150: 비싸고 약한 증언 선택을 증언+법정 기록44d/+18로 변경. 기록만20d/+10과 비교 가능. 둘 다 미제출 및 충분한 현금 조건, 원자 실행 유지. 시장 부담 조정은 별개 선택으로 남기고 소송 증거가 늘지 않음을 표시.
- 163: 잔여 목재 주문6/2/0으로 실제 확보 물량과 미래 대금을 선택.
- 165: 잔여 주문12/0/6으로 큰 주문·취소·작은 주문을 구분.
- 206·209: 정책 전환 선택을 미입고 목재 주문 취소로 교체. 화재/공사 맥락은 유지하되 특정 집 재건 보장 없음.
- 목재는 '추가'가 아니라 주문 잔량 교체. 같은 수량 재설정·주문 없는 취소는 조건에서 제외한다. 납품 때만 대금을 내고 물자가 증가한다.

## 카드에서 고민을 보이게 한 변경

소송 접수·증거·집행 비용, 실패와 기다림의 실제 대가, 직접 감독의 업무 부담, 반복되는 방문 감사와 장려금, 도시 전체 좌판세의 지속 적용, 목재의 미래 전량 비용을 이름·본문·tradeoff에 옮겼다. 외부 역사 주장과 사료 목록은 추가하거나 교체하지 않았다.

|ID|수정 필드|실행 변경|
|---|---|---|
|ck_evt_002|body, choices|아니오|
|ck_evt_005|body, choices|아니오|
|ck_evt_009|body, choices|아니오|
|ck_evt_010|body, choices|아니오|
|ck_evt_011|body, choices|아니오|
|ck_evt_015|body, choices|아니오|
|ck_evt_024|body, choices|아니오|
|ck_evt_032|body, choices|아니오|
|ck_evt_033|body, choices|아니오|
|ck_evt_035|body, choices|아니오|
|ck_evt_037|body, choices|아니오|
|ck_evt_038|body, choices|아니오|
|ck_evt_042|body, choices|아니오|
|ck_evt_046|body, choices|아니오|
|ck_evt_051|body, choices|아니오|
|ck_evt_053|body, choices|아니오|
|ck_evt_102|body, choices|아니오|
|ck_evt_123|body, choices|아니오|
|ck_evt_138|body, choices|아니오|
|ck_evt_143|body, choices|아니오|
|ck_evt_144|body, choices|아니오|
|ck_evt_150|body, choices|예|
|ck_evt_163|body, choices|예|
|ck_evt_165|body, choices|예|
|ck_evt_174|body, choices|아니오|
|ck_evt_201|body, choices|아니오|
|ck_evt_204|body, choices|아니오|
|ck_evt_206|body, choices|예|
|ck_evt_209|body, choices|예|
|ck_evt_211|body, choices|아니오|

원고 전후는 records/DIFF.json, 모든 선택 전후는 EVENT_AUDIT.json 참조.

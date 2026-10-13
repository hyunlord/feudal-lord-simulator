# 024/lower 입력·계약 준비

실행 전 준비이며 새 화면 통과가 아니다. DGX는 seed30 우선 작업의 단독 소유다. 그 작업 종료와 부모의 실행권 이전 전에는 제출하지 않는다. Mac에서는 파일·git 객체·기존 JSON 읽기만 했다.

- seed1 ck_evt_024/lower, 답h-019919@305059(1376년 여름). 입력263109바이트, SHA84c61a1e778654cf9812fe10dbcb6e461f26b184947e58387b6ee93dc1c8fd40. 기존 로컬 원본 압축 바이트와 manifest가 일치했다.
- 원래 결과h-020028@307200(1376년 겨울), 간격2141틱. 결과압축SHA35e6d3598a553bf55431f60e8a14f18bc6a7003f6b53b535d156843b72e2c739. because에는 h-019919/payment_flow/part:true 하나가 기록됐다. 이것이 유일한 실제 원인이라는 뜻은 아니다. 새 브라우저 no-bot 진행의 같은 결과ID·시간을 보장하지 않는다.
- 엔진2485af40046793f1856829fa1161dc4431942aa7 ↔ 기대표 원본a5776a8e0f18dc5d1f989cdf0a3f037460b40825에서024 전체 정본 AST가 같다. townAgency.ts, townAgencyDues.ts, decisionTrace.ts, decisionFlowConfig.ts도 전체 바이트 동일하다.
- lower는 set_market_dues(permille750), 대상state.agency.duesPermille. agency존재·현재750아님 재검사. 사건조건은1300~1450년 봄/여름, 인구≥1·세율750초과2000이하·가동시장≥1·시장수입권 활성이다. 즉시 현금 보상이 아니라 지속 세율 변화이며 뒤 payment_flow는 거래/수입 발생 조건에 달린다.
- 기대표의 즉시 상태효과·직접 주원인 요구와 역사판 part:true 미래영수증은 구분한다. 이 저장은 이미 답한 직후이므로 응답 직전 값이나 모든선택 실행을 증명하지 않는다. 이번 한 사례는 동일답 이후 실제 결과/원인 왕복만 잰다.

scripts/engineBLiveTarget024.json으로 기존 하네스/제품c5d2b35 가드를 그대로 쓴다. 복구된 기존 Chromium1234·core1.62.1과 정상 슬롯만 사용한다. 새로운 정보성 결산 처리도 기존 정상Continue/전체presentationSHA불변/모달분류 검사를 유지한다. 자동표시 미달은 별도 보존하며 LS1-4 착륙56사건 대조로 승격하지 않는다.

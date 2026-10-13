# 024/lower: 실제 답 → 결과 → 원인 왕복

**수동 한 사례 통과. 자동 표시·전체 valid는 false, 종료1 보존.** 현재 본선/LS1-4 칩이나56사건 전수 통과가 아니다. [입력·계약 준비](../screen-024-preparation.md).

- 실행 engineB-live-024-f57723c, 도구f57723cb618e5eff3a24f5e29b65003f1ea3369c. 원본 엔진2485af4·제품c5d2b35, seed1/lower 입력h-019919@305059·SHA84c61a1e778654cf9812fe10dbcb6e461f26b184947e58387b6ee93dc1c8fd40 고정.
- 정상10배속에서 결과h-020028@307200를 관측했다. because h-019919/payment_flow/part:true를 유지하며 유일 원인으로 확대하지 않는다. 이미 답한 저장 이후 재생이므로 답 직전 상태값이나 모든 선택을 검증한 것은 아니다.
-306001 정보성 결산의 정상Continue 전후 전체presentation SHA670741793e31d853ece5203ac7abdb7e11640ea291e56b68bbec04d65f882149가 같았다. 최초 결과 뒤307201 정지, 전후tick동일·모달0. 실질 결정을 임의로 답하거나 닫지 않았다.
- 실제 연대기 h-019919→h-020028→h-019919 왕복, manual.verified=true. KeyC 전후·답·결과·복귀·최종6개 전체presentation JSON SHA: `272e99e6c1b247bb808d35d8029c511323f57c523b7343a294140a89f62e403d`. proof presentation 동일성이지 원시 store 증명은 아니다.
- DGX 집중시험13/13·별도스크롤fixture2/2. 기존1e758c99b의 ledger-red ERR_ASSERTION 실패를 보존했다. 준비11.7초·공식 슬롯 대기2867.2초·명령104.7초. 대기 중 중복제출/빈 gate슬롯 우회가 없었다.
- runtime/cleanup errors0, [정리 증거](cleanup.json): unit inactive/dead·Vite PID803819 없음·run-CWD 프로세스0·4302리스너 없음. B 실행 종료.

[답](../replay-captures/engineB-live-024-f57723c/eb-live-speed/manual-answer.png) · [결과](../replay-captures/engineB-live-024-f57723c/eb-live-speed/manual-receipt.png) · [원인 복귀](../replay-captures/engineB-live-024-f57723c/eb-live-speed/manual-return.png)

[provenance.json.gz](provenance.json.gz)는49파일 원문 크기/SHA와 보관 경로/압축SHA다. PNG 무변환·JSON/로그 무손실gzip, 동일fixture4개는005기존파일을 참조한다. 입력·화면·처리 증거를 새로 만들거나 실패 판정을 바꾸지 않는다. 자동false는 LS1-4 착륙 후 대조와 별개로 남긴다. 화면/src 수정 없음.

부모의 실제3PNG 검토: 좌판세750‰ 답 → 첫수입2s3d 영수증 → 동일답 복귀를 확인했다. ‘여러 까닭’/‘한몫해’ 표현으로 부분 원인을 구분한다. 화면의 옛 ‘배율을750‰’ 문구는 고정 역사판 문구이며 다른 가지에서 이미 고친 문제다. 현재판 회귀로 세거나 UI수정을 다시 열지 않는다.

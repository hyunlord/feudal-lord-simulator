# 009/c: 실제 답 → 결과 → 원인 왕복

**수동 한 사례 통과. 자동 표시·전체 valid는 false, 종료1 보존.** 현재 본선/LS1-4 칩이나56사건 전수 통과가 아니다.

- 실행 engineB-live-009-ledger-1fc47b1, 도구1fc47b1f7ab61e6472ce73454abd11e0862f214e. 원본 엔진2485af4·제품c5d2b35, 입력h-006591@101011/c·SHA86f9ef14661b241b2383a8fda7da4d9459a4b143d306ffdd2a5003d21a3734d4 고정.
- 정상10배속에서 결과h-006647@102000를 관측했다. because h-006523/suit_turned와 h-006591/suit_turned/part:true가 함께 있다. 주원인을 하나로 덮지 않았다.
-102001 정보성 결산의 기존 식별 검사를 통과한 정상 Continue 후 정지했다. Continue 전후 전체presentation SHA가 같고, 다른 모달0·정지 전후tick102001이다. 알려지지 않은/실질 결정 모달은 닫지 않는다.
- 실제 연대기 h-006591→h-006647→h-006591 왕복, manual.verified=true. 부모가 아래3PNG를 직접 확인했다: 법정 장부 등본20d 선택·소송 증거 단계 결과·원답 복귀. 답은 ‘여러 까닭 가운데 하나’, 결과는 주원인 ‘소송을 걸었다’와 ‘당신 결정도 한몫해’ 등본 답을 구분한다.
- KeyC 전후·답·결과·복귀·최종6개 전체presentation JSON SHA: `0d9a3ffa679760c44f4a39f697c8c47c8cac98fd56e67f03d55c9e94d55fd364`. proof presentation 바이트 동일성이며 원시 store 증명은 아니다.
- DGX 집중시험13/13·스크롤fixture2/2. ledger-red는 기존1e758c99b의 실제함수에서 기대undefined/실제h-receipt인 ERR_ASSERTION(1pass/1fail) 후 수정판green이다. 예전 export부재red 둘과 구분한다. 준비10.9초·대기2.0초·명령56.9초.
- runtime/cleanup errors0, unit inactive/dead·Vite PID2948836 없음·run-CWD 프로세스0·4302리스너 없음. B 실행은 종료됐다.

[답](../replay-captures/engineB-live-009-ledger-1fc47b1/eb-live-speed/manual-answer.png) · [결과](../replay-captures/engineB-live-009-ledger-1fc47b1/eb-live-speed/manual-receipt.png) · [원인 복귀](../replay-captures/engineB-live-009-ledger-1fc47b1/eb-live-speed/manual-return.png)

[provenance.json.gz](provenance.json.gz)는45파일의 원문 크기/SHA와 보관 경로/압축SHA를 보존한다. PNG 무변환·JSON/로그 무손실gzip. 동일fixture4개는005기존파일을 참조한다. [최초 결산 모달 실패와 브라우저 복구](../live-009-ledger-blocked/README.md)는 별도 보존한다. 자동false를 수동성공으로 합산하지 않는다. UI/src 변경 없음, LS1-4 착륙 후56사건 칩 포함 여부는 별도 관문이다.

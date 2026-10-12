# 009/c: 계절 결산이 열린 수동 탐색 실패

관문 미달을 보존한다. engineB-live-009-restored-1e758c9(도구1e758c99b, 엔진2485af4, 제품c5d2b35)는 정확한 h-006591/c 답의 결과 h-006647@102000를 재현했다. because에는 h-006523와 h-006591/part:true가 함께 있다. 주원인 하나로 축약하지 않는다.

최초 결과에서102001에 정지했지만 계절 결산이 열린 채 KeyC를 눌러 연대기가 열리지 않았다. 수동false·자동false·validfalse, 종료1. 이는 trace 부재가 아니다. 정상 정보성 Continue 처리보다 수동 정지가 앞서는 하네스 순서가 원인이다. 중대 결정을 답하거나 닫지 않았다. DGX 시험12/12, runtime/cleanup errors0. unit inactive/dead, Vite2929729 없음, run-CWD 프로세스0, port4300 없음 확인.

앞선 engineB-live-009-1e758c9는 사라진 Chromium 때문에0.0초에 종료1, 시험/브라우저 시작 전 실패했다. 공식 experiment 슬롯의 engineB-browser-restore-1e758c9가 기존 setup-dgx.sh의 브라우저 설치 부분만 실행해 Node24.21·core1.62.1/Chromium1234를 복원했고17.7초 종료0했다. 최초 restore 업로드 중 보관 편집으로 rsync stat 오류23이 났지만 실행 unit가 생기기 전이었다. 편집을 되돌려 깨끗한 동일HEAD로 다시 제출했으며 이후 업로드 중 편집하지 않았다. 판정 자료를 삭제하거나 이 실패들을 성공으로 바꾸지 않는다.

[provenance.json.gz](provenance.json.gz)는 세 실행49파일의 원래 크기/SHA와 압축/보관 SHA를 기록한다. PNG는 원본이고 JSON·로그는 무손실gzip이다. 실제presentation/게임화면은 기존 replay-captures 분류에 두며 크기검사 예외를 추가하지 않았다. 파일 SHA 검증만 Mac에서 수행했다.

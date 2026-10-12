# 206/a: 역사판 수동 답→결과→원인 왕복

**수동 한 사례 통과. 자동 표시·전체 valid는 false, 종료1 유지.** 현재 본선/common answerEffects 통합이나56사건 전수 통과가 아니다. [준비 계약](../screen-206-preparation.md), [005 이전 사례](../live-manual-visible/README.md).

- 실행 `engineB-live-206-a79e069`; 도구 `a79e069d08bb42fe2a4b020ec40c053fce6a5bc7`, 엔진2485af4·제품c5d2b35 고정.
- 정확206/a 답 `h-020520@314029` 입력으로 정상10배속 진행. `h-020521@314080`, because `h-020520/goods_delivered` 관측 후 정상 Pause. 전후tick314080·모달0.
- 실제 연대기에서 주문10단 답→목재2단 들어옴→원인 답 복귀. manual.verified=true; automaticVisible/automaticThreadVisible=false. 이후 자동 전달은 이 조기 정지 사례로 판정하지 않는다.
- KeyC 전후·답·결과·복귀·최종6개 전체 presentation 바이트 SHA 동일: `e9447b34cd09aa8ecd94ac0f88c1b16edf3d757aa6ab5dc2f4d143696cea1987`. 원시 browser store 증명은 아니다.
- DGX 시험12/12, 독립 스크롤 fixture2/2. baseline red 둘은 새 export 부재 확인이며 브라우저 회귀 재현이 아니다. 준비15.7초·대기2.1초·명령58.4초. runtime/cleanup errors0; unit inactive/dead, Vite PID783655 없음·run-CWD0·port4300 리스너 없음.

[답](../replay-captures/engineB-live-206-a79e069/eb-live-speed/manual-answer.png) · [결과](../replay-captures/engineB-live-206-a79e069/eb-live-speed/manual-receipt.png) · [원인 복귀](../replay-captures/engineB-live-206-a79e069/eb-live-speed/manual-return.png)

원문 [manifest](originals/eb-live-speed/manifest.json.gz) 복원 SHA `49965f861379ebbcdf52e1481eb9747584e94ab29cdf81a33f50144b7b8d8c93`. [provenance](provenance.json.gz)의37항목에 원래 크기/SHA·보관 경로/압축 SHA가 있다. fixture PNG4개는 기존005와 원본 바이트가 같아 그 추적 파일을 참조한다. 이전 실패 provenance5개도 무손실gzip으로 옮겼으며 압축 전=복원SHA를 함께 기록했다. 원문 내용 손실·다운샘플·크기 예외 변경은 없다. `SHA256SUMS.gz`는 이 보관본 해시 목록이다.

공식 명령은 `scripts/remote/run.sh engineB-live-206 --heavy --experiment --detach --keep -- env EB_BROWSER_REVISION=a79e069d08bb42fe2a4b020ec40c053fce6a5bc7 EB_LIVE_TARGET_SPEC=scripts/engineBLiveTarget206.json EB_MANUAL_ON_RECEIPT=1 bash scripts/engineBLiveSpeedManualRun.sh`였다. 새 실행을 추가하지 않았다.

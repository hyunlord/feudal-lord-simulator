# Engine B — 최종 가드레일 대조

DGX `engineB-final-guardrail-f9f9c48`, 소스 `f9f9c48f`, 공식 `scripts/remote/tasks.sh guardrail --seeds 1,2,3,4,5`. 실험 줄에서 실행했으며 관문 칸으로 우회하지 않았다. 명령 2147.1초, 대기 745.7초, 종료 0.

| seed | 종료 tick | 승리 tick | 성장 판정 | 기준선 끝 상태 SHA-256 |
|---|---:|---:|---|---|
|1|372667|100686|passed|동일|
|2|281540|91698|passed|동일|
|3|299186|87860|passed|동일|
|4|281572|97962|passed|동일|
|5|599642|128941|passed|동일|

기준선은 본선 DUES-REL 보고서가 사용한 `seeds/baseline-11205c9.json`이다. Mac에서 공식 `scripts/finalStateHashCompare.ts`로 내려받은 다섯 `final-state.json`의 실제 바이트를 해시 계산했다. `final-state-comparison.json`의 `passed: true`, 다섯 `identical: true`를 확인했다. 기준선은 수정하지 않았다. 5/5 동일하므로 두 번째 가드레일을 생략한다.

같은 DGX 실행의 `tests/humanPath*.test.ts`는 12/12 통과, 실패·취소·건너뜀 0건이다. `human-path.txt`는 실제 명령 경로 시험의 원본이다. 이 결과는 별도 캠페인 전체 상태 해시가 같다는 증거가 아니다. 성장 끝 상태 해시 대조와 캠페인 명령 경로 회귀를 구분한다.

원격 원본은 `_kept/engineB-final-guardrail-f9f9c48/.remote/guardrail/`, 로컬 사본은 네 번째 작업트리의 `.remote-runs/engineB-final-guardrail-f9f9c48/guardrail/`에 남겼다. 보고서에는 큰 끝 상태 파일 대신 전체 SHA와 관측값을 보관한다.

이 가드레일은 등록기 사건이 충분히 자주 나타난다거나 사람이 재미있다고 느낀다는 검증이 아니다. 20년 관측의 중대결정 없는 해와 최종125년 관측은 별도 보고한다. P-M1은 없는 상태를 만들지 않고 기존 세계 사실만 읽는 것으로 지켰으며, 원래 지시서의 빈 해0 달성은 주장하지 않는다. 현재 정본 v0.3의 P-T1은 조용한 해를 허용하며 그 해의 변화·결과 표시를 함께 요구한다. 따라서 빈 해 수만으로 현재 원칙의 실패나 통과를 판정하지 않으며 최종 GP7 관측표로 함께 보고한다.

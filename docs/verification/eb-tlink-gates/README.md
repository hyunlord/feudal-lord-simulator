# EB-TLINK 변경 영향 시험 — 소스별 기록

최신 변경 영향 시험은 `engineB-tlink-audit-changed-23d1226`, clean source `23d12264289538de5f6ef3ef3f36aa9257b10aba`, Git tree `5a85395a59d6526e8ecc2a551e68d2b840c42ffb`다. 공식 exit **0**, command **1769.1초**. 선택 **619파일 = 실행401 + 재사용218**이며 두 집합에 중복이 없다. 실행 시험은 **3464개:3451통과·0실패·13skip**, cancelled/todo0이다. 재사용218은9ad의152파일과0b04의66파일이며 원본 RR25 판정과 출처를 보존했다. 재사용 시험 수를 총 시험 수에 임의로 더하지 않았다.

[23d 결과·출처](changed-result-23d1226.json), [정확한 원본 gzip](test-changed-23d1226.json.gz). source/tree, 원본·gzip 복원 SHA, 실행 로그 합계와 공식 영수증 SHA, 해당 commit의 selector/runner/lock 바이트 SHA를 확인했다. 원본 영수증은 `.remote-runs/engineB-tlink-audit-changed-23d1226/`에 있으며 재수집은 `scripts/remote/run.sh --fetch engineB-tlink-audit-changed-23d1226`이다. **23d 기록의 통과이며 이후 문서 변경까지 자동 적용되지 않는다. 기하·125년80%·native 동일성·전체 목표 완료는 별도다.**

이전 9ad 보관은 `engineB-tlink-final-changed-9ad9253`, clean source `9ad9253468592e7cba144946081d2fbced36adca`, 전체 tree `f36378c83325d6b411f5ae7f6445135e8af19379`다. 기록 tree를 해당 commit의 실제 Git tree와 대조했다. 공식 실행 exit0, command1947.2초다.

| 범위 | 결과 |
|---|---|
| 선택 파일 | 619 |
| 실제 실행 | 553파일·4425시험:4412통과·0실패·13skip |
| 재사용 | 66파일 — 기존0b04 측정 입력과 이후 변경 파일의 겹침 없음(RR25) |

[결과·출처](changed-result-9ad9253.json), [원본 전체 기록 gzip](test-changed-9ad9253.json.gz)을 보존했다. 원본의 picked·reused·inputs를 생략하지 않았다. 실행553과 재사용66은 중복 없이619개이며,4425는 **실행 시험 수**다. 재사용 시험 수를 더한 전체 개별 시험 수로 바꾸지 않는다. 각 재사용 파일·기존 tree/commit/run·시각·changedSince90·판정 이유는 원본과 결과 JSON에 있다. runtime은 Node24.21.0/aarch64, lock 기반 cache pin은 실행 로그에서 확인했다.

기존 [0b04 결과](changed-result.json)와 [원본](test-changed-0b04cd0.json.gz)은 그대로 유지했다. 이번 기록은9ad 전체 tree에 적용되며 후속 문서·증거 변경이 저장소 읽기 시험에 영향을 주는지는 최종 `check:merge`/`test:changed`에서 다시 판정해야 한다. **기하·125년 연결률·native 해시·전체 목표 완료를 증명하지 않는다.**

원본은 `.remote-runs/engineB-tlink-final-changed-9ad9253/` 및 공식 kept 실행에 보존한다. 재수집 명령은 `scripts/remote/run.sh --fetch engineB-tlink-final-changed-9ad9253`이며 여기서는 원격 작업을 수행하지 않았다. 압축 전후 SHA는 결과 JSON, 보관 파일 SHA는 `SHA256SUMS`에 있다. gzip 복원 byte 일치·source/tree·실행/재사용 집합·종료 코드·로그 시험 합계를 검사했다.


기존 9ad 기하 실행 `engineB-tlink-final-geometry-9ad9253`도 깨끗한9ad에서 통과했다. [공식 보고서](../uiaudit1/geometry/engineB-tlink-final-geometry-9ad9253/geometry.json): 기존27행·같은5화면×2문구×2수치의540조건, 실패0·미개방0·경고96, command3293.9초.056 초기 미개방3조건은 공식 재시도에서 통과했으며 원래3개 캡처를 보존했다. 축을 좁히지 않았고 예외를 추가하지 않았다. 이 축에390px는 없으므로 별도 관계 브라우저의 오른쪽 잘림을 해결했다는 뜻은 아니다.

최신23d 기하는 `engineB-tlink-audit-geometry-23d1226`, clean source23d1226에서 command3488.1초·exit0으로 완료했다. [공식 결과](../uiaudit1/geometry/engineB-tlink-audit-geometry-23d1226/geometry.json): 같은27행·5화면×2문구×2수치의540조건, 실패0·미개방0·경고96이다. 원래 캡처3개를 보존했다. 390px는 이 감사 축에 없으므로 별도 수동 브라우저의 오른쪽 잘림은 미해결이다.

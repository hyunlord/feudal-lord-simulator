# 증빙 읽는 순서

1. `REPORT.md`: 최종 요약. 평가 코드0725764, 마지막 문서 커밋 검증은 ZIP의 `FINAL_VERIFICATION.json`.
2. `guardrails-final.json`: 동일 코드의 새 게임5개, 25분 이내5/5. `scenario-matrix.json`, `review-scenarios-final.md`: 17개 시나리오 실제 PASS 대조.
3. `search-replay.json`, `search-execution.json`: 최종69입력과 평가 커밋. `sourceCommit`은 입력 출처, `evaluatedCommit`은 실행 코드다.
4. `before/`는 S0 원본 탐침, `after/`는0725764 재실행. 선택한7결함 외 원본의 다른 관찰은 해결 주장 대상이 아니다.
5. `ui-final/`는0725764 실제 제품의 준비 상태 UI. `ui/`는 초기 개발 중 비교 증거로 최종 판정에 쓰지 않는다.

나머지 `review-*`, `security-review-d417370.md`, `guardrails-403cfa9.json`, `guardrails-a215dab-timeout.json`, `history/`와 개별 성능·반례 JSON은 명시된 이전 수정 단계의 기록이다. 당시 FAIL/PENDING을 삭제하지 않았으며 최종 판정으로 이월하지 않는다. 별도 파생도시의 미해결 품절은 `distribution-residual-review.md`에 남긴다.

최종 원시 상태는 `/tmp/fls-r1fix-20260924/guardrails-0725764/seed-{1..5}/final-state.json`에 보존했고 `guardrails-final.json`에 SHA256을 기록했다. 대형 원시 상태와 소스 스냅샷은3MB 증빙 제한상 ZIP에 포함하지 않는다. 재현용 fixture와 모든 소스는 Git 커밋으로 전달한다.

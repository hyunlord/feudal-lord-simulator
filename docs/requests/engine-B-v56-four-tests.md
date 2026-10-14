# v56 TRACE-LINK 시험 4건 판정

**소스 판정: 4건 모두 검토 고정값 갱신 누락. 기대 동작 변경이나 answerEffects 통합 회귀로 판정할 근거 없음. DGX 재현 시험은 INERT 종료 뒤 수행 예정이며 아직 PASS로 보고하지 않는다.**

엔진 입력 `claude/v56` = `f42b0a0fa8ab843b5152aca2a2dbe73edb8d1f5c`.
검토·갱신 커밋 `d4c924986f1755c398ec30e643a3864e358ad233`은 이미 INERT 실행 `engineB-V56-inert-d4c9249`에 적용돼 있다.

| 실패 시험 | 원인과 판정 |
| --- | --- |
| tests/engineBTlinkOutcomeEvidence.test.ts:148 — INERT reviewed source profile matches every current reviewed actuator before a measurement run | 153–154행의 실제 SHA 대조가 통합에서 바뀐 6개 파일의 옛 핀을 거부한다. 검토 후 고정값 갱신이 맞다. 시험 assert는 유지한다. |
| tests/engineBTlinkResiduals.test.ts:74 — actual phase decision enters supplemental denominator without becoming a future receipt | fixture의 현재 history SHA가 승인 목록의 옛 SHA와 달라 phaseAnswers가 비어 있다. 선포를 보충 분모에 넣되 같은 틱 결과를 미래 연결로 세지 않는 기대값은 그대로 맞다. |
| tests/engineBTlinkResiduals.test.ts:103 — both phase commands require their exact history identity and compatible producer | 위와 같은 핀 불일치 때문에 stone phase도 미분류로 남는다. 정확한 선포 신원·검토 소스를 요구하는 기대값은 유지한다. |
| tests/engineBTlinkResiduals.test.ts:114 — reviewed baseline phase history works without prototype receipt sources; supplemental status remains explicit | 앞부분의 고정 baseline fixture가 아니라 120행의 현재 소스 censored fixture부터 같은 불일치가 생긴다. 관측 부족 기대값은 유지한다. |

## 인과 경로

1. Residuals fixture(30행)는 현재 `history.ts` 바이트로 SHA를 만든다.
2. `scripts/engineBTlinkResiduals.mjs:15`의 PHASE_HISTORY_SOURCES는 INERT 검토 목록의 history 핀을 가져온다.
3. `auditTlinkResiduals` 179행의 `phaseSource` 조회가 실패한다. 193–195행은 안전하게 unresolved로 남긴다.
4. 시험이 `phaseAnswers[0]`을 읽을 때 기대 항목이 없다. history 핀 `f198e59c…`를 검토한 실제 통합 SHA `519e9c46708071e88b4f9e9319af52fcc7dc7cac48a43b5baa1f05c4d70e4449`로 갱신하면 이 불일치가 사라진다.

## 갱신이 정당한 이유

- `f1d882f80 → f42b0a0fa`에서 history의 phase 명령 매핑(97행)과 `decision.${kind}` 생성(288–315행)은 바뀌지 않았다. 달라진 부분은 PLAY-2 가족 정보와 GB-4 공사 포기 기록이다.
- `decisionTraceAnswers.ts`의 실제 차이는 74행 주석이다. answerEffects 구현·실제 효과 캡처·undefined/[] 구분은 B 검토본과 같다.
- `decisionTrace.ts:196`의 추가 분기는 기존 선포/공사 우선순위 history decision ID를 영수증에 보존하며 weights=[]다. 새 원인이나 효과를 발명하는 변경이 아니다.
- 두 시험 파일과 `engineBTlinkResiduals.mjs`, `engineBTlinkOutcomeEvidence.mjs`는 B 검토본과 통합본 사이에 변경이 없다. 시험 기대값을 완화할 필요가 없다.
- 6개 핀의 상세 검토·전후 해시는 `engine-B-v56-measurement.md`와 `docs/verification/eb-inert-v56/reviewed-pins.json`에 있다.

## 실행 검증과 인계

INERT의 고정 실행은 수정·취소하지 않는다. 현재 채점기 9/9 시험, seed 1·2의 125년 원본/재생 완료를 확인했다. seed 3 및 최종 관문은 아직 진행 중이다.

추가 검증은 같은 두 시험 파일을 DGX에서 옛 프로필→검토 프로필 순서로 실행한다(`docs/verification/eb-inert-v56/four-tests.sh`). 처리 변수는 프로필 파일 하나뿐이며 시험 assert·픽스처·게임 코드는 바꾸지 않는다. 옛 프로필에서 위 네 이름만 실패하고 검토 프로필에서 실패 0이어야 판정을 실행으로 확정한다. 종료 때 프로필을 복원하고 깨끗한 checkout도 검사한다.

엔진에 넘길 것은 기존 `d4c924986`의 검토 핀 갱신이다. 이 4건을 이유로 제품 함수나 기대 결과를 고치지 않는다. 본선 푸시는 엔진이 한다.

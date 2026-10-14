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

추가 검증은 같은 두 시험 파일을 DGX에서 통합 당시 두 검토 목록→INERT 핀만 갱신→독립 국면 목록도 갱신 순서로 실행한다(`docs/verification/eb-inert-v56/four-tests.sh`). 시험 assert·픽스처·게임 코드는 바꾸지 않는다. 통합 당시 위 네 이름만 실패하고 이후 두 경우 모두 실패 0이어야 판정을 실행으로 확정한다. 종료 때 두 도구 파일을 복원하고 깨끗한 checkout도 검사한다.

엔진에 넘길 것은 기존 `d4c924986`의 검토 핀 갱신과 아래 독립 국면 목록이다. 이 4건을 이유로 제품 함수나 기대 결과를 고치지 않는다. 본선 푸시는 엔진이 한다.

## 추가 판정: TRACE-LINK 단독 병합과 별도 국면 핀 검토

사용자 제공 실행 증거: 원래 TRACE-LINK는 13/13 통과했고, 본선 위에 TRACE-LINK만 합친 `c41e89227`에서 이미 Residuals 세 건이 실패했다. 이 수치는 사용자 전달 증거이며 B가 재실행한 수치로 표시하지 않는다.

- `07c5943b8 → c41e89227`의 history 전체 diff는 PLAY-2 가족 정보와 GB-4 공사 포기 기록뿐이다. 선포의 command 매핑·decision template·decisionKind 생성은 그대로다. history SHA `e97b379f83fd5b93195522afb8234bfc26db5b959414b603ba56f0d78135e95d`를 별도로 검토 승인한다.
- `c41e89227 → f42b0a0fa`의 history 변화는 INERT의 실제 계절 손실 수치, 청지기 선례 처리, 감사의 상시 방침 보고다. 선포 생산 분기는 그대로다. 통합 history SHA `519e9c46…`도 국면 분류용으로 별도 승인한다.
- `scripts/engineBTlinkResiduals.mjs`의 PHASE_HISTORY_SOURCES를 INERT 현재 핀에서 가져오는 방식 대신, 검토된 각 revision/SHA의 명시적 목록으로 바꾼다. 기존 64a16·f527 및 INERT `f198e59c…`를 보존하고 c41·f42 둘을 추가한다. INERT 핀 갱신 때문에 과거 승인 history가 목록에서 사라지지 않는다. 미검토 해시는 계속 거부한다.
- timberTrade의 `c41e89227`와 `f42b0a0fa`는 바이트까지 같으며 SHA는 `6389e719c18fe8f3840985e78e292e5f6eb6341f573f9f1a7951f7e2f2a5f67d`다. 이전판 대비 실제로 바뀐 것은 `charterTimberOrder`의 영주 모드 느린 생산 주문 조건(GB-8/2a⑤)이며 승인된 본선 변경이다. `timberOrder`를 실제 명령 상태로 읽는 TRACE-LINK 의미는 바뀌지 않았다. 통합 실수는 발견하지 않았다.
- 실패한 OutcomeEvidence 시험은 이름 그대로 공유 INERT 20개 목록을 import해서 실제 파일을 검사한다. timberTrade 핀은 이미 `d4c924986`에서 갱신했다. `TLINK_REVIEWED_EFFECT_SOURCES`의 옛 12개 프로필은 과거 아카이브용이므로 거기에 현재 파일 일부만 섞어 가상의 혼합 판을 만들지 않는다. 현 통합 판은 검토된 20개 프로필로 검증된다.

INERT의 실행 소스 `d4c924986`는 그대로 유지한다. 추가 국면 목록은 125년 채점 경로에서 쓰이지 않는 별도 residual 감사 도구이므로 진행 중 판에 소스를 바꾸거나 재측정을 요구하지 않는다.

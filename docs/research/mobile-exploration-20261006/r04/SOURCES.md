# 근거와 파일 위치

이 회차의 수치·캡처는 직접 만든 단순화 모형을 로컬 Node/Chrome에서 실행한 실험 자료다. 외부 시장 수치·역사적 수치·원 PC 성능을 이 리그의 결과로 바꾸지 않는다. 시장 근거는 R01, 컨셉·판정 계약은 R02, 실제 PC 엔진·플랫폼 문헌·서버 비용은 R03 ZIP이 정본이다.

| 근거 | 이 ZIP 위치 | 성격 |
|---|---|---|
| 같은 경제·계약·공간전투 | prototype/model/, prototype/league/game.ts | 작성한 단순화 모델 |
| 사전 검증 기준 | evidence/VALIDATION_CONTRACT.md | 결과 전 설계 |
| 평가 동결 | evidence/R04_EVALUATION_FREEZE.md | 소스 해시·표본 고정 |
| 실제 브라우저 검수 | evidence/R04_UI_FINAL.md, ui-*.json, captures/ | Chrome 관찰, 실기기/인간 연구 아님 |
| 독립 AI 첫 플레이 | evidence/R04_FIRST_PLAY.md | 원문 의견, 인간 잔존 근거 아님 |
| 원장·계약·전투 시험 | prototype/tests/, evidence/R04_TESTS_FINAL.txt | 정해진 불변식·경계 시험 |
| 리그 전체 승무패·검증 | league-analysis/ | 관측된 모형 결과 |
| 별도 성장·도전자·외교·공간 | supplement-analysis/ | 통제/탐색 결과 |
| 경량 경기 원자료 | league-analysis/*-outcomes.ndjson.gz | 모든 기본리그 경기의 점수 재계산용 상태 |
| 고정 원자료의 위치·재현 | REPRODUCE.md | 전체 깊은 원자료 로컬 보존·재실행 경계 |

`evidence/` 문서의 작성 당시 `records/...` 경로는 원 작업 폴더의 위치다. 이 ZIP에서는 위 표처럼 배치했다. 소스·규칙 ID가 다른 이전 smoke/성능 훈련 자료를 최종 평가 분모에 섞지 않았다. SHA256SUMS는 파일의 일치 확인이며 저자 인증서가 아니다.

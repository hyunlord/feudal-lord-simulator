# R1 원본 탐침 재실행

사용자 제공 R1 결과 ZIP의 탐침7개. 절대 import 경로만 저장소 상대 경로로 교체했다. 새 규칙 시나리오 assertions는 `tests/`의 R-T 테스트가 담당한다. 원본 탐침은 관측 출력을 그대로 남긴다. 원문·이식본 SHA는 manifest.json.

`node --import tsx fixtures/rule-repair-probes/<파일>.ts`

목재 확장 탐침은 마지막 인자 `120000`을 주고 외부 프로세스에서 실제25분 상한을 적용한다. 나머지는 수초 내 종료한다. 서비스 탐침 P2~P5 등 이번 범위 밖 관찰은 수정 완료 판정에 포함하지 않는다.

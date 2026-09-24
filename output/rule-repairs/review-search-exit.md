# 자동 성장 예산 소진 후 조기 종료 검토

판정: 차단할 구현 결함 없음. 읽기 전용 정적 검토와 제공 실행 증빙 확인만 했으며 무거운 테스트를 추가 실행하지 않았다.

- `findBuildSite`가 반환하는 후보는 종류와 관계없이 `preservesAutoplayServiceSpace`를 통과해야 한다. 이 함수는 이미 입구에서 `autoplaySearchExhausted()`면 false를 반환한다. 소진 후에는 캐시된 true도 읽기 전에 거부하므로 뒤쪽의 합법 후보가 기존 구현에서 허용되는 경우는 없다.
- `buildAction`의 도로 준비 후보 역시 같은 서비스 공간 검증을 필수로 거친다. 따라서 후보 스캔 시작 전·반복 중 NONE 반환은 기존의 전부 탈락 후 NONE과 같다. 기존에 찾은 non-null site는 조기 종료 검사보다 먼저 처리하므로 이미 확정한 후보를 버리지 않는다.
- 예산이 정확히 한도까지 사용됐지만 거부된 추가 연산이 아직 없는 상태는 exhausted가 false다. 단순히 used==limit인 이유로 후보를 조기에 탈락시키지 않는다.
- 새 검사는 context·계수·진단을 변경하지 않는다. 각 후속 우선순위는 `runAutoplaySearchPhase`가 별도 exhausted=false context를 생성하고 finally에서 부모를 복구한다. 이전 단계의 소진으로 이후 주택·서비스·시대 단계를 건너뛰지 않는다.
- 생략되는 공간 보전/벽 후보 함수는 세계 상태를 변경하지 않는다. 벽 후보 캐시는 결정론적 기하 결과이며 새 조기 종료가 캐시 결과를 변경하지 않는다. 새 캐시·스키마도 없다.
- 추가 테스트는 소진 후 타일 접근 303,730회였던 재현을 최대 다음 루프 항목 1회로 제한하고, 같은 상태의 action도 비교한다. 기존 독립 phase 예산 테스트가 후속 단계 회복을 별도로 보호한다.
- `git diff --check -- src/engine/autoplay.ts tests/autoplaySearchBudget.test.ts` 통과.

앞선 비축 최적화 검토의 증빙 보완: `reserve-tick-equivalence.json`에서 두 자연 상태 결과 파일의 full GameState 및 pathCache 동일, SHA-256 `4108424af85be8c2d965207a5d2a5963cd83670e912a945283a5ea9e49634031` 일치를 확인했다. 해당 한 fixture의 전체 상태 동일 주장은 입증됐으며 일반 모든 상태의 캐시 채움 동일성으로 확대하지 않는다.

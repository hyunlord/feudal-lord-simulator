# R9 시장·교회 공동 증명 우선 검토

판정: 지정한 17줄 source 변경에서 확정 blocker 없음. 읽기 전용 정적 검토이며 테스트를 실행하지 않았다.

- shortcut은 시장/교회 배치에만 적용된다. projected 공동 witness는 모든 기존 주택에 대해 최종 서비스 할당·수용량·도로 및 공급원 경로를 함께 검증하므로 각 집의 local positive witness를 대신할 수 있다. complete, non-null, !exhausted 세 조건이 모두 필요하다. 주택 추가/도로/선포의 기존 보호 경로는 바뀌지 않는다.
- projected complete null만으로 거절하지 않고 baseline의 complete positive가 있을 때만 조기 거절한다. 따라서 증명할 수 있던 공동 계획의 손실을 막는 기존 규칙과 같은 이유로 거절한다. 이미 불가능한 baseline이나 불완전한 proof는 기존 local-loss 경로로 떨어진다. 남은 예산이 소진되었다면 기존과 같이 fail closed한다.
- 기존 proof memo 비용 재청구와 incomplete 비저장 규칙을 그대로 사용한다. 캐시 이력에 따른 무과금 shortcut이나 unknown을 positive로 승격하는 경로는 없다. 다만 검사 순서가 바뀌므로 행동/진단/예산 소비가 이전 커밋과 동일하다고 주장하면 안 된다.
- 새 테스트 3개는 자연 564000 상태에서 실제 reducer에 적용되는 진행 행동 및 cold/warm 동등성, 192 phase 안에서 무효 3후보를 버리고 유효 후보까지 도달, 1-step budget에서 unknown 거절을 각각 다룬다. 마지막 검사는 무효화 경계 보호이며 공동 계획의 전역 최적성을 보장하는 검사는 아니다.

한계: 기존 joint search가 complete로 판정하는 의미 자체 및 legacy 보호의 다른 테스트들은 이번에 실행 검증하지 않았다. 새 테스트는 시장 자연 반례에 집중하며 교회와 legacy impossible 서비스 배치의 별도 신규 fixture는 없다. 양쪽은 같은 source branch를 쓰고 fallback 규칙이 남아 있으므로 이 사실만으로 blocker로 보지는 않는다. 전체 회귀 및 가드레일은 root 실행 증빙이 필요하다.

# R9 성문 후보 인접 목록 재사용 검토

판정: 96b463a의 지정 변경에서 확정 blocker 없음. 정적 검토이며 테스트는 재실행하지 않았다.

- potential의 road/bridge topology는 후보 평가 중 불변이다. canTraverseRoadBoundary(potential)로 얻은 네 방향 이웃은 bridge 제한을 이미 포함한다. 후보별 차이는 성벽 개구부뿐이므로 추가 gate 상태의 canTraverseWallBoundary 재검사로 기존 전체 BFS와 같은 edge를 통과한다.
- 최초 열린 edge는 추가 성문으로 막히지 않는다. initial open만 재사용하고 막혔던 edge는 각 후보 상태로 다시 검사한다. 시작점의 건물 접근 및 자기 칸 통행 검사도 유지한다.
- BFS 이웃 순서·방문 처리 및 후보 정렬(connects, component size, y, x)을 보존한다. 최초부터 외곽에 도달한 경우의 조기 반환도 기존 while 미진입 결과와 같다.
- 인접 목록은 함수 한 번에만 존재하고 persistent cache나 저장 스키마 변경이 없다. 11개 기존 BFS golden 입력과 선택된 성문 재검사는 회전/역순/대각/다리/자연 상태를 포함한다. 배열 filter 계수 테스트는 구현 비용 검사이며 독립적인 기하 검증으로 과장하지 않는다.

보완 의무 없음. 전체 실행 동등성/속도 수치는 별도 before/after 측정 산출물 범위로만 보고할 것.

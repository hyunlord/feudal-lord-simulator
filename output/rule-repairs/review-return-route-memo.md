# 도로→건물 외부 메모 검토

판정: **정적 검토 PASS — 차단 결함 없음. 최종 실행 검증은 별도 관문.**

범위: `src/engine/routing.ts:295–330`의 외부 메모와 `tests/routingRoadBuildingCache.test.ts` 8개 테스트. 최종 receipt 갱신 시 확인 HEAD는 커밋 `b7764e9b8e0ad69242fccdc15908e91fc0c77394`다. 제품 파일 수정, 테스트·시뮬레이션 실행, 재귀 위임은 하지 않았다. 동시 작업인 autoplayFood 변경은 검토 범위 밖이다.

| 검토 항목 | 근거 및 판단 |
|---|---|
| 실제 검색 입력 | `routing.ts:103` 접근면 계산은 건물 tx/ty와 실제 footprint, grid에만 의존한다. `roadGraph.ts:111` BFS는 시작/끝 좌표, width/height로 해석하는 tiles와 `canTraverseRoadBoundary`에 의존한다. tiles 참조 + dimensions/revision + 완공 성벽/성문 서명 + 시작 좌표/목적지 kind/좌표/footprint가 이 입력을 포괄한다. 건물 id는 보수적인 추가 구분이다. |
| 도로·다리·점유 | `bridges.ts`의 hasRoad/terrain/buildingId 및 양쪽 bank 검사는 tiles에 속한다. 제품의 도로 설치·철거·건물 철거·합필은 새 tiles 배열을 만든다(`gameActions.ts`, `roadPlacement.ts`, `houseDemolition.ts`, `houseMerge.ts:104`). tiles와 Tile 속성도 readonly다. 동일 배열의 in-place mutation은 지원 전제가 아니다. |
| 성벽·성문 | `roadTopologySignature.ts:10–17`은 완공 edge와 main/additional gate를 포함하며 미완공 edge는 실제 traversal처럼 제외한다. 물리적으로 같은 완공 edge 집합의 순서·중복은 경로 결과에 영향이 없다. wall 객체 역시 불변 변경 전제이며 기존 traversal/signature WeakMap과 동일하다. revision 증가가 없어도 새 wall의 실질 topology 변경은 무효화한다. |
| 요청 순서 | miss는 기존 정렬된 접근면과 동일 BFS를 호출한다(`routing.ts:198–217,322–323`). 동률의 기존 선착순 선택은 그대로다. 각 요청 key는 독립적이고 eviction은 재계산만 유발한다. 기존 building-pair canonical cache와 다르므로 역방향 canonicalization을 새로 하지 않는다. |
| null 캐시 | `Map.get`의 undefined만 miss로 취급하므로 null도 hit다(`routing.ts:320–321`). 성공/실패에 같은 graph invalidation이 적용된다. key가 다른 destination/start의 음성 결과는 섞이지 않는다. |
| 소비자 mutation | 반환 배열은 공유되지만 readonly다. `simulationPorts.ts:162–191`의 운송/배급 경로 소비자는 읽거나 walker에 저장한다. `movement.ts:47–104`는 새 이동 상태를 반환하고 path 배열/좌표를 변경하지 않는다. `deliveryCommon.ts:252`는 slice 후 reverse하며 합성도 새 배열이다. `distributorAccess.ts:42`는 길이만 읽는다. 현재 제품에서 cache를 오염시키는 소비자 mutation을 찾지 못했다. |
| 범위·직렬화 | 최대 2048은 **살아 있는 tiles 배열별 현재 graph 해석의 요청 수**이며 전역 2048 또는 bytes 상한은 아니다. 같은 tiles에서 graphKey가 달라지면 교체, 초과 시 FIFO 하나 삭제, tiles 자체는 WeakMap key다. GameState 및 기존 serialized pathCache를 쓰지 않으므로 schema/fingerprint 변경이 필요 없다. |

테스트 소스는 exact path/state 유지(28), immutable road/bridge/null(38), 완공/main/aux gate(53), destination/grid/revision(67), 실제로 더 짧아지는 merged/kind 경로(82), 역순 요청(97), 2048 eviction(105), 자연 seed3 120tick cold/warm 전체 JSON hash(116)를 포함한다. 마지막 시험의 기대 SHA는 `877a1953f818adbb9e52df842901b8eac8aa363189a608b4d44cace54ede95d3`이며 serialized pathCache도 포함한다. 직접 읽은 `/tmp/r1-road-cache-final-tests.log`에서 해당 검사와 관련 회귀를 포함한 **36/36 PASS, fail/cancelled/skipped/todo 0**을 확인했다. `/tmp/r1-road-cache-final-typecheck.log`는 `tsc --noEmit` 실행을 기록하고 오류 진단이 없다(실행 담당자의 종료 코드 0 보고와 일치; 본 검토자가 재실행하지 않음).

후속 기록 사항(코드 차단 결함 아님):

- 최종 `docs/routing-cache-identity.md`를 직접 읽어 새 메모의 immutable 전제, readonly 공유 배열, null caching, per-tiles FIFO 2048, 기존 GameState cache와의 차이 문서화를 확인했다. `docs/design/rule-repairs/R9-road-route-cache.md`의 fixture 출처·측정 조건·해석 제한도 원시 결과와 일치한다.
- 소비자 이동 후 같은 warm 경로가 보존되는 직접 테스트는 현 8개에 없다. 실제 소비자 정적 추적과 120tick 전체 상태 비교가 간접 보호하며, 현재 결함 증거는 아니다.
- **직접 artifact 확인:** `/tmp/r1-road-cache-ab.json`의 profiler-off 5쌍 중앙값은 **491.789250→291.991167ms**다. 10개 표본 전부 tick 324120, serialized pathCache 1214개, 위 전체 상태 SHA가 동일하다. 조건은 매번 새 subprocess/import/state, 정상 120tick, 기준 frozen403 대 frozen403의 routing.ts만 교체한 복제본, 호스트 동시 부하 포함이다. 이후 표본 하나는 431.081125ms였다. 하나의 자연 snapshot 결과로 전체 seed 안정 관문이나 전체 성능을 대체하지 않는다.
- **직접 artifact 확인:** `/tmp/r1-road-cache-size.json`은 entries **2048**, coordinates **72457**, serializedBytes **1361180**이다. 관측된 경로 JSON 크기이며 실제 V8 힙 사용량 또는 전역 bytes 상한이 아니다.
- focused 36개와 typecheck 근거는 갱신했으나 최종 통합 전체 suite 및 5seed 관문은 **PENDING**으로 유지한다. 본 PASS는 이 관문들의 통과 선언이 아니다.

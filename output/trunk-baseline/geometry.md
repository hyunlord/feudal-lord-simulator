# S0 4절: 기하 타입 단일 소유

## Cleanup plan (수정 전 확정)
1. 기존 wall/palisade/geometry 행동 회귀를 먼저 실행한다.
2. `palisadeGeometry.ts` 중복 `TileEdgePoint` 구조를 제거하고 공용 geometry 타입을 import/re-export해 기존 caller API를 유지한다.
3. `wallTraversal.ts`가 공용 geometry 타입을 직접 읽게 한다.
4. 같은 회귀와 typecheck를 다시 실행한다. 문 개구부 상수/렌더 import/게임 동작은 변경하지 않는다.

## 변경 파일
- `src/world/palisadeGeometry.ts`: 중복 x/y 구조 선언 삭제. `../geometry/tileGeometry`의 TileEdgePoint를 type import 및 호환 re-export.
- `src/world/wallTraversal.ts`: TileEdgePoint type import를 공용 geometry 모듈로 변경.
- `src/geometry/tileGeometry.ts`: 이미 올바른 공용 구조를 갖고 있어 수정 불필요.
- caller 및 render 파일: re-export로 호환되므로 수정 불필요.

`GATE_HALF_CLEARANCE = 0.8`는 `src/world/wallTraversal.ts` 단독 정의다. render 5개 모듈의 기존 wallTraversal import를 그대로 보존했다. 런타임 코드 변경이 없고 타입 정의만 단일화했다.

## 검증
변경 전/후 동일 8파일 테스트 각각 51/51 통과:
`npx tsx --test tests/wallTraversal.test.ts tests/palisadeGeometry.test.ts tests/wallRoutingIntegration.test.ts tests/palisadeRenderRegression.test.ts tests/stoneWallNodeGeometry.test.ts tests/stoneWallFallbackGeometry.test.ts tests/timberGateGeometry.test.ts tests/gateArtGeometry.test.ts`

- 변경 전 `/tmp/s0-geometry-before.log`: 51/51, 344.5ms.
- 변경 후 `/tmp/s0-geometry-after.log`: 51/51, 495.5ms. 성능 비교로 해석하지 않음.
- `npm run typecheck`: 종료 0 (`/tmp/s0-geometry-typecheck.log`).
- `git diff --check`: 통과.
- 새 테스트 추가 없음: 행동 무변경의 타입 정리이고 기존 wall/gate 행동 검사가 이미 존재.
- 전체 회귀/새 클론 관문은 루트 에이전트가 마지막 커밋 기준 실행한다.

commit/push는 요청대로 실행하지 않았다. 다른 작업자 변경에 손대지 않았다.

# 목책 확장 명세 (WALL-2) — 이미 두른 목책을 넓힌다

지시서: WALL-2 목책 확장 선포. 근거: BOT-2 보고서(목책은 한 번만 선포 — 작게 두르면 플레이어도 봇도 막힘), [목책 둘레 명세](labour.md) LB-12. 결정: WX1~WX5. 조항 번호(WX-*)는 `tests/wallExpansion.test.ts`(W1~W6)와 이어진다. 화면(확장 선 그리기·미리보기 칩)은 렌더 몫이고, 이 명세는 엔진 규칙과 미리보기 API까지다.

## WX-1 확장 선포 (`expand_palisade`, `expandPalisade(state, path)`)
- 조건:
  - 목책·석벽 시대(`state.palisade`가 있음)여야 한다.
  - 새 둘레는 선포 검증(건물 이격·물 건너지 않음)을 지나야 한다. 둘레가 감쌀 것은 옛 성벽이 감싸던 건물 전부다(도시가 성 밖에 지은 것은 묻지 않는다).
  - 옛 성 안(칸 중심)이 모두 새 성 안이어야 하고, 성 안이 넓어져야 한다.
- 거절 이유: `no_palisade` · `invalid_path` · `not_containing` · `not_larger` · `no_gate`. 거절하면 상태가 그대로다.
- 구간:
  - 새 둘레 위에 온전히 놓인 옛 구간은 그대로 남는다(지어졌든 짓는 중이든, 목재든 석재든).
  - 성 안에 남게 된 옛 구간은 헐린다. 그 공사장도 없어지고, 이미 들어온 목재는 공사 취소처럼 60 %가 금고로 돌아온다.
  - 새 둘레의 나머지 걸음만 성문에서부터 이어진 토막으로 나눈다(토막당 4걸음 이하). 이 토막들이 새 목책 공사장이다.
  - 비용은 새 길이분(걸음당 목재)이다.
- 성문: 옛 성문이 새 둘레 위에 있으면 그대로이고, 아니면 선포와 같은 규칙으로 고른다. 길 성문은 새 둘레로 다시 잡는다.
- 성벽 id는 그대로다. 공사 순번(`nextConstructionOrdinal`)은 하나 오른다.

## WX-2 미리보기 (`previewPalisadeExpansion`, 렌더 칩·범위용)
`{ok, path, newSteps, timber, reusedSegmentIds, removedSegmentIds, interiorBefore, interiorAfter, enclosedArableCells}` 또는 `{ok:false, reason}`. 상태를 바꾸지 않는다.

## WX-3 석벽 도시
석벽 시대의 확장도 같은 규칙이다. 새 토막은 목책 공사장으로 서고, 지어지는 대로 석재 교체가 걸린다(석벽 시대의 모든 목책 토막과 같음, `constructionLifecycle`).

## WX-4 성 안이 된 경작지
- 확장이 새로 감싼 경작지 칸은 `palisade.expansion = {tick, arableCells}`에 적는다(저장 v17).
- 경고(`palisadeExpansionWarning`): 아직 경작지인 그 칸들과 바뀌는 틱(확장 + 한 계절)이다.
- 성 안에 새 경작지를 칠할 수는 없다(Z-5 그대로).
- 한 계절 뒤 그 칸들 가운데 아직 경작지인 것은 목초지(`pasture`)가 된다. 플레이어가 먼저 지우면 바뀔 것이 없다. 바꾸고 나면 `expansion`을 지운다.
- 확장 전부터 성 안에 있던 경작지는 이 규칙이 건드리지 않는다.
- 바꾸는 것은 구역 모듈의 칠하기·지우기로 칸마다 한다. 밭·헛간이 플레이어의 편집과 같이 따른다. 플레이어의 되돌리기 목록에는 들지 않는다.

## WX-5 원장
큰 결정 `wall_expand`(`decision.wall_expand`): 대안 `keep`, 예측·실제 `population`·`lots`(2계절 뒤). 결정 종류는 12 + 1 = 13이다.

## WX-6 봇 (AR-12, [자동 성장 복구](autoplay-recovery.md))
BOT-2의 넉넉한 선포(AR-11)는 그대로다. 그 위에 다음 조건이면 넓힌다: 지어진 성벽, 확장이 걸려 있지 않음, 남은 필지 > 성 안 집 자리.
- 넓히는 방법은 플레이어처럼 성벽의 곧은 한 변을 밖으로 1~10걸음 끄는 것이다(`dragPalisadeRun`).
- 엔진이 받아들이는 것(`previewPalisadeExpansion`) 가운데 남은 필지 × 6의 자유 집 칸을 주는 것을 고르고, 새 걸음이 가장 적은 것을 쓴다.
- 봇 명령은 `proclaim_era`(후보 선 있음)로 보내고, 성벽이 있으면 `expand_palisade`로 바뀐다(렌더 파일의 봇 명령 목록을 건드리지 않으려고).

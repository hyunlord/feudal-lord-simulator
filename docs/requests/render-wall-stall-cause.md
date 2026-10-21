# 렌더 요청 — 성벽 공사장의 멈춘 까닭: 길이 없음(STONE-1 ⓑ)

- **보낸 곳**: 엔진(사용자 판정 2026-10-21). 받는 곳: 렌더 A.
- **까닭**: seed 32(1320–1330)의 돌 성벽 아홉 구간은 돌이 창고에 400 넘게 있는데도 배달 0이다. 돌을 든 창고 셋과 석공소가 성벽 밖에 있고 성 안으로 가는 길이 없다(하나뿐인 성문이 강 쪽으로 열림). 성 안 창고 하나의 돌은 비축 바닥선과 같다. 그래서 공사장의 저장된 `stall`은 `reserve_held`이고 화면은 "비축 때문에 멈춤"이라고 말한다 — 원인과 다르다([STONE-SINK](../verification/stone-sink/REPORT.md)).

## 엔진이 주는 것(본선에 있음)
- `wallStallCause(state, site)` — `src/engine/wallStallCause.ts`, 상태를 바꾸지 않는 읽기 함수. 영주 모드에서 성벽 공사장(목책·돌 성벽)이 `reserve_held`인데 그 자재가 배달 길이 닿지 않는 건물에 있으면 `"stock_unreachable"`, 그 밖에는 저장된 `site.stall` 그대로.
- `wallStockReach(state, site)` — `{ resource: "timber" | "stone", reachable, unreachable }`(길이 닿는 건물의 자재, 닿지 않는 건물의 자재). 성벽 공사장이 아니면 `null`.
- 문구는 돌려주지 않는다. 시험: `tests/wallStallCause.test.ts`.

## 화면에 바라는 것
- 공사장 까닭을 `site.stall` 대신 `wallStallCause`로 읽고, `stock_unreachable`이면 "비축 때문에 멈춤" 대신 길이 없다는 까닭을 보인다(예: "자재가 길이 닿지 않는 곳에 있음 · 돌 401"). 숫자는 `wallStockReach`에서. 문구는 렌더의 `*.ko.ts`, 호버 전용 금지.
- 지금 `reserve_held`를 다루는 곳: `src/ui/constructionAccessModel.ts`(`reserveDeadlock`과 함께), `src/ui/inspectorModel.ts` `siteActions`, `src/economy/construction.ts` `constructionOnSiteLabel`, `src/render/constructionVisibility.ts`.

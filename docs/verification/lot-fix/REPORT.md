# LOT-FIX 보고서 — 성 안 밭 한 칸을 집 자리로 돌림(영주 모드)

관문: 통과 — 가드레일 5/5·trunk 해시 5/5 같음, 석조 도시 20 = 20, 768 도달 19 = 19, 끝 인구가 줄어든 seed 없음, 새 막다른 길 없음, 1302–1307 빵 없는 집 평균 10.2 % = 10.2 %. 본선에서는 거의 드러나지 않는 결함이라 판정 판이 본선과 거의 같다(돌린 칸 seed 33 하나).

- **지시**: 사용자 판정 2026-10-22(LOT-DIAG 뒤 — 성벽 안 경작지를 집터로 넘김, 영주 모드; 고정물 시험 먼저).
- **결정**: LOTFIX-1~LOTFIX-2.
- **코드**: `2ba529568`(작업 가지 `claude/lot-fix`). 증명 시험 `e1cb4dfb2`.

## 본선 증명(JUDGE-POP-2)
- 본선 자연 저장 seed 33 1312 첫 틱(DGX `engine-LOTFIX-save33`, 본선 `349da108`) — 만든 상태가 아니다: 성벽 1311에 닫힘, 집터 1 필요(집 23), 집 단계가 쓸 빈 성 안 자리(풀밭·길 옆·구역 없음) 0, 길 옆 성 안 자리는 모두 밭 아래. `tests/enclosedFieldLotsDefect.test.ts`(본선 함수만, 본선 코드에서 통과).
- 고침 시험 `tests/enclosedFieldLots.test.ts`는 본선 코드에서 실패(모듈 없음) — 본선 코드(`claude/food-p-base`)에서 직접 돌려 확인.
- 이 철의 seed 33은 빈 자리 말고 다른 집 문턱도 함께 걸려 있어 본선 쪽은 "집 단계가 쓸 자리가 없다"까지 보이고, "그 칸에 집을 계획한다"는 FOOD-P2 seed 26 1313 저장(DGX `engine-LOT-save26`)으로 보인다(한 칸을 돌리자 집 단계가 바로 그 칸 (36,51)에 집).

## 만든 것
| 결정 | 무엇 |
|---|---|
| LOTFIX-1 | `releaseEnclosedFieldLot`(`src/engine/enclosedFieldLots.ts`, `tick.ts`의 철 끝 단계): 영주 모드, 성벽이 닫혔고(`closedTick`) 집터가 더 필요하고 성 안에 집 단계가 쓸 빈 자리가 없으며 성 밖에 밭 블록 자리(`outsideFieldBlockExists`)가 남아 있으면, 밭 아래 있는 길 옆 성 안 집 자리 한 칸의 밭을 지운다. 한 철 한 칸, 새 구역 종류 없음 |
| LOTFIX-2 | 판정 기준과 결과(아래) |

## 관문 결과 — DGX
판: 고친 판 `engine-LOTFIX-after-ee995e1`, 본선 판 `engine-FOODP-before-c037c45`(본선 `349da108c` + 탐침) — 성장 seed 1·14 40년, 9 49년, 21–40 30년(seed 21 판정에서 뺌), 식량 40 seed 1300–1320.

| 기준 | 본선 | LOT-FIX | 결과 |
|---|---|---|---|
| 가드레일 trunk 해시 5/5 same | — | 5/5 통과·같음(`engine-LOTFIX-guard-ee995e1`, 1회차) | 통과 |
| 석조 도시 ≥ 20 | 20 | 20 | 통과 |
| 768 도달 ≥ 19 | 19 | 19 | 통과 |
| 끝 인구(JUDGE-POP-2) | — | 줄어든 seed 없음 | 통과 |
| 새 막다른 길 | 0 | 0 | 통과 |
| 1302–1307 빵 없는 집 평균 | 10.2 % | 10.2 % | 통과(나쁘지 않음) |

- 끝 상태 해시가 바뀐 seed는 33 하나. 석조 도시 해·끝 인구는 모든 seed가 본선과 같다.
- 기록 — 돌린 칸: seed 33 한 칸(1311, 성벽이 닫힌 해; 성 안 밭 43 → 42). seed 33 집은 두 판 모두 1312 23 → 1313 24.
- 기록 — seed 33 밀 기대 수확(해마다 첫 틱): 1313 2,552 → 2,416(−5 %), 1314 3,103 → 3,137, 1315 3,468 → 3,375, 1316 3,570 → 3,553 — 밭은 그 뒤 성 밖으로 늘어(1316 168 → 171칸) 수확은 곧 따라옴.

## 필수 조건
- typecheck 통과; `enclosedFieldLots` 3/3, `enclosedFieldLotsDefect` 1/1, `palisadeExteriorGate` 3/3, `cutOffGates` 6/6, `onboardingWorldGuidance` 14/14 — Mac.
- 관련 시험 DGX `engine-LOTFIX-tested-ee995e1` 5036/5055 통과(실패 0).
- 마지막 트리 test:changed·check:merge — 푸시 때(DGX).
- 사슬: 판정 판을 기다리던 ssh가 두 번 연달아 실패해 사슬이 CHAIN-STOP으로 멈췄다(판은 끝까지 돌아 exit 0) — 결과는 따로 받아 썼다.

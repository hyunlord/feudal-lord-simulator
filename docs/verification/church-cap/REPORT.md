# CHURCH-CAP 보고서 — 멈춘 마을의 범위 밖 집에 셋째 교회(영주 모드)

관문: 통과 — 가드레일 해시 본선과 모두 같음, 석조 도시 20 = 20, 768 도달 18 → 19, seed 25가 768에 닿음(1319), 새 막다른 길 없음. 셋째 교회가 선 seed는 25 하나(1318).

- **지시**: 사용자 판정 2026-10-21((나): 조건은 "지금 교회 범위 밖 집이 있음 + 마을이 두 철 넘게 자라지 않음(`lastGrowthTick`) + 짓는 교회 없음", 상한은 최대 3, 영주 모드 전용, 저장은 바꾸지 않음).
- **결정**: CAP-1~CAP-2.
- **코드**: `d116582b1`, 회귀 시험 `456f00a42`(작업 가지 `claude/church-cap`).
- **진단(앞 작업)**: CHURCH-25, DGX `engine-CHURCH-diag-e7a0f01` — seed 25는 1318부터 집 1채가 두 교회 범위 밖이고, 교회 상한 `ceil(24/32)+1` = 2에 막혀(facility_limit) 758에 머문다.

## 만든 것
| 결정 | 무엇 |
|---|---|
| CAP-1 | `churchCap()`(`src/engine/autoplayServices.ts`): 교회 상한 `ceil(집터/32)+1`에, 영주 모드에서 지금 교회 범위 밖 집이 있고 마지막 성장(`agency.seasonGrowth.lastGrowthTick`, GB2A-7)에서 두 철(2,000틱)을 넘겼으면 1을 더한다 — 최대 3. 짓는 교회가 있으면 단계가 원래 건너뛴다. 샌드박스 봇은 옛 상한, 저장 칸은 더하지 않음 |
| CAP-2 | 판정 기준과 결과(아래) |

## 관문 결과 — DGX
판: 고친 판 `engine-CAP-after-456f00a`, 본선 판 `engine-STORE-after-1a2bbce`(코드가 본선 `ae3dee1b5`·`b9bd1f4b3`와 같음) — seed 1·14 40년, 9 49년, 21–40 30년. seed 21은 판정에서 뺐다.

| 기준 | 본선 | CHURCH-CAP | 결과 |
|---|---|---|---|
| 가드레일 해시 본선과 같음 | — | 5/5 같음 | 통과 |
| 석조 도시 ≥ 20 | 20 | 20 | 통과 |
| 768 도달 ≥ 18 | 18 | 19 | 통과 |
| seed 25가 768에 닿음 | 758(1319부터) | 768(1319) | 통과 |
| 새 막다른 길 | 0 | 0 | 통과 |

- 끝 상태 해시가 바뀐 seed는 25 하나다.
- 기록 — 셋째 교회: seed 25, 1318(해마다 첫 틱 기록 1319에 교회 3). 인구는 해마다 첫 틱 1318 658, 1319 736, 1320 768(본선은 1320부터 758). seed 25의 석조 도시는 1321 → 1322(한 해 늦음, 판정 기준 밖).

## 가드레일 — DGX `engine-CAP-guard-456f00a`(1회차)
- 5/5, 사람 경로 통과. 다섯 seed의 끝 상태 해시가 본선 판 `engine-STORE-guard-1a2bbce`와 모두 같다(seed 1·3·4·5는 `baseline-096eb86`, seed 2는 WALL-PROTO 값) — 영주 모드 전용.

## 필수 조건
- typecheck 통과; `tests/churchCap.test.ts` 3/3(seed 25 1321 자연 저장 `fixtures/church/seed25-1321.save.json.gz`, DGX `engine-CAP-save25-b9bd1f4`: 영주 모드는 상한 3·셋째 교회 자리·마을 제안에 교회, 두 철 안에 자란 마을과 샌드박스는 상한 2), `autoplayServices` 17/17, `efficientServices` 13/13, `marketReach` 4/4 — Mac.
- 관련 시험 DGX `engine-CAP-tested-456f00a` 4990/5009 통과(실패 0, 건너뜀 19는 본선과 같은 목록).
- 마지막 트리 test:changed(`--all`)·check:merge — 푸시 때(DGX).

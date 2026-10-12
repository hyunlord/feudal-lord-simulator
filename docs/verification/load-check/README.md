# 부하 아래의 대기 확인 — 렌더 A 보고

렌더 A, 2026-10-11. 사용자 지시: 밤 감사(DGX가 한가할 때)로는 장면 준비의 Esc 고침(GEO-D2, 28fb2c54)을 증명할 수 없다 — 낮에 다른 세션의 판이 DGX에서 돌 때, 재시도에 걸리던 세 줄을 각각 다섯 번 관문 실행으로 재고, 실행마다 `run.sh --status`로 함께 돈 판을 남긴다. 모두 첫 라운드면 고침이 확인된 것이고, 그때 남은 늘린 대기(GEO-D1)를 원래대로 돌린 줄도 같은 방식으로 세 번씩 잰다.

## 실행 위치
- 코드: Mac 작업 트리 `~/github/fls-loadcheck`(가지 `claude/load-check`, 본선 `12d36494` → `28c1fe48` 병합; 3절은 `~/github/fls-mchips`, 가지 `claude/market-chips`, 본선 `0dc2490a` 위).
- 실행: DGX `scripts/remote/run.sh <run> --heavy --gate --keep -- bash scripts/remote/tasks.sh ui-geometry --only <줄>`, 한 실행에 한 줄(5 화면 크기 × 말 2 × 숫자 2 = 20칸). 줄을 돌아가며(056 → 기근 → 3장, 다섯 바퀴; 감사 → 지도 밖 → 시장 기근, 세 바퀴) 실행 사이 쉼 없이.
- 부하 조건: 실행마다 시작 전에 `run.sh --status`의 슬롯 지기 줄에서 다른 세션의 판이 슬롯을 쥐었는지 보고(없으면 5분마다 다시 — 기다린 적 없음), 시작 전·시작 150초 뒤·끝난 뒤의 슬롯을 적었다. 모든 실행이 엔진의 `engine-GROW2a-guard`(guardrail)와 엔진 B의 `engineB-standing4-*`(무활성 규칙 실험) 곁에서 돌았고, 몇은 REMOTE의 관문 `infra-RR27-rows*`와도 겹쳤다.
- 판정: 보고서의 `retried`(재시도 라운드에 간 트리)와 `retries`(첫 시도 시간 초과·세 번 실패) — 첫 라운드 `retried: []`, 시간 초과 0. 결과는 모두 DGX `_kept/`에 남겼다.

## 1. GEO-D2 고침(본선 12d36494): 세 줄 × 5회
| 실행 | 줄 | 시작(UTC) | 감사 시간 | 칸 | 실패 | 못 연 조건 | 첫 시도 시간 초과 | retried | 함께 돈 판(run.sh --status: 시작 전·150초 뒤·끝난 뒤) |
|---|---|---|---|---|---|---|---|---|---|
| render-LOAD-v056-r1-12d3649-12d3649 | `modal.lord.home-petition.variant-056` | 2026-10-10 21:41:24 | 127.5 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-famine-r1-12d3649-12d3649 | `hud.event-card.famine-answered` | 2026-10-10 21:44:24 | 104.0 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-ch3-r1-12d3649-12d3649 | `modal.chapter-page.ch3` | 2026-10-10 21:46:52 | 150.3 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-v056-r2-12d3649-12d3649 | `modal.lord.home-petition.variant-056` | 2026-10-10 21:50:13 | 126.7 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-famine-r2-12d3649-12d3649 | `hud.event-card.famine-answered` | 2026-10-10 21:53:04 | 103.2 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-ch3-r2-12d3649-12d3649 | `modal.chapter-page.ch3` | 2026-10-10 21:55:38 | 178.5 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-v056-r3-12d3649-12d3649 | `modal.lord.home-petition.variant-056` | 2026-10-10 22:03:30 | 125.3 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 · infra-RR27-rows-f6708f9 |
| render-LOAD-famine-r3-12d3649-12d3649 | `hud.event-card.famine-answered` | 2026-10-10 22:06:26 | 102.4 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 |
| render-LOAD-ch3-r3-12d3649-12d3649 | `modal.chapter-page.ch3` | 2026-10-10 22:09:24 | 171.3 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 · infra-RR27-rows2-a7a6b03 |
| render-LOAD-v056-r4-12d3649-12d3649 | `modal.lord.home-petition.variant-056` | 2026-10-10 22:25:49 | 124.3 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 · infra-RR27-rows2-a7a6b03 · infra-RR27-rows3-a9f9ffe |
| render-LOAD-famine-r4-12d3649-12d3649 | `hud.event-card.famine-answered` | 2026-10-10 22:37:45 | 116.5 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-125-239c823 · infra-RR27-rows3-a9f9ffe |
| render-LOAD-ch3-r4-12d3649-12d3649 | `modal.chapter-page.ch3` | 2026-10-10 22:46:29 | 197.9 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 · infra-RR27-rows3-a9f9ffe |
| render-LOAD-v056-r5-12d3649-12d3649 | `modal.lord.home-petition.variant-056` | 2026-10-10 22:50:48 | 125.8 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-LOAD-famine-r5-12d3649-12d3649 | `hud.event-card.famine-answered` | 2026-10-10 22:53:51 | 104.7 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-LOAD-ch3-r5-12d3649-12d3649 | `modal.chapter-page.ch3` | 2026-10-10 22:56:22 | 150.1 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |

15회 모두 첫 라운드, 첫 시도 시간 초과 0, 실패 0. 고침 전에는 같은 줄이 바쁜 DGX에서 재시도 라운드에서만 열렸다(RETRIES.md: infra-RR26-full-7af6f5e의 variant-056 60, infra-RR26C-rows-ed67968의 3장 쪽 7개 조건 세 번 실패, render-GROWUI-final-geometry-223e9ec).

## 2. 늘린 대기를 원래대로(2642c953): 세 줄 × 3회
- `modal.lord.audit`·`modal.lord.offmap-petition`: GEO-D1의 story-delay 8초·첫 대기 20초 → lord2의 다른 줄과 같은 3초, 대기 없이 `story` 단계(RECEIPTS 전의 모양).
- `hud.event-card.famine.market`: story-delay 8초·칩 첫 대기 90초 → 마을 기근 줄과 같은 5초, 칩 첫 대기 30초.
| 실행 | 줄 | 시작(UTC) | 감사 시간 | 칸 | 실패 | 못 연 조건 | 첫 시도 시간 초과 | retried | 함께 돈 판(run.sh --status: 시작 전·150초 뒤·끝난 뒤) |
|---|---|---|---|---|---|---|---|---|---|
| render-UNWAIT-audit-r1-2642c95-2642c95 | `modal.lord.audit` | 2026-10-10 23:00:45 | 128.3 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-offmap-r1-2642c95-2642c95 | `modal.lord.offmap-petition` | 2026-10-10 23:03:47 | 137.4 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-famkt-r1-2642c95-2642c95 | `hud.event-card.famine.market` | 2026-10-10 23:06:54 | 104.5 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-audit-r2-2642c95-2642c95 | `modal.lord.audit` | 2026-10-10 23:09:28 | 140.7 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-offmap-r2-2642c95-2642c95 | `modal.lord.offmap-petition` | 2026-10-10 23:12:31 | 129.4 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-famkt-r2-2642c95-2642c95 | `hud.event-card.famine.market` | 2026-10-10 23:15:28 | 88.9 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-audit-r3-2642c95-2642c95 | `modal.lord.audit` | 2026-10-10 23:17:53 | 129.0 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-offmap-r3-2642c95-2642c95 | `modal.lord.offmap-petition` | 2026-10-10 23:20:52 | 124.2 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |
| render-UNWAIT-famkt-r3-2642c95-2642c95 | `hud.event-card.famine.market` | 2026-10-10 23:23:42 | 88.8 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 · engineB-standing4-native-239c823 |

9회 모두 첫 라운드, 시간 초과 0, 실패 0. 각 줄의 세 번째 실행 보고서가 이 푸시의 `UI-Geometry-Run`이다(`docs/verification/uiaudit1/geometry/render-UNWAIT-*-r3-2642c95-2642c95/`).

## 3. 시장 도시의 칩 줄 셋(2b48708c, 사용자 지시 2026-10-11 — 원인이 같다): 세 줄 × 3회
- `hud.event-chips.market`·`hud.event-card.suit-defence.market`·`hud.event-card.lord-moment.market`(`CHIPS_YEARS`): story-delay 8초 → lord2 줄의 3초, 칩 첫 대기 90초 → 시장 기근 칩과 같은 30초. 다른 카드·장 쪽이 스스로 뜨면 미루는 단계는 그대로.

| 실행 | 줄 | 시작(UTC) | 감사 시간 | 칸 | 실패 | 못 연 조건 | 첫 시도 시간 초과 | retried | 함께 돈 판(run.sh --status: 시작 전·150초 뒤·끝난 뒤) |
|---|---|---|---|---|---|---|---|---|---|
| render-MCHIPS-chips-r1-2b48708-2b48708 | `hud.event-chips.market` | 2026-10-11 04:07:47 | 174.1 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-suit-r1-2b48708-2b48708 | `hud.event-card.suit-defence.market` | 2026-10-11 04:11:58 | 177.7 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-moment-r1-2b48708-2b48708 | `hud.event-card.lord-moment.market` | 2026-10-11 04:15:44 | 177.7 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-chips-r2-2b48708-2b48708 | `hud.event-chips.market` | 2026-10-11 04:19:23 | 173.9 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-suit-r2-2b48708-2b48708 | `hud.event-card.suit-defence.market` | 2026-10-11 04:23:04 | 175.1 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-moment-r2-2b48708-2b48708 | `hud.event-card.lord-moment.market` | 2026-10-11 04:26:48 | 178.2 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-chips-r3-2b48708-2b48708 | `hud.event-chips.market` | 2026-10-11 04:30:35 | 171.0 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-suit-r3-2b48708-2b48708 | `hud.event-card.suit-defence.market` | 2026-10-11 04:34:07 | 177.6 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |
| render-MCHIPS-moment-r3-2b48708-2b48708 | `hud.event-card.lord-moment.market` | 2026-10-11 04:37:52 | 178.2 s | 20 | 0 | 0 | 0 | [] | engine-GROW2a-guard-439ee50 |

9회 모두 첫 라운드, 시간 초과 0, 실패 0. 이번에는 DGX가 아침보다 가벼웠다 — 엔진의 `engine-GROW2a-guard`만 함께 돈 실행이 있다(표). 각 줄의 세 번째 실행 보고서가 이 푸시의 `UI-Geometry-Run`이다.

## 남은 것
- GEO-D1 모양으로 남은 줄: 답의 영수증 줄(`src/ui/decisionCard/receiptSurfaces.ts`, story-delay 8초·첫 대기 20초)과 변형 카드의 칩 경로(`src/ui/decisionCard/surfaces.ts` `fromChip`, 첫 대기 8초·다른 카드를 미룬 뒤 20초). 사용자가 이름 붙인 줄이 아니라 그대로 두었다.

## 원칙 점검
- 엔진 파일 0줄, 감사·관문 규칙 0줄(RR22) — 바뀐 것은 렌더 A의 줄 두 파일의 대기와 장면 지연뿐. 한국어·색·`title=`·그림 문자 변화 없음.
- 증거: 이 보고서(12 KB)와 세 줄의 실행 보고서(폴더마다 630 KB 안팎), 폴더마다 3 MB 아래.

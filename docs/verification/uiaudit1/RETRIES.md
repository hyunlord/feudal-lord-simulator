# 전체 기하 감사의 재시도 기록

사용자 지시(2026-10-09): 전체 감사마다 재시도 비율을 남겨 늘어나는지 지켜본다. 같은 조건이 감사마다 재시도에 걸리면 그 줄의 대기 조건(장면 단계) 문제다.

- **첫 시도 시간 초과**: 한 트리 안에서 단계가 시간 초과로 다시 시도한 횟수(`attempt N timed out, again`, 조건마다 세 번까지).
- **세 번 실패**: 세 번 다 시간 초과로 끝나 열리지 않은 조건(`FAILED`). 그 조건의 트리는 감사 끝의 재시도 라운드(절반의 페이지)에서 다시 돈다.
- **재시도 트리**: 재시도 라운드가 다시 돌린 트리 수(보고서 `retried`). 마지막에 못 연 조건은 보고서 `unopened`.

| 감사(실행) | 측정 커밋 | 칸 | 첫 시도 시간 초과 | 세 번 실패 | 재시도 트리 | 최종 못 연 조건 | 걸린 줄(시간 초과·실패 줄 수) |
|---|---|---|---|---|---|---|---|
| nightly-GEOMETRY-1011-eeae4c8 (첫 밤 감사, 234줄 — **무효: 더러운 트리**, 공용 결과 아님) | eeae4c81 | 4,412 | 1 | 0 | 0 | 0 | `modal.lord.home-petition` 1(두 번째 시도에 열림). Esc 고침(28fb2c54) 앞 커밋인데도 `variant-056`·`famine-answered`·`chapter-page.ch3`는 재시도 0 — 밤의 DGX는 한가해 세 줄이 빠지는지는 부하 없는 증거다 |
| infra-RR26C-rows-ed67968 (바뀐 줄만: `modal.chapter-page.ch3`·`hud.status-pill.lord`, RR26 covered 푸시의 증거) | ed679689 | 40 | 16 | 7 | 7 | 0 | `modal.chapter-page.ch3` 9(7개 조건 세 번 실패 — 재시도 라운드에서만 측정; 바로 앞 전체 감사에서도 재시도: **연속 재시도, 대기 조건 문제**) |
| infra-RR26S-full-42df9d6 (RR26 그림자, 측정 입력 포함) | 42df9d67 | 3,662 | 4 | 0 | 0 | 0 | `modal.chapter-page.ch3` 2, `modal.lord.home-petition.variant-056` 2 — 모두 두 번째 시도에 열림, 재시도 라운드 없음(감사가 직접 센 `retries`) |
| infra-RR26-full-7af6f5e | 7af6f5e7 | 3,562 | 48 | 22 | 22 | 0 | `modal.lord.home-petition.variant-056` 60(20개 조건 모두 세 번 실패, 재시도 라운드에서만 측정), `hud.event-card.famine-answered` 10(간헐) |
| infra-RR25-full-59bd71c | 59bd71c2 | 3,562 | 20 | 6 | 6 | 0 | `modal.lord.home-petition.variant-056` 26(6개 조건 세 번 실패) |
| render-GROWUI-v056b-geometry-c4c22b3 (바뀐 줄만: variant-056) | c4c22b36 | 20 | 0 | 0 | 0 | 0 | 없음 — 고친 뒤 20개 조건 모두 첫 라운드에서 열림 |
| render-GROWUI-famine-geometry-9d57715 (바뀐 줄만: famine-answered) | 9d577154 | 20 | 0 | 0 | 0 | 0 | 없음 — 고친 뒤 20개 조건 모두 첫 라운드에서 열림 |
| render-GROWUI-final-geometry-223e9ec (바뀐 줄만: GROW-BLOCK 화면 15줄, 렌더 A의 최종 관문) | 223e9ec4 | 300 | 17 | 4 | 4 | 0 | `modal.lord.home-petition.variant-056` 20(16개 조건 첫 시도 시간 초과, 그중 4개 세 번 실패 — 재시도 라운드에서만 측정), `hud.event-card.famine-answered` 1(1280×800 normal/extreme) |

## 지켜볼 것

- **부하 확인(2026-10-11, 렌더 A): 세 줄 × 5회, 모두 첫 라운드** — `variant-056`·`famine-answered`·`chapter-page.ch3`를 Esc 고침(GEO-D2) 뒤 본선 12d36494에서 엔진·엔진 B의 판이 슬롯을 쥔 채 줄마다 다섯 번 관문 실행(render-LOAD-*-12d3649): 15회 모두 `retried: []`, 첫 시도 시간 초과 0. 실행마다 함께 돈 판은 `docs/verification/load-check/README.md`.
- **부하 확인(2026-10-11, 렌더 A): 늘린 대기를 돌린 세 줄 × 3회, 모두 첫 라운드** — `modal.lord.audit`·`modal.lord.offmap-petition`(8초·20초 → 3초, 대기 없음)·`hud.event-card.famine.market`(8초·90초 → 5초·30초)를 같은 조건에서(render-UNWAIT-*-2642c95): 9회 모두 `retried: []`, 시간 초과 0.
- **밤 감사 2026-10-11은 무효**(상태 FAILED, `audit exit 0, invalid`): 실패 0·못 연 조건 0이지만 `dirty: true`. 원인은 실행 폴더 쪽 — 타이머가 파일 목록을 `git ls-tree`로 적을 때 한글 이름을 따옴표·8진수로 적어(`core.quotePath` 기본값), `remote-exec.sh`가 목록에 없는 파일로 보고 `assets-inbox/**/records/검수표.md` 등 16개를 지웠다. 화면 입력은 아니지만 안전 목록 밖이라 감사가 더러운 트리로 적었고, 밤은 유효한 결과로만 끝난다(사용자 지시). 고침: `nightlyGeometry.sh`·`trunkClone.sh`가 `-c core.quotePath=false`로 적는다(`run.sh`와 같이, `tests/remoteInFiles.test.ts`). `last-audited`는 그대로라 다음 밤(10-12 01:00)이 그때의 본선 머리 — Esc 고침이 든 — 를 다시 감사한다.
- `modal.lord.home-petition.variant-056`은 두 전체 감사 연속 재시도에 걸렸다 — 대기 조건 문제였다. **원인은 장면 쪽**(렌더 A, c4c22b36): `openScene`은 상태를 불러온 뒤 Esc를 한 번 누르는데, 바쁜 DGX에서는 불러오기가 장면의 `story-delay=3000`(3초)보다 길어 카드가 먼저 떠 있었고, 그 Esc가 카드를 치워 칩까지 사라졌다(그 뒤 칩 경로는 영영 실패). 재시도 라운드는 페이지가 절반이라 제때 불러와 열렸다. 고침(줄 쪽만, 판정 그대로): `story-delay=8000`, 첫 대기 20초, 먼저 뜬 다른 카드(056 상태의 시장 세금 제안)는 한 번 "나중에". 고친 뒤 그 줄만 잰 실행에서 첫 라운드 재시도 0. 전체 감사에서의 확인은 다음 전체 감사에서 이 표에 적는다.
- **같은 꼴을 찾는 기준**: 상태를 불러와 시간이 흐르는 장면에서 카드가 스스로 뜨는 지연(`story-delay`)이 불러오기·준비보다 짧으면, 준비 단계의 Esc·닫기가 그 카드를 먼저 치운다. 증상은 칩·화면은 그대로인데 카드 대기만 시간 초과, 재시도 라운드(가벼운 부하)에서만 열림. `hud.event-card.famine-answered`도 같은 까닭이었다(렌더 A, 9d577154): `story-delay` 5초 → 8초. 이 줄에는 두 번째 원인도 있었다 — "1배속 한 순간"을 `Digit1`로 눌렀는데 그것은 겹쳐 보기 키라 시간이 흐르지 않았고, 뒤의 `Space`가 오히려 도시를 다시 흘렸다. 속도 인장(1배속 → 일시 정지)으로 바꿨다. 고친 뒤 그 줄만 잰 실행에서 첫 라운드 재시도 0. 두 줄 모두 전체 감사에서의 확인은 다음 전체 감사에서 이 표에 적는다.
- **부하가 걸리면 다시 재시도된다**(사용자 지시 2026-10-10): 고친 두 줄은 혼자 잰 실행(c4c22b36·9d577154)에서 첫 라운드에 모두 열렸지만, 15줄을 한꺼번에 잰 렌더 A의 최종 관문 실행(render-GROWUI-final-geometry-223e9ec-223e9ec)에서는 재시도 라운드를 거친 트리가 4개였다 — variant-056은 16개 조건이 첫 시도에 칩 누르기 10초를 넘겼고(4개는 세 번 실패, 재시도 라운드에서만 열림), famine-answered도 한 조건이 재시도로 열렸다(감사 로그 `_kept/render-GROWUI-final-geometry-223e9ec-223e9ec/.remote/ui-geometry/audit.log`). 혼자 잴 때의 `retried: []`는 고침의 증거가 되지 못한다: 대기 조건은 부하 아래에서 판정한다. 렌더 A가 다음 푸시(grow-kin)에서 056의 "다른 카드를 미룬 뒤" 대기를 늘려 다시 잰다. 전체 감사에서도 이 두 줄을 이 표로 지켜본다.
- `modal.chapter-page.ch3`(2026-10-10): 전체 감사 infra-RR26S-full-42df9d6에서 두 번째 시도로 열렸고(2 조건), 두 줄만 잰 infra-RR26C-rows-ed67968에서는 7개 조건이 첫 라운드에 세 번 다 `locator.waitFor` 90초를 넘겨 재시도 라운드에서만 열렸다. 줄의 대기 조건 문제로 보고 그 줄의 주인(렌더 A)에게 알린다; 판정은 그대로(모두 열림, 실패 0).
- **같은 꼴을 찾는 기준(덧붙임)**: 시간을 흘리거나 멈추는 단계는 키보드 단축키가 아니라 화면의 속도 인장으로 한다 — 단축키는 겹쳐 보기 등 다른 뜻일 수 있고, `Space`는 현재 상태를 뒤집는다.
- RR26 (a′)부터 감사가 보고서·공용 결과의 `retries`(첫 시도 시간 초과·세 번 실패·추가 시도가 든 조건 수·재시도 트리·줄)를 직접 적고, 관문(check:merge)이 새 공용 결과의 재시도 비율과 바로 앞 공용 결과에서도 재시도된 줄("retried again")을 출력한다. 이 표에는 전체 감사마다 그 숫자를 옮겨 적는다.

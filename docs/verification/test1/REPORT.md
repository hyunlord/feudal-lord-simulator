관문: ①늦게 깨는 타이머(+30 ms)에서 본선 시험 실패(섞임 캔버스 0 / 2, DGX 클론에서 본 것과 같음) → 이 가지 시험 통과 · ②DGX 100회 연속 100/100 · ③회귀·깨끗한 클론(다음 커밋에 적음)

# TEST-1 seasonArt "held chunk raster" 시험 결정론 — 검증 보고서

- **범위:** 렌더 `src/render/groundChunkCache.ts`(시계 인자 하나), 시험 `tests/seasonArt.test.ts`, 증거 스크립트 둘, 문서만 바꿨다. 엔진·상태·저장·콘텐츠·구역·인구 0줄이다.
- **근거:** [MARKET-1 보고서](../market1-reach/REPORT.md)에 따르면 깨끗한 클론 두 번(`ec5b6e4`, `a1416c1`)이 이 시험 하나로만 실패했다. 시험은 40 ms 페이드를 실제 시계(`performance.now`)로 재고, 20 ms를 재운 뒤 페이드 중간을 기대한다. DGX가 다른 실행으로 바쁘면 늦게 깨어 페이드가 끝난 뒤를 본다.

## 고친 것

1. **시계 주입:** `createGroundChunkCache(factory, clock = performance.now)`. 래스터 시간·프레임 나이·페이드가 이 시계를 쓴다. 게임은 기본값을 써서 동작이 그대로다.
2. **시험:** 가짜 시계 `clockMs`를 준다. 실제 기다림 세 번(20·30·5 ms `setTimeout`)을 `clockMs += 20 / 30 / 5`로 바꿨다. 시험은 동기(`async` 없음)가 되어, 기계가 얼마나 바쁜지와 무관하게 늘 같은 순간을 본다. 단언은 하나도 바꾸지 않았다.

## 관문

| 관문 | 결과 | 증거 |
|---|---|---|
| ① 재현과 수정 | 모든 타이머를 30 ms 늦게 깨우는 선적재(`scripts/test1LateTimers.mjs`, 바쁜 기계의 늦은 깨어남)로 본선 `7deb4fdc`의 시험을 돌리면 실패한다: "the blend: the old raster, then the new one over it — actual 0, expected 2". DGX 클론에서 본 실패와 같다. 같은 조건에서 이 가지의 시험은 7/7 통과 | `before-late-timers.log`, `after-late-timers.log` |
| ② 반복 | DGX에서 이 시험 파일 100회 연속 100/100 | `summary.json` |
| ③ 회귀·클론 | 깨끗한 클론은 이 커밋에서 돌려 다음 커밋에 적는다 | — |

## 남긴 것

- 실제 시계를 쓰는 다른 시험 둘은 속도 예산이다: CHRON-1 원장 3만 건 모델 < 120 ms, H8 1만 건 질의 다섯 번 중 최소 < 5 ms. 속도를 재는 것이 목적이라 가짜 시계가 맞지 않는다. 흔들리면 여유를 늘릴 일이다.
- `tests/buildingGrounds.test.ts`의 "held chunk raster … past the budget"은 실제 시계로 "20 ms 늦은 프레임"을 꾸미기만 한다. 부하가 오면 프레임이 더 늦어질 뿐이라 결과가 같다. 그래서 그대로 두었다.

## 시간

TIME_LINE

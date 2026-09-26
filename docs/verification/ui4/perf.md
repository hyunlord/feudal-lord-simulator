DGX frameWork (ms) median / p95 against perf/baseline-dgx-32a43dc.json, trunk 155f6aa2 and UI-4 c2b065c3 run back to back twice (npm run remote:perf).

The first pair read pop176 at 38 % (p95 4.7 against 12.3): pop176's save carries an open petition, and UI-4 opens its card ~1.5 s after loading; the card is modal, so time stopped (0 ticks in the window, against trunk's 82-83) and the frames drew a still town. The benchmark now holds the world-first delay past its window (`story-delay=600000`, ignored by older builds), so both sides run the same 82-84 ticks; the pair below is after that change.

## trunk-1
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.1 / 9.3 | 100% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.4 / 9.3 | 103% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.6 / 21.1 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.6 | 100% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 11.9 | 97% |

## ui4-1
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.1 / 9.4 | 101% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.3 / 9.3 | 103% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.6 / 21.1 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.7 | 102% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 12.4 | 101% |

## trunk-2
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 5.9 / 9.5 | 102% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.3 / 9.5 | 106% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.5 / 21.0 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.6 | 100% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 11.9 | 97% |

## ui4-2
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.1 / 9.5 | 102% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.2 / 9.4 | 104% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.5 / 20.9 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.7 | 102% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.3 / 12.2 | 99% |

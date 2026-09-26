DGX frameWork (ms) median / p95 against perf/baseline-dgx-32a43dc.json, trunk 67c8c2ec and UX-3R2 954c318 run back to back twice (npm run remote:perf).

## trunk-1
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.0 / 9.8 | 105% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.2 / 9.3 | 103% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.4 / 21.1 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.7 | 102% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.1 / 12.3 | 100% |

## ux3r2-1
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 5.8 / 9.3 | 100% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.3 / 9.3 | 103% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.4 / 21.0 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.8 | 104% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 12.2 | 99% |

## trunk-2
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 5.9 / 9.3 | 100% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.2 / 9.4 | 104% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.5 / 21.0 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.7 | 102% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 11.7 | 95% |

## ux3r2-2
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.1 / 9.3 | 100% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.3 / 9.4 | 104% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.5 / 21.2 | 101% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.9 | 105% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.1 / 11.6 | 94% |

UX-3R2 p95 94–105 %, trunk 95–105 %: the same within the DGX's run-to-run spread.

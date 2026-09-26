DGX frameWork (ms) median / p95 against perf/baseline-dgx-32a43dc.json; trunk ae9f8049 and INSTALL-15 84b17831 (code as merged) run back to back, four pairs (npm run remote:perf). `pop176turn` is pop176 80 ticks before autumn turns to winter (tick 27,000): the turn falls ~2.5 s into the ~4 s window, so its 1.5 s change is measured whole (it has no baseline row; compare it with the trunk run beside it).

The DGX was shared with other sessions during these runs. A run is valid only where its frames came at 60 fps (rAF median 16.7 ms); where they came at 30 fps or slower the whole cell is slowed and says nothing of the code:
- pair 1: trunk's own turn cell at p95 31.1 ms and INSTALL-15's steady cells at 258-514 % — invalid.
- pair 2: all cells valid (compared below).
- pair 3: INSTALL-15's run at rAF median 33.3 ms in most cells (turn cell 83.3 ms p95) — invalid.
- pair 4: the lots24 cells at rAF 33-50 ms on the trunk side — invalid there; newgame, pop176 and pop176turn at 16.7 ms on both sides — valid.

| 칸 | pair 2 본선 → INSTALL-15 p95 | 비 | pair 4 본선 → INSTALL-15 p95 | 비 |
|---|---|---|---|---|
| lots24 drag | 10.2 → 9.6 | 94 % | (무효) | |
| lots24 still | 10.1 → 9.4 | 93 % | (무효) | |
| lots24 dpr2 | 22.0 → 21.9 | 100 % | (무효) | |
| newgame | 5.8 → 6.1 | 105 % | 6.7 → 6.6 | 99 % |
| pop176 | 12.4 → 12.0 | 97 % | 14.1 → 13.4 | 95 % |
| **pop176turn (계절 전환)** | **6.1 → 6.7** | **110 %** | **7.1 → 7.5** | **106 %** |

After merging PERSON-0 (pair 5: trunk 330f05fb against INSTALL-15 177644c, rAF alike on both sides): pop176turn 7.3 -> 7.3 ms p95 (100 %); newgame 7.0 -> 6.4 (91 %), pop176 13.7 -> 13.0 (95 %), lots24 drag 12.2 -> 11.0 (90 %), still 14.4 -> 11.0, dpr2 25.6 -> 24.3.

Gate ④: season-turn frame p95 100-110 % of trunk (≤ 120 %), steady 90-105 % (≤ 110 %).

The turn in detail (`turn-timeline.json` / `turn-timeline-trunk.json`, one 240-frame window each, stage probe on): 46 of 46 visible chunks staged before the turn and used at it; window p95 7.5 against trunk 6.3 ms.

How the turn got here (DGX, same cell): first build 17.9 ms p95 against trunk 6.9 (259 %). Stage probe and a CPU profile found (1) every chunk blitted semi-transparent each frame of the fade, whose blend the software raster paid on the next draws that flushed it (buildings stage 0.3 -> 4.8 ms, `restore` 250 ms per 1.2 s), (2) trees and orchards drawn twice, (3) staging almost never ran (idle over 6 ms was rare: 0-10 of 46 chunks). Now: the ground blends in 8 steps offset per chunk, objects turn one by one, staging takes at least one chunk per 50 ms callback.

## Tables as printed

### trunk-1
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.0 / 9.4 | 101% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.8 / 9.9 | 110% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.7 / 21.0 | 100% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.3 / 5.9 | 105% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 12.5 | 102% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 6.0 / 31.1 | — |

### i15-1
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 7.7 / 11.1 | 119% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 9.6 / 33.3 | 370% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 22.9 / 67.2 | 320% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 5.8 / 28.8 | 514% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 5.9 / 31.7 | 258% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 5.9 / 11.8 | — |

### trunk-2
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.7 / 10.2 | 110% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 6.0 / 10.1 | 112% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 19.5 / 22.0 | 105% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.8 | 104% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.3 / 12.4 | 101% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 4.1 / 6.1 | — |

### i15-2
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.1 / 9.6 | 103% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.6 / 9.4 | 104% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 19.2 / 21.9 | 104% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.3 / 6.1 | 109% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.5 / 12.0 | 98% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 4.7 / 6.7 | — |

### trunk-3
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.1 / 9.5 | 102% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.3 / 9.2 | 102% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 18.6 / 21.2 | 101% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.1 / 5.6 | 100% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.2 / 11.6 | 94% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 4.1 / 6.0 | — |

### i15-3
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 6.2 / 9.8 | 105% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 5.5 / 9.7 | 108% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 19.5 / 22.1 | 105% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 5.2 / 7.3 | 130% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.3 / 12.6 | 102% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 6.4 / 45.8 | — |

### trunk-4
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 8.5 / 19.2 | 206% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 10.7 / 52.3 | 581% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 21.6 / 24.7 | 118% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 5.0 / 6.7 | 120% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 5.2 / 14.1 | 115% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 5.1 / 7.1 | — |

### i15-4
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 7.2 / 10.7 | 115% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 6.6 / 10.8 | 120% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 21.5 / 24.0 | 114% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 5.0 / 6.6 | 118% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 4.9 / 13.4 | 109% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 5.3 / 7.5 | — |

### trunk-5
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 8.2 / 12.2 | 131% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 8.7 / 14.4 | 160% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 22.4 / 25.6 | 122% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 5.1 / 7.0 | 125% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 5.3 / 13.7 | 111% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 5.2 / 7.3 | — |

### i15-5
| 칸 | 기준선 중앙 / p95 | 이번 중앙 / p95 | p95 비 |
|---|---|---|---|
| lots24-1280x800-dpr1-cpu1-drag | 5.8 / 9.3 | 7.5 / 11.0 | 118% |
| lots24-1280x800-dpr1-cpu1-still | 5.0 / 9.0 | 6.7 / 11.0 | 122% |
| lots24-1280x800-dpr2-cpu1-still | 18.3 / 21.0 | 21.5 / 24.3 | 116% |
| newgame-1280x800-dpr1-cpu1-still | 4.1 / 5.6 | 4.7 / 6.4 | 114% |
| pop176-1280x800-dpr1-cpu1-still | 4.0 / 12.3 | 5.1 / 13.0 | 106% |
| pop176turn-1280x800-dpr1-cpu1-still | — | 5.0 / 7.3 | — |

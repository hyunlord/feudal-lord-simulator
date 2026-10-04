# 성능 추이 (커밋마다, DGX)

사용자 판정(2026-09-30): 이 표로 판정한다. 본선에 푸시할 때마다 pre-push 훅이 그 커밋을 DGX에서 뒤로 잰다(`scripts/perf/trendRun.ts`, 기다리지 않음). `npm run perf:trend`가 결과를 모아 이 문서를 다시 쓴다.

- **판정 지표 넷**(결정 RR6, 모두 클수록 나쁨): JS 할당 MB/s · 힙 하락(GC)/분 · 캔버스 생성/초 · GC 뒤 남은 JS 힙 MB. 초당 값이라 DGX가 바빠 틱이 적게 돌아도 덜 흔들린다.
- **참고 칸**(표시 없음): 스크립트 시간(ms/틱·ms/프레임)은 DGX 부하에 끌려가므로(`a597617b` 큰 도시: 조용할 때 13.5 ms/틱, 전체 시험과 함께 19.9 ms/틱) **다른 일 CPU** 칸과 나란히 적기만 한다. 스크립트 시간은 `npm run perf:ab`의 A-B-A-B 짝 비교에서만 판정한다. JS 힙 끝은 GC 톱니 위 한 점(같은 커밋에서 61~90 MB), 프레임 시간(p95 등)은 DGX 소프트웨어 래스터라 참고만 한다.
- **표시**(결정 RR7): ① 이 커밋의 값(제 실행들의 중앙값)이 비교 커밋(잰 커밋 가운데 가장 가까운 조상 — DGX 실행과 같은 커밋)이 제 실행들에서 보인 범위를 그 폭만큼 양쪽으로 넓힌 범위 밖이면 **의심**이다. ② 의심이 뜨면 DGX가 비교 커밋과 이 커밋을 같은 장면에서 A-B-A-B(`perf:ab`, 45초 × 4쌍)로 자동으로 돌린다. ③ 짝 차이의 95 % 폭(쌍 수에 맞춘 t 분포, 4쌍이면 ±3.18 표준오차)이 0 위에 있으면 A-B를 한 번 더 돌리고, 두 번 모두 그럴 때만 **나빠짐**, 아래면 좋아짐, 걸치면 같음으로 끝난다. 추이는 커밋마다 다른 시간(다른 부하)에 재서 범위 규칙만으로는 흔들리고, A-B-A-B는 같은 소음을 둘이 같이 맞는다.
- **장면**: 가장 큰 도시 5×(`fixtures/perf-gate/ch4-1380`), 새 게임 3×. 각 45초 × 3회, 중앙값. 증명 포트 켬(틱 수).
- **비교가 필요하면**: `npm run perf:ab -- --a <커밋> --b <커밋>`(A-B-A-B 번갈아, 같은 소음을 둘이 같이 맞음).

**지금 나빠진 지표(A-B 확정): 없음.**

A-B를 기다리는 의심 1개: `5ad4b834 big-town-x5 heapAllocMBps 19.3(비교 dd7b668e 14.2~16.6)`

코드 시간 예산을 넘은 칸(참고): 없음.

A-B가 같음으로 끝낸 의심 150개: `a597617b big-town-x5 gcPerMin 102.5(비교 8ebdcf5c 106.3~108.5) → A-B 소음 안` · `61d79e8e big-town-x5 canvasPerSec 1.88(비교 5e214ef7 1.69~1.73) → A-B 소음 안` · `26507989 big-town-x5 canvasPerSec 2.06(비교 61d79e8e 1.74~1.89) → A-B 소음 안` · `7ef055f4 big-town-x5 heapAllocMBps 17.1(비교 26507989 21.7~22.7) → A-B 소음 안` · `7ef055f4 big-town-x5 gcPerMin 111.9(비교 26507989 94.6~102.6) → A-B 소음 안` · `7ef055f4 big-town-x5 canvasPerSec 1.93(비교 26507989 2.04~2.09) → A-B 소음 안` · `267b43b8 big-town-x5 heapAllocMBps 18.4(비교 7ef055f4 16.7~17.4) → A-B 소음 안` · `3acc04ff big-town-x5 gcPerMin 97.3(비교 267b43b8 113.2~127.8) → A-B 소음 안` · `3acc04ff big-town-x5 canvasPerSec 2.07(비교 267b43b8 1.91~1.95) → A-B 소음 안` · `83599119 big-town-x5 gcPerMin 83.9(비교 3acc04ff 95.9~101.3) → A-B 소음 안` · `ed5fd13d big-town-x5 heapAllocMBps 18.3(비교 e084513b 19.3~19.9) → A-B 소음 안` · `ed5fd13d big-town-x5 gcPerMin 105.2(비교 e084513b 87.9~91.9) → A-B 소음 안` · `ed5fd13d big-town-x5 canvasPerSec 1.91(비교 e084513b 2~2.04) → A-B 소음 안` · `c19c30a0 big-town-x5 heapAfterGcMB 37.6(비교 bc24d036 38.3~38.5) → A-B 소음 안` · `bf60912b big-town-x5 canvasPerSec 1.71(비교 2a8add3f 1.89~1.91) → A-B 소음 안` · `bf60912b big-town-x5 heapAfterGcMB 36(비교 2a8add3f 37.8~38.7) → A-B 소음 안` · `aa6aadbc big-town-x5 heapAllocMBps 25.7(비교 bf60912b 21.9~23.5) → A-B 소음 안` · `aa6aadbc big-town-x5 gcPerMin 118.4(비교 bf60912b 104.6~107.7) → A-B 소음 안` · `ba52bae3 big-town-x5 heapAllocMBps 22.5(비교 aa6aadbc 25~26.4) → A-B 소음 안` · `20eec341 big-town-x5 canvasPerSec 1.95(비교 aa6aadbc 1.66~1.8) → A-B 소음 안` · `820af8e1 big-town-x5 heapAllocMBps 25.6(비교 d3dcf72b 19.5~20.9) → A-B 소음 안` · `820af8e1 big-town-x5 canvasPerSec 1.74(비교 d3dcf72b 1.93~2.04) → A-B 소음 안` · `ff2a5c51 big-town-x5 gcPerMin 105.4(비교 820af8e1 128.9~130.9) → A-B 소음 안` · `ff2a5c51 big-town-x5 canvasPerSec 1.64(비교 820af8e1 1.74~1.76) → A-B 소음 안` · `4511b7ec big-town-x5 heapAllocMBps 23.5(비교 7f697d74 25.7~27.2) → A-B 소음 안` · `4511b7ec big-town-x5 heapAfterGcMB 36.4(비교 7f697d74 37.3~37.9) → A-B 소음 안` · `6d039cd9 big-town-x5 heapAllocMBps 23.1(비교 69734122 23.9~24.1) → A-B 소음 안` · `6d039cd9 big-town-x5 canvasPerSec 1.86(비교 69734122 1.65~1.75) → A-B 소음 안` · `19aae9c9 big-town-x5 heapAllocMBps 24.5(비교 65d5e577 25.8~26.7) → A-B 소음 안` · `f5aec50a big-town-x5 heapAllocMBps 21.6(비교 19aae9c9 24.2~24.5) → A-B 소음 안` · `f5aec50a big-town-x5 canvasPerSec 2.06(비교 19aae9c9 1.73~1.82) → A-B 소음 안` · `5a40ef34 big-town-x5 heapAfterGcMB 38.1(비교 caa1ea9f 37.1~37.4) → A-B 소음 안` · `f662b67e big-town-x5 canvasPerSec 1.56(비교 6e6b96eb 2.04~2.04) → A-B 소음 안` · `f662b67e big-town-x5 heapAfterGcMB 35.8(비교 6e6b96eb 37.7~38.1) → A-B 소음 안` · `01bb7b92 big-town-x5 heapAllocMBps 17.7(비교 f662b67e 21.3~23.1) → A-B 소음 안` · `bdf84129 big-town-x5 canvasPerSec 1.88(비교 ebbb61f4 1.89~1.89) → A-B 소음 안` · `59dab601 big-town-x5 heapAllocMBps 20.5(비교 bdf84129 14.9~17.3) → A-B 소음 안` · `59dab601 big-town-x5 gcPerMin 101.1(비교 bdf84129 113.2~116.7) → A-B 소음 안` · `eca4a97f big-town-x5 canvasPerSec 1.89(비교 9ccb98e4 1.51~1.68) → A-B 소음 안` · `2ed0fa8b big-town-x5 heapAllocMBps 19.7(비교 eca4a97f 23.1~23.4) → A-B 소음 안` · `2ed0fa8b big-town-x5 gcPerMin 127.7(비교 eca4a97f 91.3~97.4) → A-B 소음 안` · `2ed0fa8b big-town-x5 canvasPerSec 1.88(비교 eca4a97f 1.89~1.89) → A-B 소음 안` · `602fdd84 big-town-x5 heapAllocMBps 20.2(비교 2ed0fa8b 19.6~19.7) → A-B 소음 안` · `602fdd84 big-town-x5 gcPerMin 134.8(비교 2ed0fa8b 126.1~129.1) → A-B 소음 안` · `d6ae1549 big-town-x5 canvasPerSec 1.95(비교 3e3192c5 1.86~1.88) → A-B 소음 안` · `83b06802 big-town-x5 heapAllocMBps 19.5(비교 d6ae1549 22~23.2) → A-B 소음 안` · `83b06802 big-town-x5 gcPerMin 97.1(비교 d6ae1549 106.4~107.8) → A-B 소음 안` · `83b06802 big-town-x5 canvasPerSec 1.6(비교 d6ae1549 1.94~1.97) → A-B 소음 안` · `b5040e52 big-town-x5 heapAfterGcMB 35.9(비교 5f10d874 36.6~37.3) → A-B 소음 안` · `18add596 big-town-x5 gcPerMin 97.1(비교 b5040e52 106.1~110.2) → A-B 소음 안` · `18add596 big-town-x5 canvasPerSec 1.64(비교 b5040e52 1.93~1.99) → A-B 소음 안` · `b6d8f056 big-town-x5 heapAfterGcMB 36.7(비교 618c5ec2 36.2~36.3) → A-B 소음 안` · `a8834c7f big-town-x5 gcPerMin 133.6(비교 b6d8f056 93~99.1) → A-B 소음 안` · `473abcbf big-town-x5 canvasPerSec 1.81(비교 a8834c7f 1.86~1.88) → A-B 소음 안` · `ee39aa56 big-town-x5 heapAllocMBps 23.2(비교 473abcbf 16.2~18.6) → A-B 소음 안` · `ee39aa56 big-town-x5 canvasPerSec 1.55(비교 473abcbf 1.81~1.81) → A-B 소음 안` · `c2175898 big-town-x5 canvasPerSec 1.55(비교 9015d80f 1.82~2.02) → A-B 소음 안` · `c2175898 big-town-x5 heapAfterGcMB 35.8(비교 9015d80f 36.8~36.8) → A-B 소음 안` · `872cc612 big-town-x5 heapAllocMBps 19.1(비교 fe9fa8d8 22.5~23.8) → A-B 소음 안` · `872cc612 big-town-x5 gcPerMin 92.9(비교 fe9fa8d8 105~109) → A-B 소음 안` · `ce67158a big-town-x5 heapAllocMBps 26.1(비교 aca18836 22~24) → A-B 소음 안` · `ce67158a big-town-x5 gcPerMin 123.5(비교 aca18836 98.2~104) → A-B 소음 안` · `07dd3833 big-town-x5 heapAllocMBps 21.9(비교 5a04276e 25.2~27.4) → A-B 소음 안` · `3bfc3f65 big-town-x5 canvasPerSec 1.84(비교 07dd3833 1.8~1.81) → A-B 소음 안` · `5c16778d big-town-x5 heapAllocMBps 17.3(비교 3bfc3f65 20.4~21.5) → A-B 소음 안` · `5c16778d big-town-x5 gcPerMin 120(비교 3bfc3f65 102.4~107.3) → A-B 소음 안` · `8e0623aa big-town-x5 canvasPerSec 1.91(비교 5c16778d 1.81~1.82) → A-B 소음 안` · `a4650af6 big-town-x5 canvasPerSec 1.47(비교 8e0623aa 1.88~2.02) → A-B 소음 안` · `6a887ea7 big-town-x5 heapAllocMBps 15.7(비교 a4650af6 21.6~23.8) → A-B 소음 안` · `6a887ea7 big-town-x5 gcPerMin 118.9(비교 a4650af6 90.5~102.6) → A-B 소음 안` · `6a887ea7 big-town-x5 heapAfterGcMB 37.1(비교 a4650af6 35.4~35.7) → A-B 소음 안` · `00df3324 new-game-x3 gcPerMin 137.2(비교 cf04b4a7 106.5~110.6) → A-B 소음 안` · `8ebdcf5c new-game-x3 heapAllocMBps 14.2(비교 00df3324 21.5~23.1) → A-B 소음 안` · `8ebdcf5c new-game-x3 gcPerMin 72.6(비교 00df3324 109.3~145.3) → A-B 소음 안` · `e6d08a6e new-game-x3 gcPerMin 86.4(비교 a597617b 69.2~71.5) → A-B 소음 안` · `e6d08a6e new-game-x3 canvasPerSec 0.64(비교 a597617b 0.59~0.59) → A-B 소음 안` · `26507989 new-game-x3 heapAllocMBps 21.1(비교 61d79e8e 21.9~22.6) → A-B 소음 안` · `7ef055f4 new-game-x3 heapAllocMBps 24(비교 26507989 21~21.5) → A-B 소음 안` · `83599119 new-game-x3 gcPerMin 95.9(비교 3acc04ff 113.2~118.6) → A-B 소음 안` · `83599119 new-game-x3 heapAfterGcMB 20.7(비교 3acc04ff 20.4~20.5) → A-B 소음 안` · `ed5fd13d new-game-x3 gcPerMin 109.3(비교 e084513b 95.9~99.9) → A-B 소음 안` · `c52e6634 new-game-x3 heapAllocMBps 22.7(비교 37538017 23.1~23.4) → A-B 소음 안` · `0f7a45fa new-game-x3 heapAllocMBps 20.6(비교 c52e6634 22.4~23) → A-B 소음 안` · `0f7a45fa new-game-x3 gcPerMin 97.2(비교 c52e6634 114.6~126.6) → A-B 소음 안` · `bc24d036 new-game-x3 heapAllocMBps 22.8(비교 0f7a45fa 20.5~20.9) → A-B 소음 안` · `bc24d036 new-game-x3 gcPerMin 114.6(비교 0f7a45fa 95.9~98.6) → A-B 소음 안` · `bf60912b new-game-x3 heapAllocMBps 17.1(비교 2a8add3f 22.3~24) → A-B 소음 안` · `bf60912b new-game-x3 gcPerMin 75.9(비교 2a8add3f 107.9~111.9) → A-B 소음 안` · `bf60912b new-game-x3 heapAfterGcMB 20.8(비교 2a8add3f 20.5~20.6) → A-B 소음 안` · `ba52bae3 new-game-x3 heapAllocMBps 23.2(비교 aa6aadbc 15~18.8) → A-B 소음 안` · `20eec341 new-game-x3 heapAfterGcMB 21.1(비교 aa6aadbc 20.3~20.7) → A-B 소음 안` · `d3dcf72b new-game-x3 gcPerMin 111.9(비교 20eec341 82.5~89.2) → A-B 소음 안` · `ff2a5c51 new-game-x3 heapAllocMBps 16.9(비교 820af8e1 20.4~21.6) → A-B 소음 안` · `ff2a5c51 new-game-x3 gcPerMin 82.6(비교 820af8e1 99.9~99.9) → A-B 소음 안` · `44689fad new-game-x3 gcPerMin 94.6(비교 ff2a5c51 79.8~83.9) → A-B 소음 안` · `7f697d74 new-game-x3 gcPerMin 91.9(비교 44689fad 94.6~97.2) → A-B 소음 안` · `4511b7ec new-game-x3 heapAllocMBps 18.2(비교 7f697d74 19.1~19.7) → A-B 소음 안` · `65d5e577 new-game-x3 gcPerMin 79.9(비교 6d039cd9 93.2~95.8) → A-B 소음 안` · `f5aec50a new-game-x3 gcPerMin 94.6(비교 19aae9c9 73.1~77) → A-B 소음 안` · `caa1ea9f new-game-x3 gcPerMin 89.2(비교 b90c0eca 91.9~93.3) → A-B 소음 안` · `5a40ef34 new-game-x3 heapAllocMBps 21.1(비교 caa1ea9f 20.3~20.6) → A-B 소음 안` · `6e6b96eb new-game-x3 heapAllocMBps 20.8(비교 5a40ef34 21.1~21.4) → A-B 소음 안` · `f662b67e new-game-x3 heapAllocMBps 13.5(비교 6e6b96eb 19.1~22) → A-B 소음 안` · `f662b67e new-game-x3 canvasPerSec 0.65(비교 6e6b96eb 0.64~0.64) → A-B 소음 안` · `01bb7b92 new-game-x3 gcPerMin 97.1(비교 f662b67e 63.8~80.3) → A-B 소음 안` · `ebbb61f4 new-game-x3 heapAllocMBps 22.6(비교 01bb7b92 18.4~20.1) → A-B 소음 안` · `bdf84129 new-game-x3 heapAllocMBps 21.6(비교 ebbb61f4 22.4~22.6) → A-B 소음 안` · `59dab601 new-game-x3 heapAllocMBps 21(비교 bdf84129 21.6~21.7) → A-B 소음 안` · `e120273a new-game-x3 heapAllocMBps 15.7(비교 59dab601 21~22.2) → A-B 소음 안` · `e120273a new-game-x3 gcPerMin 74.5(비교 59dab601 113.3~119.9) → A-B 소음 안` · `5a15e62d new-game-x3 heapAllocMBps 17.8(비교 e120273a 15.5~16.5) → A-B 소음 안` · `5a15e62d new-game-x3 gcPerMin 83.8(비교 e120273a 74.5~75.9) → A-B 소음 안` · `f0cb3105 new-game-x3 heapAllocMBps 13.1(비교 5a15e62d 17.3~18.2) → A-B 소음 안` · `f0cb3105 new-game-x3 gcPerMin 69.2(비교 5a15e62d 82.6~87.9) → A-B 소음 안` · `f0cb3105 new-game-x3 canvasPerSec 0.65(비교 5a15e62d 0.64~0.64) → A-B 소음 안` · `2c34faac new-game-x3 heapAllocMBps 14.4(비교 6c954293 11~12.4) → A-B 소음 안` · `eca4a97f new-game-x3 heapAllocMBps 20.9(비교 9ccb98e4 13.5~15.6) → A-B 소음 안` · `eca4a97f new-game-x3 gcPerMin 115.9(비교 9ccb98e4 73.2~85.3) → A-B 소음 안` · `2ed0fa8b new-game-x3 heapAllocMBps 21.8(비교 eca4a97f 20.6~21) → A-B 소음 안` · `2ed0fa8b new-game-x3 gcPerMin 106.6(비교 eca4a97f 113.3~119.9) → A-B 소음 안` · `3e3192c5 new-game-x3 heapAllocMBps 16.4(비교 602fdd84 15.7~15.9) → A-B 소음 안` · `3e3192c5 new-game-x3 heapAfterGcMB 20(비교 602fdd84 19.8~19.9) → A-B 소음 안` · `d6ae1549 new-game-x3 heapAllocMBps 15.1(비교 3e3192c5 16.1~16.4) → A-B 소음 안` · `83b06802 new-game-x3 heapAllocMBps 13.6(비교 d6ae1549 15~15.7) → A-B 소음 안` · `83b06802 new-game-x3 heapAfterGcMB 19.7(비교 d6ae1549 19.8~19.9) → A-B 소음 안` · `5f10d874 new-game-x3 heapAllocMBps 19.8(비교 83b06802 13~13.9) → A-B 소음 안` · `5f10d874 new-game-x3 gcPerMin 90.5(비교 83b06802 62.7~75.7) → A-B 소음 안` · `b5040e52 new-game-x3 heapAllocMBps 14.1(비교 5f10d874 19.4~21.6) → A-B 소음 안` · `b5040e52 new-game-x3 gcPerMin 67.8(비교 5f10d874 87.9~98.6) → A-B 소음 안` · `b5040e52 new-game-x3 canvasPerSec 0.67(비교 5f10d874 0.64~0.64) → A-B 소음 안` · `b6d8f056 new-game-x3 gcPerMin 93.3(비교 618c5ec2 71.8~79.8) → A-B 소음 안` · `a8834c7f new-game-x3 heapAllocMBps 21.7(비교 b6d8f056 18.6~19.4) → A-B 소음 안` · `a8834c7f new-game-x3 gcPerMin 115.9(비교 b6d8f056 91.9~94.5) → A-B 소음 안` · `473abcbf new-game-x3 heapAllocMBps 18.8(비교 a8834c7f 20.5~21.8) → A-B 소음 안` · `473abcbf new-game-x3 gcPerMin 94.5(비교 a8834c7f 114.6~119.9) → A-B 소음 안` · `473abcbf new-game-x3 heapAfterGcMB 20(비교 a8834c7f 19.8~19.9) → A-B 소음 안` · `c2175898 new-game-x3 heapAllocMBps 12.3(비교 9015d80f 12.9~13.2) → A-B 소음 안` · `ba9203c5 new-game-x3 heapAfterGcMB 19.8(비교 c63b776f 19.6~19.7) → A-B 소음 안` · `c2460918 new-game-x3 gcPerMin 69.3(비교 ba9203c5 57.1~61.2) → A-B 소음 안` · `aca18836 new-game-x3 heapAllocMBps 16.1(비교 c2460918 12.2~12.7) → A-B 소음 안` · `07dd3833 new-game-x3 heapAfterGcMB 19.9(비교 5a04276e 20~20) → A-B 소음 안` · `3bfc3f65 new-game-x3 heapAllocMBps 16.8(비교 07dd3833 21.6~23) → A-B 소음 안` · `3bfc3f65 new-game-x3 gcPerMin 77.2(비교 07dd3833 110.6~121.2) → A-B 소음 안` · `5c16778d new-game-x3 heapAllocMBps 21.8(비교 3bfc3f65 16.2~17.3) → A-B 소음 안` · `5c16778d new-game-x3 gcPerMin 114.5(비교 3bfc3f65 75.9~86.6) → A-B 소음 안` · `8e0623aa new-game-x3 canvasPerSec 0.69(비교 5c16778d 0.64~0.64) → A-B 소음 안` · `6a887ea7 new-game-x3 heapAllocMBps 21.2(비교 a4650af6 10.2~12.3) → A-B 소음 안` · `6a887ea7 new-game-x3 gcPerMin 121.2(비교 a4650af6 62.5~71.8) → A-B 소음 안` · `dd7b668e new-game-x3 heapAllocMBps 23(비교 6a887ea7 20.9~21.6) → A-B 소음 안` · `dd7b668e new-game-x3 gcPerMin 110.6(비교 6a887ea7 117.3~123.9) → A-B 소음 안`

## big-town-x5

| 커밋 | 날짜 | JS 할당 MB/s | 힙 하락(GC)/분 | 캔버스 생성/초 | GC 뒤 남은 JS 힙 MB | 다른 일 CPU(DGX 전체 코어 중) | 스크립트 ms/틱(참고) | 스크립트 ms/프레임(참고) | JS 할당 KB/틱(참고) | 캔버스 생성/1천 틱(참고) | 비트맵/초(참고) | getImageData/초(참고) | JS 힙 끝 MB(참고, GC 톱니 위 한 점) | p95 ms(DGX, 참고) | 33 ms 초과/분(DGX, 참고) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `5ad4b834` INBOX-3u: landmark rework — bridge B1–B3 and guild | 2026-10-03 13:24 | 19.3 의심(A-B 대기) | 127.2 | 1.81 | 38.3 | 0.31 | 17.555 | 18.768 | 495.3 | 216.4 | 0 | 0 | 52.4 | 50 | 1220.1 |
| `dd7b668e` DOC: content drafts v3 filed in docs/design/conten | 2026-10-03 13:20 | 16.3 | 121.3 | 1.81 | 37.7 | 0.29 | 17.444 | 17.453 | 417.1 | 214.2 | 0 | 0 | 63 | 33.4 | 1174.9 |
| `6a887ea7` Fill the NAT-5 report's gate line and record the o | 2026-10-03 06:29 | 15.7 의심→같음(A-B) | 118.9 의심→같음(A-B) | 1.81 | 37.1 의심→같음(A-B) | 0.28 | 17.405 | 17.519 | 402.8 | 215.2 | 0 | 0 | 68.4 | 33.4 | 1202 |
| `a4650af6` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-03 04:57 | 23.7 | 99.7 | 1.47 의심→같음(A-B) | 35.5 | 0.36 | 26.075 | 64.226 | 972.2 | 310.9 | 0 | 0 | 59 | 216.7 | 547.8 |
| `8e0623aa` INBOX-3t: world event staging candidates — 25 new  | 2026-10-03 04:09 | 21.7 | 100.7 | 1.91 의심→같음(A-B) | 36.7 | 0.31 | 18.362 | 50.184 | 522.3 | 244.5 | 0 | 0 | 63.2 | 116.7 | 832.1 |
| `5c16778d` DOC: install-plan fragments renamed to .fragments. | 2026-10-03 04:02 | 17.3 의심→같음(A-B) | 120 의심→같음(A-B) | 1.81 | 37.2 | 0.41 | 17.745 | 19.996 | 442.3 | 215.6 | 0 | 0 | 76.3 | 50 | 1283.2 |
| `3bfc3f65` INBOX-3q: the 16 wall strip corners and their 97 r | 2026-10-03 03:57 | 21.3 | 103.6 좋아짐(A-B) | 1.84 의심→같음(A-B) | 36.3 | 0.31 | 18.195 | 48.127 | 526.1 | 238.8 | 0 | 0 | 69.9 | 116.7 | 854.2 |
| `07dd3833` perf-trend: refreshed after a merge (the page was  | 2026-10-03 02:56 | 21.9 의심→같음(A-B) | 133 | 1.8 | 36.8 | 0.21 | 17.672 | 20.282 | 562.8 | 221.3 | 0 | 0 | 86.5 | 50 | 1267.1 |
| `5a04276e` INBOX-3p: trade world pictures received — 128 LM-E | 2026-10-03 02:53 | 26.8 | 125.7 | 1.8 | 36.7 | 0.31 | 18.009 | 26.753 | 684.1 | 217.3 | 0 | 0 | 58.8 | 66.7 | 1234.2 |
| `ce67158a` INBOX-3o: event illustration rework received — the | 2026-10-03 02:52 | 26.1 의심→같음(A-B) | 123.5 의심→같음(A-B) | 1.8 | 37.3 | 0.33 | 18.012 | 26.681 | 667.7 | 218.5 | 0 | 0 | 76.6 | 66.7 | 1211.8 |
| `aca18836` strip-corners: records/README notes that blind rou | 2026-10-03 02:42 | 22.1 | 98.4 | 1.64 | 35.4 | 0.3 | 24.123 | 64.328 | 903.9 | 335.9 | 0 | 0 | 84.1 | 216.6 | 573.2 |
| `c2460918` INBOX-3n: wall strip corners received — 16 corners | 2026-10-03 02:38 | 21.5 | 90.4 | 1.64 | 35.5 | 0.32 | 24.363 | 59.804 | 803.6 | 314.1 | 0 | 0 | 67.7 | 200.1 | 613.2 |
| `ba9203c5` INBOX-3m: event illustrations received — 35 pictur | 2026-10-03 02:26 | 20.200000000000003 | 97.65 | 1.5750000000000002 | 35.55 | 0.375 | 25.0435 | 65.33449999999999 | 776.75 | 293.1 | 0 | 0 | 59.849999999999994 | 216.7 | 567.45 |
| `c63b776f` INBOX-3l: region atlas received — 20 hand-painted- | 2026-10-03 02:22 | 21.4 | 93.5 | 1.64 | 36.4 | 0.38 | 25.94 | 66.431 | 935.6 | 346 | 0 | 0 | 73.7 | 250 | 541 |
| `d15ed728` INBOX-3k: region map kit candidates judged — 8 roa | 2026-10-03 01:58 | 20.6 | 98.5 | 1.57 | 35.4 | 0.35 | 24.148 | 62.585 | 814.6 | 318 | 0 | 0 | 76.3 | 249.9 | 557.4 |
| `25c766b6` INBOX-3j: the last pictures outside the ledger get | 2026-10-03 01:54 | 20.2 | 90 | 1.58 | 35.5 | 0.34 | 28.522 | 67.539 | 881.7 | 370.8 | 0 | 0 | 69.3 | 233.4 | 538.5 |
| `872cc612` INBOX-3h: the one picture missing from the ledger  | 2026-10-03 01:47 | 19.1 의심→같음(A-B) | 92.9 의심→같음(A-B) | 1.55 | 35.4 | 0.33 | 22.784 | 56.765 | 779.5 | 347.1 | 0 | 0 | 71.8 | 200 | 637.7 |
| `fe9fa8d8` INBOX-3g: the 8 pictures 11ca755e (BLD-01, ENV-03, | 2026-10-03 01:36 | 23.8 | 106.4 | 1.64 | 35.4 | 0.35 | 21.77 | 56.165 | 802.4 | 318.9 | 0 | 0 | 82.2 | 199.9 | 658.3 |
| `c2175898` INBOX-3f: corner verdicts changed — stone corner v | 2026-10-03 01:26 | 22.2 | 101.1 | 1.55 의심→같음(A-B) | 35.8 의심→같음(A-B) | 0.33 | 25.716 | 63.828 | 890.5 | 338.6 | 0 | 0 | 64.6 | 200 | 601.4 |
| `9015d80f` INBOX-3e: era pilot received — 18 era portraits co | 2026-10-03 01:14 | 21.8 | 109.3 | 1.9 | 36.8 | 0.34 | 21.226 | 55.272 | 645.6 | 292.4 | 0 | 0 | 78.8 | 150 | 742.7 |
| `ee39aa56` INBOX-3d: storehouse snow layers and gate corner p | 2026-10-03 01:11 | 23.2 의심→같음(A-B) | 101.2 | 1.55 의심→같음(A-B) | 36 | 0.32 | 23.633 | 57.189 | 751.5 | 284.4 | 0 | 0 | 71.2 | 166.7 | 679.7 |
| `473abcbf` QA: vision checker holdout round filed in docs/qa/ | 2026-10-03 00:32 | 17.5 | 110.8 | 1.81 의심→같음(A-B) | 36.2 | 0.24 | 17.569 | 18.626 | 448.4 | 216.1 | 0 | 0 | 87.8 | 49.9 | 1234.2 |
| `a8834c7f` DOC: Astra neighbor world filed as design records  | 2026-10-03 00:23 | 22.8 | 133.6 의심→같음(A-B) | 1.88 | 37.1 | 0.29 | 17.662 | 21.807 | 583.5 | 222.6 | 0 | 0 | 53.6 | 50.1 | 1302 |
| `b6d8f056` tools/vision-check README: points to the expansion | 2026-10-03 00:15 | 24.7 | 98 | 1.77 | 36.7 의심→같음(A-B) | 0.32 | 17.689 | 34.023 | 632.5 | 216 | 0 | 0 | 68 | 83.4 | 1019.8 |
| `618c5ec2` QA: vision checker expansion round filed in docs/q | 2026-10-02 23:38 | 22.8 | 101.3 | 1.85 | 36.2 | 0.42 | 20.815 | 49.798 | 642.4 | 250.5 | 0 | 0 | 53.1 | 133.3 | 809.1 |
| `18add596` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 22:16 | 21.6 | 97.1 의심→같음(A-B) | 1.64 의심→같음(A-B) | 35.9 | 0.44 | 25.042 | 60.988 | 910.8 | 317 | 0 | 0 | 70 | 266.6 | 538.6 |
| `b5040e52` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 21:44 | 22.7 | 109 | 1.95 | 35.9 의심→같음(A-B) | 0.34 | 20.914 | 54.108 | 683.6 | 283.8 | 0 | 0 | 56.7 | 150 | 749.5 |
| `5f10d874` DOC: content drafts v2 filed in docs/design/conten | 2026-10-02 21:35 | 25.3 | 104.1 | 1.86 | 36.6 | 0.33 | 18.03 | 29.929 | 651.2 | 223.8 | 0 | 0 | 56.4 | 83.3 | 1116.9 |
| `83b06802` DOC: Astra content drafts filed as design records  | 2026-10-02 20:38 | 19.5 의심→같음(A-B) | 97.1 의심→같음(A-B) | 1.6 의심→같음(A-B) | 36 | 0.38 | 21.703 | 56.578 | 621.5 | 280.2 | 0 | 0 | 61.5 | 166.7 | 713.1 |
| `d6ae1549` Dispatch ledger: REMOTE·문서 session's two items tic | 2026-10-02 19:23 | 22.9 | 107.1 | 1.95 의심→같음(A-B) | 35.7 | 0.34 | 21.223 | 50.743 | 688.4 | 264.8 | 0 | 0 | 69.2 | 150.1 | 739.4 |
| `3e3192c5` Dispatch ledger: INBOX session's seven items ticke | 2026-10-02 19:06 | 21.9 | 103.9 | 1.86 | 36.4 | 0.3 | 20.278 | 45.743 | 626.8 | 245.5 | 0 | 0 | 71.8 | 116.7 | 815.6 |
| `602fdd84` Dispatch ledger filed as received in docs/ops/DISP | 2026-10-02 19:04 | 20.2 의심→같음(A-B) | 134.8 의심→같음(A-B) | 1.88 | 36.6 | 0.27 | 17.625 | 20.261 | 516.1 | 223 | 0 | 0 | 56.8 | 50 | 1262 |
| `2ed0fa8b` QA round 17 filed in docs/qa/round17 — new lands 5 | 2026-10-02 18:49 | 19.7 의심→같음(A-B) | 127.7 의심→같음(A-B) | 1.88 의심→같음(A-B) | 37.8 | 0.26 | 17.554 | 20.233 | 503.7 | 220.6 | 0 | 0 | 55.4 | 50 | 1247.5 |
| `eca4a97f` FIX-14: ui-geometry on the merged head 532f3cd (1, | 2026-10-02 17:33 | 23.2 | 92.6 | 1.89 의심→같음(A-B) | 36.7 | 0 | 16.782 | 14.627 | 592.9 | 219.4 | 0 | 0 | 71.8 | 33.4 | 873.8 |
| `9ccb98e4` DOC: lord-mode tutorial filed as design records in | 2026-10-02 15:43 | 21.6 | 95.5 | 1.61 | 35 | 0.32 | 24.218 | 60.57 | 821.9 | 296.3 | 0 | 0 | 66 | 199.9 | 612.2 |
| `2c34faac` Game title: Charter & Kin (Korean 인장과 가문), replaci | 2026-10-02 15:42 | 22.5 | 99.4 | 1.64 | 35.6 | 0.32 | 23.434 | 58.901 | 837.9 | 334.8 | 0 | 0 | 71.9 | 216.6 | 614.2 |
| `6c954293` INBOX-3c: Wave 42 bramble v3 received — abandoned_ | 2026-10-02 15:38 | 22 | 96.7 | 1.64 | 36.2 | 0.37 | 22.188 | 56.824 | 733 | 287.1 | 0 | 0 | 69.4 | 183.4 | 663.4 |
| `f0cb3105` INBOX-3b: Wave 42 rework v2 received — saplings 1– | 2026-10-02 15:31 | 21.1 | 102.4 | 1.82 | 36.7 | 0.31 | 20.121 | 49.631 | 633.3 | 288.7 | 0 | 0 | 85.5 | 149.9 | 785 |
| `5a15e62d` INBOX-3a: Waves 42, 43 and 44 received — Wave 42 l | 2026-10-02 15:14 | 22.7 | 103.3 | 1.84 | 36.5 | 0.4 | 19.953 | 46.374 | 644.7 | 265.7 | 0 | 0 | 65.2 | 116.8 | 845.5 |
| `e120273a` perf-trend: 47 trunk commits with 6e6b96eb (re-mea | 2026-10-02 15:05 | 21.2 | 91.8 | 1.88 | 36.9 | 0.38 | 19.503 | 47.28 | 593 | 258.8 | 0 | 0 | 72.8 | 133.3 | 823.2 |
| `59dab601` Remote runs hold their lock from before the folder | 2026-10-02 14:11 | 20.5 의심→같음(A-B) | 101.1 의심→같음(A-B) | 1.89 | 37.4 | 0.31 | 17.389 | 29.925 | 517.9 | 229.6 | 0 | 0 | 54.5 | 83.4 | 991.4 |
| `bdf84129` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 12:54 | 15.8 | 115.5 | 1.88 의심→같음(A-B) | 36.8 | 0.21 | 17.475 | 17.795 | 404.9 | 219.4 | 0 | 0 | 69.7 | 33.4 | 1214 |
| `ebbb61f4` Trunk-push trend runs start fully apart from the p | 2026-10-02 11:35 | 15.9 | 102.4 | 1.89 | 36.9 | 0.22 | 17.439 | 17.512 | 408.1 | 224.8 | 0 | 0 | 69.5 | 33.4 | 1168.4 |
| `01bb7b92` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 11:19 | 17.7 의심→같음(A-B) | 97.2 | 1.89 좋아짐(A-B) | 36.7 | 0.34 | 17.448 | 17.756 | 454.3 | 224.3 | 0 | 0 | 62.3 | 33.4 | 1226.7 |
| `f662b67e` INBOX-2z: Wave 41 LAND-UI session's take on the sa | 2026-10-02 10:42 | 22.2 | 105.7 | 1.56 의심→같음(A-B) | 35.8 의심→같음(A-B) | 0.35 | 17.488 | 47.111 | 550.2 | 226.3 | 0 | 0 | 68.5 | 116.8 | 808.2 |
| `6e6b96eb` INBOX-2y: Wave 41 additions received and confirmed | 2026-10-02 10:30 | 20.8 | 87.9 | 2.04 | 37.7 | 0.02 | 9.57 | 15.364 | 309.6 | 195.8 | 0 | 0 | 62.7 | 33.4 | 1043.3 |
| `5a40ef34` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 08:32 | 20.3 | 83.9 | 2.04 | 38.1 의심→같음(A-B) | 0.06 | 9.66 | 16.092 | 302.4 | 201.2 | 0 | 0 | 70.6 | 33.4 | 1124.5 |
| `caa1ea9f` INBOX-2x: Wave 41 redraws received and confirmed — | 2026-10-02 08:31 | 20.3 | 82.6 | 2.02 | 37.3 | 0.02 | 9.652 | 16.139 | 302.1 | 197.8 | 0 | 0 | 77.7 | 33.4 | 1138.8 |
| `b90c0eca` LAND-UI: the clean clone on the merged head 21d558 | 2026-10-02 02:12 | 21.8 | 86.6 | 2.04 | 38.3 | 0 | 9.643 | 15.953 | 324.9 | 201.3 | 0 | 0 | 81.3 | 33.4 | 1112.6 |
| `f5aec50a` LM-E5: report (three seeds three towns, the same s | 2026-10-02 01:52 | 21.6 의심→같음(A-B) | 90.6 | 2.06 의심→같음(A-B) | 38.3 | 0 | 9.506 | 14.97 | 321.2 | 203.5 | 0 | 0 | 73.5 | 33.4 | 1008.3 |
| `19aae9c9` INBOX-2w: lord-mode screen components received and | 2026-10-02 01:04 | 24.5 의심→같음(A-B) | 105.1 | 1.75 | 36.9 | 0.38 | 17.581 | 54.724 | 606.9 | 244.7 | 0 | 0 | 70 | 166.7 | 693.4 |
| `65d5e577` DOC: art audit links resolve in the repo — evidenc | 2026-10-02 01:00 | 26.3 | 109.1 | 1.71 | 37.3 | 0.36 | 13.862 | 34.225 | 524 | 188.4 | 0 | 0 | 72.5 | 83.4 | 994.6 |
| `6d039cd9` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 00:58 | 23.1 의심→같음(A-B) | 103.8 | 1.86 의심→같음(A-B) | 37.7 | 0.33 | 14.349 | 39.79 | 492.6 | 191.4 | 0 | 0 | 66.1 | 100 | 920.7 |
| `69734122` DOC: Astra art audit filed as design records — ART | 2026-10-02 00:46 | 24 | 107.8 | 1.71 | 37.8 | 0.31 | 13.939 | 36.569 | 477.6 | 205.5 | 0 | 0 | 70.6 | 99.9 | 977.9 |
| `7c9feef8` DOC: lord-mode screen mockups gain their assembly  | 2026-10-02 00:44 | 21.8 | 105.1 | 1.75 | 37.2 | 0.33 | 16.158 | 47.201 | 505.8 | 219.6 | 0 | 0 | 59.8 | 116.7 | 810.1 |
| `a754affe` Roadmap: LM-E5 living growth (random seeds shown a | 2026-10-02 00:42 | 23.3 | 111.6 | 1.68 | 37.6 | 0.32 | 17.125 | 42.16 | 532.1 | 197 | 0 | 0 | 66.6 | 116.7 | 858.3 |
| `4511b7ec` DOC: two deep-research reports filed as received ( | 2026-10-02 00:39 | 23.5 의심→같음(A-B) | 107.8 | 1.69 | 36.4 의심→같음(A-B) | 0.32 | 13.582 | 34.588 | 451.7 | 191.6 | 0 | 0 | 78 | 83.4 | 988.9 |
| `7f697d74` DOC: Astra lord-mode screen mockups filed as desig | 2026-10-02 00:34 | 25.8 | 111.8 | 1.69 | 37.5 | 0.26 | 13.65 | 31.899 | 506.1 | 175.6 | 0 | 0 | 78.7 | 83.4 | 1011.5 |
| `44689fad` Branch archive: hyunlord/organic-curved-land-desig | 2026-10-02 00:32 | 25.5 | 115.8 | 1.73 | 36.8 | 0.31 | 13.319 | 31.255 | 492.4 | 190.6 | 0 | 0 | 72.8 | 83.3 | 1048.8 |
| `ff2a5c51` perf-trend: 27 trunk commits up to 820af8e1, every | 2026-10-02 00:14 | 23.7 | 105.4 의심→같음(A-B) | 1.64 의심→같음(A-B) | 36.5 | 0.33 | 17.489 | 45.613 | 610.1 | 208.2 | 0 | 0 | 61.3 | 116.7 | 816.8 |
| `820af8e1` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 23:13 | 25.6 의심→같음(A-B) | 129.7 | 1.74 의심→같음(A-B) | 37.1 | 0.3 | 11.408 | 26.269 | 438.4 | 174.3 | 0 | 0 | 73.4 | 66.7 | 1180.3 |
| `d3dcf72b` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 23:05 | 19.8 | 111.9 | 1.95 | 38 | 0.22 | 9.802 | 17.459 | 296.3 | 199 | 0 | 0 | 73.1 | 33.4 | 1228.5 |
| `20eec341` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 22:39 | 22.5 좋아짐(A-B) | 103.8 | 1.95 의심→같음(A-B) | 37.6 | 0.2 | 9.796 | 17.335 | 334.3 | 194.4 | 0 | 0 | 76.5 | 33.4 | 1064.7 |
| `ba52bae3` Wall-clock tests (decision RR9): four put on count | 2026-10-01 21:29 | 22.5 의심→같음(A-B) | 117.2 | 1.91 | 36.9 | 0.3 | 10.233 | 26.98 | 362.6 | 203.3 | 0 | 0 | 78.2 | 66.7 | 1277.2 |
| `aa6aadbc` perf-trend: 22 trunk commits up to bf60912b, every | 2026-10-01 20:26 | 25.7 의심→같음(A-B) | 118.4 의심→같음(A-B) | 1.71 | 36.6 | 0.37 | 13.653 | 36.522 | 511.2 | 174.8 | 0 | 0 | 70 | 100 | 993.2 |
| `bf60912b` INBOX-2v: Wave 38 UI controls, its rework and Wave | 2026-10-01 19:57 | 22.9 | 106.4 | 1.71 의심→같음(A-B) | 36 의심→같음(A-B) | 0.42 | 19.074 | 56.513 | 619.6 | 251.9 | 0 | 0 | 73.5 | 150 | 694 |
| `2a8add3f` Wire Graft context graph into Claude Code and Code | 2026-10-01 19:12 | 19.8 | 129.2 | 1.91 | 38.1 | 0.31 | 9.92 | 20.348 | 292.6 | 200.6 | 0 | 0 | 74.8 | 50 | 1353.2 |
| `c19c30a0` QA round 16 on c52e6634: QA034, QA016 and QA010 cl | 2026-10-01 19:09 | 18.6 | 113.2 | 1.93 | 37.6 의심→같음(A-B) | 0.21 | 9.917 | 18.975 | 280.1 | 200.1 | 0 | 0 | 66.6 | 50 | 1301.3 |
| `bc24d036` LM-E3: ui-geometry on the merged head 100e193 (eng | 2026-10-01 18:35 | 19.3 | 114.5 | 1.95 | 38.4 | 0.22 | 9.847 | 17.94 | 288.6 | 199.9 | 0 | 0 | 67.3 | 49.9 | 1251.5 |
| `0f7a45fa` QA-034 second surface: gates on 4d1d089 — geometry | 2026-10-01 17:52 | 18.9 | 106.5 | 1.93 | 38 | 0.21 | 9.882 | 18.362 | 283.4 | 194.4 | 0 | 0 | 78.1 | 49.9 | 1310.1 |
| `c52e6634` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 16:02 | 19.7 | 107.9 | 1.95 | 38.4 | 0.2 | 9.827 | 18.085 | 293 | 196.4 | 0 | 0 | 80.2 | 49.9 | 1245.3 |
| `37538017` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 15:51 | 18.8 | 114.5 | 1.93 | 38.4 | 0.21 | 10.076 | 19.865 | 283.7 | 192.9 | 0 | 0 | 72.1 | 50 | 1320.4 |
| `ed5fd13d` QA round 15: UI-AUDIT-1 recheck on 3acc04ff (fixed | 2026-10-01 14:30 | 18.3 의심→같음(A-B) | 105.2 의심→같음(A-B) | 1.91 의심→같음(A-B) | 37.8 | 0.23 | 9.836 | 18.089 | 270.8 | 202 | 0 | 0 | 73 | 49.9 | 1282.6 |
| `e084513b` QA rounds 03-14 consolidated: 33 numbered findings | 2026-10-01 14:05 | 19.9 | 90.6 | 2.02 | 38.1 | 0.04 | 9.618 | 15.962 | 295.5 | 200.5 | 0 | 0 | 61.3 | 33.4 | 1113.5 |
| `83599119` LM-E2: ui-geometry refreshed on 4030083 (engine-LM | 2026-10-01 14:05 | 20.9 | 83.9 의심→같음(A-B) | 2.02 | 38.4 | 0.04 | 9.582 | 15.776 | 309.9 | 202.2 | 0 | 0 | 64 | 33.4 | 1102.8 |
| `3acc04ff` Record UI-AUDIT-1's gates on the tree with trunk m | 2026-10-01 13:33 | 21.4 | 97.3 의심→같음(A-B) | 2.07 의심→같음(A-B) | 38.2 | 0 | 9.429 | 14.777 | 319.7 | 200.1 | 0 | 0 | 68.4 | 33.4 | 984.6 |
| `267b43b8` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 12:18 | 18.4 의심→같음(A-B) | 114.5 | 1.93 | 37.8 | 0.23 | 9.914 | 18.605 | 274.8 | 197.9 | 0 | 0 | 70.6 | 50 | 1308.8 |
| `7ef055f4` perf:ab and the trend's A-B confirmation judge wit | 2026-10-01 11:53 | 17.1 의심→같음(A-B) | 111.9 의심→같음(A-B) | 1.93 의심→같음(A-B) | 37.6 | 0.27 | 9.839 | 18.541 | 255.6 | 199.7 | 0 | 0 | 71.2 | 50 | 1318.1 |
| `26507989` LM-E1: clean clone 29c1a87 4,048/4,048; report gat | 2026-10-01 04:01 | 22.3 | 99.9 | 2.06 의심→같음(A-B) | 38 | 0 | 9.45 | 14.767 | 330.5 | 200.2 | 0 | 0 | 61.7 | 33.4 | 976.3 |
| `61d79e8e` perf-trend judges four per-second metrics (JS allo | 2026-10-01 01:33 | 23.6 | 119.8 | 1.88 의심→같음(A-B) | 36.6 | 0.46 | 11.382 | 26.987 | 384.6 | 179.9 | 0 | 0 | 61.1 | 66.7 | 1223.9 |
| `5e214ef7` Decisions: the keep-judgement-runs decision is RR5 | 2026-10-01 01:27 | 24.2 | 118.5 | 1.73 | 37.1 | 0.43 | 14.088 | 35.219 | 510.1 | 193.1 | 0 | 0 | 63.1 | 100 | 960.9 |
| `bfb0d430` perf-trend: five trunk commits re-measured with th | 2026-10-01 00:54 | 23.2 | 123.8 | 1.91 | 37.4 | 0.37 | 10.118 | 23.115 | 346.5 | 194.6 | 0 | 0 | 69 | 50.1 | 1333.2 |
| `e6d08a6e` perf-trend: the four backfilled trunk commits (big | 2026-09-30 22:39 | 23 | 105.7 | 1.62 | 36.7 | 0.42 | 17.442 | 47.796 | 577.2 | 220.7 | 0 | 0 | 56.1 | 133.3 | 810.3 |
| `a597617b` Merge remote-tracking branch 'origin/codex/phase15 | 2026-09-30 13:53 | 23.1 | 102.5 의심→같음(A-B) | 1.77 | 36.5 | 0.44 | 18.429 | 54.793 | 615 | 276.4 | 0 | 0 | 74.8 | 166.7 | 679.4 |
| `8ebdcf5c` NAT-2: decision D8 names the regenerated C25 board | 2026-09-30 13:39 | 22.2 | 107.5 | 1.73 | 35.7 | 0.42 | 18.314 | 53.819 | 569.1 | 223.7 | 0 | 0 | 70.9 | 150.1 | 703.6 |
| `00df3324` INBOX-2q: Wave 37 doorstep trade and condition pro | 2026-09-30 13:21 | 17.2 좋아짐(A-B) | 113.2 | 1.91 좋아짐(A-B) | 37 | 0.21 | 9.782 | 17.935 | 256.5 | 202 | 0 | 0 | 68.3 | 50 | 1221.9 |
| `cf04b4a7` QA-2: Astra observation QA round 02 kept in docs/q | 2026-09-30 10:59 | 27.2 | 127.8 | 5.92 | 35.2 | 0.36 | 11.433 | 26.387 | 458.5 | 1723.8 | 85.68 | 0.1 | 66.9 | 66.7 | 1229.9 |

## new-game-x3

| 커밋 | 날짜 | JS 할당 MB/s | 힙 하락(GC)/분 | 캔버스 생성/초 | GC 뒤 남은 JS 힙 MB | 다른 일 CPU(DGX 전체 코어 중) | 스크립트 ms/틱(참고) | 스크립트 ms/프레임(참고) | JS 할당 KB/틱(참고) | 캔버스 생성/1천 틱(참고) | 비트맵/초(참고) | getImageData/초(참고) | JS 힙 끝 MB(참고, GC 톱니 위 한 점) | p95 ms(DGX, 참고) | 33 ms 초과/분(DGX, 참고) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `5ad4b834` INBOX-3u: landmark rework — bridge B1–B3 and guild | 2026-10-03 13:24 | 21.9 | 114.6 | 0.64 | 20.2 | 0.32 | 9.64 | 4.783 | 785.5 | 71.5 | 0 | 0 | 44.5 | 33.3 | 222.5 |
| `dd7b668e` DOC: content drafts v3 filed in docs/design/conten | 2026-10-03 13:20 | 23 의심→같음(A-B) | 110.6 의심→같음(A-B) | 0.64 | 20.3 | 0.34 | 9.739 | 5.112 | 824.9 | 72.3 | 0 | 0 | 24.8 | 33.3 | 354.4 |
| `6a887ea7` Fill the NAT-5 report's gate line and record the o | 2026-10-03 06:29 | 21.2 의심→같음(A-B) | 121.2 의심→같음(A-B) | 0.64 | 20.3 | 0.23 | 9.501 | 4.649 | 758.8 | 72.2 | 0 | 0 | 32.1 | 16.8 | 169.2 |
| `a4650af6` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-03 04:57 | 10.3 | 69.6 | 0.64 | 20 | 0.38 | 11.248 | 15.545 | 448.3 | 82.1 | 0 | 0 | 25.3 | 166.7 | 684.7 |
| `8e0623aa` INBOX-3t: world event staging candidates — 25 new  | 2026-10-03 04:09 | 12.5 | 69 | 0.69 의심→같음(A-B) | 20.2 | 0.36 | 10.579 | 13.116 | 514.4 | 82.1 | 0 | 0 | 21.9 | 100.1 | 789.6 |
| `5c16778d` DOC: install-plan fragments renamed to .fragments. | 2026-10-03 04:02 | 21.8 의심→같음(A-B) | 114.5 의심→같음(A-B) | 0.64 | 20 | 0.33 | 9.386 | 4.629 | 780.9 | 71.5 | 0 | 0 | 34 | 33.3 | 197.1 |
| `3bfc3f65` INBOX-3q: the 16 wall strip corners and their 97 r | 2026-10-03 03:57 | 16.8 의심→같음(A-B) | 77.2 의심→같음(A-B) | 0.64 | 20.1 | 0.34 | 10.262 | 10.254 | 604.8 | 72.2 | 0 | 0 | 32.7 | 83.3 | 866.1 |
| `07dd3833` perf-trend: refreshed after a merge (the page was  | 2026-10-03 02:56 | 22.6 | 114.6 | 0.64 | 19.9 의심→같음(A-B) | 0.18 | 9.536 | 4.693 | 809.6 | 71.5 | 0 | 0 | 40.2 | 33.3 | 191.9 |
| `5a04276e` INBOX-3p: trade world pictures received — 128 LM-E | 2026-10-03 02:53 | 22.1 | 106.6 | 0.64 | 20 | 0.23 | 9.765 | 5.212 | 791.5 | 71.5 | 0 | 0 | 49 | 33.4 | 402.4 |
| `ce67158a` INBOX-3o: event illustration rework received — the | 2026-10-03 02:52 | 21.1 | 99.9 | 0.64 | 20 | 0.25 | 10.085 | 6.502 | 754.4 | 72.3 | 0 | 0 | 34.9 | 50 | 764.8 |
| `aca18836` strip-corners: records/README notes that blind rou | 2026-10-03 02:42 | 16.1 의심→같음(A-B) | 77.2 | 0.64 | 20 | 0.37 | 10.607 | 11.691 | 580.4 | 72.5 | 0 | 0 | 41.4 | 83.3 | 878.4 |
| `c2460918` INBOX-3n: wall strip corners received — 16 corners | 2026-10-03 02:38 | 12.3 | 69.3 의심→같음(A-B) | 0.64 | 19.8 | 0.33 | 11.39 | 13.942 | 513.8 | 84.4 | 0 | 0 | 35.5 | 116.6 | 760.8 |
| `ba9203c5` INBOX-3m: event illustrations received — 35 pictur | 2026-10-03 02:26 | 11.8 | 59.9 | 0.67 | 19.8 의심→같음(A-B) | 0.4 | 10.652 | 15.435 | 493.3 | 84.2 | 0 | 0 | 34.9 | 150 | 704.1 |
| `c63b776f` INBOX-3l: region atlas received — 20 hand-painted- | 2026-10-03 02:22 | 12 | 63.9 | 0.64 | 19.6 | 0.38 | 10.202 | 13.225 | 502.2 | 82.5 | 0 | 0 | 46.6 | 133.3 | 706 |
| `d15ed728` INBOX-3k: region map kit candidates judged — 8 roa | 2026-10-03 01:58 | 11.9 | 61.3 | 0.64 | 19.6 | 0.39 | 12.028 | 15.785 | 496.5 | 85.1 | 0 | 0 | 50.4 | 133.2 | 728.8 |
| `25c766b6` INBOX-3j: the last pictures outside the ledger get | 2026-10-03 01:54 | 11.4 | 63.4 | 0.64 | 19.9 | 0.37 | 11.499 | 14.861 | 459.9 | 80.5 | 0 | 0 | 28 | 150 | 682.8 |
| `872cc612` INBOX-3h: the one picture missing from the ledger  | 2026-10-03 01:47 | 12.1 | 64.9 | 0.64 | 19.6 | 0.38 | 11.356 | 15.237 | 492.7 | 82.8 | 0 | 0 | 49.1 | 133.5 | 753.1 |
| `fe9fa8d8` INBOX-3g: the 8 pictures 11ca755e (BLD-01, ENV-03, | 2026-10-03 01:36 | 12.5 | 63.9 | 0.64 | 19.6 | 0.37 | 11.061 | 13.769 | 498.6 | 81.9 | 0 | 0 | 29.3 | 100 | 780.9 |
| `c2175898` INBOX-3f: corner verdicts changed — stone corner v | 2026-10-03 01:26 | 12.3 의심→같음(A-B) | 71.1 | 0.64 | 19.7 | 0.33 | 11.266 | 14.414 | 507.9 | 82.5 | 0 | 0 | 35.6 | 100 | 757.3 |
| `9015d80f` INBOX-3e: era pilot received — 18 era portraits co | 2026-10-03 01:14 | 13 | 67.9 | 0.64 | 19.8 | 0.3 | 10.458 | 12.083 | 530.9 | 82.1 | 0 | 0 | 34.1 | 100.1 | 786.7 |
| `ee39aa56` INBOX-3d: storehouse snow layers and gate corner p | 2026-10-03 01:11 | 15.9 | 74.5 | 0.64 | 19.8 | 0.33 | 10.287 | 10.814 | 573.6 | 72.3 | 0 | 0 | 47.4 | 83.3 | 890.1 |
| `473abcbf` QA: vision checker holdout round filed in docs/qa/ | 2026-10-03 00:32 | 18.8 의심→같음(A-B) | 94.5 의심→같음(A-B) | 0.64 | 20 의심→같음(A-B) | 0.28 | 10.25 | 7.065 | 672.6 | 71.4 | 0 | 0 | 43.8 | 66.6 | 688.3 |
| `a8834c7f` DOC: Astra neighbor world filed as design records  | 2026-10-03 00:23 | 21.7 의심→같음(A-B) | 115.9 의심→같음(A-B) | 0.64 | 19.8 | 0.04 | 9.027 | 4.441 | 777 | 71.4 | 0 | 0 | 31 | 33.3 | 187.9 |
| `b6d8f056` tools/vision-check README: points to the expansion | 2026-10-03 00:15 | 19.1 | 93.3 의심→같음(A-B) | 0.64 | 20.2 | 0.32 | 10.105 | 7.369 | 684.8 | 71.7 | 0 | 0 | 28 | 50 | 844.1 |
| `618c5ec2` QA: vision checker expansion round filed in docs/q | 2026-10-02 23:38 | 16.5 | 73 | 0.64 | 20.1 | 0.42 | 10.656 | 10.743 | 596 | 72.2 | 0 | 0 | 42.2 | 83.3 | 851.2 |
| `18add596` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 22:16 | 11.8 | 66.5 | 0.64 | 19.7 | 0.46 | 10.793 | 12.372 | 484.5 | 81.9 | 0 | 0 | 46.2 | 116.7 | 782.3 |
| `b5040e52` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 21:44 | 14.1 의심→같음(A-B) | 67.8 의심→같음(A-B) | 0.67 의심→같음(A-B) | 20 | 0.34 | 10.829 | 13.516 | 519.1 | 76.3 | 0 | 0 | 29.9 | 100 | 856.7 |
| `5f10d874` DOC: content drafts v2 filed in docs/design/conten | 2026-10-02 21:35 | 19.8 의심→같음(A-B) | 90.5 의심→같음(A-B) | 0.64 | 20 | 0.33 | 10.135 | 7.556 | 709.2 | 71.7 | 0 | 0 | 35.2 | 50.1 | 804.2 |
| `83b06802` DOC: Astra content drafts filed as design records  | 2026-10-02 20:38 | 13.6 의심→같음(A-B) | 72 | 0.64 | 19.7 의심→같음(A-B) | 0.43 | 10.664 | 12.285 | 545.5 | 82.9 | 0 | 0 | 38.2 | 100 | 810.4 |
| `d6ae1549` Dispatch ledger: REMOTE·문서 session's two items tic | 2026-10-02 19:23 | 15.1 의심→같음(A-B) | 75.5 | 0.64 | 19.9 | 0.33 | 10.031 | 10.956 | 548.5 | 72.5 | 0 | 0 | 42 | 83.3 | 858.2 |
| `3e3192c5` Dispatch ledger: INBOX session's seven items ticke | 2026-10-02 19:06 | 16.4 의심→같음(A-B) | 77.3 | 0.64 | 20 의심→같음(A-B) | 0.3 | 9.947 | 10.508 | 589.2 | 72.5 | 0 | 0 | 38.1 | 83.3 | 848.7 |
| `602fdd84` Dispatch ledger filed as received in docs/ops/DISP | 2026-10-02 19:04 | 15.9 | 78.6 | 0.64 | 19.8 | 0.28 | 10.266 | 11.111 | 574 | 73 | 0 | 0 | 38.2 | 83.3 | 890.4 |
| `2ed0fa8b` QA round 17 filed in docs/qa/round17 — new lands 5 | 2026-10-02 18:49 | 21.8 의심→같음(A-B) | 106.6 의심→같음(A-B) | 0.64 | 20 | 0.29 | 9.829 | 5.324 | 779.4 | 71.4 | 0 | 0 | 33.1 | 33.4 | 487.5 |
| `eca4a97f` FIX-14: ui-geometry on the merged head 532f3cd (1, | 2026-10-02 17:33 | 20.9 의심→같음(A-B) | 115.9 의심→같음(A-B) | 0.64 | 20.1 | 0 | 8.001 | 3.771 | 747.6 | 70.7 | 0 | 0 | 43.2 | 16.8 | 44 |
| `9ccb98e4` DOC: lord-mode tutorial filed as design records in | 2026-10-02 15:43 | 14.2 | 74.3 | 0.64 | 19.8 | 0.35 | 10.593 | 11.931 | 555.5 | 73.3 | 0 | 0 | 42 | 83.4 | 849.1 |
| `2c34faac` Game title: Charter & Kin (Korean 인장과 가문), replaci | 2026-10-02 15:42 | 14.4 의심→같음(A-B) | 67.8 | 0.64 | 19.9 | 0.31 | 10.594 | 11.576 | 587 | 79.4 | 0 | 0 | 36.1 | 83.4 | 855.3 |
| `6c954293` INBOX-3c: Wave 42 bramble v3 received — abandoned_ | 2026-10-02 15:38 | 11.4 | 63.9 | 0.64 | 19.6 | 0.35 | 11.497 | 15.231 | 472.4 | 80.8 | 0 | 0 | 35.3 | 116.7 | 781.8 |
| `f0cb3105` INBOX-3b: Wave 42 rework v2 received — saplings 1– | 2026-10-02 15:31 | 13.1 의심→같음(A-B) | 69.2 의심→같음(A-B) | 0.65 의심→같음(A-B) | 20 | 0.38 | 10.396 | 13.187 | 509.9 | 79.8 | 0 | 0 | 35.9 | 100 | 815.9 |
| `5a15e62d` INBOX-3a: Waves 42, 43 and 44 received — Wave 42 l | 2026-10-02 15:14 | 17.8 의심→같음(A-B) | 83.8 의심→같음(A-B) | 0.64 | 19.8 | 0.38 | 10.355 | 9.145 | 639 | 71.7 | 0 | 0 | 39.9 | 66.7 | 874.4 |
| `e120273a` perf-trend: 47 trunk commits with 6e6b96eb (re-mea | 2026-10-02 15:05 | 15.7 의심→같음(A-B) | 74.5 의심→같음(A-B) | 0.64 | 20.1 | 0.36 | 9.987 | 10.799 | 565.3 | 73.3 | 0 | 0 | 31.2 | 83.4 | 862.1 |
| `59dab601` Remote runs hold their lock from before the folder | 2026-10-02 14:11 | 21 의심→같음(A-B) | 117.3 | 0.64 | 19.9 | 0.41 | 9.437 | 4.667 | 750.5 | 70.8 | 0 | 0 | 42.1 | 33.3 | 206.5 |
| `bdf84129` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 12:54 | 21.6 의심→같음(A-B) | 115.9 | 0.64 | 19.9 | 0.17 | 9.506 | 4.74 | 772.9 | 71.4 | 0 | 0 | 38.4 | 33.3 | 217.2 |
| `ebbb61f4` Trunk-push trend runs start fully apart from the p | 2026-10-02 11:35 | 22.6 의심→같음(A-B) | 109.3 | 0.64 | 19.8 | 0.24 | 9.684 | 4.975 | 806.3 | 72.2 | 0 | 0 | 36.6 | 33.3 | 341.1 |
| `01bb7b92` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 11:19 | 19.7 | 97.1 의심→같음(A-B) | 0.64 | 20.2 | 0.39 | 9.794 | 6.589 | 704.1 | 71 | 0 | 0 | 34.7 | 50 | 712.8 |
| `f662b67e` INBOX-2z: Wave 41 LAND-UI session's take on the sa | 2026-10-02 10:42 | 13.5 의심→같음(A-B) | 70.5 | 0.65 의심→같음(A-B) | 20.2 | 0.3 | 6.687 | 13.383 | 346.1 | 49.4 | 0 | 0 | 24.1 | 100 | 806.5 |
| `6e6b96eb` INBOX-2y: Wave 41 additions received and confirmed | 2026-10-02 10:30 | 20.8 의심→같음(A-B) | 94.5 | 0.64 | 20.3 | 0.05 | 6.375 | 5.12 | 473.4 | 48.7 | 0 | 0 | 37.2 | 33.3 | 287.8 |
| `5a40ef34` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 08:32 | 21.1 의심→같음(A-B) | 97.3 | 0.64 | 20.3 | 0.05 | 5.623 | 4.251 | 481.8 | 48.7 | 0 | 0 | 38 | 16.8 | 123.9 |
| `caa1ea9f` INBOX-2x: Wave 41 redraws received and confirmed — | 2026-10-02 08:31 | 20.4 | 89.2 의심→같음(A-B) | 0.64 | 20.1 | 0.01 | 5.657 | 4.276 | 466.2 | 48.6 | 0 | 0 | 26.1 | 16.8 | 121.3 |
| `b90c0eca` LAND-UI: the clean clone on the merged head 21d558 | 2026-10-02 02:12 | 21.1 | 93.2 | 0.64 | 20.3 좋아짐(A-B) | 0 | 5.241 | 3.918 | 480.6 | 48.6 | 0 | 0 | 31.7 | 16.8 | 78.6 |
| `f5aec50a` LM-E5: report (three seeds three towns, the same s | 2026-10-02 01:52 | 21.3 좋아짐(A-B) | 94.6 의심→같음(A-B) | 0.64 | 20.9 | 0.01 | 5.24 | 3.929 | 485.9 | 48.5 | 0 | 0 | 32.4 | 16.8 | 86.6 |
| `19aae9c9` INBOX-2w: lord-mode screen components received and | 2026-10-02 01:04 | 16.5 | 76.4 | 0.64 | 20.7 | 0.37 | 6.408 | 11.634 | 379.1 | 50.2 | 0 | 0 | 37.6 | 83.4 | 816.4 |
| `65d5e577` DOC: art audit links resolve in the repo — evidenc | 2026-10-02 01:00 | 16.8 좋아짐(A-B) | 79.9 의심→같음(A-B) | 0.64 | 20.4 | 0.38 | 6.442 | 10.844 | 395.5 | 50.1 | 0 | 0 | 37 | 83.3 | 839.8 |
| `6d039cd9` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-02 00:58 | 19.5 | 93.3 | 0.64 | 20.5 | 0.41 | 6.764 | 8.258 | 444.7 | 49.5 | 0 | 0 | 35.2 | 66.6 | 841.1 |
| `69734122` DOC: Astra art audit filed as design records — ART | 2026-10-02 00:46 | 19.8 | 97.2 | 0.64 | 20.5 | 0.3 | 6.5 | 7.937 | 455.2 | 48.9 | 0 | 0 | 41.6 | 50.1 | 870.1 |
| `7c9feef8` DOC: lord-mode screen mockups gain their assembly  | 2026-10-02 00:44 | 19.8 | 93.2 | 0.64 | 20.6 | 0.3 | 6.881 | 8.537 | 453.6 | 49 | 0 | 0 | 26.6 | 66.6 | 883.7 |
| `a754affe` Roadmap: LM-E5 living growth (random seeds shown a | 2026-10-02 00:42 | 17.8 | 81.2 | 0.64 | 20.6 | 0.35 | 6.927 | 10.892 | 412.8 | 49.5 | 0 | 0 | 39.8 | 83.2 | 874.1 |
| `4511b7ec` DOC: two deep-research reports filed as received ( | 2026-10-02 00:39 | 18.2 의심→같음(A-B) | 85.1 | 0.64 | 20.5 | 0.36 | 6.665 | 9.892 | 420 | 49.4 | 0 | 0 | 40.4 | 66.7 | 932.6 |
| `7f697d74` DOC: Astra lord-mode screen mockups filed as desig | 2026-10-02 00:34 | 19.2 | 91.9 의심→같음(A-B) | 0.64 | 20.7 | 0.3 | 6.772 | 8.99 | 444.1 | 49.4 | 0 | 0 | 37.1 | 66.7 | 873.4 |
| `44689fad` Branch archive: hyunlord/organic-curved-land-desig | 2026-10-02 00:32 | 18.6 | 94.6 의심→같음(A-B) | 0.64 | 20.5 | 0.34 | 6.642 | 8.647 | 426.2 | 49.9 | 0 | 0 | 28.2 | 66.6 | 888.4 |
| `ff2a5c51` perf-trend: 27 trunk commits up to 820af8e1, every | 2026-10-02 00:14 | 16.9 의심→같음(A-B) | 82.6 의심→같음(A-B) | 0.64 | 20.4 | 0.31 | 6.329 | 10.208 | 392.7 | 52.1 | 0 | 0 | 31 | 83.3 | 851.4 |
| `820af8e1` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 23:13 | 21.2 | 99.9 | 0.64 | 20.5 | 0.3 | 6.574 | 6.844 | 484 | 49.4 | 0 | 0 | 39.3 | 50 | 762.1 |
| `d3dcf72b` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 23:05 | 21.5 | 111.9 의심→같음(A-B) | 0.64 | 20.5 | 0.25 | 6.368 | 5.595 | 488.7 | 48.6 | 0 | 0 | 38.8 | 33.4 | 463.5 |
| `20eec341` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 22:39 | 19.5 | 83.8 | 0.64 | 21.1 의심→같음(A-B) | 0.3 | 6.488 | 8.885 | 448.1 | 49.3 | 0 | 0 | 41.4 | 66.7 | 809.2 |
| `ba52bae3` Wall-clock tests (decision RR9): four put on count | 2026-10-01 21:29 | 23.2 의심→같음(A-B) | 113.3 | 0.64 | 20.5 | 0.31 | 6.328 | 5.26 | 529.4 | 48.7 | 0 | 0 | 33.2 | 33.4 | 378.4 |
| `aa6aadbc` perf-trend: 22 trunk commits up to bf60912b, every | 2026-10-01 20:26 | 16.2 | 73.2 | 0.64 | 20.5 | 0.3 | 6.649 | 11.426 | 387.1 | 49.7 | 0 | 0 | 36.8 | 100 | 854.5 |
| `bf60912b` INBOX-2v: Wave 38 UI controls, its rework and Wave | 2026-10-01 19:57 | 17.1 의심→같음(A-B) | 75.9 의심→같음(A-B) | 0.64 | 20.8 의심→같음(A-B) | 0.43 | 6.987 | 13.312 | 391.5 | 50.6 | 0 | 0 | 39.3 | 99.9 | 806.2 |
| `2a8add3f` Wire Graft context graph into Claude Code and Code | 2026-10-01 19:12 | 23.3 | 107.9 | 0.64 | 20.5 | 0.3 | 6.508 | 5.6 | 532.8 | 48.6 | 0 | 0 | 37.4 | 33.4 | 489 |
| `c19c30a0` QA round 16 on c52e6634: QA034, QA016 and QA010 cl | 2026-10-01 19:09 | 22.9 | 111.9 | 0.64 | 20.5 | 0.27 | 6.356 | 5.381 | 523 | 49 | 0 | 0 | 36.4 | 33.4 | 431.7 |
| `bc24d036` LM-E3: ui-geometry on the merged head 100e193 (eng | 2026-10-01 18:35 | 22.8 의심→같음(A-B) | 114.6 의심→같음(A-B) | 0.64 | 20.6 | 0.26 | 6.372 | 5.158 | 518.9 | 48.6 | 0 | 0 | 24.9 | 33.3 | 323.7 |
| `0f7a45fa` QA-034 second surface: gates on 4d1d089 — geometry | 2026-10-01 17:52 | 20.6 의심→같음(A-B) | 97.2 의심→같음(A-B) | 0.64 | 20.5 | 0.31 | 6.597 | 7.456 | 473.3 | 49.2 | 0 | 0 | 29.5 | 50 | 837.5 |
| `c52e6634` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 16:02 | 22.7 의심→같음(A-B) | 115.9 | 0.64 | 20.5 | 0.21 | 6.211 | 4.858 | 518.2 | 48.6 | 0 | 0 | 37.9 | 33.3 | 233.2 |
| `37538017` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 15:51 | 23.2 | 114.6 | 0.64 | 20.5 | 0.23 | 6.289 | 4.971 | 529 | 48.6 | 0 | 0 | 30.7 | 33.3 | 257.2 |
| `ed5fd13d` QA round 15: UI-AUDIT-1 recheck on 3acc04ff (fixed | 2026-10-01 14:30 | 22.6 | 109.3 의심→같음(A-B) | 0.64 | 20.4 | 0.23 | 6.291 | 5.089 | 515.6 | 48.5 | 0 | 0 | 34.6 | 33.3 | 307.8 |
| `e084513b` QA rounds 03-14 consolidated: 33 numbered findings | 2026-10-01 14:05 | 20.4 | 97.3 | 0.64 | 20.5 | 0.03 | 5.579 | 4.222 | 464.7 | 48.6 | 0 | 0 | 25 | 16.8 | 119.9 |
| `83599119` LM-E2: ui-geometry refreshed on 4030083 (engine-LM | 2026-10-01 14:05 | 21.1 | 95.9 의심→같음(A-B) | 0.64 | 20.7 의심→같음(A-B) | 0.04 | 5.622 | 4.261 | 481.2 | 48.6 | 0 | 0 | 27 | 16.8 | 119.9 |
| `3acc04ff` Record UI-AUDIT-1's gates on the tree with trunk m | 2026-10-01 13:33 | 23 | 117.2 | 0.64 | 20.4 | 0.19 | 6.122 | 4.68 | 525.1 | 48.6 | 0 | 0 | 34.5 | 16.8 | 162.5 |
| `267b43b8` Merge remote-tracking branch 'origin/codex/phase15 | 2026-10-01 12:18 | 23 | 117.3 | 0.64 | 20.4 | 0.23 | 6.293 | 4.879 | 522.6 | 48.5 | 0 | 0 | 27 | 33.3 | 210.6 |
| `7ef055f4` perf:ab and the trend's A-B confirmation judge wit | 2026-10-01 11:53 | 24 의심→같음(A-B) | 114.6 좋아짐(A-B) | 0.64 | 20.3 | 0.21 | 6.323 | 4.925 | 545.7 | 49.1 | 0 | 0 | 43.6 | 33.3 | 222.6 |
| `26507989` LM-E1: clean clone 29c1a87 4,048/4,048; report gat | 2026-10-01 04:01 | 21.1 의심→같음(A-B) | 94.6 | 0.64 | 20.4 | 0 | 5.216 | 3.902 | 479.3 | 49 | 0 | 0 | 40.4 | 16.8 | 75.9 |
| `61d79e8e` perf-trend judges four per-second metrics (JS allo | 2026-10-01 01:33 | 22.1 | 95.9 | 0.64 | 20.9 | 0.44 | 6.581 | 6.787 | 506.3 | 49.3 | 0 | 0 | 35.7 | 50 | 814.1 |
| `5e214ef7` Decisions: the keep-judgement-runs decision is RR5 | 2026-10-01 01:27 | 18.9 | 93.3 | 0.64 | 20.5 | 0.39 | 6.483 | 8.457 | 434.9 | 49 | 0 | 0 | 35 | 66.7 | 838.1 |
| `bfb0d430` perf-trend: five trunk commits re-measured with th | 2026-10-01 00:54 | 18.6 | 93.3 | 0.64 | 20.3 | 0.38 | 6.803 | 9.197 | 430.3 | 50 | 0 | 0 | 41.1 | 66.7 | 909.7 |
| `e6d08a6e` perf-trend: the four backfilled trunk commits (big | 2026-09-30 22:39 | 18.2 | 86.4 의심→같음(A-B) | 0.64 의심→같음(A-B) | 20.1 | 0.46 | 6.61 | 9.57 | 418.3 | 49.4 | 0 | 0 | 30.6 | 66.7 | 854.2 |
| `a597617b` Merge remote-tracking branch 'origin/codex/phase15 | 2026-09-30 13:53 | 15.1 | 69.2 | 0.59 | 20.2 | 0.43 | 6.538 | 11.583 | 382.9 | 52.3 | 0 | 0 | 41 | 100 | 778 |
| `8ebdcf5c` NAT-2: decision D8 names the regenerated C25 board | 2026-09-30 13:39 | 14.2 의심→같음(A-B) | 72.6 의심→같음(A-B) | 0.64 | 20.1 | 0.44 | 6.503 | 12.132 | 365.5 | 49.4 | 0 | 0 | 29.2 | 100 | 763.1 |
| `00df3324` INBOX-2q: Wave 37 doorstep trade and condition pro | 2026-09-30 13:21 | 22.2 | 137.2 의심→같음(A-B) | 0.64 좋아짐(A-B) | 19.9 | 0.18 | 6.704 | 4.955 | 504.5 | 48.4 | 0 | 0 | 35.9 | 16.8 | 26.6 |
| `cf04b4a7` QA-2: Astra observation QA round 02 kept in docs/q | 2026-09-30 10:59 | 22.7 | 109.3 | 2.58 | 20 | 0.35 | 7.984 | 7.279 | 516.3 | 144.9 | 3.2 | 0 | 42.8 | 33.4 | 553.2 |

## 코드 시간 예산(회귀 시험에서 옮김, 참고)

벽시계 예산이라 DGX가 바쁘면 회귀 시험을 떨어뜨렸다(`docs/verification/wall-clock-tests.md`). 그 시험들은 이제 결과만 보고, 시간은 커밋마다 여기에 적는다(세 번의 중앙값 ms, 괄호는 예산). 예산을 넘은 칸은 "예산 넘음"이다. 다른 일 CPU가 높으면 기계 탓일 수 있다.

| 커밋 | INSTALL-26 집 400채 항목 ms(50) | INSTALL-26 집 그림 배정 ms(100) | INSTALL-26 같은 입력 프레임 ms(0.5) | INSTALL-26 새 집 배열 프레임 ms(50) | CHRON-1 연대기 30,000건 열기 ms(120) | H8 기록 10,000건 질의 ms(5) | 다른 일 CPU |
|---|---:|---:|---:|---:|---:|---:|---:|
| `5ad4b834` | 0.489 | 1.118 | 0.017 | 0.428 | 8.316 | 0.322 | 0.47 |
| `dd7b668e` | 0.488 | 1.15 | 0.017 | 0.471 | 9.137 | 0.32 | 0.49 |
| `6a887ea7` | 0.503 | 1.037 | 0.015 | 0.423 | 7.34 | 0.303 | 0.13 |
| `a4650af6` | 0.833 | 1.853 | 0.047 | 3.196 | 22.725 | 0.359 | 0.51 |
| `8e0623aa` | 1.193 | 1.412 | 0.045 | 1.963 | 15.687 | 0.314 | 0.49 |
| `5c16778d` | 0.716 | 2.35 | 0.025 | 1.163 | 10.31 | 0.326 | 0.46 |
| `3bfc3f65` | 0.462 | 2.545 | 0.033 | 0.499 | 10.807 | 0.345 | 0.5 |
| `07dd3833` | 0.683 | 1.077 | 0.017 | 0.517 | 8.748 | 0.316 | 0.37 |
| `5a04276e` | 0.473 | 1.118 | 0.017 | 0.422 | 14.431 | 0.34 | 0.45 |
| `ce67158a` | 0.532 | 1.701 | 0.018 | 0.502 | 8.796 | 0.328 | 0.49 |
| `aca18836` | 0.76 | 1.793 | 0.021 | 0.544 | 10.187 | 0.333 | 0.53 |
| `c2460918` | 0.878 | 2.454 | 0.028 | 2.124 | 10.435 | 0.272 | 0.45 |
| `ba9203c5` | 0.865 | 1.799 | 0.043 | 1.857 | 17.372 | 0.334 | 0.5 |
| `c63b776f` | 0.491 | 3.474 | 0.032 | 2.284 | 11.023 | 0.308 | 0.51 |
| `d15ed728` | 0.497 | 2.369 | 0.054 | 1.988 | 17.834 | 0.314 | 0.49 |
| `25c766b6` | 0.524 | 1.511 | 0.031 | 1.191 | 15.561 | 0.289 | 0.46 |
| `872cc612` | 0.973 | 4.597 | 0.035 | 0.868 | 23.172 | 0.339 | 0.42 |
| `fe9fa8d8` | 1.431 | 2.19 | 0.045 | 2.448 | 18.666 | 0.343 | 0.48 |
| `c2175898` | 0.462 | 41.82 | 0.04 | 2.278 | 18.071 | 0.31 | 0.42 |
| `9015d80f` | 1.357 | 2.414 | 0.026 | 1.367 | 18.272 | 0.33 | 0.53 |
| `ee39aa56` | 1.527 | 3.82 | 0.091 | 0.927 | 13.158 | 0.491 | 0.39 |
| `473abcbf` | 0.527 | 1.083 | 0.023 | 0.599 | 10.102 | 0.35 | 0.48 |
| `a8834c7f` | 0.439 | 1.04 | 0.016 | 0.402 | 7.278 | 0.315 | 0.08 |
| `b6d8f056` | 1.701 | 2.433 | 0.035 | 2.225 | 9.233 | 0.339 | 0.56 |
| `618c5ec2` | 1.104 | 1.531 | 0.03 | 0.57 | 10.429 | 0.34 | 0.51 |
| `18add596` | 0.653 | 1.125 | 0.034 | 0.498 | 16.544 | 0.377 | 0.57 |
| `b5040e52` | 0.748 | 1.785 | 0.025 | 2.34 | 8.954 | 0.392 | 0.44 |
| `5f10d874` | 0.502 | 1.445 | 0.017 | 0.567 | 9.828 | 0.319 | 0.54 |
| `83b06802` | 1.496 | 2.216 | 0.035 | 2.537 | 8.73 | 0.324 | 0.49 |
| `d6ae1549` | 0.877 | 1.898 | 0.031 | 1.058 | 17.41 | 0.505 | 0.52 |
| `3e3192c5` | 0.932 | 1.055 | 0.026 | 1.244 | 10.163 | 0.324 | 0.44 |
| `602fdd84` | 0.888 | 2.389 | 0.053 | 1.217 | 16.778 | 0.326 | 0.48 |
| `2ed0fa8b` | 0.795 | 2.097 | 0.049 | 2.463 | 10.942 | 0.33 | 0.43 |
| `eca4a97f` | 0.463 | 1.055 | 0.016 | 0.402 | 5.94 | 0.315 | 0.01 |
| `9ccb98e4` | 0.568 | 2.364 | 0.024 | 2.877 | 11.109 | 0.357 | 0.53 |
| `2c34faac` | 2.013 | 1.992 | 0.044 | 1.481 | 14.154 | 0.33 | 0.56 |
| `6c954293` | 1.237 | 1.424 | 0.059 | 0.736 | 19.144 | 0.318 | 0.44 |
| `f0cb3105` | 0.654 | 2.421 | 0.026 | 1.393 | 11.224 | 0.326 | 0.56 |
| `5a15e62d` | 0.479 | 1.734 | 0.043 | 1.502 | 16.231 | 0.332 | 0.55 |
| `e120273a` | 0.486 | 3.955 | 0.026 | 1.475 | 13.775 | 0.334 | 0.43 |
| `59dab601` | 0.489 | 1.125 | 0.017 | 0.473 | 7.979 | 0.323 | 0.45 |
| `bdf84129` | 0.508 | 1.094 | 0.017 | 0.479 | 8.39 | 0.319 | 0.48 |
| `ebbb61f4` | 0.572 | 1.081 | 0.017 | 0.571 | 8.277 | 0.318 | 0.41 |
| `01bb7b92` | 0.595 | 1.233 | 0.022 | 0.95 | 17.237 | 0.337 | 0.61 |
| `f662b67e` | 0.78 | 2.585 | 0.031 | 2.365 | 10.77 | 0.322 | 0.46 |
| `6e6b96eb` | 0.927 | 1.92 | 0.04 | 1.37 | 9.427 | 0.317 | 0.45 |
| `5a40ef34` | 0.505 | 1.044 | 0.016 | 0.442 | 6.922 | 0.311 | 0.07 |
| `caa1ea9f` | 0.526 | 1.056 | 0.016 | 0.435 | 6.635 | 0.302 | 0.08 |
| `b90c0eca` | 0.513 | 1.05 | 0.016 | 0.436 | 6.152 | 0.281 | 0.01 |
| `f5aec50a` | 0.472 | 1.046 | 0.016 | 0.433 | 5.716 | 0.313 | 0.01 |
| `19aae9c9` | 2.177 | 3.95 | 0.376 | 2.772 | 21.843 | 0.343 | 0.55 |
| `65d5e577` | 0.489 | 2.879 | 0.049 | 0.58 | 10.409 | 0.308 | 0.5 |
| `6d039cd9` | 1.282 | 2.503 | 0.052 | 3.83 | 12.646 | 0.362 | 0.49 |
| `69734122` | 0.801 | 1.774 | 0.02 | 1.168 | 10.625 | 0.366 | 0.59 |
| `7c9feef8` | 0.682 | 1.864 | 0.028 | 1.033 | 10.086 | 0.325 | 0.56 |
| `a754affe` | 0.582 | 2.632 | 0.03 | 2.668 | 10.919 | 0.342 | 0.54 |
| `4511b7ec` | 0.98 | 2.117 | 0.043 | 4.091 | 11.001 | 0.322 | 0.6 |
| `7f697d74` | 1.413 | 5.624 | 0.04 | 0.849 | 10.081 | 0.378 | 0.52 |
| `44689fad` | 2.431 | 1.096 | 0.027 | 1.001 | 18.56 | 0.328 | 0.56 |
| `ff2a5c51` | 0.951 | 2.096 | 0.029 | 2.326 | 12.162 | 0.32 | 0.41 |
| `820af8e1` | 0.523 | 1.049 | 0.031 | 0.777 | 8.557 | 0.316 | 0.56 |
| `ba52bae3` | 0.506 | 1.3 | 0.018 | 0.536 | 10.747 | 0.325 | 0.43 |

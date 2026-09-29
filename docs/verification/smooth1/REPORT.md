# SMOOTH-1 끊김 감사 — 보고서

관문: 없음(측정만 하는 감사) — 이 Mac의 실제 Chrome 창(120 Hz)에서 추적한 27회 실행(77.4분) 가운데, 33 ms를 넘는 프레임이 한 번도 없었던 것은 청원 5× 하나다. 전체로는 33 ms 초과가 분당 27.8번, 50 ms 초과가 분당 13.2번이고, 1~2.5초 멈춤이 여러 장면에서 나왔다.

- **담당**: Claude Code, 인프라·문서 세션.
- **범위**: 게임 코드 0줄. 도구·요약·문서만 바꿨다.
- **데이터**
  - 추적 파일은 저장소 밖에 둔다: `~/feudal-lord-analysis/perf-traces/smooth1-20260929/{mac-chrome-window,dgx-headless}/`(2.2 GB).
  - 저장소에는 요약만 넣었다: [`summary.json`](summary.json)(실행별 통계·GC·긴 프레임 원인), [`tables.md`](tables.md)(표 전체), [`scenes.json`](scenes.json)(장면).

## 한눈에

- **평균은 빠르다.** Mac 실제 창에서 p50은 8.3 ms(120 Hz 한 프레임), p95는 9~25 ms다. 그래서 p95 대비 %로 보던 지금까지의 성능 관문은 이 문제를 잡지 못했다.
- **튀는 한 프레임이 문제다.** 1배속 도시에서도 33 ms를 넘는 프레임이 분당 9.7~19.3번(ch2~ch5) 나오고, 3분 실행마다 최악 한 프레임이 0.17~1.8초다.
  - 최악은 2.49초(서랍 열기)다.
  - 배치 끌기 5×에서는 33 ms 초과가 분당 154번이다.
- **1위 원인은 major GC다.** Mac 추적 실행의 긴 프레임 2,154개 가운데 640개를 차지하고, 합계 101초로 모든 원인 중 가장 길다.
  - 100 ms 넘는 GC 프레임이 306개이고, 한 번에 최대 1.8초다.
  - 마을이 커지면 두 가지가 함께 커진다.
    - JS 힙: 최대 230~836 MB.
    - V8 전역 예산 안의 임베더 메모리(캔버스 backing store·그림): 약 1.2~1.8 GB.
  - 그 결과 major GC가 분당 5.5~13.7번 돈다. 새 게임에서도 분당 27~29번이다(외부 메모리 약 590~660 MB, old generation 33 MB).
- **나머지 원인**: 한 프레임에 겹친 무거운 일이다.
  - 5배속 틱 여러 개.
  - 첫 그리기 캐시 채우기(스프라이트 여백 자르기 `getImageData`, 걷는 사람 합성).
  - 서랍을 열 때의 강제 레이아웃.
  - 배치 끌기 중 동기 React 렌더와 길 찾기.
  - 계절 전환의 경계 재구성·자동 저장.
- **계절이 바뀌는 순간이 가장 위험하다.** 계절 전환 뒤 1초 안에 긴 프레임이 나올 확률은 67%다. 아무 구간의 기준값 26%보다 약 2.6배 높다.
  - 자동 저장(65%)과 결산 카드(36%)가 같은 순간에 겹친다.
  - 장 전환은 4번 중 4번 튀었다(최대 67 ms).
  - 청원 모달 자체는 부드러웠다(1×는 최대 34 ms, 5×는 33 ms 초과 0).
- **추적이 끊김을 부풀린다.** 추적 없이 같은 장면을 돌린 대조군은 33 ms 초과가 1.6~3.8배 적었다. 그래도 끊김은 사라지지 않았다.
  - ch1 5×: 추적 없이 분당 10.1번·최대 109 ms, 추적하면 분당 16.1번·최대 209 ms.
  - ch4 5×: 추적 없이 분당 9.8번·최대 832 ms, 추적하면 분당 37번·최대 1,387 ms.
- **DGX 헤드리스는 끊김 판정에 쓸 수 없다.** 소프트웨어 래스터라서 도시에서는 p95가 33 ms에 붙는다(60 fps를 못 낸다). 게다가 공유 슬라이스에 다른 세션의 실행이 겹쳐 5개 실행이 무효(rAF p50 > 16.8 ms)다. 비교용으로만 적었다.

## 어떻게 쟀나

- **도구**(`scripts/perf/`, 게임 코드 0줄)
  - `hitchAudit.ts`: 한 번 실행 = 장면 하나 × 배속 하나 × N초.
  - `hitchTrace.ts`: 추적 분석.
  - `hitchBatch.sh`: 장면 × 배속을 한 번에 하나씩 돌린다.
  - `hitchStates.ts`: 장면 저장 파일을 만든다.
  - `hitchReanalyse.ts`: 기록과 추적으로 분석을 다시 한다.
  - `hitchSummary.ts`: 표로 모은다.
- **빌드와 불러오기**
  - 제품 빌드를 쓴다(`vite build --minify false`). 제품 React와 같은 코드이고, 함수 이름만 읽을 수 있게 남겼다. 게임 코드는 바꾸지 않는다.
  - 장면은 플레이어와 같은 길로 연다. 저장 파일을 게임의 IndexedDB 슬롯(`auto-1`)에 넣고 첫 화면에서 `이어하기`를 누른다.
  - 튜토리얼은 끈다. 틱을 읽으려고 증명 포트(`?phase10-proof=1`)를 켠다.
- **프레임**
  - 페이지의 rAF 시각을 전부 기록한다. 그 간격이 플레이어가 보는 프레임 간격이다.
  - 표의 지표: p50 · p95 · p99 · 최대, 그리고 25·33·50 ms를 넘은 프레임의 수와 분당 수.
  - 추적을 켠 뒤 2초는 기록하지 않는다(추적 시작 자체의 멈춤을 빼기 위해서다).
- **원인**
  - Chrome 추적을 쓴다(`devtools.timeline` + V8 CPU 샘플러, Playwright `startTracing`).
  - 33 ms를 넘은 프레임마다 다음을 모은다.
    - 그 안에서 돈 메인 스레드 사건: rAF 콜백·유휴 콜백·타이머·GC·그림 디코드·스타일·레이아웃·페인트.
    - 메인 스레드가 일한 시간.
    - 다른 스레드와 GPU 프로세스의 긴 사건.
    - CPU 표본의 함수(자기 시간·포함 시간).
  - GC는 실행 전체에서 major·minor 횟수, 길이, 표시 시작 이유를 셌다. V8의 전역 예산은 JS 힙에 임베더 메모리(캔버스·그림)를 더한 것이다.
- **순간**
  - 계절 전환은 증명 포트의 틱으로 알아낸다. 날씨는 계절에 속하므로(`events.types` EV-3) 날씨 전환 = 계절 전환이다.
  - 자동 저장은 IndexedDB `slots` 저장으로 알아낸다.
  - 모달은 `role=dialog`가 나타나는 것으로 알아낸다(계절 결산 카드·청원).
  - 장 전환은 `politics.chapter.number`가 바뀌는 것으로 알아낸다.
  - 모달은 게임을 멈추게 되어 있다. 실행은 약 3초 뒤 Esc로 닫고 배속을 되돌린다(플레이어가 카드를 훑고 닫는 흐름).
- **기계**
  - **DGX 헤드리스**: Chromium 151 linux-arm64, 소프트웨어 래스터, 1600×1000 DPR 1. 비교용이다. 처음 30분은 다른 세션의 가드레일이 같은 DGX에서 돌았다.
  - **이 Mac의 실제 Chrome 창**: Chrome 154, M4 Max, 내장 XDR ProMotion.
    - 창 안쪽은 1600×877 CSS px, DPR 2이고, rAF 간격 p50은 8.3 ms(120 Hz)다.
    - 60 Hz는 재지 않았다. 디스플레이 설정(시스템 설정 → 디스플레이 → 주사율)을 바꿔야 해서다.

## 장면

한 번의 가드레일 봇 실행(seed 2, `hitchStates.ts`, 봇의 답 그대로, 상태를 고치지 않음)에서 저장한 것이다.

| 장면 | 저장 | 틱 | 연도 | 장 | 인구 | 건물 | 설명 |
|---|---|---:|---:|---:|---:|---:|---|
| ch1-new | 새 게임 | 0 | 1300 | 1 | — | — | `목표형으로 시작` |
| ch2-1340 | `pre-chapter3` | 159,600 | 1339 겨울 | 2 | 739 | 69 | seed 2의 2장은 1340에 끝난다. 그래서 1339 겨울 도시를 쓰고, 실행 400틱 안에 장 전환이 온다(장 전환 순간 측정) |
| ch3-plague | `ch3-plague` | 193,600 | 1348 | 3 | 768 | 75 | 첫 역병 도래 400틱 전 |
| ch4-1380 | `ch4-1380` | 320,000 | 1380 | 4 | 768 | 86 | 4장 1380, 이 봇 실행의 가장 큰 도시 |
| ch5-1440 | `ch5-1440` | 560,000 | 1440 | 5 | 768 | 86 | 5장 1440. 이야기 모달이 열린 채 저장돼 있다 |
| ops-camera · ops-placement · ops-drawers | `ch4-1380` | | | | | | 카메라 끌기·확대 축소 연속 / 길·필지 도구로 끌기(미리보기 뒤 취소) / 목표 기록·인구 기록·자원 장부·계절 띠 열고 닫기 |
| moment-petition | `pre-petition` | 148,700 | 1337 | 2 | 528 | 65 | 2장 첫 청원 300틱 전(청원 모달, 60초) |

## 결과 — 이 Mac의 실제 Chrome 창(120 Hz, 사용자가 느끼는 쪽)

- **각 실행**: 3분이다(청원은 1분).
- **"긴 프레임 순간" 칸**: 긴 프레임이 어느 순간(±0.75초)과 겹쳤는지 `순간 개수(최악 ms)`로 적었다.
- **`(추적 없음)`**: 대조 실행이다.
- **ch1-new 5× 추적 실행**: 기록 파일을 저장하기 전의 첫 실행이라 원래 분석(GC 통계 없음)을 그대로 썼다.

| 기계 | 장면 | 조작 | 배속 | 유효 | 끝 인구 | 프레임 | p50 | p95 | p99 | 최대 | >25 | >33 | >50 | >33/분 | 긴 프레임 순간 |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| mac-chrome-window | ch1-new | none | 1× | ○ | 38 | 21466 | 8.3 | 10.1 | 10.3 | 156.8 | 27 | 12 | 5 | 4 | none 12(157) |
| mac-chrome-window | ch1-new | none | 3× | ○ | 4 | 21289 | 8.3 | 10.1 | 10.3 | 107.9 | 48 | 42 | 25 | 14 | season 8(93) · dialog 8(93) · autosave 8(93) · none 34(108) |
| mac-chrome-window | ch1-new (추적 없음) | none | 5× | ○ | 15 | 21808 | 8.3 | 10.2 | 10.3 | 108.7 | 36 | 31 | 26 | 10.1 | season 2(65) · none 27(109) · dialog 3(109) · autosave 1(65) |
| mac-chrome-window | ch1-new | none | 5× | ○ | 15 | 21456 | 8.3 | 10.1 | 10.3 | 208.6 | 58 | 49 | 35 | 16.1 | dialog 8(142) · autosave 7(135) · season 6(135) · none 41(209) |
| mac-chrome-window | ch2-1340 | none | 1× | ○ | 739 | 21221 | 8.3 | 10.1 | 10.3 | 173.5 | 33 | 29 | 22 | 9.7 | none 26(174) · dialog 3(127) · season 3(127) · chapter 1(44) · autosave 3(127) |
| mac-chrome-window | ch2-1340 | none | 3× | ○ | 759 | 20490 | 8.3 | 10.1 | 14.7 | 815 | 60 | 42 | 35 | 13.9 | none 34(685) · dialog 8(815) · season 7(240) · chapter 3(58) · autosave 7(815) |
| mac-chrome-window | ch2-1340 | none | 5× | ○ | 759 | 19501 | 8.4 | 15.3 | 23.6 | 815.5 | 142 | 81 | 36 | 27 | dialog 17(532) · season 18(532) · chapter 5(59) · autosave 18(532) · none 63(816) |
| mac-chrome-window | ch3-plague | none | 1× | ○ | 481 | 20679 | 8.3 | 10.1 | 14.7 | 1799.4 | 57 | 41 | 29 | 13.7 | none 34(1799) · dialog 7(217) · season 6(217) · autosave 6(217) |
| mac-chrome-window | ch3-plague | none | 3× | ○ | 430 | 20573 | 8.3 | 10.2 | 15.8 | 724.9 | 50 | 34 | 25 | 11.3 | dialog 11(725) · season 10(333) · autosave 11(725) · none 23(566) |
| mac-chrome-window | ch3-plague | none | 5× | ○ | 445 | 19940 | 8.4 | 15.2 | 17.9 | 874.7 | 61 | 35 | 21 | 11.5 | dialog 16(249) · season 16(249) · autosave 16(249) · none 19(875) |
| mac-chrome-window | ch4-1380 | none | 1× | ○ | 768 | 21030 | 8.3 | 9.8 | 10.4 | 250.4 | 44 | 36 | 27 | 12 | none 28(217) · dialog 8(250) · season 8(250) · autosave 8(250) |
| mac-chrome-window | ch4-1380 | none | 3× | ○ | 768 | 19444 | 8.4 | 16.4 | 24.9 | 707.8 | 143 | 69 | 34 | 22.5 | none 55(708) · season 14(250) · dialog 14(250) · autosave 14(250) |
| mac-chrome-window | ch4-1380 (추적 없음) | none | 5× | ○ | 768 | 21101 | 8.3 | 10.2 | 16.3 | 831.6 | 49 | 30 | 23 | 9.8 | none 25(832) · dialog 5(349) · season 4(157) · autosave 4(157) |
| mac-chrome-window | ch4-1380 | none | 5× | ○ | 768 | 17091 | 8.5 | 17.1 | 25.4 | 1386.9 | 219 | 113 | 52 | 37 | none 94(1387) · season 19(67) · dialog 19(67) · autosave 19(67) · chapter 2(67) |
| mac-chrome-window | ch5-1440 | none | 1× | ○ | 768 | 20680 | 8.3 | 9.2 | 9.4 | 1100 | 71 | 58 | 37 | 19.3 | none 51(1100) · dialog 7(225) · season 7(225) · autosave 7(225) |
| mac-chrome-window | ch5-1440 | none | 3× | ○ | 768 | 19786 | 8.3 | 10.1 | 16.7 | 2240 | 85 | 64 | 46 | 21.3 | none 55(2240) · dialog 9(416) · season 9(416) · autosave 9(416) |
| mac-chrome-window | ch5-1440 | none | 5× | ○ | 768 | 21080 | 8.3 | 10.2 | 16.7 | 941.5 | 40 | 20 | 16 | 6.5 | none 15(632) · dialog 5(942) · season 4(191) · autosave 5(942) |
| mac-chrome-window | moment-petition | none | 1× | ○ | 528 | 7625 | 8.3 | 9.2 | 9.4 | 34.1 | 6 | 1 | 0 | 0.9 | dialog 1(34) |
| mac-chrome-window | moment-petition | none | 3× | ○ | 528 | 7992 | 8.3 | 9.2 | 16.6 | 216.2 | 27 | 14 | 7 | 12.3 | dialog 3(67) · none 11(216) |
| mac-chrome-window | moment-petition | none | 5× | ○ | 528 | 8019 | 8.3 | 9.2 | 9.3 | 25.3 | 1 | 0 | 0 | 0 | — |
| mac-chrome-window | ops-camera | camera | 1× | ○ | 768 | 19192 | 8.3 | 9.3 | 33.6 | 842 | 223 | 202 | 167 | 67.3 | none 199(842) · season 3(83) · dialog 3(83) · autosave 2(41) |
| mac-chrome-window | ops-camera | camera | 3× | ○ | 768 | 20449 | 8.3 | 9.2 | 15.7 | 534.4 | 97 | 85 | 68 | 28.3 | none 81(534) · season 4(141) · dialog 2(99) · autosave 2(99) |
| mac-chrome-window | ops-camera | camera | 5× | ○ | 768 | 20935 | 8.3 | 9.3 | 16.7 | 400.1 | 64 | 44 | 9 | 14.7 | none 40(400) · season 4(51) · dialog 4(51) · autosave 4(51) |
| mac-chrome-window | ops-drawers | drawers | 1× | ○ | 768 | 19614 | 8.3 | 16.1 | 17.5 | 2491.9 | 100 | 64 | 42 | 21.1 | none 50(2492) · dialog 14(216) · autosave 14(216) · season 7(117) |
| mac-chrome-window | ops-drawers | drawers | 3× | ○ | 768 | 19263 | 8.4 | 17 | 25.5 | 1799.8 | 331 | 115 | 52 | 35.4 | none 88(1800) · season 19(491) · dialog 19(491) · autosave 20(492) |
| mac-chrome-window | ops-drawers | drawers | 5× | ○ | 768 | 20302 | 8.4 | 17.1 | 25.6 | 2491.2 | 311 | 120 | 51 | 35 | none 84(2491) · season 31(217) · dialog 33(217) · autosave 21(393) |
| mac-chrome-window | ops-placement | placement | 1× | ○ | 768 | 18919 | 8.3 | 16.7 | 25 | 500.2 | 156 | 98 | 41 | 32.7 | none 85(500) · season 7(100) · dialog 7(100) · autosave 13(133) |
| mac-chrome-window | ops-placement | placement | 3× | ○ | 768 | 20467 | 8.4 | 24.3 | 25.7 | 2291.8 | 432 | 154 | 52 | 42.2 | none 123(2292) · season 21(508) · dialog 22(508) · autosave 27(508) |
| mac-chrome-window | ops-placement | placement | 5× | ○ | 768 | 17287 | 8.4 | 25.4 | 41.6 | 1524.2 | 1179 | 532 | 91 | 153.9 | none 457(1524) · dialog 50(183) · season 62(183) · autosave 59(183) |

## 끊김 원인 상위 10 (Mac 실제 창 추적 실행, 33 ms를 넘은 프레임 2,154개)

- 긴 프레임마다 주원인을 하나씩 정했다.
  - 메인 스레드가 프레임의 절반도 일하지 않았으면 "메인 스레드 밖"이다.
  - 그렇지 않고 GC가 일한 시간의 절반 이상이면 GC다.
  - 둘 다 아니면 포함 CPU 시간이 가장 큰 함수 묶음이다.
- 표본 함수는 `summary.json`의 실행별 `worst`와 긴 프레임 상세에 있다.

| # | 원인 | 무엇이 | 긴 프레임 | 그중 >100 ms | 한 프레임 최대 | 대표 함수·장면 |
|---:|---|---|---:|---:|---:|---|
| 1 | **Major GC** | JS 힙(최대 230~836 MB)과 임베더 메모리(1.2~1.8 GB)가 V8 전역 예산 한도에 붙어 major GC가 분당 5.5~13.7번(새 게임 27~29번) 돈다. 표시 시작 이유는 모두 `task` | 640 | 306 | 2,292 ms | `V8.GC_MARK_COMPACTOR` 0.7~1.8초(3×·5×). 모든 장면·배속 |
| 2 | 건물·물체 그리기 | 한 프레임의 물체 그리기가 길어진다. 첫 그리기 캐시 채우기가 섞인다 | 362 | 88 | 1,800 ms | `drawObjectRenderItems`·`drawBuildings`·`drawPalisadeSegment`(최대 254 ms)·`drawCachedWorldRaster`(248 ms)·스프라이트 여백 자르기 `trimTransparentMargin`+`getImageData`(최대 235·160 ms) |
| 3 | 시뮬레이션 틱 겹침 | 5배속이면 한 프레임에 최대 5틱이다. 틱 안의 길 찾기·분배가 한 프레임에 쌓인다 | 643 | 24 | 2,492 ms(서랍과 겹침) | `advanceTick`(최대 637 ms)·`advanceSimulationSubstep`·`routeToBuilding`/`resolveRoadToBuildingRoute`(~70 ms)·`stepDistributors`(65 ms)·`findExistingRoadPath`·`householdMembers`·`personById` |
| 4 | 지면 그리기·경계 재구성 | 계절 전환·도구 사용 때 지면 경계를 다시 짓고 청크를 다시 그린다 | 105 | 17 | 1,799 ms | `ground`·`drawTerrainBoundaryV2`(최대 584 ms)·`buildGroundBoundaryScene`(계절 전환 58 ms). ch3 1×의 1.8초 한 프레임(`objectRenderItemsForFrame` 762·`ground` 595·`warProps` 354 ms 자기 시간) |
| 5 | 한 프레임 쌓임(기타) | UI를 여는 순간의 강제 레이아웃, 틱, 그리기가 같은 프레임에 겹친다 | 146 | 13 | 2,491 ms | 서랍 열기: `getBoundingClientRect` 275 ms + `transferToImageBitmap` 191 ms + `householdSlots` 156 ms + 틱 637 ms + `drawWalker` 380 ms |
| 6 | 입력 중 동기 React 렌더·길 찾기 | 배치 끌기 포인터 이동마다 동기 렌더와 길 경로 계산이 돈다 | 40 | 11 | 1,524 ms | `performSyncWorkOnRoot` 474 ms·`shortestRoadPathBetweenAccessTiles`·`getOrthogonalRoadNeighbors`. ops-placement 5×는 33 ms 초과가 분당 154번 |
| 7 | GPU 프로세스·합성(메인 스레드 밖) | 메인 스레드는 한가한데 GPU 프로세스가 오래 걸린다 | 44 | 11 | 667 ms | `GPU Process/CrGpuMain: GPUTask`(최대 1,218 ms), 도구 미리보기 첫 그리기 283 ms |
| 8 | 걷는 사람·수레 첫 합성 | 처음 보이는 걷는 사람·수레 그림을 합성한다 | 45(+물체 안) | 0(+물체 안) | 1,662 ms(물체로 분류) | `drawComposedWalkerWithCart` 458 ms·`drawComposedWalker` 380 ms(ch5 3×) |
| 9 | 자동 저장·결산 | 계절 전환의 자동 저장 직렬화와 유휴 콜백 | 23 | 1 | 492 ms | `encodeSave`+`stateChecksum` ~49 ms, 유휴 콜백 최대 420 ms. 저장 크기는 2.4 MB(1337) → 6.7 MB(1440) |
| 10 | 큰 minor GC | 젊은 세대 수집(scavenge)이 드물게 수백 ms로 길어진다 | 16 | 4 | 699 ms | `MinorGC` 477~699 ms(ch5·ops) |

- **"원인 미기록"**: 추적 버퍼가 차서 Chrome이 기록을 멈춘 뒤의 프레임이 80개다(카메라 1×는 122초 뒤부터). 원인 목록에 넣지 않았다.
- **그림 디코드**: 8프레임(최대 50 ms)뿐이라 Mac에서는 주원인이 아니었다.

## 순간별 (Mac)

| 순간 | 본 횟수 | 1초 안에 긴 프레임 | 비율 | 아무 1.25초 구간 비율(기준) | 최악 |
|---|---:|---:|---:|---:|---:|
| 계절 전환(= 날씨 전환) | 159 | 107 | 67% | 26% | 815 ms |
| 자동 저장 | 172 | 111 | 65% | 26% | 815 ms |
| 모달(결산 카드·이야기·청원) | 358 | 128 | 36% | 26% | 942 ms |
| 장 전환 | 4 | 4 | 100% | 26% | 67 ms |

- **계절 전환의 겹침**: 계절이 바뀌는 틱에 결산 카드 모달과 자동 저장이 함께 온다. 셋이 같은 1초 안에 겹쳐서 계절 전환이 가장 위험한 순간이다.
- **청원 모달**: 모달 자체는 부드러웠다. 1×는 긴 프레임 1개(34 ms), 5×는 0개다. 3×의 216 ms는 모달과 떨어진 프레임이다.

## 기계별 차이

- **DGX 헤드리스**
  - 소프트웨어 래스터라 도시(ch2~ch5)에서 p95가 33.4 ms에 붙는다. 긴 프레임의 대부분이 물체·지면 그리기(래스터 비용)다.
  - Mac에서 1위인 GC는 DGX에서는 묻힌다. 그래서 DGX로는 "튀는가"를 판정할 수 없다.
- **DGX 무효 실행 5개**(rAF p50 > 16.8 ms): ch4 5× 추적 없음, ch5 1×, 서랍 1×·3×, 배치 5×.
  - 다른 세션의 원격 실행이 같은 12코어 슬라이스를 썼다(13:31~14:10 engine ARCH1 가드레일, 15:12~ engine ARCH1b 캠페인·가드레일).
  - ch5 3×·5×는 실행 중에 무효로 판단해 멈췄다.
- **Mac 실제 창**
  - 120 Hz라 p50이 8.3 ms다. 끊김의 모양(GC·겹침·첫 캐시)이 그대로 보인다.
  - 60 Hz 디스플레이에서는 같은 일이 한 프레임 16.7 ms 안에 들어가야 한다. 그래서 p99가 더 나빠질 것으로 보이지만, 재지 않았다.
- **추적의 영향**: 추적을 켜면 CPU 샘플러와 기록 때문에 긴 프레임이 늘어난다(대조군 1.6~3.8배). 판정 수치는 추적 없이 재고, 추적은 원인을 보는 데만 쓰는 것이 맞다.

<details><summary>DGX 헤드리스 표(비교용)</summary>

| 기계 | 장면 | 조작 | 배속 | 유효 | 끝 인구 | 프레임 | p50 | p95 | p99 | 최대 | >25 | >33 | >50 | >33/분 | 긴 프레임 순간 |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| dgx-headless | ch1-new | none | 1× | ○ | 38 | 10441 | 16.7 | 16.8 | 33.4 | 66.8 | 344 | 344 | 4 | 114.7 | none 307(50) · dialog 22(67) · season 23(67) · autosave 23(67) |
| dgx-headless | ch1-new | none | 3× | ○ | 1 | 10637 | 16.7 | 16.8 | 33.3 | 100 | 160 | 160 | 19 | 53.1 | none 126(100) · dialog 29(67) · season 27(67) · autosave 25(100) |
| dgx-headless | ch1-new (추적 없음) | none | 5× | ○ | 6 | 5880 | 16.7 | 66.7 | 83.4 | 183.3 | 2440 | 2440 | 732 | 813.2 | none 2027(183) · dialog 225(150) · season 220(150) · autosave 234(117) |
| dgx-headless | ch1-new | none | 5× | ○ | 15 | 8667 | 16.7 | 50 | 66.7 | 183.3 | 1434 | 1434 | 184 | 472.9 | none 1102(183) · season 216(100) · dialog 232(133) · autosave 205(100) |
| dgx-headless | ch2-1340 | none | 1× | ○ | 739 | 6247 | 16.8 | 50.1 | 83.3 | 266.6 | 3012 | 3012 | 412 | 1003.9 | none 2836(267) · dialog 93(167) · season 76(167) · chapter 27(167) · autosave 97(217) |
| dgx-headless | ch2-1340 | none | 3× | ○ | 759 | 7849 | 16.7 | 33.4 | 50 | 349.9 | 2830 | 2830 | 51 | 929.9 | none 2525(350) · dialog 213(117) · season 200(117) · chapter 28(83) · autosave 126(250) |
| dgx-headless | ch2-1340 | none | 5× | ○ | 759 | 7725 | 16.7 | 33.4 | 50 | 333.3 | 2752 | 2752 | 57 | 917.2 | none 2285(333) · season 360(150) · chapter 30(100) · dialog 354(233) · autosave 177(233) |
| dgx-headless | ch3-plague | none | 1× | ○ | 481 | 9254 | 16.7 | 33.4 | 33.4 | 216.6 | 1404 | 1404 | 24 | 467.9 | none 1312(217) · dialog 54(100) · season 47(100) · autosave 48(50) |
| dgx-headless | ch3-plague | none | 3× | ○ | 430 | 8262 | 16.7 | 33.4 | 50 | 333.3 | 2272 | 2272 | 50 | 757.4 | none 2029(317) · season 158(117) · dialog 175(117) · autosave 79(333) |
| dgx-headless | ch3-plague | none | 5× | ○ | 426 | 7638 | 16.7 | 33.4 | 50 | 366.7 | 2787 | 2787 | 70 | 928.9 | none 2317(367) · season 339(83) · dialog 344(83) · autosave 186(200) |
| dgx-headless | ch4-1380 | none | 1× | ○ | 768 | 8754 | 16.7 | 33.4 | 33.4 | 266.7 | 1923 | 1923 | 24 | 640.9 | none 1848(267) · season 55(100) · dialog 56(100) · autosave 28(67) |
| dgx-headless | ch4-1380 | none | 3× | ○ | 768 | 7839 | 16.7 | 33.4 | 50 | 366.7 | 2902 | 2902 | 57 | 944.4 | none 2634(350) · dialog 191(367) · season 190(233) · autosave 94(233) |
| dgx-headless | ch4-1380 (추적 없음) | none | 5× | × rAF p50 | 768 | 3799 | 50 | 83.4 | 100.1 | 383.4 | 3007 | 3007 | 1410 | 1000.8 | none 2557(383) · season 205(200) · dialog 230(200) · autosave 244(150) |
| dgx-headless | ch4-1380 | none | 5× | ○ | 768 | 7134 | 16.7 | 33.4 | 50 | 366.7 | 3341 | 3341 | 69 | 1103.2 | none 2774(367) · season 389(167) · dialog 408(250) · autosave 227(200) · chapter 30(83) |
| dgx-headless | ch5-1440 | none | 1× | × rAF p50 | 768 | 4702 | 33.4 | 66.7 | 83.3 | 383.3 | 3964 | 3964 | 544 | 1321.1 | none 3804(283) · season 85(117) · dialog 85(117) · autosave 82(383) |
| dgx-headless | moment-petition | none | 1× | ○ | 528 | 3419 | 16.7 | 33.2 | 33.4 | 83.3 | 172 | 172 | 2 | 172 | none 158(83) · season 9(33) · dialog 10(33) · autosave 5(50) |
| dgx-headless | moment-petition | none | 3× | ○ | 528 | 3344 | 16.7 | 33.3 | 33.4 | 166.7 | 414 | 414 | 11 | 392.4 | none 343(100) · season 49(167) · dialog 53(167) · autosave 31(50) |
| dgx-headless | moment-petition | none | 5× | ○ | 528 | 3118 | 16.7 | 33.4 | 50 | 133.2 | 442 | 442 | 14 | 438.6 | dialog 93(67) · autosave 53(50) · none 327(133) · season 70(67) |
| dgx-headless | ops-camera | camera | 1× | ○ | 768 | 9708 | 16.7 | 33.3 | 33.4 | 400.1 | 540 | 540 | 70 | 180 | none 536(400) · dialog 4(33) · season 4(33) · autosave 4(33) |
| dgx-headless | ops-camera | camera | 3× | ○ | 768 | 7499 | 16.7 | 33.4 | 50 | 400.1 | 3121 | 3121 | 39 | 1040.1 | none 3063(400) · dialog 34(100) · season 33(100) · autosave 30(83) |
| dgx-headless | ops-camera | camera | 5× | ○ | 768 | 10392 | 16.7 | 16.8 | 33.4 | 99.9 | 386 | 386 | 6 | 128.6 | none 357(100) · dialog 28(67) · season 28(67) · autosave 15(67) |
| dgx-headless | ops-drawers | drawers | 1× | × rAF p50 | 768 | 3940 | 49.9 | 116.6 | 183.2 | 433.4 | 2626 | 2626 | 1640 | 781.4 | none 2493(300) · dialog 70(433) · autosave 67(250) · season 6(433) |
| dgx-headless | ops-drawers | drawers | 3× | × rAF p50 | 768 | 2355 | 66.7 | 183.4 | 250 | 883.3 | 1870 | 1870 | 1402 | 621.9 | none 1743(883) · season 44(400) · dialog 62(400) · autosave 67(283) |
| dgx-headless | ops-placement | placement | 3× | ○ | 768 | 12240 | 16.7 | 33.4 | 50 | 183.3 | 1922 | 1922 | 60 | 479 | none 1737(183) · season 89(100) · dialog 93(100) · autosave 105(67) |
| dgx-headless | ops-placement | placement | 5× | × rAF p50 | 768 | 6904 | 33.3 | 83.3 | 116.7 | 550 | 4924 | 4924 | 996 | 1151.3 | none 4507(550) · season 196(183) · dialog 198(183) · autosave 236(183) |

</details>

## 목표 제안 (사용자 판정용)

- **측정 조건**: 이 Mac의 실제 Chrome 창(120 Hz)에서 추적 없이 3분씩 판정한다. 원인은 같은 장면의 추적 실행으로 본다. DGX 헤드리스는 판정에 쓰지 않는다.
- **지금 값**(가장 큰 도시 5×, 추적 없음): p99 16.3 ms, 최대 832 ms, 33 ms 초과 분당 9.8번, 50 ms 초과 23번/3분.

| 단계 | 대상 | p99 | 최대 | 50 ms 초과 | 33 ms 초과 | 순간 |
|---|---|---:|---:|---:|---:|---|
| 1단계(GC·메모리 정리 뒤 현실선) | 모든 장면 1·3·5×, 조작 포함 | ≤ 16.7 ms | ≤ 100 ms | ≤ 1/분 | ≤ 3/분 | 계절 전환·자동 저장 1초 안 긴 프레임 비율이 기준 구간과 같음 |
| 2단계(목표 "한 번도 튀지 않는다") | 가장 큰 도시 5× + 조작 | ≤ 12 ms(120 Hz 1.5프레임) | ≤ 33 ms | 0 | ≤ 1/분 | 계절 전환·자동 저장·장 전환·모달 각각 33 ms 초과 0 |
| 60 Hz 기기(Steam Deck 실기 때) | 같은 장면 | ≤ 20 ms | ≤ 33 ms | 0 | ≤ 1/분 | 같음 |

- **왜 1단계는 최대 100 ms인가**: 지금 100 ms를 넘는 긴 프레임 500개 가운데 306개(약 60%)가 major GC다. GC가 분당 5.5~13.7번 도는 한 33 ms를 지키기는 어렵다. 먼저 메모리(임베더 1.2~1.8 GB·힙 수백 MB)를 줄여 GC 빈도와 길이를 낮추는 것이 순서다.
- **왜 2단계에서 5×·조작을 보는가**: 끊김이 가장 많이 나오는 조건이다. 5×는 틱이 겹치고, 배치 끌기는 5×에서 분당 154번이다.

## 한계

- **60 Hz 미측정**: 이 Mac의 60 Hz는 재지 않았다(디스플레이 설정 변경 필요). Steam Deck은 실기 때 잰다.
- **seed 하나**: seed 2 봇 도시 하나다. 사람이 지은 도시는 모양이 다를 수 있다.
- **자동 입력**: 조작 장면은 CDP로 넣은 마우스·휠·키 입력이다. 실제 손의 입력 빈도와 다를 수 있다.
- **추적 버퍼**: 입력이 많은 실행에서는 추적 버퍼가 약 2분에 찬다(카메라 1×는 122초). 그 뒤 프레임은 원인이 없다(프레임 통계는 전 구간).
- **모달 처리**: 모달이 뜨면 약 3초 뒤 닫는다. 그동안 게임이 멈추므로 틱 부하는 실제 플레이와 다르다. 튜토리얼은 껐다.
- **DGX 빠진 칸**: DGX의 ops-placement 1×와 ops-drawers 5×는 불러오기·분석 중 Node 오류로 끝나 결과가 없다(수정 전 코드). ch5 3×·5×는 다른 세션의 실행과 겹쳐 무효라서 멈췄다. DGX는 비교용이라 다시 돌리지 않았다.
- **분석 재실행**: 분석 버그를 고친 뒤 모든 실행을 `hitchReanalyse.ts`로 같은 코드로 다시 읽었다. ch1-new 5× 추적 실행 하나만 기록 파일 저장 전이라 원래 분석을 썼다.

## 산출물과 다시 돌리기

```sh
# 장면 저장(한 번, DGX 약 35분)
scripts/remote/run.sh <label> --detach -- node_modules/.bin/tsx scripts/perf/hitchStates.ts .remote/states 2 600000
# Mac 실제 창(화면에 창이 뜬다; 추적 실행 한 칸에 5~7분)
PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs bash scripts/perf/hitchBatch.sh --machine mac-chrome-window \
  --states <dir> --out <summaries> --traces ~/feudal-lord-analysis/perf-traces/<date>/mac-chrome-window --headed --port 4391
# 대조(추적 없음)는 --no-trace, 분석 다시 하기·표 만들기
node_modules/.bin/tsx scripts/perf/hitchReanalyse.ts <trace dir> <summary dir>
node_modules/.bin/tsx scripts/perf/hitchSummary.ts <summary dirs…> --out docs/verification/smooth1/summary.json --tables docs/verification/smooth1/tables.md
```

## 다음 후보(이 작업에서 고치지 않음)

1. **메모리**
   - 무엇이 1.2~1.8 GB를 쥐는지 따로 잰다: 임베더 메모리(지면 청크·월드 래스터·합성 캔버스·그림)와 JS 힙(원장·기록·캐시).
   - 캐시 상한을 바이트 기준으로 둔다.
   - GC 빈도와 한 번 길이를 관문에 넣는다.
2. **한 프레임 예산**
   - 5배속 틱을 프레임당 시간 예산 안으로 나눈다.
   - 첫 캐시 채우기(스프라이트 자르기·걷는 사람 합성·경계 재구성)를 미리 하거나 나눠 한다.
   - 서랍을 여는 프레임과 틱이 겹치지 않게 한다.
3. **입력 경로**: 배치 끌기 중 동기 React 렌더와 길 찾기를 포인터 이동마다가 아니라 프레임마다 한 번만 하게 한다.
4. **계절 전환**: 자동 저장·결산 카드·경계 재구성을 같은 프레임에 두지 않는다.
5. **관문 도구화**: 이 감사를 Mac 실제 창 판정 관문으로 만든다(추적 없는 판정 + 추적 원인). DGX는 추세 기록만 한다.

## 소요 시간

13:38(작업 브랜치 생성) ~ END_TIME(본선 푸시). 4시간 상한.

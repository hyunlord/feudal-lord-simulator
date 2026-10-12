# 엔진 → REMOTE: 영주 모드 성장 관문을 본선 정기 실행에 (GROW-BLOCK-2a, 2026-10-10)

사용자 판정(2026-10-10): GB-8·GB-12처럼 영주 모드에만 있는 성장 규칙이 늘수록, 샌드박스 가드레일로는 영주 모드 성장을 지킬 수 없다. 그래서 `growBlockProbe`(seed 10개 × 60년)를 본선에서 날마다 도는 성장 관문으로 만든다. 기준을 어긴 첫 커밋의 주인을 표시하는 방식은 깨끗한 클론 시험과 같다.

## 실행
- **명령**: `bash scripts/growthGateRun.sh output/growth-gate`.
  - seed 1~10을 60년(1300–1360) 동시에 돌린 뒤 판정한다.
  - 결과: 종료 코드 0이면 통과, 1이면 실패, 2이면 탐침 자체가 실패.
  - 판정문은 `output/growth-gate/verdict.txt`, seed별 원자료는 `m-<seed>.json`에 남는다.
- **DGX에서 돈다**: 무거운 실행이다(DGX에서 프로세스 열 개로 약 2~2.5시간). 예: `scripts/remote/run.sh infra-GROWTH-<sha> --heavy --keep -- bash scripts/growthGateRun.sh output/growth-gate`.
- **판정만 다시**: `npx tsx scripts/growthGate.ts <폴더>`.

## 통과 기준(`scripts/growthGate.ts`)
| 기준 | 값 |
|---|---|
| 10년 넘는 정체(인구와 목책이 함께 그대로, 768 미만) | 0 |
| seed마다 최고 인구 | 768(성벽 안 24필지 L4) |
| 그루터기 최대 | 865 미만(`STUMP_PEAK_MAX`; GROW-BLOCK-2a 전 최악은 seed 7의 886, seed 1의 865) |
| 접은 자리에 다시 놓기 | 0 |
| 접은 공사장(까닭별 길·자재·일) | 보이기만 하고 판정하지 않음 |

- **알려진 판**(`KNOWN`, 2a 최종 판 기준):
  - seed 1: 특허가 목재를, 그다음 교회가 돌을 기다린다(1318–1329, 528명). A안 묶음이 고친다.
  - seed 3: 성벽 안 집터를 밭이 덮는다. GROW-BLOCK-2b가 고친다.
  - seed 9: 목책 뒤 빵이 집에 닿지 않는다(1330–1348, 608 → 489). 2a 뒤 DGX 진단으로 원인을 정한다.
  - 판정문에 "known"으로 보이되 실패로 세지 않는다. 고치는 작업이 들어가면 엔진이 그 줄을 지운다.
- **기준을 바꾸는 경우**: 엔진이 결정 목록에 줄을 적는다(규칙 19와 같은 방식).

## REMOTE에 부탁하는 것
1. 본선 정기 실행(하루 한 번)에 위 명령을 연결한다.
2. 실패하면 첫 나쁜 커밋을 찾아 그 주인 세션을 표시한다. 방법은 깨끗한 클론 시험의 이분 탐색과 같다.
3. 결과 표(seed별 최고 인구·그루터기·정체·접은 공사장)를 남긴다.
   - 남기는 곳의 예: `docs/verification/perf-trend/`처럼 한 곳.
   - 렌더 A와 사용자가 성장 추이를 본다.
4. 실행 폴더는 `--keep`으로 남긴다. 판정 근거가 되는 판이다.

## 지금 상태
- 첫 기준값은 GROW-BLOCK-2a 최종 판(`engine-GROW2a-final-bdf07e1`, DGX)의 seed 1~10이다. 위 `KNOWN`으로 판정하면 통과다(Mac에서 `growthGate.ts`로 판정만 다시).
- 그루터기 최대는 seed 7의 800이다. 숫자는 [2a 보고서](../verification/grow-block-2a/REPORT.md)에 있다.

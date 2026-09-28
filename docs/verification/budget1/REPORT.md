# BUDGET-1 빌드 크기 예산·이미지 메모리 — 보고서

관문: 통과 — 전체 63.60 MB / 150 MB · 초상 4.33 / 20 · 삽화 5.29 / 25(DGX 빌드 `ec901f2`) · 넘으면 병합 전 검사 실패(강제 초과 실행으로 확인) · 초상·삽화는 화면에 뜰 때만 불러옴(다섯 단계 모두 "불러왔는데 안 보임" 0) · 시험 6/6 · 깨끗한 클론 `18548b2`(C4 병합 뒤) 3,344/3,344·build

작업: 예산 스크립트·병합 전 검사 단계·탐침은 하위 에이전트가 `claude/budget1`에서 만들었고(`0944bc38`, `8b199413`), DGX 측정과 보고는 이 세션이 했다. INSTALL-23b와 한 가지로 합쳐 검증·병합했다.

## 1. 예산표
- [BUDGET.md](BUDGET.md)(표와 범주 안의 구성), 원본 [dgx/dist-budget.json](dgx/dist-budget.json)(DGX `ec901f2`; [dist-budget.json](dist-budget.json)은 BUDGET-1b가 woff2만으로 다시 잰 것)·[dgx/dist-budget.json](dgx/dist-budget.json)(DGX `ec901f2`, 같은 63.60 MB). MB = 1,000,000바이트.

| 범주 | 파일 | 크기 | 예산 | 남은 폭 |
|---|---:|---:|---:|---:|
| 세계 그림 | 660 | 26.14 MB | — | — |
| 초상 | 614 | 4.33 MB | 20 MB | 15.67 MB |
| 삽화 | 81 | 5.29 MB | 25 MB | 19.71 MB |
| 키아트 | 6 | 1.49 MB | — | — |
| UI | 1,002 | 22.75 MB | — | — |
| 소리 | 37 | 1.24 MB | — | — |
| 코드 | 15 | 2.36 MB | — | — |
| 기타 | 1 | 0.00 MB | — | — |
| 전체 | 2,416 | 63.60 MB | 150 MB | 86.40 MB |

- 범주 규칙과 예산은 한 파일 `scripts/checks/distBudget.config.json`(dist 안 경로 패턴 → 범주, 먼저 맞는 규칙). 섞인 웨이브 폴더는 하위 폴더로 나눴다(예: wave19 `scenes_*`는 삽화, `cards|pages|timeline`은 UI; wave23 `life_*|weather`는 세계 그림, `pad|person_state|royal`은 UI). 어느 규칙에도 안 맞는 파일은 기타로 세고 목록에 적는다(지금 `assets/.gitkeep` 0바이트 하나).
- 글꼴은 UI로 셌다: 744개 16.19 MB — UI의 71 %. 빌드가 Noto Sans KR 글자 묶음 372개를 woff2(약 7 MB)와 woff(약 9 MB) 두 가지로 모두 싣는다(판정 필요: woff 빼기).

## 2. 병합 전 검사
- `npm run check:merge` 일곱째 단계 `budget`: 푸시 머리를 임시 폴더에 `vite build --outDir`로 빌드해 재고 지운다(작업 폴더의 dist는 그대로). 전체나 예산 있는 범주가 넘으면 실패. 빌드 0.8–1.3 초(캐시), 첫 빌드 약 7 초(DGX 6.6 초).
- 강제 초과(임시로 전체 60 MB·초상 4 MB): `budget: 63.60 MB of 60.00 MB, OVER (전체 … 초상 4.33 MB > 4.00 MB)` → `check:merge: FAILED (budget)`, 종료 1. 시험 `tests/distBudget.test.ts`(범주 나누기, 넘으면 실패) 6/6. 따로 재기: `npm run budget:dist`.

## 3. 1장 끝 저장의 이미지 메모리와 늦은 불러오기(DGX)
- `scripts/imageMemoryProbe.mjs`, 상태 `scripts/ui4ChapterStates.ts 2 90000`의 `chapter-end`(seed 2, 틱 77,500), 1600 × 1100, DPR 1, 헤드리스 Chrome(소프트웨어 래스터). 결과 [dgx/image-memory-dgx.json](dgx/image-memory-dgx.json).

| 단계 | 초상 불러옴(이 단계) / 화면 | 삽화 불러옴(이 단계) / 화면 | 추정 해제 크기 | Chrome 측정: 렌더러 cc/image_memory · discardable · canvas | GPU shared_images |
|---|---|---|---:|---|---:|
| 불러온 직후(1장 쪽) | 1(1) / 1 | 8(8) / 8 | 148.4 MB | 45.1 · 48.9 · 61.4 MB | 46.2 MB |
| 지도 | 1(0) / 1 | 8(0) / 2 | 148.6 MB | 48.1 · 49.0 · 61.4 MB | 43.4 MB |
| 연대기 | 6(5) / 6 | 9(1) / 4 | 158.6 MB | 58.2 · 61.5 · 61.5 MB | 52.1 MB |
| 세력 탭 | 15(9) / 10 | 9(0) / 2 | 162.4 MB | 63.6 · 64.1 · 61.4 MB | 51.9 MB |
| 국왕 세력 쪽 | 16(1) / 2 | 9(0) / 2 | 164.7 MB | 66.0 · 66.4 · 61.4 MB | 47.7 MB |

- 늦은 불러오기: 모든 단계에서 그 단계에 불러온 초상·삽화는 그때 화면에 있었다("불러왔는데 안 보임" 0). 초상·삽화는 CSS 배경(`src/ui/portraitArt.ts`, `src/ui/wave16Art.ts`)이라 화면에 그려질 때 브라우저가 가져온다. 화면 수보다 불러온 수가 큰 것은 앞 단계에서 보였던 것이 남은 것.
- 세계 그림은 시작 때 한 번에 불러온다: 590개(파일 24.1 MB, 추정 해제 118.8 MB), `src/render/preloadGameArt.ts:17`. 초상·삽화가 아니라 그대로 뒀다.
- "추정 해제 크기"는 지금까지 불러온 모든 그림의 가로 × 세로 × 4의 합 — 아무것도 버리지 않는다고 본 위쪽 한계다. Chrome이 실제로 들고 있는 해제 그림은 렌더러 `cc/image_memory` 45 → 66 MB(연대기·세력을 돌며 +21 MB), 버릴 수 있는 캐시 `discardable` 49 → 66 MB, 캔버스 61 MB(게임 캔버스와 오프스크린 캐시), GPU 프로세스 shared_images 43–52 MB.

## 4. 판정 대기
1. 글꼴 woff 사본(372개, 약 9 MB — UI 16.19 MB의 절반 남짓): woff2만 남길지.
2. 세계 그림을 시작 때 전부 불러오는 것(590개, 추정 해제 119 MB)을 그대로 둘지.

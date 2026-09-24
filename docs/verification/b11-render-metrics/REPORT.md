# B11 렌더 단계별 계측 + P-F1 원인 규명

관문: ①합 99.9~100.0% · ②오버헤드 0 · ③P-F1 재현(headless·headed 모두 GPU에서만), 원인 = 도로 칸 패턴 `fillRect` · 수정 · ④기준선 14칸(12칸 + 24필지 CPU 4배 2칸)

- 측정 기준: 브랜치 `claude/b11-render-metrics`에 본선 `008a24f`를 merge한 `cbd221a` 이후 커밋. 증빙 폴더 중 `premerge-*`는 merge 전(본선 `1c09e99` 기준) 측정이다.
- 기기: Apple M4 Max, macOS 26.4.1, Chrome 153.0.8010.53. GPU 모드의 `chrome://gpu`는 Canvas·Rasterization·Compositing 모두 Hardware accelerated(ANGLE Metal)이고, 소프트웨어 모드(`--disable-gpu`)는 Software only다.
- 측정은 모두 Vite 개발 서버와 `?phase10-proof=1`에서 했다. React가 개발 모드로 돌기 때문에 캔버스 밖 스크립트 비용은 배포 빌드보다 크게 나온다.

## 1. 만든 것

| 파일 | 내용 |
|---|---|
| `src/render/renderStageProbe.ts` | 증빙 모드 전용 단계 기록기 |
| `src/render/{canvasRuntimeFrame,gameCanvasFrame,renderer,drawTerrain,drawObjectRenderItems}.ts` | 단계 전환 지점. 각 지점은 `probe?.enter(...)` 한 줄이다 |
| `src/testing/phase10ProofRuntime.ts` | 증빙 포트 연결. `diagnosis().renderStages`, `diagnosis().rasterCache`. `&render-stages=0`이면 단계 계측 없이 포트만 켠다 |
| `tests/renderStageProbe.test.ts` | 관문 ① 합 = 프레임 시간. 관문 ② 증빙 모드가 아니면 계측 코드 미실행(V8 정밀 커버리지). 대조군 포함 |
| `scripts/renderStageBenchmark.mjs` | phase19 formal loop 확장. 단계별 중앙값·p95, 호출 수, 화면 내 타일·객체, 래스터 캐시, 힙, 트레이스 분리. `--matrix b11`이 관문 ④ 조합 |
| `scripts/renderCommitProbe.mjs` | P-F1 조합 측정(headless/headed × GPU/software) |
| `scripts/renderPixelCompare.mjs` | 정지 상태 fixture 캡처와 픽셀 비교 |
| `scripts/renderFixtureStates.ts` | 벤치 도시를 저장 코덱으로 현재 스키마까지 마이그레이션 |
| `scripts/measureTickRouting.ts` | 틱 중 경로 탐색 비중(엔진 파일 무변경) |
| `src/render/drawTerrainDetails.ts` | P-F1 수정(3절) |

**단계 기록 방식**
- 단계는 평평하고 서로 겹치지 않는다. `enter(stage)`가 앞 단계를 현재 시각으로 닫고 다음 단계를 연다. 그래서 한 프레임의 단계 시간 합은 `frameEnd − frameStart`와 정확히 같다.
- 브라우저 `performance.now()` 해상도(약 0.1ms)는 합에 영향을 주지 않는다. 다만 단계별 **중앙값**은 0.1ms 단위로 끊겨 보인다. 작은 단계는 평균을 본다.
- 캔버스 호출 수는 증빙 캔버스에서만 `drawImage·fill·stroke·fillRect·clip·beginPath`를 감싸 단계별로 센다. 해제 시 원래 메서드로 돌려놓는다.

**단계 → 묶음**(`RENDER_STAGE_GROUPS`)
- 지형: `terrain.water·fill·seams·landscape·grounding`
- 도로: `roads.ground`(지면 도로), `roads.overlay`(가독성 덧칠), `bridges`
- 농지: `farmland`
- 오브젝트 정렬: `objects.sort`(가시 범위·객체 큐 생성·깊이 정렬)
- 건물: `buildings·construction·terrain.frontage`
- 나무·풀: `nature`
- 성벽: `walls`
- 주민·수레: `walkers`
- 오버레이: 원인 지도·온보딩·배치 미리보기·목책 초안 등
- 준비: 미리보기 계산·화면 지우기·게시
- 캔버스 밖 UI(React 렌더·커밋)는 계측기가 아니라 트레이스로 분리한다. 트레이스의 "rAF 밖 스크립트"는 스케줄러 작업과 타이머이고, 대부분 React다.

## 2. 관문 판정

| 관문 | 결과 | 근거 |
|---|---|---|
| ① 단계 합 / `frameWorkMs` | **99.87~99.98%** (14칸 전부) | `baseline/*.json`의 `stageCoverage`. 두 링버퍼가 같은 240프레임을 담는다(`stageFrames` = 240). 나머지 0.1%는 `drawFrame`이 `drawCurrentCanvasFrame`을 부르고 돌아오는 사이 시간이다 |
| ② 증빙 모드가 아닐 때 오버헤드 0 | **미실행 확인** | `tests/renderStageProbe.test.ts`. 기록기가 없을 때 24필지 한 프레임 전체(캔버스 호출 약 12만 번)를 그리는 동안 V8 정밀 커버리지로 본 `renderStageProbe.ts` 함수 호출은 0회다. 대조군: 기록기를 켜면 `countedCanvasCall` 31,922회·`stageForRenderItem` 608회, 해제하면 다시 0회. 증빙 조건이 아니면 설치 자체가 안 되고 캔버스 메서드도 그대로다. 호출 지점은 `probe?.` 형태라 인수(`stageForRenderItem(...)`)도 평가되지 않는다 |
| ③ P-F1 | **재현 → 원인 확정 → 수정** | 3절 |
| ④ 기준선 | **14칸** | 4절: 24필지·인구 176·새 게임 × DPR1/2 × 정지/드래그 = 12칸, 24필지 CPU 4배 정지/드래그 = 2칸 |

**증빙 모드 안에서의 계측 비용**(참고, 관문 밖)
- 24필지·DPR1·정지에서 `&render-stages=0`과 비교했다.
- merge 전: frameWork 중앙값 23.3 → 23.7ms(+2%).
- merge 후: 11.0 → 12.3ms(+12%).
- 한 번씩 잰 값이라 측정 편차와 섞여 있다(`probe-overhead/`, `premerge-probe-overhead/`).

## 3. P-F1 원인 규명

**재현**(`premerge-p-f1-before-fix.json`, rAF 중앙값·트레이스 3초 중 메인 스레드 `Commit` ms)

| 모드 | 인구 176 마을 | 인구 176 빈 땅 | 새 게임 마을 | 24필지 |
|---|---|---|---|---|
| headless · GPU | **149.9ms** · Commit 2,593 | 16.7 · 280 | **183.3** · 2,363 | 33.3 · 51 |
| headed · GPU | **150.0** · 2,626 | 8.3 · 567 | **183.7** · 2,414 | 34.2 · 52 |
| headless · software | 16.7 · 1,853 | 16.7 · 1,690 | 33.4 · 1,225 | 33.4 · 1,570 |
| headed · software | 26.2 · 1,822 | 24.7 · 1,803 | 41.4 · 1,211 | 41.5 · 1,575 |

- 일반 창에서도 재현된다. 헤드리스 전용 현상이 아니라 **GPU 캔버스 경로의 제품 결함**이다.
- 소프트웨어 렌더에서는 생기지 않는다. 소프트웨어 모드는 원래 Commit이 1.2~1.9초라 모든 장면이 고르게 느리다. 그 차이와 별개로, 마을만 튀는 현상은 없다.

**이분 탐색**(HTTP 응답에서만 렌더 모듈을 고쳐 한 단계씩 끔. 저장소 코드 무변경. headless·GPU·인구 176 마을, rAF 중앙값)

| 끈 것 | rAF |
|---|---|
| (없음) | 150~183ms |
| 지면 패스 전체 / 객체 패스 전체 | 16.7 / 16.7 |
| 비네트 / 원인 지도·온보딩 | 150 / 150 |
| 물 · 지면 마름모 · 이음새 · 풍경 · 그림자 | 150 · 133 · 150 · 150 · 150 |
| **지면 도로 `drawRoadPath`** | **16.7** |
| 도로 패턴 채우기 `fillRoadPattern` | **16.7** |
| `clip()`만 제거(패턴 `fillRect` 유지) | 150 |
| 패턴 `fillRect`만 제거(`clip` 유지) | **16.7** |
| 패턴 알파 제거 / 패턴 회전 제거 | 150 / 150 |
| 패턴 대신 단색으로 `fillRect` | **16.7** |
| 같은 패턴을 도로 다각형 `fill()`로 | **16.7** |

**원인**
- 도로 한 칸마다 흙길 패턴(256×256)을 **`fillRect`로** 칠하는 호출이다(`src/render/drawTerrainDetails.ts:fillRoadPattern`).
- 같은 패턴을 경로 `fill()`로 칠하면 비용이 없다. 단색 `fillRect`도 비용이 없다. 이 저장소의 다른 패턴 채우기(풀밭·숲 이음새·앞마당·물)는 모두 경로 `fill()`이다.
- Chrome 내부에서 왜 이 조합만 느린지는 확인하지 않았다(범위 밖).
- 관찰 하나(원인 설명은 아님): 수정 전 GPU 캡처 중 인구 176 DPR1·2와 새 게임 DPR1은 소프트웨어 캡처와 39~42% 픽셀만 달랐다. 새 게임 DPR2, 24필지, 수정 후 6장은 88~94% 달랐다. 이 세 장은 GPU 캔버스가 다른 래스터 경로로 그려졌던 것으로 보인다(`road-fix-pixels/gpu-vs-software-before.json`, `gpu-vs-software-after.json`).

**수정**(`92f0760`, 2줄 성격)
- `clip()` + 타일 상자 `fillRect` 대신, 이미 그린 도로 다각형 경로를 같은 패턴·알파로 `fill()`한다.
- 세 fixture의 도로 칸 346개 모두 다각형이 `fillRect` 상자 안에 있다. 칠하는 영역이 같다.
- 그림 보존 확인(`scripts/renderPixelCompare.mjs`, 시뮬레이션 미시작 정지 캡처 6장 = 3장면 × DPR1/2):
  - 같은 코드를 두 번 캡처하면 6장 모두 픽셀 차이가 0이다(잡음 없음, `road-fix-pixels/gpu-noise-same-code.json`).
  - **소프트웨어 래스터로 수정 전후를 비교하면 차이 픽셀 0.0~0.3%, 최대 채널 차이 2/255다**(`road-fix-pixels/software-before-vs-after.json`).
  - GPU 캡처끼리는 수정 전후 10~73%가 작은 값으로 다르다. 위의 래스터 경로 차이 때문이다. 채널 차이 8을 넘는 픽셀은 0.0~3.1%였다(`road-fix-pixels/gpu-before-vs-after.json`).
- 테스트: `tests/terrainPatterns.test.ts`에 "도로 패턴은 다각형 `fill`, `clip`·`fillRect` 없음"을 추가했다.

**수정 후**(merge 후 코드, `p-f1-modes.json`, rAF 중앙값·Commit ms)

| 모드 | 인구 176 마을 | 새 게임 마을 | 24필지 |
|---|---|---|---|
| headless · GPU | 150 → **16.7** · 344 | 183 → **16.7** · 287 | 33 → **16.7** · 419 |
| headed · GPU | 150 → **8.3** · 596 | 184 → **24.9** · 285 | 34 → **16.8** · 427 |
| headless · software | 16.7 → 33.2 | 33.4 → 33.4 | 33.4 → 33.4 |
| headed · software | 26.2 → 25.1 | 41.4 → 41.7 | 41.5 → 42.5 |

- headed GPU의 8.3ms는 120Hz 화면 기준이다.
- 소프트웨어 인구 176의 16.7 → 33.2ms는 frameWork가 5.0 → 5.5ms로 비슷해, 30fps 경계에서 흔들린 것으로 본다. 한 번씩 잰 값이다.
- 부수 효과: 24필지의 캔버스 명령 시간 자체도 줄었다. 수정 전후(merge 전, 1배·정지)로 frameWork 29.5 → 10.2ms, `roads.ground` 10.4 → 2.5ms, `farmland` 8.3 → 0.2ms, CPU 4배 frameWork 97.4 → 61.5ms다. GPU 대기가 그리기 호출 안에서 CPU 시간으로도 잡히고 있었던 것으로 보인다(추정, 확인 안 함).

## 4. 기준선 (merge 후 코드, `baseline/`)

#### 단계별 (1280×800, 카메라 정지; ms 중앙값 / p95; 평균 기준 내림차순, 24필지 1배 평균 0.05ms 미만 단계 생략)

| 단계 | 묶음 | 24필지 1배 | 24필지 CPU 4배 | 인구 176 | 새 게임 | 24필지 1배 drawImage·fill·fillRect·clip (프레임당) |
|---|---|---|---|---|---|---|
| `overlay.onboarding` | 오버레이 | 0.70 / 0.90 | 3.40 / 4.50 | 0.50 / 0.70 | 14.40 / 15.70 | 0 · 0 · 0 · 0 |
| `roads.ground` | 도로 | 2.90 / 3.50 | 12.80 / 15.10 | 0.40 / 0.50 | 0.20 / 0.30 | 0 · 1318 · 0 · 0 |
| `roads.overlay` | 도로 | 1.90 / 2.40 | 8.10 / 9.80 | 0.30 / 0.40 | 0.10 / 0.20 | 0 · 286 · 0 · 0 |
| `terrain.fill` | 지형 | 1.60 / 1.90 | 8.20 / 9.50 | 1.90 / 2.20 | 1.80 / 2.20 | 0 · 3042 · 0 · 0 |
| `objects.sort` | 오브젝트 정렬 | 0.50 / 2.00 | 7.30 / 10.10 | 0.20 / 1.20 | 0.80 / 1.10 | 0 · 0 · 0 · 0 |
| `terrain.grounding` | 지형 | 0.60 / 1.20 | 4.60 / 6.10 | 1.00 / 1.20 | 1.10 / 1.30 | 0 · 1193 · 0 · 0 |
| `nature` | 나무·풀 | 0.60 / 1.00 | 3.20 / 5.20 | 1.10 / 1.40 | 1.30 / 1.70 | 342 · 57 · 0 · 0 |
| `walls` | 성벽 | 0.60 / 0.90 | 3.10 / 4.70 | 0.00 / 0.00 | 0.00 / 0.00 | 132 · 0 · 0 · 0 |
| `terrain.frontage` | 건물 | 0.50 / 0.90 | 2.40 / 4.00 | 0.20 / 0.40 | 0.10 / 0.20 | 0 · 171 · 0 · 0 |
| `overlay.cause` | 오버레이 | 0.10 / 0.70 | 0.90 / 4.30 | 0.10 / 0.40 | 0.10 / 0.20 | 0 · 1 · 0 · 0 |
| `buildings` | 건물 | 0.20 / 0.50 | 1.30 / 2.70 | 0.10 / 0.30 | 0.10 / 0.20 | 77 · 4 · 1 · 0 |
| `terrain.seams` | 지형 | 0.20 / 0.30 | 0.80 / 1.30 | 0.30 / 0.40 | 0.40 / 0.50 | 0 · 196 · 0 · 0 |
| `farmland` | 농지 | 0.20 / 0.30 | 0.80 / 1.40 | 0.10 / 0.20 | 0.00 / 0.10 | 56 · 0 · 0 · 20 |
| `walkers` | 주민·수레 | 0.10 / 0.30 | 0.70 / 1.60 | 0.10 / 0.10 | 0.00 / 0.10 | 43 · 25 · 12 · 0 |
| `terrain.water` | 지형 | 0.10 / 0.20 | 0.50 / 1.00 | 0.10 / 0.20 | 0.10 / 0.10 | 0 · 4 · 0 · 0 |
| `frame.setup` | 준비 | 0.00 / 0.10 | 0.00 / 0.70 | 0.00 / 0.10 | 0.00 / 0.10 | 0 · 0 · 0 · 0 |
| `terrain.landscape` | 지형 | 0.00 / 0.10 | 0.00 / 0.70 | 0.00 / 0.10 | 0.00 / 0.10 | 0 · 0 · 0 · 0 |
| `frame.clear` | 준비 | 0.00 / 0.10 | 0.00 / 0.50 | 0.00 / 0.10 | 0.00 / 0.10 | 0 · 0 · 1 · 0 |
| `overlay.mode` | 오버레이 | 0.00 / 0.10 | 0.00 / 0.40 | 0.00 / 0.10 | 0.00 / 0.10 | 0 · 0 · 0 · 0 |

#### 묶음별 평균 ms (프레임 평균, 1280×800·정지)

| 묶음 | 24필지 1배 | 24필지 4배 | 인구 176 | 새 게임 |
|---|---|---|---|---|
| 도로 | 4.87 | 21.43 | 0.65 | 0.33 |
| 지형 | 2.74 | 13.83 | 3.40 | 3.41 |
| 오버레이 | 1.01 | 5.19 | 0.68 | 14.23 |
| 오브젝트 정렬 | 0.95 | 5.64 | 0.45 | 0.53 |
| 건물 | 0.79 | 3.94 | 0.38 | 0.18 |
| 나무·풀 | 0.65 | 3.37 | 1.13 | 1.29 |
| 성벽 | 0.62 | 3.16 | 0.00 | 0.00 |
| 농지 | 0.19 | 0.89 | 0.08 | 0.02 |
| 주민·수레 | 0.13 | 0.73 | 0.05 | 0.04 |
| 준비 | 0.03 | 0.23 | 0.04 | 0.03 |
| **합 (frameWork 평균)** | **11.99** (11.99) | **58.40** (58.44) | **6.85** (6.86) | **20.06** (20.07) |

**14칸 요약**(`baseline/summary.md`)

| 도시 | DPR | CPU | 카메라 | frameWork 중앙/p95 | rAF 중앙/p95 | tick 중앙/p95 | 상위 3단계 |
|---|---|---|---|---|---|---|---|
| 24필지 | 1 | 1× | 정지 / 드래그 | 11.6/14.3 · 13.4/15.3 | 16.7/33.4 · 16.7/33.4 | 2.2/9.5 · 2.2/9.5 | 도로 지면, 도로 덧칠, 지면 마름모 |
| 24필지 | 2 | 1× | 정지 / 드래그 | 13.0/16.5 · 14.1/16.1 | 16.7/33.4 · 33.3/33.4 | 2.2/20.0 · 2.1/8.8 | 같음 |
| 인구 176 | 1 | 1× | 정지 / 드래그 | 6.6/8.3 · 7.1/8.9 | 16.7/16.8 · 16.7/16.8 | 0.5/0.7 · 0.4/0.7 | 지면 마름모, 나무·풀, 그림자 |
| 인구 176 | 2 | 1× | 정지 / 드래그 | 6.5/8.2 · 7.0/8.7 | 16.7/16.8 · 16.7/16.8 | 0.5/0.7 · 0.4/0.7 | 같음 |
| 새 게임 | 1 | 1× | 정지 / 드래그 | 20.2/22.4 · 20.1/22.5 | 33.3/33.4 · 33.3/33.4 | 0.2/0.4 · 0.2/0.5 | **온보딩 오버레이 14.4**, 지면 마름모, 나무·풀 |
| 새 게임 | 2 | 1× | 정지 / 드래그 | 20.1/22.2 · 20.3/22.5 | 33.3/33.4 · 33.3/33.4 | 0.2/0.5 · 0.2/0.5 | 같음 |
| 24필지 | 1 | **4×** | 정지 / 드래그 | 59.2/68.5 · 61.6/74.9 | 133.3/166.7 · 149.9/216.7 | 9.0/16.7 · 9.1/17.9 | 도로 지면 12.8, 지면 마름모·도로 덧칠 ~8 |

- **목표 대비**(1280×800 p95 33.3ms): frameWork p95 기준으로 1배 12칸은 모두 통과, CPU 4배 2칸은 초과다.
  - 새 게임은 frameWork p95 22ms로 통과지만 rAF가 33ms 계단에 걸린다. 16.7ms를 넘기 때문이다.
  - 24필지 CPU 4배는 여전히 초과다(p95 68.5~74.9ms). R1 대비 107.9~111.9ms에서 약 35% 줄었다.
- **캔버스 밖**(트레이스 3초, 24필지 1배 정지): canvas rAF 1,987ms(렌더 + 고정 틱 루프), rAF 밖 스크립트 516ms(React 개발 모드 포함), Commit 424ms, 유휴 16ms.
  - 인구 176은 rAF 1,275ms, 밖 556ms, Commit 448ms, 유휴 600ms다.
- **화면 내 객체**(1280×800·DPR1·정지): 타일 1,162~1,183개. 객체는 24필지 603개(나무 360·건물 73·성벽 132·주민 27), 인구 176 733개, 새 게임 853개.
- **호출 수**(24필지 1배, 프레임당): `drawImage` 651, `fill` 6,298, `fillRect` 15. 지면 마름모 `fill` 3,042, 도로 지면 1,318, 그림자 1,193.
- **래스터 캐시**(`worldRasterCache`): 24필지는 창당 적중 31,680·미스 0이다. 성벽 조각만 이 캐시를 쓴다. 인구 176·새 게임은 사용 0이다.
- **JS 힙**: 강제 GC 직후 17~21MB, 측정 창 직후 GC 없이 20~64MB.
- **틱 경로 탐색**(`tick-routing.json`, Node V8 샘플링, 3,000틱):
  - 24필지: 틱당 2.13ms, 그중 **76.1%**가 경로 탐색(거의 전부 `src/engine/routing.ts` 아래, `findExistingRoadPath` 자기 시간만 20.7%).
  - 인구 176: 틱당 0.21ms, 26.2%.
  - 엔진 파일은 고치지 않았다.

## 5. D1a에 넘길 제안

1. **지면 청크 캐시의 첫 대상은 도로와 지면 마름모다.**
   - 24필지 1배에서 도로(지면 2.9 + 덧칠 1.9ms)와 지면 마름모 1.6ms, 그림자 0.6ms가 frameWork 12ms의 약 60%다.
   - 호출 수로는 프레임당 `fill` 6,298회 중 약 5,550회가 지면 마름모(3,042)·도로 지면(1,318)·그림자(1,193)다. 정적 층 캐시가 가장 크게 줄일 수 있는 부분이다.
   - 비교 기준은 `baseline/`의 24필지 1배 정지·드래그와 CPU 4배 두 칸이다. 드래그 칸이 캐시 무효화 비용을 드러낸다.
2. **패턴 채우기는 경로 `fill()`만 쓴다.**
   - 청크 캐시나 곡선 도로 리본을 만들면서 `clip()` + 패턴 `fillRect`를 다시 쓰지 않는다. 쓰면 P-F1이 돌아온다.
   - `tests/terrainPatterns.test.ts`가 도로에 대해서만 이를 고정한다. 새 패턴 채우기에도 같은 검사를 붙이는 것을 권한다.
3. **D1a 전후 비교는 GPU 모드 rAF와 Commit까지 본다.**
   - frameWork만 보면 P-F1 같은 GPU 대기가 보이지 않는다(수정 전 인구 176은 frameWork 5.8ms, rAF 150ms).
   - `renderCommitProbe.mjs`의 headless·GPU 4장면을 전후에 한 번씩 돌린다.
4. **곡선 도로 리본은 CPU 4배에서 확인한다.** 도로 지면이 이미 가장 비싼 단계다(12.8ms). 이동평균·Chaikin 점 수 증가가 여기에 바로 얹힌다.

## 6. 다음 후보 (관문 밖, 수정하지 않음)

- **새 게임 온보딩 오버레이가 프레임당 14.4ms**(`overlay.onboarding`, frameWork의 72%)다.
  - `onboardingWorldGuidanceTargets(state)`(`src/ui/onboardingWorldGuidance.ts:77`)에 캐시가 없어, 매 프레임 안내 대상을 다시 계산한다. R1 CPU 프로파일에서는 그 안의 도로 연결 요소 계산(`existingRoadComponent`)이 보였다.
  - 새 게임이 30fps 계단에 걸리는 유일한 원인이다. 상태가 바뀔 때만 다시 계산하면 된다. 다만 `src/ui` 모듈이라 이번 범위(렌더·스크립트·테스트)에서는 건드리지 않았다.
- **틱 경로 탐색 76%**: pathCache 적중률 계측(엔진 쪽)이 필요하다. 엔진 파일 수정이 필요하므로 R1-fix 이후로 미룬다.
- **실제 저사양 기기**(Iris Xe급) 측정: 로드맵 B11 항목이지만 이 기기에서는 할 수 없다. 같은 스크립트를 그 기기에서 돌리면 된다.
- DPR 1.5, 메모리 중기 측정: 로드맵 항목이지만 지시서 관문 밖이다.

## 7. 재현

```sh
npx vite --host 127.0.0.1 --port 4194 --strictPort &
export PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs
node scripts/renderStageBenchmark.mjs --matrix b11 --output docs/verification/b11-render-metrics/baseline
node scripts/renderCommitProbe.mjs --out docs/verification/b11-render-metrics/p-f1-modes.json   # headed 모드는 창이 뜬다
node scripts/renderPixelCompare.mjs capture /tmp/before && node scripts/renderPixelCompare.mjs capture /tmp/after --gpu off
npx tsx scripts/measureTickRouting.ts --ticks 3000 --out docs/verification/b11-render-metrics/tick-routing.json
npx tsx --test tests/renderStageProbe.test.ts tests/terrainPatterns.test.ts
```

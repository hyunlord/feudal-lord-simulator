# Phase 17 — 정식 렌더 성능 검증

- 소스: bd0890a → d08f572. Apple M4 Max / macOS25.4.0 / Chrome153.0.8010.48 headless 기본 설정.
- 동일 인구176 저장도시,1600×1100,zoom1,pan(800,-940),DPR1/2. 조건별40프레임×4회 중 첫 회 제외. CPU profiler·강제 readback 없음.
- 단위 ms. 이 장면·하드웨어의 결과이며 다른 환경의 FPS를 보장하지 않는다. 통합후보에는 성벽 수정도 포함된다. 지형수정 단독 인과관계는 앞선 무생략 진단으로 따로 확인했다.

| DPR/조건 | 중앙값 전→후 | p95 전→후 | 평균 전→후 | 평균 변화 |
|---|---:|---:|---:|---:|
| 1 / paused | 50.0→33.3 | 83.3→50.0 | 49.03→28.61 | -41.6% |
| 1 / running | 50.0→33.3 | 66.7→50.1 | 49.03→32.50 | -33.7% |
| 1 / drag | 50.0→33.4 | 66.7→50.1 | 50.55→37.50 | -25.8% |
| 2 / paused | 83.3→33.4 | 150.0→50.1 | 82.64→36.53 | -55.8% |
| 2 / running | 83.3→50.0 | 83.4→50.1 | 80.14→45.28 | -43.5% |
| 2 / drag | 83.3→50.0 | 83.4→50.1 | 80.97→46.25 | -42.9% |

- 판정: 두DPR 정지 중앙값 개선, 모든 조건 평균 악화10%이하 기준 통과. 브라우저 오류0, 실제 카메라 및 드래그 이동 확인, 소스diff 없음.
- 각batch평균·버전·fixture SHA: `performance-summary.json`. 원본120샘플 및 워밍업40샘플은 무시된 output/phase17/formal에 보존하며 증빙 폴더에 넣지 않는다.
- 테스트: 소스 `d08f572`의 typecheck /1518회귀(Phase9 포함)/build 통과. 그림 검증과 기본 GPU 반복 readback 한계는 visual-validation.md 참조.
- 사용자 결정 필요: 없음. 성능 목표는 통과했지만60FPS를 달성한 것은 아니다.

재현 하네스 `benchmark.mjs`는 추적된 `scripts/phase16Benchmark.mjs`에서 P17 작업명과 평균 기록을 추가한 측정 전용 사본이다. 새 의존성을 추가하지 않았다. 기존 playwright-core 설치와 Chrome이 필요하며 모듈이 자동 해석되지 않으면 `PLAYWRIGHT_MODULE`에 해당 환경의 기존 모듈 진입점 절대 경로를 지정한다. 기준 `bd0890a`와 후보 `d08f572` 체크아웃을 각각 Vite로 실행한 뒤 후보 체크아웃 루트에서 다음을 실행한다. BASELINE_URL/ROOT 및 CANDIDATE_URL/ROOT는 각 실제 서버와 체크아웃이다.

```sh
node docs/verification/phase17/benchmark.mjs --state tests/fixtures/phase16-city.json.gz --task P17 --variant before --dpr 1 --condition paused --url "$BASELINE_URL" --source-root "$BASELINE_ROOT" --output output/phase17/formal
node docs/verification/phase17/benchmark.mjs --state tests/fixtures/phase16-city.json.gz --task P17 --variant after --dpr 1 --condition paused --url "$CANDIDATE_URL" --source-root "$CANDIDATE_ROOT" --output output/phase17/formal
```

DPR1/2와 paused/running/drag를 각각 순차 반복한다. 다른 테스트·브라우저·프로파일러와 겹치지 않는다. 이동은 초당200px이며 rAF 중앙값·p95·평균과3회별 평균을 비교한다. 기준 서버를 이미 갱신된 개발판으로 지정하지 않는다.

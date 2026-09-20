# Phase 18 — 측정 재현

제품 루트에서 실행한다. 원본 `tests/fixtures/phase16-city.json.gz`가 필요하다. 두 하네스는 Node ESM이며 기존 playwright-core 설치를 사용한다. 기본 모듈 해결이 안 되는 환경은 `PLAYWRIGHT_MODULE=/absolute/path/to/existing/playwright-core/index.mjs` 또는 `--playwright <path>`로 지정한다. 새 의존성 설치나 브라우저 플래그는 추가하지 않았다.

```sh
node docs/verification/phase18/formal-benchmark.mjs --task P18 --variant before --dpr 1 --condition paused --url "$BASELINE_URL" --source-root "$BASELINE_ROOT" --state tests/fixtures/phase16-city.json.gz --output output/phase18/reproduce
node docs/verification/phase18/formal-benchmark.mjs --task P18 --variant after --dpr 1 --condition paused --url "$CANDIDATE_URL" --source-root "$CANDIDATE_ROOT" --state tests/fixtures/phase16-city.json.gz --output output/phase18/reproduce
```

위 전후쌍을 DPR1/2 및paused/running/drag 각각 실행한다. 동일 저장도시와 카메라를 검증하고, drag는 실제200CSSpx/s 이동을 확인한다. 각 조건40×4,첫회제외; median,p95,mean 및 batch원자료를 기록한다. 하네스는 committed `scripts/phase16Benchmark.mjs` 재사용본이며 P18 task 허용과 mean 산출만 추가했다. 실행 중 CPU집약 작업을 중지한다.

```sh
node docs/verification/phase18/model-benchmark.mjs --url "$BASELINE_URL" --source-root "$BASELINE_ROOT" --state tests/fixtures/phase16-city.json.gz --output output/phase18/reproduce/model-before.json
node docs/verification/phase18/model-benchmark.mjs --url "$CANDIDATE_URL" --source-root "$CANDIDATE_ROOT" --state tests/fixtures/phase16-city.json.gz --output output/phase18/reproduce/model-after.json
```

모델검사는 별도 Chrome에서100호출×4회(첫회제외) 실행하며 실제 함수 진입에 카운터만 추가한다. 같은canonical도시의 era를hamlet/palisade/stone_town으로 바꾼 제어실험으로, 자연발전 플레이 결과가 아니다. 촌락 양성대조100회 및 후기시대0회를 확인한다. 호출당 시간에는 카운터 증가 비용이 포함되므로 frame시간과 혼동하지 않는다.

BASELINE_URL/ROOT는 e05b46c 체크아웃의 실제 서버·경로, CANDIDATE_URL/ROOT는401e9d4 체크아웃의 서버·경로로 지정한다. 이미 갱신된 개발판을 기준 버전으로 사용하지 않는다.

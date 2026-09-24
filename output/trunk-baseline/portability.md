# S0 테스트·스크립트 이식성 구현 기록

## 변경 파일(이 작업자 소유)

- `tests/autoplayConstructionLogistics.test.ts`: 사용자 홈의 `free-city-stage0-v2` 상태 두 개를 `tests/fixtures/autoplay/`로 이동. `pathCache`만 `{}`로 비우고 나머지 게임 상태·관측·주민·운송·공사를 보존, compact JSON+gzip. 기존 28→14 운반 비용 및 추천 도로/식량 우선순위 assertions 그대로.
- `tests/autoplayServices.test.ts`: `output/playtest-a-double-prime/.../seed3/final-state.json`을 `tests/fixtures/autoplay/church-gap-seed3.json.gz`로 이동. 기존 교회 자리 보전/도로 좌표 assertions 그대로.
- `tests/fixtures/autoplay/{construction-endpoint-seed3,construction-pre-proclaim-seed3,church-gap-seed3}.json.gz`와 `manifest.json`: 원본 경로, 원본 실행 커밋, 기존 테스트 커밋, 원본/압축/해제 SHA-256, 크기, 변환 기록. 총 gzip 105,225바이트. endpoint/pre-proclaim의 원본 커밋은 `0c91b47be613069c42e5522bca2fd42ea4e80cb1`(summary.json·history.mjs·baseline-manifest 확인), church gap은 `689bda7` 전체 해시.
- `tests/animatedMill.test.ts`, `tests/historicalFacilityAssets.test.ts`, `tests/historicalHouseAssets.test.ts`: 고해상도 원본은 있을 때 해시/치수 검사, 없으면 파일명과 이유를 내는 `node:test` skip. 좌표·crop·hub 판정은 원본 유무와 무관하게 계속 실행.
- `tests/runtimeAssetCoordinates.test.ts`: 런타임 PNG SHA/치수 검사는 무조건 실행. 원본 검사는 별도 subtest로 있어야만 실행. 선택 검사 대상 모두 `runtimeAssetDerivatives`에 등록되어 mandatory runtime 검사를 받음(누락 0 확인).
- `scripts/installAcceptedArt.mjs`: 사용자 홈 sharp 절대경로와 형제 저장소 기본 source 경로 제거. source는 첫 인자 또는 `ACCEPTED_ART_SOURCE_ROOT`, sharp는 `SHARP_MODULE_PATH` 또는 일반 `require('sharp')`. 누락 시 명확한 오류, 새 의존성 없음.
- `tests/installAcceptedArt.test.ts`: source 미지정·optional sharp 미설치의 오류 계약 2개. 설치를 실행하거나 실제 에셋을 수정하지 않음.

## 검증

- 수정 전 기존 관련 28/28 통과: `/tmp/s0-portability-before.log`.
- 축소 fixture의 기존 기대값 21/21 통과: `/tmp/s0-fixture-tests.log`.
- 수정 후 관련 143/143 통과, skip 0: `/tmp/s0-portability-after.log` (약 2초).
- 원본 아카이브가 없는 별도 임시 디렉터리: 120개 중 pass 23, 원본 subtest skip 97, fail 0. 모든 skip에 경로·이유. `/tmp/s0-no-art-originals.log`. 이 검사는 로컬 node_modules/public 연결로 optional 아카이브 계약만 확인한 것이며, 관문인 새 클론 검사를 대체하지 않음.
- 같은 임시 디렉터리에서 public 연결까지 제거하면 mandatory runtime hash 검사 ENOENT로 실패(exit 1). `/tmp/s0-missing-runtime.log`. 런타임 누락을 원본 skip로 감추지 않음.
- `node --check scripts/installAcceptedArt.mjs` 및 소유 변경 파일 `git diff --check` 통과.
- 전체 회귀/typecheck/build/새 클론 관문은 루트 에이전트 최종 커밋 검증 소유.

## 전수 경로 감사

`git grep -n '/Users/' -- tests scripts src` 초기 2건 → 수정 후 0건. 초기 원문 `/tmp/s0-absolute-path-audit.txt`.

`git grep -n 'output/' -- tests scripts src` 초기 원문 `/tmp/s0-output-path-audit.txt`. 모든 발견 분류:

| 위치 | 의미 / 처리 |
|---|---|
| tests/autoplayConstructionLogistics.test.ts | 외부 입력. fixture로 교체 |
| tests/autoplayServices.test.ts | output 입력. fixture로 교체 |
| scripts/verifySaveDeterminism.ts | output 기본 입력. 루트 에이전트에 전달, 루트가 fixtures로 변경 |
| scripts/a4SnapshotCapture.mjs:14,162,228 | Usage·새 캡처/복원 **출력** 기본 경로. 기존 output 읽기 의존 아님, 유지 |
| scripts/phase16Benchmark.mjs:20 | 벤치마크 출력 기본 경로. 유지 |
| scripts/phase16CacheParity.mjs:7 | 패리티 결과 출력 경로. 유지 |
| scripts/phase16SpriteStudy.mjs:5 | 검사판 출력 경로. 유지 |
| scripts/phase17TerrainParity.mjs:7 | 패리티 결과 출력 경로. 유지 |
| scripts/buildSaveFixtures.ts 주석 | 입력 fixture를 쓰는 이유 설명. 실행 의존 아님 |
| src/render/runtimeActorManifest.generated.ts:1 | 과거 등록 도구 provenance 주석. 실행 의존 아님 |
| tests/fixtures/phase16-city.provenance.json:3 | 원래 출처 기록. 실행 의존 아님 |
| tests/fixtures/wall/README.md:3,4 | 자연 플레이 원래 출처. 실행 의존 아님 |
| tests/saveFixtures.test.ts | output 의존 금지 assertion 문자열. 실행 의존 아님 |
| 새 tests/fixtures/autoplay/manifest.json | 원래 출처 기록. 실행 의존 아님 |

추가 감사: `installAcceptedArt`의 `../feudal-lord-simulator/output`은 명시 source 인자/환경변수로 교체. 다른 `/tmp/`들은 테스트가 직접 만드는 임시 파일, CLI 인자 계약 fixture, 검증 결과 출력 디렉터리이며 외부 저장 상태 입력이 아님. ComfyUI 스크립트 `output`은 환경변수로 지정하는 선택적 아트 도구 출력/입력 계약이며 npm test에 필요하지 않음. `src/` 실행 코드에 외부 사용자 경로 없음.

## 범위와 한계

게임 규칙·밸런스·UI·경제 수치·새 의존성 변경 없음. 저장 관련 파일과 package.json은 수정하지 않았음. 새로운 fixture는 완전한 자연 상태에서 파생 캐시만 뺀 축소본으로, 합성 상태나 저장 마이그레이션 결과라고 부르지 않음. 기존 고해상도 원본 파일은 삭제하지 않았고, 새 클론에는 현재 추적된 원본이 있으므로 해당 검사는 skip 없이 수행됨.

# 측정 재현

원본 저장소는 경량 ZIP에 넣지 않았다. 실제 사용한 SHA와 fixtures hash는 evidence/BENCH_RESULT.md 및 raw JSON에 있다. 재현은 동일한 저장소 커밋과 Git LFS 실파일, 기존 package-lock 의존성이 필요하다. 코드/데이터가 다르면 같은 측정이라고 비교하지 않는다.

이 ZIP의 scripts/engine-bench.ts를 원본 전용 복제본의 mobile-study/scripts/engine-bench.ts에 놓는다. 기존 출력은 덮어쓰지 않으며 새 출력 이름을 사용한다. 저장소 루트에서 실행한다.

```sh
npm ci --ignore-scripts --no-audit --no-fund
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable --jsx react-jsx --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --types node,vite/client mobile-study/scripts/engine-bench.ts
node --input-type=module -e 'import { spawnSync } from "node:child_process"; const r = spawnSync("./node_modules/.bin/tsx", ["mobile-study/scripts/engine-bench.ts", "mobile-study/records/engine-bench-new.json"], { encoding: "utf8", timeout: 35000, killSignal: "SIGKILL" }); console.log(JSON.stringify({ status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr })); process.exitCode = r.status ?? 1;'
```

35초 watchdog, 내부30초 협력적 점검. 사례당20예열+200측정 최대, 둘을 순차 실행한다. 출력이 있더라도 status/샘플/중단 상태를 확인한다. 원본 파일 수정 없이 API를 import한다. DGX 사용은 이 의뢰에서 금지되어 있다.

아카이브 확인은 추출 디렉터리에서 `shasum -a 256 -c SHA256SUMS`.

시제품 실행법은 R04에 포함할 예정이다. 이 벤치마크는 게임 플레이 UI가 아니다.

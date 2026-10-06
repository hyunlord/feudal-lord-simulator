# Bounded engine screening result

관문: 로컬 소규모 실행·저장 왕복 통과 / 모바일 성능 미판정. Mac only, no DGX, no source changes, no commits. One benchmark execution, no reruns.

Raw evidence: `mobile-study/records/engine-bench.json`, timestamp `2026-10-06T04:45:47.194Z`. HEAD `eeccc92a6c3c67b82859d325492b8166f1e6a3be`, Apple M4 Max, macOS Darwin 25.4.0 arm64, Node v25.8.2, 14 logical CPUs, 36 GiB physical RAM. Leader confirmed complete LFS checkout and installed existing lockfile dependencies before execution.

| Case / phase | Timed ticks | Mean ms | p50 ms | p95 ms | Max ms |
|---|---:|---:|---:|---:|---:|
| Opening lord / regular | 100 | 1.771 | 0.091 | 0.345 | **164.020** |
| Opening lord / repeated-tick catchup | 100 | 1.353 | 0.103 | 0.317 | **120.887** |
| Mature campaign / regular | 100 | 1.234 | 1.160 | 1.689 | 2.591 |
| Mature campaign / repeated-tick catchup | 100 | 1.073 | 1.026 | 1.309 | 1.821 |

Each case completed 20 warmups + 200 measured full `advanceTick` calls. 440 total calls, 400 finite measured samples, no abandoned/nonprogressing stop. Internal elapsed before writing output: 1187.730ms; dynamic engine imports: 472.458ms (excludes Node/tsx process bootstrap). Opening initialization: 2.837ms; fixture read/gunzip/migrate/validate: 32.835ms. External watchdog result: status 0, signal null, stderr empty.

**Low p95 does not erase the opening spikes.** They warrant a later profile on target hardware; this benchmark does not establish their causal subsystem. The opening had two weekly agency opportunities and two receipts; annual estates, seasonal suits and diplomacy were unexercised. The mature fixture had neither agency nor diplomacy; it is a logistics/population workload, not a mature Lord Mode proof. No additional profile or long run was attempted.

Opening: seed1, 64×64, tick0→220, population12→16, 9 buildings, 4 houses, walkers0→5, one construction site at end, 21 people at end. Mature: fixture seed2, campaign scenario, tick320000→320220, population768, 87 buildings, 24 houses, walkers51→43, 775 people. Original fixture migrated from schema30; saved schema49. Fixture SHA256: `4b3fb4ef1aa1be2e381e4fe572bab295cf8adb9c6fd42002fc19b6e94ad742ff`.

| Save roundtrip | Bytes | Encode ms | Decode ms | Deep state equal |
|---|---:|---:|---:|---|
| Opening | 360431 | 3.437 | 1.994 | true |
| Mature | 4895144 | 19.005 | 20.155 | true |

Process RSS after ticks: opening 322207744 bytes, mature 341540864 bytes; after mature save 367509504 bytes. These are same-process observations containing imports/caches/previous-case allocation, without forced GC; they are not isolated engine or mobile memory requirements. Catchup100 wall time was 135.388ms opening / 107.413ms mature, with exact100 progression each; no production background-resume policy is implied.

## Commands and checks

Strict supplemental typecheck (exit0; repo tsconfig excludes mobile-study):

```
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable --jsx react-jsx --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --types node,vite/client mobile-study/scripts/engine-bench.ts
```

Actual benchmark with 35-second external child watchdog:

```
node --input-type=module -e 'import { spawnSync } from "node:child_process"; const r = spawnSync("./node_modules/.bin/tsx", ["mobile-study/scripts/engine-bench.ts", "mobile-study/records/engine-bench.json"], { encoding: "utf8", timeout: 35000, killSignal: "SIGKILL" }); console.log(JSON.stringify({ status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr })); process.exitCode = r.status ?? 1;'
```

Internal30s deadline checks are cooperative between synchronous operations; external35s watchdog targeted the tsx child. Neither deadline triggered. Output is written only after all assertions pass, with exclusive create. Verification of recorded JSON asserted two cases,20 warmups each,200 raw samples each,220 tick delta each, catchup count equal tick delta, finite samples, stopped=null, both save roundtrip flags true; exit0, printed `PASS: two cases, 440 total full ticks, 400 finite timed samples, both save roundtrips, no stop`.

Remaining limits: one desktop Node run, tiny samples, sequential shared caches, no mobile hardware/browser/WebView/frame/input/battery/thermal/background lifecycle testing; no active negotiation/marriage/litigation or annual estate progression. This is engine reuse screening, not mobile release approval.

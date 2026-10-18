# Political petition expiry: rule-preserving extraction

Baseline: `e18c0d248`. Branch: `codex/engine-b-petition-expiry`. No saved fields added. No UI change.

`politicalPetitionExpiryTick(state, petition)` returns the first tick at which the existing calendar petition expires, not the last answerable tick. Petitions outside that existing calendar expiry rule return null. The expiration transition calls the same helper.

Verification runs on DGX through one official FAIR-LINE experiment. `paired.sh` first runs the boundary tests and typecheck, then eight lanes: sandbox seeds 1–5 using the standard `efficientGrowthRun.ts 24 1200000` termination, and lord seeds 1–3 using `lordSliceRun.ts seed 30 through` (120000 ticks). Each lane runs baseline then changed, with the identical dependencies. Full-state hashes include every field. Original simulation exit codes and sandbox acceptance are retained separately from hash equality.

PASS: official run exit 0; boundary/purity tests 4/4 (0 skipped), typecheck exit 0, and all eight baseline/changed full-state hashes identical. Command elapsed 2011.8 seconds (prepare 7.5 seconds; slot wait 2.0 seconds). Sandbox simulation acceptance is also true for all five seeds on both sides; all ten sandbox runs stopped at `target-scale-stable` with exit 0. All six lord runs reached 120000 ticks / year 1330 with exit 0.

## 렌더 A / 엔진 인계 계약

- 읽기: `politicalPetitionExpiryTick(state, petition): number | null` (`src/engine/politics.ts`). `scenarioId`와 청원의 `defId`만 읽는다.
- 반환값은 **만료되는 첫 틱**이다. 마지막으로 답할 수 있는 틱으로 표시하지 않는다. 예: 기본 시나리오의 `market_charter`는 36000에서 만료하며 35999에서는 열린 상태다.
- 기존 달력형 청원만 대상이다. 순서형 청원, 알 수 없는 정의, 정치 이벤트가 비활성인 시나리오는 `null`이다. 응답 여부와 무관하게 정의의 경계를 반환하므로 화면은 열린 청원에 적용한다.
- 기존 50틱 처리 주기를 보존한다. 저장 필드, 청원 생성/응답 규칙, 화면 코드는 바꾸지 않는다.
- 원칙: 하나의 엔진 계산으로 기한과 만료 처리가 같은 사실을 읽게 한다(A4·A5). 이 가지는 엔진 검토용이며 본선 병합은 엔진 담당이다.

실행: `engineB-petition-expiry-94e3fbc`, 소스 `94e3fbce695b4abceb9f45112d5d634c4f173dc4`. DGX에서 경계·순수성 시험 4/4와 타입 검사가 통과했다. 실행 종료 후 전체 8쌍 해시 일치를 확인했다.

추가 정적 검사: 변경한 `src/engine/politics.ts`, `tests/politicalPetitionExpiry.test.ts`의 ESLint 통과(exit 0). 기존 잠금 의존성을 사용했으며 의존성 파일은 변경하지 않았다. 명령: `tools/eslint/node_modules/.bin/eslint -c tools/eslint/eslint.config.mjs --suppressions-location tools/eslint/eslint-suppressions.json --pass-on-unpruned-suppressions --no-warn-ignored --max-warnings 0 src/engine/politics.ts tests/politicalPetitionExpiry.test.ts`.

## Terminal comparison

| Mode | Seed | Baseline = changed tick | Full-state SHA-256 (both sides) |
|---|---:|---:|---|
| sandbox | 1 | 372667 | `4acbfbf73150c374662e4c0ad98c526652ae04ddc2402d48118b50aeb8f122b2` |
| sandbox | 2 | 281575 | `3d768a2009ecf6b6f6bc6c9ff9eb3d1ba7c8e448e1db57df2547439969725f53` |
| sandbox | 3 | 299309 | `33b3d88a225ba3998eb8e0eae348ea30da62b9109dbcc7141a4a3ade4f7a51a7` |
| sandbox | 4 | 281572 | `db0ba1ff69a915f7142a024373889e0406ba5dd2de982fda288d363ecda78980` |
| sandbox | 5 | 333724 | `8c04888603b9163966aa02fa538984c0e3ca898c8f3ef2bb2d9dc3ce6c3d1f57` |
| lord | 1 | 120000 | `6c4feba286c29b0be6752e60dad326a4926b1582d6b9cd5ccace5a15b4d29919` |
| lord | 2 | 120000 | `9267d13816497870142c2670a35606613bb64cd53b1cf5c8ba069c532d6fa402` |
| lord | 3 | 120000 | `d80935f16440bb13ecd7517457d448697ff4f7a7bd124aa7f1978d086f5c4126` |

## Evidence and limits

- `comparison.json`: unmodified official terminal comparison; baseline `e18c0d248e5d370134d1f39a4b9546993d695af4`, measured source `94e3fbce695b4abceb9f45112d5d634c4f173dc4`. Later documentation commits do not change that measured runtime source.
- `raw-evidence.tar.gz`: original boundary/typecheck logs, run log, timings, exit codes, seed summaries, and lord results. Archive paths are relative to the official run's `.remote/` directory. No result fields were removed from included files.
- `provenance.json`: SHA-256 and byte size of every fetched raw artifact (91 files), including the ten large sandbox final-state files omitted from the compact archive. Full states remain locally in `.remote-runs/engineB-petition-expiry-94e3fbc/` and on DGX at the recorded run/kept paths. `remote-meta.env` preserves the launch identity and confirms the kept copy exists.
- Verification independently rehashed all ten sandbox states and checked all six lord result hashes against the official comparison. `SHA256SUMS` covers the committed evidence and this contract. The archive is approximately 133 KiB.
- This is the requested targeted boundary and rule-preservation verification, not a claim that all repository tests, merge checks, or 125-year cohorts ran. No screen code or rendering validation is part of this change. Broader mainline integration gates remain the engine owner's responsibility; this branch is not merged to main.

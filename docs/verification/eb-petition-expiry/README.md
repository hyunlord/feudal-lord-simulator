# Political petition expiry: rule-preserving extraction

Baseline: `e18c0d248`. Branch: `codex/engine-b-petition-expiry`. No saved fields added. No UI change.

`politicalPetitionExpiryTick(state, petition)` returns the first tick at which the existing calendar petition expires, not the last answerable tick. Petitions outside that existing calendar expiry rule return null. The expiration transition calls the same helper.

Verification runs on DGX through one official FAIR-LINE experiment. `paired.sh` first runs the boundary tests and typecheck, then eight lanes: sandbox seeds 1–5 using the standard `efficientGrowthRun.ts 24 1200000` termination, and lord seeds 1–3 using `lordSliceRun.ts seed 30 through` (120000 ticks). Each lane runs baseline then changed, with the identical dependencies. Full-state hashes include every field. Original simulation exit codes and sandbox acceptance are retained separately from hash equality.

Pending: terminal boundary/typecheck logs and eight baseline/changed state-hash pairs. A source-level proof is not a substitute for these runs. No PASS claimed before terminal evidence.

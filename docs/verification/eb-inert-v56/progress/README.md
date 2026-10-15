# v56 publication status

2026-10-14 11:32 UTC: `engineB-V56-inert-d4c9249` is still running on DGX.
Seed 1 and 2 completed original and replay verification (210 and 222 classified heavy answers). Seed 3 replay reached 260000/500000 ticks. The final pooled gate has not been produced; this is not a PASS verdict.

Reviewed source pins and the four-test adjudication are published on `codex/engine-b-v56-pins`, including commit `738a1c6f932bc221ee22cdffd89bb0aec5fc0a30` and `docs/requests/engine-B-v56-four-tests.md`.

`publish-when-finished.sh` waits for the official terminal artifact, fetches the run, and invokes `archive.mjs` to verify provenance and recompute the gate before publishing the results and `docs/requests/engine-B-v56-result.md` on this branch. Missing or inconsistent evidence stops publication. No trunk push or new simulation is performed. The separate four-test watcher remains in the original validation checkout.

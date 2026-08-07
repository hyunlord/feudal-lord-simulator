# Task 10 Red/Green Ledger

## Red

- Stale root task-10 evidence files and obsolete child directories were present before cleanup.
- The browser hash manifest included references to files that were not part of the final retained evidence set.

## Green

- Retained browser evidence is limited to six PNG screenshots, `browser-qa-results.json`, `manualQa.json`, and a refreshed `sha256sum.txt`.
- Retained DGX evidence is limited to `summary.md`, `manualQa-dgx-132abf.json`, `dgx-browser-benchmark.json`, `benchmark-assertion.json`, `remote-forced-write-tree.txt`, and `remote-cleanup-verify.txt`.
- Browser QA: PASS with pan hash `882602d7 -> f58ca132 -> 882602d7`, zoom hash `23ef64e7`, responsive hash `840bc9a8`, and zero browser errors.
- DGX benchmark: PASS with averages `4.936`, `4.792`, `4.785`, `4.732`, `4.698` ms, all under the 12 ms threshold and zero over-budget frames.
- DGX tree proof: PASS, `remote-forced-write-tree.txt` equals `e717384c92cea821a5530b3925dfba7f0ea7f129`.
- Regression gates: full `681/681`, typecheck, build, harness, contrast, and assets PASS.
- Review gate: PASS with no critical/high findings.

## Final State

Task-10 evidence is now a compact final bundle for revision `132abf70edd833cd056557c641551fb5c4f85a0e` and tree `e717384c92cea821a5530b3925dfba7f0ea7f129`.

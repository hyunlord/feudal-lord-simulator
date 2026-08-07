# Task 10 Red/Green Ledger

## Red Observations

- Focused renderer tests initially failed around hard-coded water RGB expectations and context logging that did not capture style state.
- The first browser proof draft failed with a `Cannot access 'CdpClient' before initialization` reference error.
- Split middle-button/space pan attempts did not prove deterministic pan-away/pan-back identity; the canvas either did not change or failed to restore exactly.
- DGX Chromium initially failed under sandbox constraints; the benchmark script now launches owned headless Chrome with `--no-sandbox`.
- DGX Node 20 did not expose native `WebSocket`; the script supports `WS_MODULE_PATH` and used the existing DGX `ws` module path.
- Typecheck initially failed because a placement-tool set rejected the renderer-only `"ford"` string; the test now asserts absence through a string set.
- A residue probe found the owned DGX temp dir and Vite process still present after benchmark capture; cleanup was rerun and verified clean.

## Green Evidence

- `green-focused-renderer-tests.log`: `86` tests, `86` pass, `0` fail.
- `green-full-npm-test.log`: `669` tests, `669` pass, `0` fail.
- `green-typecheck.log`: `tsc --noEmit` passed.
- `green-build.log`: production Vite build passed.
- `green-strict-world-assets.log`: strict asset verifier passed.
- `local-pan-pixel-proof.json`: pan-away changed the canvas and pan-back restored hash `c7efd475`.
- `local-browser-benchmark.json`: five local 5x average samples under `12ms`.
- `dgx-browser-benchmark.json`: five DGX 5x average samples under `12ms`, with zero over-budget frames.
- `local-vite.stderr.log` and `dgx-vite.stderr.log`: both zero bytes.
- `residue-scan.log`: local server stopped, no local process match, DGX temp clean.
- `secret-scan.log`: scoped intended-file scan found no credential patterns.

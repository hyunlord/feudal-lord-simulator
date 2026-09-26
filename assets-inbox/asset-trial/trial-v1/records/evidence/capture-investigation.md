# Comparison capture investigation

The camera-coordinate equality assertion failed after the first capture pass. Hypotheses: (1) initial asset/layout readiness changes opening camera timing; (2) pointer at viewport edge continuously pans camera; (3) different asset bounds change world projection. Existing proof snapshots showed identical simulation and zoom. The capture placed the pointer at (0,0), and the runtime advances camera motion every animation frame; edge-pan input is the likely discriminating cause. Re-run the same camera-coordinate assertion with the pointer over the bottom console, away from the viewport edge. Product code is unchanged. Owned temporary process: Vite on 3201, to stop after QA.

Confirmed: with pointer off the edge the exact same assertion passes at all three viewports. Baseline/candidate cottage projections are exactly equal at (863.7037037037037,468), (460.70370370370364,533), and (224.1252723311547,422.73662551440316). All six scenes remain at tick 0. Only the capture harness changed; product code was not edited.

Cleanup: owned Vite process on 3201 stopped after QA. Playwright browser closed in finally. Product git status remains clean and git diff --check passes. Trial artifacts are intentionally retained as deliverables under output/astra-asset-trial.

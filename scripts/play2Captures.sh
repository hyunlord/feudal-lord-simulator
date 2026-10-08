#!/usr/bin/env bash
# PLAY-2 (Astra's second lord-mode play, the screen's part) on the DGX: the lord-mode states (scripts/play2States.ts), then
# the screens in the browser (scripts/play2Captures.mjs) on them and on the kept states of the lmr2, deccard2 and ui5
# sets, this tree beside the base commit (the time cluster's box before and after; scripts/remote/with-base-build.sh).
#   scripts/remote/run.sh render-PLAY2-captures-<sha7> --light -- bash scripts/play2Captures.sh [out] [base-sha] [--only a,b]
set -u
out=${1:-docs/verification/play2}
base_sha=${2:-1c9d0440}
extra=${3:-}${4:+ $4}
states=.remote/play2-states
node_modules/.bin/tsx scripts/play2States.ts "$states" 2>&1 | tee .remote/play2-states.log
mkdir -p "$out" && cp "$states/play2-states.json" "$out/states.json" 2>/dev/null
bash scripts/remote/with-base-build.sh "$base_sha" -- "node_modules/.bin/tsx scripts/play2Captures.mjs '$out' --url \"\$URL\" --base \"\$BASE_URL\" --states '$states' \
  --lord2 '${LMR2_STATES:-$HOME/fls-lmr2-states}' --deccard2 '${DECCARD2_STATES:-$HOME/fls-deccard2-results-states}' --ui5 '${UI5_STATES:-$HOME/fls-ui5-states-v22}' --moments '${WAVE40_MOMENT_STATES:-$HOME/fls-wave40-moment-states}' $extra 2>&1 | tee .remote/play2-captures.log; exit \${PIPESTATUS[0]}"

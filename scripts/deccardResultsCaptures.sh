#!/usr/bin/env bash
# DEC-CARD (result side) on the DGX: the changed tests, the result states (scripts/deccardResultsStates.ts, built into the
# run), then the cards in the browser (scripts/deccardResultsCaptures.mjs) on them and on the house-change states the
# LM-R1 petitions and Wave 40 moments sets already hold.
#   scripts/remote/run.sh render-DECCARD-results-<sha7> --light -- bash scripts/deccardResultsCaptures.sh [out]
set -u
out=${1:-docs/verification/deccard/results}
states=.remote/deccard-results-states
petitions=${LMR1_PETITION_STATES:-$HOME/fls-lmr1-petition-states}
moments=${WAVE40_MOMENT_STATES:-$HOME/fls-wave40-moment-states}
states5=${UI5_STATES:-$HOME/fls-ui5-states-v22}
. scripts/remote/devServers.sh
if [ "${DECCARD_SKIP_TESTS:-0}" != 1 ]; then
  npm run -s test:changed -- --base "${DECCARD_TEST_BASE:-2c37f162}" 2>&1 | tee .remote/deccard-results-tests.log
fi
node_modules/.bin/tsx scripts/deccardResultsStates.ts "$states" 2>&1 | tee .remote/deccard-results-states.log || exit 1
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/results.json" "$out/states.json"
node_modules/.bin/tsx scripts/deccardResultsCaptures.mjs "$out" --url "$url" --results "$states" --petitions "$petitions" --moments "$moments" --states5 "$states5" 2>&1 | tee .remote/deccard-results-captures.log
exit "${PIPESTATUS[0]}"

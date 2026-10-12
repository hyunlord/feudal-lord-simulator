#!/usr/bin/env bash
# GROW-BLOCK (the screen's part) on the DGX: lord mode's era console and its palisade plan in the browser
# (scripts/growPlanCaptures.mjs) on the plan's states ($HOME/fls-growplan-states, scripts/growPlanStates.ts) and lmr2.
#   scripts/remote/run.sh render-GROWPLAN-captures-<sha7> --light -- bash scripts/growPlanCaptures.sh [out]
set -u
out=${1:-docs/verification/growblock}
states=${GROWPLAN_STATES:-$HOME/fls-growplan-states}
. scripts/remote/devServers.sh
mkdir -p "$out" && cp "$states/states.json" "$out/states.json" 2>/dev/null
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
node_modules/.bin/tsx scripts/growPlanCaptures.mjs "$out" --url "$url" --states "$states" --lord2 "${LMR2_STATES:-$HOME/fls-lmr2-states}" 2>&1 | tee .remote/growplan-captures.log
exit "${PIPESTATUS[0]}"

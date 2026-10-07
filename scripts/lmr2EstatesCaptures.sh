#!/usr/bin/env bash
# LM-R2 (estates) on the DGX: the lord screen's 영지 in the browser (scripts/lmr2EstatesCaptures.mjs) from the lord2
# states ($LMR2_STATES, ~/fls-lmr2-states; scripts/lmr2States.ts builds them).
#   FLS_REMOTE_LABEL=render-LMR2-estates scripts/remote/run.sh render-LMR2-estates-<sha7> -- bash scripts/lmr2EstatesCaptures.sh [out]
set -u
out=${1:-docs/verification/lmr2/estates}
states=${LMR2_STATES:-$HOME/fls-lmr2-states}
[ -f "$states/inherited.json" ] || { echo "no lord2 states in $states (scripts/lmr2States.ts)"; exit 1; }
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/lmr2EstatesCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/lmr2-estates-captures.log
exit "${PIPESTATUS[0]}"

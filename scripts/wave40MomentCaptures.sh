#!/usr/bin/env bash
# EVENT-ART (wave40) on the DGX: build the lord-mode moment states (scripts/wave40MomentStates.ts) into $WAVE40_MOMENT_STATES
# (~/fls-wave40-moment-states) when its moments.json is missing, then the moments in the browser (scripts/wave40MomentCaptures.mjs).
#   scripts/remote/run.sh render-EVENTART-wave40-<sha7> -- bash scripts/wave40MomentCaptures.sh [out]
set -u
out=${1:-docs/verification/eventart/wave40}
states=${WAVE40_MOMENT_STATES:-$HOME/fls-wave40-moment-states}
states5=${UI5_STATES:-$HOME/fls-ui5-states-v22}
if [ ! -f "$states/moments.json" ] || [ "${WAVE40_REBUILD_STATES:-0}" = 1 ]; then
  node_modules/.bin/tsx scripts/wave40MomentStates.ts "$states" 2>&1 | tee .remote/wave40-moment-states.log || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/moments.json" "$out/moments.json"
node_modules/.bin/tsx scripts/wave40MomentCaptures.mjs "$out" --url "$url" --states "$states" --states5 "$states5" 2>&1 | tee .remote/wave40-moment-captures.log
exit "${PIPESTATUS[0]}"

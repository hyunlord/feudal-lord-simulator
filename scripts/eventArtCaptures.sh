#!/usr/bin/env bash
# EVENT-ART on the DGX: build the registry offer state (scripts/eventArtStates.ts) into $LORD_STATES (~/fls-lord-states)
# when it is missing, then the registry's event card in the browser (scripts/eventArtCaptures.mjs).
#   scripts/remote/run.sh render-EVENTART-card -- bash scripts/eventArtCaptures.sh [out]
set -u
out=${1:-docs/verification/eventart/card}
states=${LORD_STATES:-$HOME/fls-lord-states}
states5=${UI5_STATES:-$HOME/fls-ui5-states-v22}
if [ ! -f "$states/registry-offer.json" ] || [ "${EVENTART_REBUILD_STATES:-0}" = 1 ]; then
  node_modules/.bin/tsx scripts/eventArtStates.ts "$states" 2>&1 | tee .remote/eventart-states.log || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/moments-eventart.json" "$out/moments-eventart.json"
node_modules/.bin/tsx scripts/eventArtCaptures.mjs "$out" --url "$url" --states "$states" --states5 "$states5" 2>&1 | tee .remote/eventart-captures.log
exit "${PIPESTATUS[0]}"

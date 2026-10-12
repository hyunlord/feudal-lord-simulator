#!/usr/bin/env bash
# MARKET-TOWN on the DGX: the lord's town after the market charter's proclamation in the browser
# (scripts/marketTownCaptures.mjs) on its states ($HOME/fls-market-states, scripts/marketTownStates.ts).
#   scripts/remote/run.sh render-MARKET-captures-<sha7> --light -- bash scripts/marketTownCaptures.sh [out]
set -u
out=${1:-docs/verification/market}
states=${MARKET_STATES:-$HOME/fls-market-states}
. scripts/remote/devServers.sh
mkdir -p "$out" && cp "$states/states.json" "$out/states.json" 2>/dev/null
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
node_modules/.bin/tsx scripts/marketTownCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/market-captures.log
exit "${PIPESTATUS[0]}"

#!/usr/bin/env bash
# SUIT-THREAD (renderer A's "suit-rest" part) on the DGX: the states (scripts/suitRestStates.ts, from the lmr2 set and
# Astra's lordplay2 save), then the screens in the browser (scripts/suitRestCaptures.mjs) on them and on the lmr2 states.
#   scripts/remote/run.sh render-SUIT-rest-captures-<sha7> --light -- bash scripts/suitRestCaptures.sh [out]
set -u
out=${1:-docs/verification/suit/suit-rest}
lord2=${LMR2_STATES:-$HOME/fls-lmr2-states}
states=.remote/suit-rest-states
for file in "$lord2/will-change.json" "$lord2/neighbour-suit.json" "$lord2/attention-overloaded.json"; do
  [ -f "$file" ] || { echo "missing state $file"; exit 1; }
done
node_modules/.bin/tsx scripts/suitRestStates.ts "$states" "$lord2" 2>&1 | tee .remote/suit-rest-states.log
mkdir -p "$out" && cp "$states/suit-rest-states.json" "$out/states.json" 2>/dev/null
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
node_modules/.bin/tsx scripts/suitRestCaptures.mjs "$out" --url "$url" --lord2 "$lord2" --states "$states" 2>&1 | tee .remote/suit-rest-captures.log
exit "${PIPESTATUS[0]}"

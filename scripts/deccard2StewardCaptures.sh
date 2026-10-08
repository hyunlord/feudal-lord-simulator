#!/usr/bin/env bash
# DEC-CARD-2 (steward) on the DGX: the steward's state (scripts/deccard2StewardStates.ts, built into the run), then the
# season card's steward section, the standing-policy screen and the treasury in the browser (scripts/deccard2StewardCaptures.mjs).
#   scripts/remote/run.sh render-DC2-steward-captures-<sha7> --light -- bash scripts/deccard2StewardCaptures.sh [out]
set -u
out=${1:-docs/verification/deccard2/steward}
states=.remote/deccard2-steward-states
. scripts/remote/devServers.sh
node_modules/.bin/tsx scripts/deccard2StewardStates.ts "$states" 2>&1 | tee .remote/deccard2-steward-states.log || exit 1
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/steward.json" "$out/states.json"
node_modules/.bin/tsx scripts/deccard2StewardCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/deccard2-steward-captures.log
exit "${PIPESTATUS[0]}"

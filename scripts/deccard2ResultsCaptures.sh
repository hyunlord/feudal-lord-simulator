#!/usr/bin/env bash
# DEC-CARD-2 (the result thread) on the DGX: the result states (scripts/deccard2ResultsStates.ts, built into the run and
# kept in $HOME/fls-deccard2-results-states for the geometry audit's `deccard2` set), then the screens in the browser
# (scripts/deccard2ResultsCaptures.mjs) on them.
#   scripts/remote/run.sh render-DC2-results-captures-<sha7> --light -- bash scripts/deccard2ResultsCaptures.sh [out]
set -u
out=${1:-docs/verification/deccard2/dc2-results}
states=.remote/deccard2-results-states
keep=${DECCARD2_STATES_KEEP:-$HOME/fls-deccard2-results-states}
. scripts/remote/devServers.sh
node_modules/.bin/tsx scripts/deccard2ResultsStates.ts "$states" 2>&1 | tee .remote/deccard2-results-states.log
[ "${PIPESTATUS[0]}" = 0 ] || exit 1
mkdir -p "$keep" && cp "$states"/*.json "$keep"/
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/deccard2-results-states.json" "$out/states.json"
node_modules/.bin/tsx scripts/deccard2ResultsCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/deccard2-results-captures.log
exit "${PIPESTATUS[0]}"

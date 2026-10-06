#!/usr/bin/env bash
# DEC-CARD A1/A2/A4/A5 on the DGX (Astra's lord-mode play): the played-on states (scripts/deccardAstraStates.ts) into
# $DECCARD_ASTRA_STATES (~/fls-deccard-astra-states) when they are missing (or DECCARD_ASTRA_REBUILD=1), then the
# captures (scripts/deccardAstraCaptures.ts) into [out].
#   scripts/remote/run.sh render-DECCARD-astra-<sha7> --light -- bash scripts/deccardAstraCaptures.sh [out]
set -u
out=${1:-docs/verification/deccard/astra}
states=${DECCARD_ASTRA_STATES:-$HOME/fls-deccard-astra-states}
if [ ! -f "$states/deccard-astra-states.json" ] || [ "${DECCARD_ASTRA_REBUILD:-0}" = 1 ]; then
  node_modules/.bin/tsx scripts/deccardAstraStates.ts "$states" "${DECCARD_ASTRA_LAST_YEAR:-1322}" 2>&1 | tee .remote/deccard-astra-states.log || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/deccard-astra-states.json" "$out/deccard-astra-states.json"
node_modules/.bin/tsx scripts/deccardAstraCaptures.ts "$out" --url "$url" --states "$states" 2>&1 | tee .remote/deccard-astra-captures.log
exit "${PIPESTATUS[0]}"

#!/usr/bin/env bash
# LM-R3 phase 2a (the lord slice's opening page and its end) on the DGX: the browser captures (scripts/sliceEndsCaptures.mjs)
# on the slice's end states (scripts/sliceEndsStates.ts, kept in $HOME/fls-slice-end-states for the geometry audit's
# `slice` set; built here only when missing).
#   scripts/remote/run.sh render-LMR3-slice-captures-<sha7> --light -- bash scripts/sliceEndsCaptures.sh [out]
set -u
out=${1:-docs/verification/lmr3/slice}
states=${SLICE_STATES:-$HOME/fls-slice-end-states}
. scripts/remote/devServers.sh
if [ ! -f "$states/slice-end.json" ] || [ ! -f "$states/slice-eve.json" ]; then
  node_modules/.bin/tsx scripts/sliceEndsStates.ts "$states" 2>&1 | tee .remote/slice-end-states.log
  [ "${PIPESTATUS[0]}" = 0 ] || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/slice-states.json" "$out/states.json"
node_modules/.bin/tsx scripts/sliceEndsCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/slice-captures.log
exit "${PIPESTATUS[0]}"

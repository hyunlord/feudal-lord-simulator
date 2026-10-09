#!/usr/bin/env bash
# LM-R3 (lord slice LS-2) on the DGX: the lord-mode auto-pause's browser captures (scripts/autoPauseCaptures.mjs) on the
# states of scripts/autoPauseStates.ts (kept in $HOME/fls-slice-end-states for the geometry audit's `slice` set; built
# here only when missing).
#   scripts/remote/run.sh render-PAUSE-captures-<sha7> --light -- bash scripts/autoPauseCaptures.sh [out]
set -u
out=${1:-docs/verification/pause}
states=${SLICE_STATES:-$HOME/fls-slice-end-states}
. scripts/remote/devServers.sh
if [ ! -f "$states/pause-due.json" ] || [ ! -f "$states/pause-due-suit.json" ]; then
  node_modules/.bin/tsx scripts/autoPauseStates.ts "$states" 2>&1 | tee .remote/auto-pause-states.log
  [ "${PIPESTATUS[0]}" = 0 ] || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/autoPauseCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/auto-pause-captures.log
exit "${PIPESTATUS[0]}"

#!/usr/bin/env bash
# LM-R2 (region) on the DGX: the lord screen's region map in the browser (scripts/lmr2RegionCaptures.mjs) on the lord2
# states (scripts/lmr2States.ts, $LMR2_STATES or ~/fls-lmr2-states; built by the lead, not here).
#   scripts/remote/run.sh render-LMR2-region-<sha7> -- bash scripts/lmr2RegionCaptures.sh [out]
set -u
out=${1:-docs/verification/lmr2/region}
states=${LMR2_STATES:-$HOME/fls-lmr2-states}
for name in inherited attention-overloaded offer-countered neighbour-suit; do
  [ -f "$states/$name.json" ] || { echo "missing $states/$name.json (scripts/lmr2States.ts)"; exit 1; }
done
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/lmr2RegionCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/lmr2-region-captures.log
exit "${PIPESTATUS[0]}"

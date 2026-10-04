#!/usr/bin/env bash
# LM-R1 hud captures on the DGX (scripts/lmr1HudCaptures.ts): the playtest's six blockers in real states, lord mode's
# command pins at 1280 and tablet, the sandbox's drawer unchanged.
#   scripts/remote/run.sh render-LMR1-hud-<sha7> -- bash scripts/lmr1HudCaptures.sh [out]
set -u
out=${1:-docs/verification/lmr1/hud}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite.log 2>&1 &
vite=$!
trap 'kill $vite 2>/dev/null' EXIT
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
node_modules/.bin/tsx scripts/lmr1HudCaptures.ts "$out" --url "$url" --states6 "${UI6_STATES:-$HOME/fls-ui6-states}" 2>&1 | tee .remote/lmr1-hud-captures.log
exit "${PIPESTATUS[0]}"

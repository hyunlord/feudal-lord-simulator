#!/usr/bin/env bash
# NAT-4 story on the DGX (scripts/nat4PauseHolds.mjs): a paused game stays paused through every surface, a chapter's
# page does not open again after a save and a load, the paused pill's food days are the state's own.
#   scripts/remote/run.sh render-NAT4-story-<sha7> -- bash scripts/nat4PauseHolds.sh [out]
set -u
out=${1:-docs/verification/nat4/story}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite.log 2>&1 &
vite=$!
trap 'kill $vite 2>/dev/null' EXIT
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
node_modules/.bin/tsx scripts/nat4PauseHolds.mjs "$out" --url "$url" \
  --states5 "${UI5_STATES:-$HOME/fls-ui5-states-v22}" --states6 "${UI6_STATES:-$HOME/fls-ui6-states}" --states10 "${UI10_STATES:-$HOME/fls-ui10-states}" 2>&1 | tee .remote/nat4-pause-holds.log
exit "${PIPESTATUS[0]}"

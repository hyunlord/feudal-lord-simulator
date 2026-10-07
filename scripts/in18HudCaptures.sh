#!/usr/bin/env bash
# INSTALL-18 (Wave 18 HUD) on the DGX: the capture states (scripts/in18HudStates.ts, from the save fixtures) into
# .remote/in18-hud-states, then the HUD captures in the browser (scripts/in18HudCaptures.mjs) into the evidence folder.
#   scripts/remote/run.sh render-IN18-hud-captures-<sha7> --light -- bash scripts/in18HudCaptures.sh [out]
set -u
out=${1:-docs/verification/in18/hud}
states=.remote/in18-hud-states
node_modules/.bin/tsx scripts/in18HudStates.ts "$states" > .remote/in18-hud-states.log 2>&1 || { cat .remote/in18-hud-states.log; exit 1; }
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/scenes.json" "$out/scenes.json"
node scripts/in18HudCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/in18-hud-captures.log
exit "${PIPESTATUS[0]}"

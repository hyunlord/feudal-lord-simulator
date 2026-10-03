#!/usr/bin/env bash
# LM-R1 (petitions) on the DGX: build the lord-mode states (scripts/lmr1PetitionStates.ts) into $LMR1_PETITION_STATES
# (~/fls-lmr1-petition-states) when its moments.json is missing, then the lord's cards in the browser
# (scripts/lmr1PetitionCaptures.mjs).
#   scripts/remote/run.sh render-LMR1-petitions-<sha7> -- bash scripts/lmr1PetitionCaptures.sh [out]
set -u
out=${1:-docs/verification/lmr1/petitions}
states=${LMR1_PETITION_STATES:-$HOME/fls-lmr1-petition-states}
states5=${UI5_STATES:-$HOME/fls-ui5-states-v22}
if [ ! -f "$states/moments.json" ] || [ "${LMR1_REBUILD_STATES:-0}" = 1 ]; then
  node_modules/.bin/tsx scripts/lmr1PetitionStates.ts "$states" 2>&1 | tee .remote/lmr1-petition-states.log || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite.log 2>&1 &
vite=$!
trap 'kill $vite 2>/dev/null' EXIT
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/moments.json" "$out/moments.json"
node_modules/.bin/tsx scripts/lmr1PetitionCaptures.mjs "$out" --url "$url" --states "$states" --states5 "$states5" 2>&1 | tee .remote/lmr1-petition-captures.log
exit "${PIPESTATUS[0]}"

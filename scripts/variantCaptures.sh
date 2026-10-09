#!/usr/bin/env bash
# ER-13 wording variants on the DGX: the variant cards' states (scripts/variantStates.ts, built into the run and kept in
# $HOME/fls-variant-states for the geometry audit's `variants` set), then the cards in the browser
# (scripts/variantCaptures.mjs) on them.
#   scripts/remote/run.sh render-VARIANTS-captures-<sha7> --light -- bash scripts/variantCaptures.sh [out]
set -u
out=${1:-docs/verification/variants}
states=.remote/variant-states
keep=${VARIANT_STATES_KEEP:-$HOME/fls-variant-states}
. scripts/remote/devServers.sh
node_modules/.bin/tsx scripts/variantStates.ts "$states" 2>&1 | tee .remote/variant-states.log
[ "${PIPESTATUS[0]}" = 0 ] || exit 1
mkdir -p "$keep" "$out" && cp "$states"/*.json "$keep"/ && cp "$states/states.json" "$out/states.json"
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
node_modules/.bin/tsx scripts/variantCaptures.mjs "$out" --url "$url" --states "$states" 2>&1 | tee .remote/variant-captures.log
exit "${PIPESTATUS[0]}"

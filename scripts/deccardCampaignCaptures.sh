#!/usr/bin/env bash
# DEC-CARD (campaign) on the DGX: the famine and one political petition per chapter in the heavy decision card, on the
# campaign states the geometry audit uses (scripts/deccardCampaignCaptures.mjs).
#   scripts/remote/run.sh render-DECCARD-campaign-<sha7> --light -- bash scripts/deccardCampaignCaptures.sh [out]
set -u
out=${1:-docs/verification/deccard/campaign}
states5=${UI5_STATES:-$HOME/fls-ui5-states-v22}; states6=${UI6_STATES:-$HOME/fls-ui6-states}; states8=${UI8_STATES:-$HOME/fls-ui8-states}
states9=${UI9_STATES:-$HOME/fls-ui9-states}; states10=${UI10_STATES:-$HOME/fls-ui10-states}; extra=$states10/extra
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/deccardCampaignCaptures.mjs "$out" --url "$url" --states5 "$states5" --states6 "$states6" --states8 "$states8" \
  --states9 "$states9" --states10 "$states10" --extra "$extra" 2>&1 | tee .remote/deccard-campaign-captures.log
exit "${PIPESTATUS[0]}"

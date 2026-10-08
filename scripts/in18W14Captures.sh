#!/usr/bin/env bash
# INSTALL-18 (Wave 14 leftovers) on the DGX: the chronicle's faction tab and pages with Wave 14's faction panel and kind
# icons, on the chapter 4 campaign state ($CAMPAIGN_STATE, ~/fls-ui9-states/rumour-chased.json: the nine factions) and a
# lord-mode state ($LORD_STATE, ~/fls-lord-states/registry-offer.json), in the browser (scripts/in18W14Captures.ts).
#   scripts/remote/run.sh render-IN18-in18w14-captures-<sha7> --light -- bash scripts/in18W14Captures.sh [out]
set -u
out=${1:-docs/verification/in18/w14}
campaign=${CAMPAIGN_STATE:-$HOME/fls-ui9-states/rumour-chased.json}
lord=${LORD_STATE:-$HOME/fls-lord-states/registry-offer.json}
for file in "$campaign" "$lord"; do [ -f "$file" ] || { echo "missing state $file"; exit 1; }; done
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/in18W14Captures.ts "$out" --url "$url" --campaign "$campaign" --lord "$lord" 2>&1 | tee .remote/in18w14-captures.log
exit "${PIPESTATUS[0]}"

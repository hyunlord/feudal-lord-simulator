#!/usr/bin/env bash
# LM-R2 on the DGX: the skin audit (scripts/uiSkinAudit.mjs) on the base UI states ($UI5_STATES, ~/fls-ui5-states) and
# the lord screens and decision cards of the lord2 states ($LMR2_STATES, ~/fls-lmr2-states; scripts/lmr2States.ts).
# The audit's captures stay in the run's .remote/ folder (they come back to .remote-runs/<run>/, not into the tree).
#   FLS_REMOTE_LABEL=render-LMR2-skin scripts/remote/run.sh render-LMR2-skin-<sha7> -- bash scripts/lmr2SkinAudit.sh
set -u
out=${1:-.remote/skin}
states=${UI5_STATES:-$HOME/fls-ui5-states}
lord2=${LMR2_STATES:-$HOME/fls-lmr2-states}
[ -f "$states/merchant-town.json" ] || { echo "no ui5 states in $states (scripts/ui5States.ts)"; exit 1; }
[ -f "$lord2/inherited.json" ] || { echo "no lord2 states in $lord2 (scripts/lmr2States.ts)"; exit 1; }
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node scripts/uiSkinAudit.mjs "$out" --url "$url" --states "$states" --states-lord2 "$lord2" 2>&1 | tee .remote/lmr2-skin.log
exit "${PIPESTATUS[0]}"

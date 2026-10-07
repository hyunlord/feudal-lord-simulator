#!/usr/bin/env bash
# LM-R2 (ledger area) on the DGX: the played-on states (scripts/lmr2LedgerStates.ts: a promise due within the season and
# on its day, the contested suit at each stage) into $LEDGER_STATES (~/fls-lmr2-ledger-states) when one is missing (or
# LEDGER_REBUILD_STATES=1), then the lord screen's 약속·소송 in the browser (scripts/lmr2LedgerCaptures.ts) on them and on
# the lord2 states ($LMR2_STATES, ~/fls-lmr2-states).
#   scripts/remote/run.sh render-LMR2-ledger-<sha7> -- bash scripts/lmr2LedgerCaptures.sh [out]
set -u
out=${1:-docs/verification/lmr2/ledger}
lord2=${LMR2_STATES:-$HOME/fls-lmr2-states}
states=${LEDGER_STATES:-$HOME/fls-lmr2-ledger-states}
if [ ! -f "$states/ledger2.json" ] || [ "${LEDGER_REBUILD_STATES:-0}" = 1 ]; then
  node_modules/.bin/tsx scripts/lmr2LedgerStates.ts "$states" 2>&1 | tee .remote/lmr2-ledger-states.log || exit 1
fi
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$states/ledger2.json" "$out/ledger2.json"
node_modules/.bin/tsx scripts/lmr2LedgerCaptures.ts "$out" --url "$url" --lord2 "$lord2" --ledger2 "$states" 2>&1 | tee .remote/lmr2-ledger-captures.log
exit "${PIPESTATUS[0]}"

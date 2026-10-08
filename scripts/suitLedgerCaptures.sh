#!/usr/bin/env bash
# SUIT-THREAD (renderer A) on the DGX: the lord screen's 약속·소송 with the lord sued and forewarned (scripts/suitLedgerCaptures.ts)
# on the lord2 states ($LMR2_STATES, ~/fls-lmr2-states) — neighbour-suit and the suit-<name>.json states played on from
# it by commands (scripts/suitLedgerStates.ts) — and on Astra's lordplay2 final save.
#   scripts/remote/run.sh render-SUIT-ledger-captures-<sha7> --light -- bash scripts/suitLedgerCaptures.sh [out]
set -u
out=${1:-docs/verification/suit/suit-ledger}
lord2=${LMR2_STATES:-$HOME/fls-lmr2-states}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out" && cp "$lord2/suit-ledger-states.json" "$out/states.json" 2>/dev/null
node_modules/.bin/tsx scripts/suitLedgerCaptures.ts "$out" --url "$url" --lord2 "$lord2" 2>&1 | tee .remote/suit-ledger-captures.log
exit "${PIPESTATUS[0]}"

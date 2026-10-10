#!/usr/bin/env bash
# RECEIPTS on the DGX: a few heavy answers in the browser on the real states, the card before and its receipt after, at
# 1280 × 800 and the tablet's 1180 × 820 (scripts/receiptsCaptures.mjs) — the petition states ($PETITION_STATES,
# ~/fls-lmr1-petition-states), the lord states ($LORD_STATES, ~/fls-lord-states), the lord2 states ($LMR2_STATES, ~/fls-lmr2-states).
#   scripts/remote/run.sh render-RECEIPTS-captures --light -- bash scripts/receiptsCaptures.sh [out]
set -u
out=${1:-docs/verification/receipts}
petitions=${PETITION_STATES:-$HOME/fls-lmr1-petition-states}
lord=${LORD_STATES:-$HOME/fls-lord-states}
lord2=${LMR2_STATES:-$HOME/fls-lmr2-states}
for file in "$petitions/home-boundary_dispute.json" "$lord/registry-offer-hold.json" "$lord2/audit-pending.json" "$lord2/inherited.json"; do
  [ -f "$file" ] || { echo "missing state $file"; exit 1; }
done
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/receiptsCaptures.mjs "$out" --url "$url" --lord "$lord" --petitions "$petitions" --lord2 "$lord2" 2>&1 | tee .remote/receipts-captures.log
exit "${PIPESTATUS[0]}"

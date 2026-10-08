#!/usr/bin/env bash
# DEC-CARD (lord cards) on the DGX: the lord-mode decision cards in the heavy layout on the real states — the petition
# states ($PETITION_STATES, ~/fls-lmr1-petition-states), the lord states ($LORD_STATES, ~/fls-lord-states) and the lord2
# states ($LMR2_STATES, ~/fls-lmr2-states), all already built — in the browser (scripts/decCardLordCaptures.mjs).
#   scripts/remote/run.sh render-DECCARD-lordcards-<sha7> --light -- bash scripts/decCardLordCaptures.sh [out]
set -u
out=${1:-docs/verification/deccard/lordcards}
petitions=${PETITION_STATES:-$HOME/fls-lmr1-petition-states}
lord=${LORD_STATES:-$HOME/fls-lord-states}
lord2=${LMR2_STATES:-$HOME/fls-lmr2-states}
for file in "$petitions/home-boundary_dispute.json" "$petitions/request.json" "$lord/registry-offer.json" "$lord/registry-offer-hold.json" "$lord2/will-change.json" "$lord2/offer-countered.json"; do
  [ -f "$file" ] || { echo "missing state $file"; exit 1; }
done
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh
fls_serve .remote/vite.log --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort
url="http://127.0.0.1:$port/"
for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
mkdir -p "$out"
node_modules/.bin/tsx scripts/decCardLordCaptures.mjs "$out" --url "$url" --lord "$lord" --petitions "$petitions" --lord2 "$lord2" 2>&1 | tee .remote/deccard-lordcards.log
exit "${PIPESTATUS[0]}"

#!/usr/bin/env bash
# ECON-UI gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-ECONUI --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/econUiVerification.sh
# The ale replay's states (scripts/install3States.ts, into ~/fls-econ-ale-states) and UI-6's war states
# (~/fls-ui6-states, wool_payment), the captures (scripts/econUiCaptures.ts: the town's ale on the ledger, a store and
# the season card; the barley lock; the wool levy's in-kind line without and with a pasture), then UI-6's set into
# docs/verification/econ-ui/ui6 (skin audit, HUD area, tutorial, touch targets, replays, focus).
set -u
out=docs/verification/econ-ui
ale=$HOME/fls-econ-ale-states
war=${UI6_STATES:-$HOME/fls-ui6-states}
mkdir -p "$out/gates" "$ale"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step states npx tsx scripts/install3States.ts "$ale"
step captures npx tsx scripts/econUiCaptures.ts "$out/captures" --url "$URL" --ale "$ale" --war "$war"
printf '%s\n' "${results[@]}" > "$out/gates/econ-exit-codes.txt"
# `captures`: the states and the captures alone (a rerun of the evidence).
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=$war UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

#!/usr/bin/env bash
# NAT-1 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-NAT1 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/nat1Verification.sh [captures]
# Occlusion and door props before → after with the whole-town counts (scripts/nat1Captures.ts), the text boxes in normal
# and 1.4× copy (scripts/nat1TextCaptures.ts), the audit tour's land states (scripts/nat1LandStates.ts, cached in
# ~/fls-nat1-lands), then UI-6's set into docs/verification/nat1/ui6 (skin audit with its floating-box frame rule, HUD
# area, tutorial, touch targets, replays, focus). Each step runs even when one fails.
set -u
out=docs/verification/nat1
ui9=${UI9_STATES:-$HOME/fls-ui9-states}; lands=${NAT1_LANDS:-$HOME/fls-nat1-lands}
mkdir -p "$out/gates"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
[ -f "$lands/open_field.json" ] || step lands npx tsx scripts/nat1LandStates.ts "$lands" 30000
step occlusion npx tsx scripts/nat1Captures.ts "$out/captures" --url "$URL" --base "$BASE_URL" --states "$ui9" --extra "$HOME/fls-ui8-states/plague.empty_streets.json" --extra fixtures/saves/v31/chapter-four-town.save.json
step text npx tsx scripts/nat1TextCaptures.ts "$out/text" --url "$URL" --states "$ui9" --lands "$lands"
printf '%s\n' "${results[@]}" > "$out/gates/nat1-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=$ui9 bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

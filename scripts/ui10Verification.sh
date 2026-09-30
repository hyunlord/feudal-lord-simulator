#!/usr/bin/env bash
# UI-10 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI10 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui10Verification.sh [captures]
# Chapter 5's states (scripts/ui10States.ts, seed 2's bot through the legacy and its interlude to the last market day
# of 1450, cached in ~/fls-ui10-states), the six endings' saves (scripts/ui10EndingSaves.ts, scenario L9's, cached in
# ~/fls-ui10-endings), the replay captures world → UI (scripts/ui10Captures.ts: each step and interlude event, the six
# petition cards, the season strip, the faction tab after 1399, the ledger, the stores, the empty manor, the campaign's
# end and the chronicle book, the six endings), then UI-6's set into docs/verification/ui10/ui6 (skin audit with
# chapters 3–5's blocks, HUD area, tutorial, touch targets, replays, focus). Each step runs even when one fails.
set -u
out=docs/verification/ui10
states=${UI10_STATES:-$HOME/fls-ui10-states}
endings=${UI10_ENDINGS:-$HOME/fls-ui10-endings}
mkdir -p "$out/gates" "$states" "$endings"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/chapter5-end.json" ] || [ ! -f "$states/campaign-victory.json" ]; then step states npx tsx scripts/ui10States.ts 2 640000 "$states"; fi
if [ "$(ls "$endings"/*.json 2>/dev/null | wc -l)" -lt 6 ]; then step endings npx tsx scripts/ui10EndingSaves.ts "$endings"; fi
cp "$states/moments-legacy.json" "$out/gates/" 2>/dev/null || true
step captures npx tsx scripts/ui10Captures.ts "$out/captures" --url "$URL" --states "$states" --endings "$endings"
printf '%s\n' "${results[@]}" > "$out/gates/ui10-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=${UI9_STATES:-$HOME/fls-ui9-states} UI10_STATES=$states bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

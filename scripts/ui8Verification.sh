#!/usr/bin/env bash
# UI-8 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI8 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui8Verification.sh [captures]
# Chapter 3's states (scripts/ui8States.ts, seed 2's bot through the Black Death, cached in ~/fls-ui8-states), the
# replay captures world → UI (scripts/ui8Captures.ts: rumour → arrival → the four decisions → resettlement → chapter
# end, with the wage ledger, the chronicle and the family tree), then UI-6's set into docs/verification/ui8/ui6 (skin
# audit with chapter 3's block, HUD area, tutorial, touch targets, replays, focus). Each step runs even when one fails.
set -u
out=docs/verification/ui8
states=${UI8_STATES:-$HOME/fls-ui8-states}
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/chapter3-end.json" ]; then step states npx tsx scripts/ui8States.ts 2 280000 "$states"; fi
cp "$states/moments-plague.json" "$out/gates/" 2>/dev/null || true
step captures npx tsx scripts/ui8Captures.ts "$out/captures" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/ui8-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=$states bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

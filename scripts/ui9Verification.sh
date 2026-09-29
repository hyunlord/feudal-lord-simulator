#!/usr/bin/env bash
# UI-9 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI9 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui9Verification.sh [captures]
# Chapter 4's states (scripts/ui9States.ts, seed 2's bot through the reorganisation and both rumours of 1381, cached
# in ~/fls-ui9-states), the replay captures world → UI (scripts/ui9Captures.ts: each step, the four decisions, the world
# close up, the faction tab and page, the rights tab, the ledger), then UI-6's set into docs/verification/ui9/ui6 (skin
# audit with chapter 3's and chapter 4's blocks, HUD area, tutorial, touch targets, replays, focus). Each step runs
# even when one fails.
set -u
out=docs/verification/ui9
states=${UI9_STATES:-$HOME/fls-ui9-states}
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/chapter4-end.json" ] || [ ! -f "$states/rumour-chased.json" ]; then step states npx tsx scripts/ui9States.ts 2 480000 "$states"; fi
cp "$states/moments-reorg.json" "$out/gates/" 2>/dev/null || true
step captures npx tsx scripts/ui9Captures.ts "$out/captures" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/ui9-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=$states bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

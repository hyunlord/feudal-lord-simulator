#!/usr/bin/env bash
# UI-9b gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI9B --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui9bVerification.sh [captures]
# The captures before → after (scripts/ui9bCaptures.ts: the arms, the commons' pressure cell, the collector, chapters
# 3–5's openings and the chronicle's chapter starts, the pastoral farm) from UI-9's, UI-6's and CLOTH-UI's cached states,
# then UI-6's set into docs/verification/ui9b/ui6 (skin audit with chapter 3's and chapter 4's blocks, HUD area,
# tutorial, touch targets, replays, focus). Each step runs even when one fails.
set -u
out=docs/verification/ui9b
ui9=${UI9_STATES:-$HOME/fls-ui9-states}; ui6=${UI6_STATES:-$HOME/fls-ui6-states}; cloth=${CLOTH_STATES:-$HOME/fls-cloth-states}
mkdir -p "$out/gates"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
for file in "$ui9/chapter4-end.json" "$ui9/rumour-chased.json" "$ui9/chapter3-end.json" "$ui6/chapter2-end.json" "$cloth/c2-fleece.json"; do
  [ -f "$file" ] || { echo "missing state $file"; exit 2; }
done
step captures npx tsx scripts/ui9bCaptures.ts "$out/captures" --url "$URL" --base "$BASE_URL" --states "$ui9" --states6 "$ui6" --cloth "$cloth"
printf '%s\n' "${results[@]}" > "$out/gates/ui9b-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=$ui6 UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=$ui9 bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

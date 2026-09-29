#!/usr/bin/env bash
# CLOTH-UI gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-CLOTH --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/clothVerification.sh [captures]
# C5's human path (scripts/clothStates.ts: the chapter-four town, pasture → shearing → yarn → cloth → fulling → dyeing
# → tenter → the first sale, cached in ~/fls-cloth-states), the captures world → UI (scripts/clothCaptures.ts), then
# UI-6's set into docs/verification/cloth-ui/ui6 (skin audit with chapter 3's block, HUD area, tutorial, touch
# targets, replays, focus). Each step runs even when one fails.
set -u
out=docs/verification/cloth-ui
states=${CLOTH_STATES:-$HOME/fls-cloth-states}
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/c9-season-after.json" ]; then step states npx tsx scripts/clothStates.ts "$states"; fi
cp "$states/moments-cloth.json" "$out/gates/" 2>/dev/null || true
step captures npx tsx scripts/clothCaptures.ts "$out/captures" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/cloth-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

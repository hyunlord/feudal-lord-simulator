#!/usr/bin/env bash
# UI-7b gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI7B --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui7bVerification.sh [hud]
# UI-7's states (scripts/ui7States.ts), the biography and person-card captures (scripts/ui7bCaptures.ts: a commoner's
# covered shield and circle, the developer display, the lord's arms), then UI-6's set into docs/verification/ui7b/ui6
# (HUD area — chapter 1's idle screen with its margin —, skin audit, tutorial, touch targets, replays, focus).
set -u
out=docs/verification/ui7b
states=$HOME/fls-ui7-states
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
# `hud`: the HUD area measure alone, with its shots and masks (docs/verification/ui7b/gates/hud).
if [ "${1:-}" = "hud" ]; then step hud npx tsx scripts/measureHudCoverage.ts "$out/gates/hud/hud.json" --url "$URL" --shots "$out/gates/hud/shots"; printf '%s\n' "${results[@]}"; exit 0; fi
step states npx tsx scripts/ui7States.ts "$states"
step captures npx tsx scripts/ui7bCaptures.ts "$out/captures" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/ui7b-exit-codes.txt"
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

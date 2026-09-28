#!/usr/bin/env bash
# INSTALL-3b gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-INSTALL3B --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/install3bVerification.sh [chain]
# ① the wall works' tags (scripts/install3bWallCaptures.ts: trunk vs this build at zoom 1, zoom 1.35, the works
# selected) and the HUD area measure with the chapter 2 wall works state (scripts/measureHudCoverage.ts); ②/④ the ale
# chain's human path replayed from a well-fed start (scripts/install3States.ts) and captured world → UI with each
# subject checked inside its crop (scripts/install3ChainCaptures.ts); ③ the season card's population line is in the
# chain's 09b shot. Then UI-6's regression set as INSTALL-3 ran it (skin audit, tutorial, touch targets, replays).
# Each step runs even when one before it fails.
set -u
out=docs/verification/install3b
states=$HOME/fls-install3b-states
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
# `chain`: the chain captures alone, on the states a run before left in $states.
if [ "${1:-}" = "chain" ]; then step chain npx tsx scripts/install3ChainCaptures.ts "$out/chain" --url "$URL" --states "$states"; printf '%s\n' "${results[@]}"; exit 0; fi
step walls npx tsx scripts/install3bWallCaptures.ts "$out/walls" --url "$URL" --base "$BASE_URL"
step hud-coverage npx tsx scripts/measureHudCoverage.ts "$out/gates/hud-coverage.json" --url "$URL" --shots "$out/gates/hud-shots"
step states npx tsx scripts/install3States.ts "$states"
cp "$states/moments.json" "$states/food.json" "$out/gates/" 2>/dev/null || true
step chain npx tsx scripts/install3ChainCaptures.ts "$out/chain" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/install3b-exit-codes.txt"
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

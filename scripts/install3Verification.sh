#!/usr/bin/env bash
# INSTALL-3 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-INSTALL3 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/install3Verification.sh
# ③ UI-6's set (the chapter 2 captures, the skin audit this and base, HUD area, tutorial, touch targets, input / touch /
# gamepad replays, focus return: scripts/ui6Verification.sh all) into docs/verification/install3; then the ale chain's
# human path as states (scripts/install3States.ts), ① the chain world → UI (scripts/install3ChainCaptures.ts), ② the
# world captures at zoom 1.0 / 0.6 (scripts/install3WorldCaptures.ts) and the UI captures (scripts/install3UiCaptures.ts).
# Each step runs even when one before it fails.
set -u
out=docs/verification/install3
states=$HOME/fls-install3-states
UI6_OUT=$out UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step states npx tsx scripts/install3States.ts "$states"
step chain npx tsx scripts/install3ChainCaptures.ts "$out/chain" --url "$URL" --states "$states"
step world npx tsx scripts/install3WorldCaptures.ts "$out/world" --url "$URL" --states "$states"
step ui npx tsx scripts/install3UiCaptures.ts "$out/ui" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/install3-exit-codes.txt"
printf '%s\n' "${results[@]}"

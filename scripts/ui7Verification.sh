#!/usr/bin/env bash
# UI-7 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI7 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui7Verification.sh [captures]
# The states (scripts/ui7States.ts: the v24 town left to run — the lord's family, a baby, the four conditions, the
# bailiff), then the captures (scripts/ui7Captures.ts: the L3 lord's tree, the miller's wide tree and folded, a baby's
# face, the five state ornaments with their ledger sentences), then UI-6's set into docs/verification/ui7/ui6 (skin
# audit, HUD area with the chapter 2 wall works, tutorial, touch targets, input / touch / gamepad replays, focus).
# Each step runs even when one before it fails.
set -u
out=docs/verification/ui7
states=$HOME/fls-ui7-states
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step states npx tsx scripts/ui7States.ts "$states"
cp "$states/moments.json" "$out/gates/" 2>/dev/null || true
step captures npx tsx scripts/ui7Captures.ts "$out/captures" --url "$URL" --states "$states"
printf '%s\n' "${results[@]}" > "$out/gates/ui7-exit-codes.txt"
# `captures`: the states and the captures alone (a rerun after a trunk merge).
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

#!/usr/bin/env bash
# INSTALL-26~29 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-INSTALL26 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/install26Verification.sh [captures|perf]
# ① the 1340 town before and after at zoom 1.0 and 0.6, the backyards, the countryside, the water in six paused frames,
# winter (scripts/install26Captures.ts on UI-6's states); ② the landscape's frame cost against the trunk
# (scripts/install26Perf.mjs, p95 ≤ 110 %); then UI-6's set into docs/verification/install26/ui6 (skin audit, HUD area,
# tutorial, touch targets, replays, focus). Each step runs even when one before it fails.
set -u
out=docs/verification/install26
war=${UI6_STATES:-$HOME/fls-ui6-states}
mkdir -p "$out/gates"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ "${1:-}" != "perf" ]; then step captures npx tsx scripts/install26Captures.ts "$out/captures" --url "$URL" --base "$BASE_URL" --states "$war"; fi
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
step perf node scripts/install26Perf.mjs "$out/gates/perf.json" --url "$URL" --base "$BASE_URL" --states "$war"
printf '%s\n' "${results[@]}" > "$out/gates/install26-exit-codes.txt"
if [ "${1:-}" = "perf" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=$war UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

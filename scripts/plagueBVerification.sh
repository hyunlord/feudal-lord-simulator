#!/usr/bin/env bash
# PLAGUE-b gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-PLAGUEB --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/plagueBVerification.sh [captures]
# UI-8's chapter 3 states (scripts/ui8States.ts, cached in ~/fls-ui8-states): the plague-emptied houses up close with
# and without their boards (scripts/plagueBCaptures.ts, compared by scripts/plagueBMarkBoards.py), chapter 3's start
# in the chronicle and chapter 3's opening screen after chapter 2's page (UI-6's chapter2-end state), then UI-6's set into docs/verification/plague-b/ui6 (skin audit with chapter 3's block, HUD area,
# tutorial, touch targets, replays, focus). Each step runs even when one fails.
set -u
out=docs/verification/plague-b
states=${UI8_STATES:-$HOME/fls-ui8-states}
mkdir -p "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/chapter3-end.json" ]; then step states npx tsx scripts/ui8States.ts 2 280000 "$states"; fi
step captures npx tsx scripts/plagueBCaptures.ts "$out/captures" --url "$URL" --states "$states" --states6 "${UI6_STATES:-$HOME/fls-ui6-states}"
step mark python3 scripts/plagueBMarkBoards.py "$out/captures"
printf '%s\n' "${results[@]}" > "$out/gates/plague-b-exit-codes.txt"
if [ "${1:-}" = "captures" ]; then printf '%s\n' "${results[@]}"; exit 0; fi
UI6_OUT=$out/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=$states bash scripts/ui6Verification.sh all
printf '%s\n' "${results[@]}"

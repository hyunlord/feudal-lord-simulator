#!/usr/bin/env bash
# INSTALL-23 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-INSTALL23 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/install23Verification.sh
# ⑦ UI-6's set (the chapter 2 captures, the skin audit this and base, HUD area, tutorial, touch targets, input / touch /
# gamepad replays, focus return: scripts/ui6Verification.sh all) into docs/verification/install23; then ① the royal arms
# (scripts/install23RoyalCaptures.ts), ② the weathers (scripts/weatherCaptures.ts), ③ the village life
# (scripts/villageLifeCaptures.ts), ④ ⑤ the person states and pad glyphs (scripts/install23UiCaptures.ts) and ⑥ the
# weather's frame cost against the trunk (scripts/install23Perf.mjs). Each step runs even when one before it fails.
set -u
out=docs/verification/install23
states=${UI6_STATES:-$HOME/fls-ui6-states}
UI6_OUT=$out UI6_STATES=$states UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step royal npx tsx scripts/install23RoyalCaptures.ts "$out/royal" --url "$URL" --states "$states"
step weather npx tsx scripts/weatherCaptures.ts "$out/weather" --url "$URL" --state "$states/wool_payment.json"
step life npx tsx scripts/villageLifeCaptures.ts "$out/life" --url "$URL" --states "$states"
step ui npx tsx scripts/install23UiCaptures.ts "$out/ui" --url "$URL" --states "$states"
step perf node scripts/install23Perf.mjs "$out/gates/perf.json" --url "$URL" --base "$BASE_URL"
printf '%s\n' "${results[@]}" > "$out/gates/install23-exit-codes.txt"
printf '%s\n' "${results[@]}"

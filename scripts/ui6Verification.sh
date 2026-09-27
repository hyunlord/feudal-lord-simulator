#!/usr/bin/env bash
# UI-6 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI6 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui6Verification.sh [captures|audit|all]
# ①–④ the chapter 2 captures (scripts/ui6Captures.ts) on the states of scripts/ui6States.ts (the seed 2 war run and
# FAIL-3's naive seed 3, kept between runs in ~/fls-ui6-states: both are deterministic); ⑤ the skin audit on UI-5's
# states and chapter 2's (this build and, for the before count, the trunk before); with `all`, ⑥ the UX-3 regression
# set as UX-0b ran it (HUD area, the tutorial's steps this and base, touch targets, B9 input replay vs base, TOUCH-1
# touch replay, gamepad replay, focus return). Each step runs even when one before it fails; the summary lists the codes.
set -u
mode=${1:-all}
out=docs/verification/ui6
states=${UI6_STATES:-$HOME/fls-ui6-states}
states5=${UI5_STATES:-$HOME/fls-ui5-states}
mkdir -p "$out/captures" "$out/audit" "$out/audit-base" "$out/gates" "$states" "$states5"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/chapter2-end.json" ]; then step states-war npx tsx scripts/ui6States.ts war 2 260000 "$states"; fi
if [ ! -f "$states/house-change.json" ]; then step states-house npx tsx scripts/ui6States.ts house 3 80000 "$states"; fi
if [ ! -f "$states5/merchant-town.json" ]; then step states5 npx tsx scripts/ui5States.ts 2 200000 "$states5"; fi
cp "$states/moments-war.json" "$states/moments-house.json" "$out/gates/" 2>/dev/null || true
if [ "$mode" = "captures" ] || [ "$mode" = "all" ]; then
  step captures npx tsx scripts/ui6Captures.ts "$out/captures" --url "$URL" --states "$states"
fi
if [ "$mode" = "audit" ] || [ "$mode" = "all" ]; then
  step audit node scripts/uiSkinAudit.mjs "$out/audit" --url "$URL" --states "$states5" --states6 "$states"
  step audit-base node scripts/uiSkinAudit.mjs "$out/audit-base" --url "$BASE_URL" --states "$states5"
fi
if [ "$mode" = "all" ]; then
  mkdir -p "$out/gates/replay" "$out/gates/replay-base" "$out/gates/gamepad"
  step hud-coverage npx tsx scripts/measureHudCoverage.ts "$out/gates/hud-coverage.json" --url "$URL"
  step tutorial node scripts/tutorialReplay.mjs "$out/gates/replay" --url "$URL"
  step tutorial-base node scripts/tutorialReplay.mjs "$out/gates/replay-base" --url "$BASE_URL"
  step touch-targets node scripts/touchTargetAudit.mjs "$out/gates/touch-targets.json" --url "$URL"
  step touch-targets-base node scripts/touchTargetAudit.mjs "$out/gates/touch-targets-base.json" --url "$BASE_URL"
  step input-replay node scripts/inputReplayCompare.mjs "$out/gates/input-replay.json" --base "$BASE_URL" --url "$URL"
  step touch-replay node scripts/touchReplayCompare.mjs "$out/gates/touch-replay.json" --url "$URL"
  step gamepad node scripts/gamepadReplay.mjs "$out/gates/gamepad" --url "$URL"
  step focus-return node scripts/focusReturnCheck.mjs "$out/gates/focus-return.json" --base "$BASE_URL" --url "$URL"
  printf '%s\n' "${results[@]}" > "$out/gates/exit-codes.txt"
  step gates node scripts/ux3GateSummary.mjs "$out/gates"
  cat "$out/gates/gates.json"
fi
printf '%s\n' "${results[@]}"

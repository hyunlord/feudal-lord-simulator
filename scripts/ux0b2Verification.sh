#!/usr/bin/env bash
# UX-0b2 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UX0B2 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ux0b2Verification.sh [captures|all]
# The MARKET-1 and WALL-2 captures (scripts/ux0b2Captures.mjs) on the states of scripts/ux0b2States.ts (the seed 1
# determinism town and the seed 3 walled town, fixtures both: made on each run); with `all`, the UX-3 regression set as
# UX-0b ran it: per-state HUD area, the tutorial's 13 steps (this and base), touch targets, B9 input replay vs base,
# TOUCH-1 touch replay, gamepad replay and focus return. Each step runs even when one before it fails.
set -u
mode=${1:-all}
out=docs/verification/ux0b2
states=$(mktemp -d)
mkdir -p "$out/captures" "$out/gates"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step states npx tsx scripts/ux0b2States.ts "$states"
cp "$states/moments.json" "$out/gates/moments.json" 2>/dev/null || true
step captures node scripts/ux0b2Captures.mjs "$out/captures" --url "$URL" --states "$states"
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
rm -rf "$states"
printf '%s\n' "${results[@]}"

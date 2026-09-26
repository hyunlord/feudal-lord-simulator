#!/usr/bin/env bash
# CHRON-1 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-CHRON1 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/chron1Verification.sh [captures|all]
# ①–⑤ the chronicle captures (scripts/chron1Captures.mjs) on the seed 2 chapter 1 state (scripts/chron1States.ts, kept
# between runs in ~/fls-chron1-states: the bot run is deterministic); with `all`, ⑥ the UX-3 regression set as UX-0b
# ran it: per-state HUD area, the tutorial's 13 steps (this and base), touch targets, B9 input replay vs base, TOUCH-1
# touch replay, gamepad replay and focus return. Each step runs even when one before it fails; the summary lists the codes.
set -u
mode=${1:-all}
out=docs/verification/chron1
states=${CHRON1_STATES:-$HOME/fls-chron1-states}
mkdir -p "$out/captures" "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/chapter-end.json" ]; then step states npx tsx scripts/chron1States.ts 2 200000 "$states"; fi
cp "$states/chapter-end.summary.json" "$out/gates/chapter-end.summary.json" 2>/dev/null || true
step captures node scripts/chron1Captures.mjs "$out/captures" --url "$URL" --states "$states"
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

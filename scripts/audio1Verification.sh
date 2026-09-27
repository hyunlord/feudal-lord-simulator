#!/usr/bin/env bash
# AUDIO-1 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-AUDIO1 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/audio1Verification.sh [captures|all]
# ①② the sound captures (scripts/audio1Captures.mjs: the bank played, spectrum logs of a season's change, a market day
# and a fire, 5x, the town's bus) on the seed 2 moments (scripts/audio1States.ts, kept between runs in
# ~/fls-audio1-states); ③ frame work with the sound on against base (scripts/audio1Perf.mjs); with `all`, ④ the UX-3
# regression set as UX-0b ran it. Each step runs even when one before it fails; the summary lists the codes.
set -u
mode=${1:-all}
out=docs/verification/audio1
states=${AUDIO1_STATES:-$HOME/fls-audio1-states}
mkdir -p "$out/captures" "$out/gates" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/market-day.json" ] || [ ! -f "$states/wet-summer.json" ]; then step states npx tsx scripts/audio1States.ts 2 120000 "$states"; fi
cp "$states/moments.json" "$out/gates/moments.json" 2>/dev/null || true
step captures node scripts/audio1Captures.mjs "$out/captures" --url "$URL" --states "$states"
step perf node scripts/audio1Perf.mjs "$out/gates/perf.json" --url "$URL" --base "$BASE_URL" --states "$states"
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

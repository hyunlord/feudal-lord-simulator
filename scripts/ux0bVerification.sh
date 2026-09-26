#!/usr/bin/env bash
# UX-0b gates ③④ on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh ux0b -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ux0bVerification.sh
# The UX-3 regression set after the cold start fixes: per-state HUD area (measureHudCoverage), the tutorial's 13 steps
# by card buttons (this and base, same press count), TOUCH-1 targets, B9 input replay vs base, TOUCH-1 touch replay,
# gamepad replay and focus return. Each step runs even when one before it fails; the summary lists the exit codes.
set -u
out=docs/verification/ux0b/gates
mkdir -p "$out/replay" "$out/replay-base" "$out/gamepad"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step hud-coverage npx tsx scripts/measureHudCoverage.ts "$out/hud-coverage.json" --url "$URL"
step tutorial node scripts/tutorialReplay.mjs "$out/replay" --url "$URL"
step tutorial-base node scripts/tutorialReplay.mjs "$out/replay-base" --url "$BASE_URL"
step touch-targets node scripts/touchTargetAudit.mjs "$out/touch-targets.json" --url "$URL"
step touch-targets-base node scripts/touchTargetAudit.mjs "$out/touch-targets-base.json" --url "$BASE_URL"
step input-replay node scripts/inputReplayCompare.mjs "$out/input-replay.json" --base "$BASE_URL" --url "$URL"
step touch-replay node scripts/touchReplayCompare.mjs "$out/touch-replay.json" --url "$URL"
step gamepad node scripts/gamepadReplay.mjs "$out/gamepad" --url "$URL"
step focus-return node scripts/focusReturnCheck.mjs "$out/focus-return.json" --base "$BASE_URL" --url "$URL"
printf '%s\n' "${results[@]}" > "$out/exit-codes.txt"
step gates node scripts/ux3GateSummary.mjs "$out"
cat "$out/gates.json"

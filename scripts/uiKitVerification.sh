#!/usr/bin/env bash
# UI-KIT-1 gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UIKIT1 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/uiKitVerification.sh [audit|perf|all]
# ① ③ the skin audit and the gallery (scripts/uiSkinAudit.mjs) on the states of scripts/ui5States.ts (kept between runs
# in ~/fls-ui5-states; deterministic), the same audit on the trunk before for the before count; ④ before/after captures
# (scripts/uiKitCaptures.mjs); with `perf` or `all`, ⑥ the kit's frame and chronicle cost (scripts/uiKitPerf.mjs); with `all`,
# ⑤ the UX-3 regression set as UX-0b ran it. Each step runs even when one
# before it fails; the summary lists the codes.
set -u
mode=${1:-all}
# UIKIT_OUT: another task's evidence folder (RES-REG: docs/verification/resreg), so a later run keeps UI-KIT-1's.
out=${UIKIT_OUT:-docs/verification/uikit1}
states=${UI5_STATES:-$HOME/fls-ui5-states}
mkdir -p "$out/audit" "$out/audit-base" "$out/gates" "$out/captures" "$states"
declare -a results=()
step() { local name=$1; shift; "$@" > "$out/gates/$name.log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
if [ ! -f "$states/merchant-town.json" ]; then step states npx tsx scripts/ui5States.ts 2 200000 "$states"; fi
step audit node scripts/uiSkinAudit.mjs "$out/audit" --url "$URL" --states "$states"
step audit-base node scripts/uiSkinAudit.mjs "$out/audit-base" --url "$BASE_URL" --states "$states"
if [ -f scripts/sceneStateRefusalProof.mjs ]; then step scene-refusal node scripts/sceneStateRefusalProof.mjs "$out/gates/scene-refusal.json" --url "$URL" --old fixtures/determinism/seed1/final-state.json --current "$states/chapter-end.json"; fi
if [ -f scripts/uiKitCaptures.mjs ] && [ "${UIKIT_CAPTURES:-1}" = 1 ]; then step captures node scripts/uiKitCaptures.mjs "$out/captures" --url "$URL" --base "$BASE_URL" --states "$states"; fi
if [ "$mode" = "perf" ] || [ "$mode" = "all" ]; then step perf node scripts/uiKitPerf.mjs "$out/gates/perf.json" --url "$URL" --base "$BASE_URL" --states "$states"; fi
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

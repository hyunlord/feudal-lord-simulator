#!/usr/bin/env bash
# INSTALL-15 gates on the DGX:
#   scripts/remote/run.sh install15 -- bash scripts/install15Verification.sh
# The evidence states (the C25 zoned board in four seasons, two turns, the two effect windows), the captures (four
# seasons at zoom 1.0 / 0.6, close views, effects, the turns at 1x with the one-frame change measured in the page),
# the browser determinism check (same state twice, the second from a scene rebuilt in reverse) and save determinism.
set -u
out=docs/verification/install15
mkdir -p "$out"
npx tsx scripts/install15States.ts .remote/install15-states > "$out/states.log" 2>&1; echo "states exit $?"
node scripts/install15Captures.mjs "$out/captures" --url "$URL" --states .remote/install15-states > "$out/captures.log" 2>&1; echo "captures exit $?"
node scripts/boundaryEvidence.mjs determinism "$out/browser-determinism.json" --url "$URL" > "$out/determinism.log" 2>&1; echo "browser-determinism exit $?"
npm run --silent verify:save-determinism > "$out/save-determinism.log" 2>&1; echo "save-determinism exit $?"
tail -3 "$out/save-determinism.log"

#!/usr/bin/env bash
# UI-3 gates on the DGX beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh ui3 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui3Verification.sh
# The UX-3 gate set (area per state, tutorial, B9 / TOUCH-1 replays) must still hold, then the UI-3 captures:
# season cards and the card off, the strip, the naive-bot pressure town, the lean season, title -> mode -> continue.
set -u
out=docs/verification/ui3
mkdir -p "$out"
bash scripts/ux3Verification.sh
mkdir -p "$out/ux3-gates" && cp -r docs/verification/ux3r/. "$out/ux3-gates/" && rm -rf docs/verification/ux3r
npx tsx scripts/ui3PressureState.ts 1 16000 .remote/pressure-seed1.json > "$out/pressure-state.log" 2>&1; echo "pressure-state exit $?"
node scripts/ui3Captures.mjs "$out/captures" --url "$URL" --pressure .remote/pressure-seed1.json > "$out/captures.log" 2>&1; echo "captures exit $?"

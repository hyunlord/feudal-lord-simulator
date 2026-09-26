#!/usr/bin/env bash
# UI-4b gates on the DGX:
#   scripts/remote/run.sh ui4b -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui4bVerification.sh
# The seed 2 chapter 1 season states (the bot) and the season ledger card captures; the UX-3 HUD area gate (the card
# is one of its states).
set -u
out=docs/verification/ui4b
mkdir -p "$out"
npx tsx scripts/ui4bSeasonStates.ts 2 90000 .remote/ui4b-states > "$out/season-states.log" 2>&1; echo "season-states exit $?"
node scripts/ui4bCaptures.mjs "$out/captures" --url "$URL" --states .remote/ui4b-states > "$out/captures.log" 2>&1; echo "captures exit $?"
cp .remote/ui4b-states/moments.json "$out/moments.json" 2>/dev/null || true
npx tsx scripts/measureHudCoverage.ts "$out/hud-coverage.json" --url "$URL" > "$out/hud-coverage.log" 2>&1; echo "hud-coverage exit $?"

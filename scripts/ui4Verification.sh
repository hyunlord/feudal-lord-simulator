#!/usr/bin/env bash
# UI-4 gates on the DGX beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh ui4 -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui4Verification.sh
# The UX-3 / UX-3R2 gate set (area per state, tutorial, B9 / TOUCH-1 replays, gamepad, focus, touch targets and the
# UX-3R2 captures) into docs/verification/ui4/ux3-gates, then the seed 2 chapter 1 states (the bot) and the UI-4
# captures: world before UI for the first fire, the wet summer, the famine, the petition and the chapter's end; the
# famine answer round trip; the chronicle page and the chapter 2 preview; S12.
set -u
out=docs/verification/ui4
mkdir -p "$out"
UX3_OUT="$out/ux3-gates" bash scripts/ux3r2Verification.sh
npx tsx scripts/ui4ChapterStates.ts 2 90000 .remote/ui4-states > "$out/chapter-states.log" 2>&1; echo "chapter-states exit $?"
node scripts/ui4Captures.mjs "$out/captures" --url "$URL" --states .remote/ui4-states > "$out/captures.log" 2>&1; echo "captures exit $?"
cp .remote/ui4-states/moments.json "$out/moments.json" 2>/dev/null || true

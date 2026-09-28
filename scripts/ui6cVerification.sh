#!/usr/bin/env bash
# UI-6c gates on the DGX, this build ($URL) beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-UI6C --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/ui6cVerification.sh
# UI-6's set (scripts/ui6Verification.sh all) into docs/verification/ui6c: the HUD area measure with the chapter 2 wall
# works state (the folded chapter chip must bring 1280 x 800 inside 6 %), the skin audit, tutorial, touch targets and
# the replays; with the shots of the area measure kept (gates/hud-shots).
set -u
UI6_OUT=docs/verification/ui6c UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} bash scripts/ui6Verification.sh all
mkdir -p docs/verification/ui6c/gates/hud-shots
npx tsx scripts/measureHudCoverage.ts docs/verification/ui6c/gates/hud-coverage-walls.json --url "$URL" --shots docs/verification/ui6c/gates/hud-shots --only walls

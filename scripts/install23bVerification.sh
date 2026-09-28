#!/usr/bin/env bash
# INSTALL-23b and BUDGET-1 on the DGX, this build at $URL (scripts/remote/with-base-build.sh's dev server):
#   scripts/remote/run.sh render-INSTALL23b -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/install23bVerification.sh
# INSTALL-23b: the rain, props and pause captures (scripts/install23bCaptures.ts, ui6 states). BUDGET-1: the dist
# budget of this checkout (scripts/checks/distBudget.mjs --build) and the image loading / decoded memory walk of the
# chapter-1-end state (scripts/imageMemoryProbe.mjs; the state from scripts/ui4ChapterStates.ts, kept between runs in
# ~/fls-ui4-chapter-states: deterministic). Each step runs even when one before it fails.
set -u
states6=${UI6_STATES:-$HOME/fls-ui6-states}
states4=${UI4_STATES:-$HOME/fls-ui4-chapter-states}
mkdir -p docs/verification/install23b/dgx docs/verification/budget1/dgx "$states4"
declare -a results=()
step() { local name=$1 log=$2; shift 2; "$@" > "$log" 2>&1; local code=$?; results+=("$name=$code"); echo "$name exit $code"; }
step captures docs/verification/install23b/dgx/captures.log npx tsx scripts/install23bCaptures.ts docs/verification/install23b/dgx --url "$URL" --states "$states6"
step budget docs/verification/budget1/dgx/budget.log node scripts/checks/distBudget.mjs --build --json docs/verification/budget1/dgx/dist-budget.json
if [ ! -f "$states4/chapter-end.json" ]; then step state docs/verification/budget1/dgx/state.log npx tsx scripts/ui4ChapterStates.ts 2 90000 "$states4"; fi
step probe docs/verification/budget1/dgx/probe.log node scripts/imageMemoryProbe.mjs --url "$URL" --state "$states4/chapter-end.json" --out docs/verification/budget1/dgx/image-memory-dgx.json
printf '%s\n' "${results[@]}" | tee docs/verification/budget1/dgx/exit-codes.txt

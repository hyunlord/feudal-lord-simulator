#!/usr/bin/env bash
# SMOOTH-2R gates on the DGX, this build ($URL): UI-6's set into docs/verification/smooth2r/ui6 (skin audit with its
# floating-box frame rule, HUD area, tutorial, touch targets, replays, focus) — the regressions beside perf:gate, which
# runs on the Mac's real Chrome window only (scripts/perf/perfGate.ts).
#   scripts/remote/run.sh render-S2R --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/smooth2rVerification.sh
set -u
UI6_OUT=docs/verification/smooth2r/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=${UI9_STATES:-$HOME/fls-ui9-states} bash scripts/ui6Verification.sh all

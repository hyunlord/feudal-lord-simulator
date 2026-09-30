#!/usr/bin/env bash
# NAT-2 gates on the DGX, this build ($URL) beside the trunk before it: UI-6's set into docs/verification/nat2/ui6 (skin
# audit with the NAT-2 rules for unpainted surfaces and flat drawers, HUD area, the slot-chip overlap check, tutorial,
# touch targets, replays, focus). perf:gate runs on the Mac's real Chrome window only (scripts/perf/perfGate.ts); the
# standing-people share (scripts/nat2Standing.ts) needs a Vite dev server and runs locally.
#   scripts/remote/run.sh render-NAT2 --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/nat2Verification.sh
set -u
UI6_OUT=docs/verification/nat2/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=${UI9_STATES:-$HOME/fls-ui9-states} bash scripts/ui6Verification.sh all

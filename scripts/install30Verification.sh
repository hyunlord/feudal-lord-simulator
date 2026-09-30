#!/usr/bin/env bash
# INSTALL-30~33 gates on the DGX: UI-6's regression set (skin audit incl. chapter 3–5 blocks, HUD area, slot chips,
# tutorial, touch targets, B9 / touch / gamepad replays, focus) into docs/verification/install30/ui6, this build ($URL)
# beside the trunk before it ($BASE_URL):
#   scripts/remote/run.sh render-INSTALL30-reg --detach -- bash scripts/remote/with-base-build.sh <trunk-sha> -- bash scripts/install30Verification.sh
set -u
UI6_OUT=docs/verification/install30/ui6 UI6_STATES=${UI6_STATES:-$HOME/fls-ui6-states} UI5_STATES=${UI5_STATES:-$HOME/fls-ui5-states-v22} \
  UI8_STATES=${UI8_STATES:-$HOME/fls-ui8-states} UI9_STATES=${UI9_STATES:-$HOME/fls-ui9-states} UI10_STATES=${UI10_STATES:-$HOME/fls-ui10-states} \
  bash scripts/ui6Verification.sh "${1:-all}"

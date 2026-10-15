#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
node_modules/.bin/tsx docs/verification/eb-weight-live56/acquire024.mjs /home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-1/ck_evt_031-consequence-h-018721.save.json.gz .remote/eb-weight-024-acquire

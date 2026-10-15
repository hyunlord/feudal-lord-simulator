#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
# One bounded official experiment; the preserved real raw-state SHA is checked before admission.
node_modules/.bin/tsx docs/verification/eb-weight-live56/acquireAudit.mjs \
  /home/hyunlord/fls-lmr2-states/audit-pending.json .remote/eb-weight-audit-acquire

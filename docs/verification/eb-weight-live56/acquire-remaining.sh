#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
[ "$#" -eq 1 ] || { echo 'Usage: acquire-remaining.sh CASE_ID' >&2; exit 1; }
# Exactly one case per invocation. Submit through the ordinary run.sh FAIR-LINE queue.
node_modules/.bin/tsx docs/verification/eb-weight-live56/acquireRemaining.mjs "$1" ".remote/eb-weight-acquire-remaining/$1"

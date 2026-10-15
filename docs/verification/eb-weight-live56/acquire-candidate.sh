#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
[ "$#" -eq 1 ] || { echo 'Usage: acquire-candidate.sh attention|contested' >&2; exit 1; }
case "$1" in
  attention) input=/home/hyunlord/fls-lmr2-states/attention-overloaded.json ;;
  contested) input=/home/hyunlord/fls-lmr2-states/contested.json ;;
  *) echo 'Only attention or contested is allowed' >&2; exit 1 ;;
esac
# One case per official FAIR-LINE experiment. No parallel invocation or existing runner changes.
node_modules/.bin/tsx docs/verification/eb-weight-live56/acquireCandidate.mjs "$1" "$input" ".remote/eb-weight-candidate-$1"

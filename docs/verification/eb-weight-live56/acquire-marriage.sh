#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
[ "$#" -eq 1 ] || { echo 'Usage: acquire-marriage.sh marriage|small-rights' >&2; exit 1; }
case "$1" in
  marriage) input=/home/hyunlord/fls-lord-states/registry-offer.json ;;
  small-rights) input=/home/hyunlord/fls-lmr2-states/inherited.json ;;
  *) echo 'Only marriage or small-rights is allowed' >&2; exit 1 ;;
esac
# One case per official FAIR-LINE experiment; never parallelize these cases.
node_modules/.bin/tsx docs/verification/eb-weight-live56/acquireMarriage.mjs "$1" "$input" ".remote/eb-weight-acquire-$1"

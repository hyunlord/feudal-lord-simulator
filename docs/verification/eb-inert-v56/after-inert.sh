#!/usr/bin/env bash
set -euo pipefail
expected=${1:?pass the frozen verification commit}
previous=engineB-V56-inert-d4c9249
host=${FLS_REMOTE_HOST:-hyunlord@100.70.109.50}
test "$(git rev-parse HEAD)" = "$expected"
test -z "$(git status --porcelain)"
while ! ssh -o BatchMode=yes -o ConnectTimeout=15 "$host" \
  'test -f ~/fls-runs/engineB-V56-inert-d4c9249/.remote/exit-code || test -f ~/fls-runs/_kept/engineB-V56-inert-d4c9249/.remote/exit-code'; do
  sleep 60
done
set +e
bash scripts/remote/run.sh --fetch "$previous"
fetch_exit=$?
set -e
printf 'INERT fetch/measurement exit: %s\n' "$fetch_exit"
test "$(git rev-parse HEAD)" = "$expected"
test -z "$(git status --porcelain)"
bash scripts/remote/run.sh engineB-V56-four --heavy --experiment --detach --keep -- bash docs/verification/eb-inert-v56/four-tests.sh

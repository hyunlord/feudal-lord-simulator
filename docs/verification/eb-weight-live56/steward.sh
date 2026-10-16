#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
git diff --exit-code 5ade799acb870c00d3fab7f52fe1ca88279854ed HEAD -- src package.json package-lock.json
case_id=${1:?one steward case per official experiment}
case "$case_id" in 034|058|144|163) ;; *) exit 2 ;; esac
out=".remote/eb-weight-live56/steward-$case_id"
mkdir -p "$out"
git rev-parse HEAD > "$out/source-revision.txt"
. scripts/remote/devServers.sh
fls_serve "$out/vite.log" --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
url="http://127.0.0.1:$FLS_REMOTE_PORT/"
for _ in $(seq 1 90); do
  if curl -sf "$url" > /dev/null; then break; fi
  sleep 1
done
curl -sf "$url" > /dev/null
node_modules/.bin/tsx docs/verification/eb-weight-live56/stewardCase.mjs /home/hyunlord/fls-runs/_kept/engineB-answer-json-92bbc7d-92bbc7d/.remote/eb-answer-replay/seed-1 "$out" "$url" "$case_id"

#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
git diff --exit-code 0b9e1a6bbb7c6b47cd19b5a1f1358dedde6afa96 HEAD -- src package.json package-lock.json
out=".remote/eb-weight-046-cancel"
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
node_modules/.bin/tsx docs/verification/eb-weight-live56/answer046.mjs docs/verification/eb-weight-024-input/evidence "$out" "$url"

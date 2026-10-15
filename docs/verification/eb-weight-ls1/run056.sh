#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
git diff --exit-code 0eddc146c7d57b4cae091bff62295a1fc16e1f97 HEAD -- src package.json package-lock.json
out=.remote/eb-weight-056-ls1
mkdir -p "$out"
. scripts/remote/devServers.sh
fls_serve "$out/vite.log" --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$FLS_REMOTE_PORT" --strictPort
url="http://127.0.0.1:$FLS_REMOTE_PORT/"
for _ in $(seq 1 90); do
  if curl -sf "$url" > /dev/null; then break; fi
  sleep 1
done
curl -sf "$url" > /dev/null
node_modules/.bin/tsx docs/verification/eb-weight-ls1/event056.mjs /home/hyunlord/fls-variant-states/home-056.json "$out" "$url"

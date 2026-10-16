#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
git diff --exit-code 00125eb96838ea1143d496c41953159d631e6bd3 HEAD -- src package.json package-lock.json
case_id=${1:?One acquired answer case per experiment}
case "$case_id" in 052|038|059|051|010|209) ;; *) exit 2 ;; esac
input=$(node -e 'const fs=require("node:fs"); const cases=JSON.parse(fs.readFileSync("docs/verification/eb-weight-live56/acquired-answer-cases.json")); console.log(cases.find(c=>c.id===process.argv[1]).remoteDirectory)' "$case_id")
out=".remote/eb-weight-acquired-answer/$case_id"
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
node_modules/.bin/tsx docs/verification/eb-weight-live56/answerAcquired.mjs "$case_id" "$input" "$out" "$url"

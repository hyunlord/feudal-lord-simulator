#!/usr/bin/env bash
set -euo pipefail
[ "$(uname -s)" = Linux ]
: "${FLS_REMOTE_PORT:?Official runner required}"
grep -q '^SLOT=heavy$' .remote-in/meta.env
grep -q '^RUN_CLASS=experiment$' .remote-in/meta.env
[ -z "$(git status --porcelain)" ]
git diff --exit-code 0b9e1a6bbb7c6b47cd19b5a1f1358dedde6afa96 HEAD -- src package.json package-lock.json
case_id=${1:?one case per official experiment}
case "$case_id" in
  130|206) echo "LS1-8 must land on main and this audit baseline must be reviewed before replaying $case_id" >&2; exit 2;;
esac
out=".remote/eb-weight-live56/$case_id"
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
if [ "$case_id" = 024-keep ]; then
  node_modules/.bin/tsx docs/verification/eb-weight-live56/answer024.mjs /home/hyunlord/fls-runs/_kept/engineB-weight024-input-ef5a483/.remote/eb-weight-024-acquire "$out" "$url"
else
  node_modules/.bin/tsx docs/verification/eb-weight-live56/liveCase.mjs /home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints "$out" "$url" "$case_id"
fi

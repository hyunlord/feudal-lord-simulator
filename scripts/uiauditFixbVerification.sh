#!/usr/bin/env bash
# UI-AUDIT-1 fix group B on the DGX: the chronicle / legacy surfaces measured and captured on this build and the base
# (docs/verification/uiaudit1/fixb):
#   scripts/remote/run.sh render-UIAUDIT-fixb-<sha7> -- bash scripts/uiauditFixbVerification.sh <base-sha>
# Two dev servers (the pseudo-long copy is a dev transform); the base worktree outside the run folder, as
# scripts/uiauditTokensVerification.sh (one Vite watching the other's tree passes the DGX's inotify limit).
set -u
base_sha=${1:?base sha}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
base_port=$((port + 50))
dir=${TMPDIR:-/tmp}/fls-base-$port
git worktree remove --force "$dir" 2>/dev/null || true
git worktree add -q --detach "$dir" "$base_sha"
ln -sfn "$PWD/node_modules" "$dir/node_modules"
node_modules/.bin/vite --host 127.0.0.1 --port "$port" --strictPort > .remote/vite-this.log 2>&1 &
this=$!
(cd "$dir" && exec node_modules/.bin/vite --host 127.0.0.1 --port "$base_port" --strictPort) > .remote/vite-base.log 2>&1 &
base=$!
trap 'kill $this $base 2>/dev/null; git worktree remove --force "$dir" 2>/dev/null || true' EXIT
for url in "http://127.0.0.1:$port/" "http://127.0.0.1:$base_port/"; do
  for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
done
node_modules/.bin/tsx scripts/uiauditFixbCaptures.mjs docs/verification/uiaudit1/fixb --url "http://127.0.0.1:$port/" --base "http://127.0.0.1:$base_port/" \
  --states5 "${UI5_STATES:-$HOME/fls-ui5-states-v22}" --states9 "${UI9_STATES:-$HOME/fls-ui9-states}" --states10 "${UI10_STATES:-$HOME/fls-ui10-states}" \
  2>&1 | tee .remote/fixb-captures.log

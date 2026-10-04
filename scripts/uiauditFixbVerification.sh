#!/usr/bin/env bash
# UI-AUDIT-1 fix group B on the DGX: the chronicle / legacy surfaces measured and captured on this build and the base
# (docs/verification/uiaudit1/fixb):
#   scripts/remote/run.sh render-UIAUDIT-fixb-<sha7> -- bash scripts/uiauditFixbVerification.sh <base-sha>|none [out]
# (`none`: this build alone; `out`: the folder, default docs/verification/uiaudit1/fixb.)
# Two dev servers (the pseudo-long copy is a dev transform); the base worktree outside the run folder, as
# scripts/uiauditTokensVerification.sh (one Vite watching the other's tree passes the DGX's inotify limit).
set -u
base_sha=${1:?base sha or none}
out=${2:-docs/verification/uiaudit1/fixb}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
base_port=${FLS_REMOTE_BASE_PORT:?run through scripts/remote/run.sh (its second port)}
dir=${TMPDIR:-/tmp}/fls-base-$port
. scripts/remote/devServers.sh   # both servers stop on any exit, failures and a stopped run included
fls_serve .remote/vite-this.log --host 127.0.0.1 --port "$port" --strictPort
this=$FLS_SERVE_PID
base=""
urls="http://127.0.0.1:$port/"
if [ "$base_sha" != none ]; then
  git worktree remove --force "$dir" 2>/dev/null || true
  git worktree add -q --detach "$dir" "$base_sha"
  ln -sfn "$PWD/node_modules" "$dir/node_modules"
  fls_serve .remote/vite-base.log --in "$dir" --host 127.0.0.1 --port "$base_port" --strictPort
  base=$FLS_SERVE_PID
  urls="$urls http://127.0.0.1:$base_port/"
fi
fls_on_exit '[ -n "$base" ] && git worktree remove --force "$dir" 2>/dev/null || true'
for url in $urls; do
  for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
done
base_flag=()
[ -n "$base" ] && base_flag=(--base "http://127.0.0.1:$base_port/")
node_modules/.bin/tsx scripts/uiauditFixbCaptures.mjs "$out" --url "http://127.0.0.1:$port/" "${base_flag[@]}" \
  --states5 "${UI5_STATES:-$HOME/fls-ui5-states-v22}" --states9 "${UI9_STATES:-$HOME/fls-ui9-states}" --states10 "${UI10_STATES:-$HOME/fls-ui10-states}" \
  2>&1 | tee .remote/fixb-captures.log

#!/usr/bin/env bash
# UI-AUDIT-1 frame tokens on the DGX: the skin audit (UI-6's set, docs/verification/install30/ui6) and the four before /
# after captures (docs/verification/uiaudit1/tokens-shots), this build beside the trunk before it:
#   scripts/remote/run.sh render-UIAUDIT-tokens-<sha7> --detach -- bash scripts/uiauditTokensVerification.sh <base-sha> [shots]
# (`shots`: the captures alone).
# As scripts/remote/with-base-build.sh, but the base worktree lives outside the run folder: this build's Vite watches its
# whole root, and with the base inside it the two servers pass the DGX's 65536 inotify watches (ENOSPC, the run's Vite
# dies at start).
set -u
base_sha=${1:?base sha}
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
base_port=${FLS_REMOTE_BASE_PORT:?run through scripts/remote/run.sh (its second port)}
dir=${TMPDIR:-/tmp}/fls-base-$port
git worktree remove --force "$dir" 2>/dev/null || true
git worktree add -q --detach "$dir" "$base_sha"
ln -sfn "$PWD/node_modules" "$dir/node_modules"
. scripts/remote/devServers.sh   # both servers stop on any exit, failures and a stopped run included
fls_serve .remote/vite-this.log --host 127.0.0.1 --port "$port" --strictPort
this=$FLS_SERVE_PID
fls_serve .remote/vite-base.log --in "$dir" --host 127.0.0.1 --port "$base_port" --strictPort
base=$FLS_SERVE_PID
fls_on_exit 'git worktree remove --force "$dir" 2>/dev/null || true'
export URL="http://127.0.0.1:$port/" BASE_URL="http://127.0.0.1:$base_port/"
for url in "$URL" "$BASE_URL"; do
  for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
done
echo "this $URL · base $BASE_URL ($base_sha)"
[ "${2:-}" = "shots" ] || bash scripts/install30Verification.sh audit
node scripts/uiauditTokenCaptures.mjs docs/verification/uiaudit1/tokens-shots --url "$URL" --base "$BASE_URL" --states "${UI5_STATES:-$HOME/fls-ui5-states-v22}"

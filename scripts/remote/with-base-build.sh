#!/usr/bin/env bash
# Before / after evidence on the DGX (render sessions): serve this run folder and a base commit side by side, then run
# a command with URL (this tree) and BASE_URL (the base) set. The base is a git worktree of <base-sha> under .remote/
# sharing this folder's node_modules; both Vite servers stop when the command ends.
#   scripts/remote/run.sh <label> -- bash scripts/remote/with-base-build.sh <base-sha> -- node scripts/x.mjs out --url '$URL' --base '$BASE_URL'
set -euo pipefail
base_sha=$1; shift; [ "${1:-}" = "--" ] && shift
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
base_port=$((port + 50))
dir=.remote/base-build
git worktree remove --force "$dir" 2>/dev/null || true
git worktree add -q --detach "$dir" "$base_sha"
ln -sfn "$PWD/node_modules" "$dir/node_modules"
# No file watching (viteNoWatch.config.ts): this folder's server would also watch the base worktree under .remote/, and
# two watched trees ran the DGX out of inotify watches (ENOSPC, NAT-4).
node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$port" --strictPort > .remote/vite-this.log 2>&1 &
this=$!
(cd "$dir" && exec node_modules/.bin/vite --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$base_port" --strictPort) > .remote/vite-base.log 2>&1 &
base=$!
trap 'kill $this $base 2>/dev/null; git worktree remove --force "$dir" 2>/dev/null || true' EXIT
export URL="http://127.0.0.1:$port/" BASE_URL="http://127.0.0.1:$base_port/"
for url in "$URL" "$BASE_URL"; do
  for _ in $(seq 1 90); do curl -sf "$url" > /dev/null && break; sleep 1; done
  curl -sf "$url" > /dev/null || { echo "vite did not come up on $url"; exit 1; }
done
echo "this $URL · base $BASE_URL ($base_sha)"
bash -c "$*"
